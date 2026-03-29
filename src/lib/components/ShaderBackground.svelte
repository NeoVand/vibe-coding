<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
    import type { ShaderParams } from '$lib/shaderParams';
    import { audioState } from '$lib/stores/audio';
    import { activeThemeStore } from '$lib/stores/theme';
    import { vertexShader, fragmentShader } from '$lib/shaders/cloud-tunnel';
    import { vertexShader as cosmosVertex, fragmentShader as cosmosFragment } from '$lib/shaders/themes/cosmos/index';

	let { params, activeTheme = 'clouds' }: { params: ShaderParams; activeTheme?: string } = $props();

    // Theme shader lookup
    const themeShaders: Record<string, { vertex: string; fragment: string }> = {
        clouds: { vertex: vertexShader, fragment: fragmentShader },
        cosmos: { vertex: cosmosVertex, fragment: cosmosFragment },
    };

    let currentThemeId = activeTheme;

    // Track theme from store (polled in animate loop, not reactive effect)
    let latestStoreTheme = 'clouds';
    const themeUnsub = activeThemeStore.subscribe(v => { latestStoreTheme = v; });

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let renderer: THREE.WebGLRenderer;
	let material: THREE.ShaderMaterial;
	let animationId: number;
    let resizeObserver: ResizeObserver;
    let noiseTex: THREE.Texture;
    let blueNoiseTex: THREE.Texture;
    let isPortrait = false;
    let camera: THREE.OrthographicCamera;
    let scene: THREE.Scene;
    let geometry: THREE.PlaneGeometry;

    // Integration state variables
    let camZ = 0;
    let vortexPhase = 0;

    // Precision-safe time wrapping constants
    // iTime wraps at 10000s (~2.7 hours) - well within float32 precision
    // All iTime multipliers in shaders (0.05, 0.02, 0.1, 0.15, 0.2, 0.25, 0.35)
    // produce smooth values at this range. The wrap is invisible because noise
    // functions only care about fractional parts after floor/fract operations.
    const TIME_WRAP_PERIOD = 10000.0;
    // Vortex phase wraps at 2*PI since it's only used in sin/cos
    const VORTEX_WRAP = Math.PI * 2;
    // camZ wraps at a large multiple of all path periods to avoid visible jumps
    // Path freqs are 0.2 and 0.15, so sin periods are 2*PI/0.2=31.4 and 2*PI/0.15=41.9
    // LCM period ≈ 209.4. We use 100x that for safety.
    const CAMZ_WRAP = 20944.0;

    // Noise transition state
    let noiseTypeA = params.noiseMethod;
    let noiseTypeB = params.noiseMethod;
    let noiseMix = 0;

    // Theme transition state: fade-through-black
    let themeFade = 1.0;          // 1.0 = fully visible, 0.0 = black
    let pendingThemeSwap: string | null = null;  // Theme ID waiting to be applied at black
    const THEME_FADE_SPEED = 1.5; // Speed of fade (full fade in ~0.67s)

    // Helper for color interpolation
    const colorTargets = {
        bgColor: new THREE.Color(params.bgColor),
        lightColor1: new THREE.Color(params.lightColor1),
        lightColor2: new THREE.Color(params.lightColor2),
        cloudBaseCol: new THREE.Color(params.cloudBaseCol),
        cloudShadowCol: new THREE.Color(params.cloudShadowCol),
        sunGlowCol: new THREE.Color(params.sunGlowCol),
        sunCoreCol: new THREE.Color(params.sunCoreCol),
        sunGlareCol: new THREE.Color(params.sunGlareCol),
        lightningColor: new THREE.Color(params.lightningColor),
        nebulaColor1: new THREE.Color(params.nebulaColor1),
        nebulaColor2: new THREE.Color(params.nebulaColor2),
        nebulaColor3: new THREE.Color(params.nebulaColor3),
    };

	onMount(() => {
        if (!container || !canvas) return;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
        // Set initial background to match params immediately
        renderer.setClearColor(new THREE.Color(params.bgColor));
		// Initial setup will be handled by the effect below
		
		camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		scene = new THREE.Scene();
		geometry = new THREE.PlaneGeometry(2, 2);

        const loader = new THREE.TextureLoader();
        
        const base = import.meta.env.BASE_URL;
        const noisePath = `${base === '/' ? '' : base}/textures/noise.png`;
        const blueNoisePath = `${base === '/' ? '' : base}/textures/blue_noise.png`;
        
        noiseTex = loader.load(noisePath);
        noiseTex.wrapS = THREE.RepeatWrapping;
        noiseTex.wrapT = THREE.RepeatWrapping;
        noiseTex.minFilter = THREE.LinearMipMapLinearFilter;
        noiseTex.magFilter = THREE.LinearFilter;
        noiseTex.generateMipmaps = true;
        noiseTex.colorSpace = THREE.NoColorSpace;
        
        blueNoiseTex = loader.load(blueNoisePath);
        blueNoiseTex.wrapS = THREE.RepeatWrapping;
        blueNoiseTex.wrapT = THREE.RepeatWrapping;
        blueNoiseTex.minFilter = THREE.LinearMipMapLinearFilter; 
        blueNoiseTex.magFilter = THREE.LinearFilter;
        blueNoiseTex.generateMipmaps = true; 
        blueNoiseTex.colorSpace = THREE.NoColorSpace; 

        // Use the correct shader for the initial theme (from store/localStorage)
        const initialTheme = themeShaders[latestStoreTheme] || themeShaders['clouds'];
        currentThemeId = latestStoreTheme;

		material = new THREE.ShaderMaterial({
			vertexShader: initialTheme.vertex,
			fragmentShader: initialTheme.fragment,
			uniforms: {
				iTime: { value: 0 },
                uCamZ: { value: 0 },
                uVortexPhase: { value: 0 },
                uNoisePhase: { value: 0 },
				iResolution: { value: new THREE.Vector3(1, 1, 1) },
                iChannel0: { value: noiseTex },
                iChannel1: { value: blueNoiseTex },
                LOOK: { value: params.look },
                NOISE_METHOD: { value: params.noiseMethod },
                uNoiseTypeA: { value: params.noiseMethod },
                uNoiseTypeB: { value: params.noiseMethod },
                uNoiseMix: { value: 0 },
                USE_LOD: { value: params.useLod },
                RENDER_STEPS: { value: params.renderSteps },
                DRAW_DIST: { value: params.drawDist },
                CAM_SPEED: { value: params.camSpeed },
                CAM_FOV: { value: params.camFov },
                CAM_ROLL_AMP: { value: params.camRollAmp },
                CAM_ROLL_FREQ: { value: params.camRollFreq },
                CAM_LOOK_AHEAD: { value: params.camLookAhead },
                SUN_PATH_OFFSET: { value: params.sunPathOffset },
                TUNNEL_RADIUS: { value: params.tunnelRadius },
                PATH_AMP_X: { value: params.pathAmpX },
                PATH_FREQ_X: { value: params.pathFreqX },
                PATH_AMP_Y: { value: params.pathAmpY },
                PATH_FREQ_Y: { value: params.pathFreqY },
                VORTEX_SPEED: { value: params.vortexSpeed },
                VORTEX_TWIST: { value: params.vortexTwist },
                NOISE_SCALE_BASE: { value: params.noiseScaleBase },
                NOISE_SCALE_DET: { value: params.noiseScaleDet },
                CLOUD_DENSITY: { value: params.cloudDensity },
                BG_COLOR: { value: new THREE.Color(params.bgColor) },
                LIGHT_COLOR_1: { value: new THREE.Color(params.lightColor1) },
                LIGHT_COLOR_2: { value: new THREE.Color(params.lightColor2) },
                CLOUD_BASE_COL: { value: new THREE.Color(params.cloudBaseCol) },
                CLOUD_SHADOW_COL: { value: new THREE.Color(params.cloudShadowCol) },
                FOG_DENSITY: { value: params.fogDensity },
                SUN_GLOW_COL: { value: new THREE.Color(params.sunGlowCol) },
                SUN_GLOW_POW: { value: params.sunGlowPow },
                SUN_CORE_COL: { value: new THREE.Color(params.sunCoreCol) },
                SUN_CORE_POW: { value: params.sunCorePow },
                SUN_GLARE_COL: { value: new THREE.Color(params.sunGlareCol) },
                SUN_GLARE_POW: { value: params.sunGlarePow },
                LIGHTNING_ENABLED: { value: params.lightningEnabled },
                LIGHTNING_CHANCE: { value: params.lightningChance },
                LIGHTNING_COLOR: { value: new THREE.Color(params.lightningColor) },
                LIGHTNING_INTENSITY: { value: params.lightningIntensity },
                LIGHTNING_AUDIO_SYNC: { value: params.lightningAudioSync || 0 },
                AUDIO_BEAT: { value: 0 },
                AUDIO_BASS: { value: 0 },
                AUDIO_MID: { value: 0 },
                AUDIO_HIGH: { value: 0 },
                uFadeAlpha: { value: 1.0 },
                // Cosmos uniforms
                NEBULA_DENSITY: { value: params.nebulaDensity },
                NEBULA_FALLOFF: { value: params.nebulaFalloff },
                NEBULA_COLOR_1: { value: new THREE.Color(params.nebulaColor1) },
                NEBULA_COLOR_2: { value: new THREE.Color(params.nebulaColor2) },
                NEBULA_COLOR_3: { value: new THREE.Color(params.nebulaColor3) },
                STAR_DENSITY: { value: params.starDensity },
                STAR_BRIGHTNESS: { value: params.starBrightness },
                STAR_GLOW_SIZE: { value: params.starGlowSize },
                SPIRAL_ARMS: { value: params.spiralArms },
                SPIRAL_TWIST: { value: params.spiralTwist },
			}
		});

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		const resize = () => {
            if (!container || !renderer) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            // Check orientation for mobile optimization (No longer needed for state, but useful for debug if needed)
            // isPortrait = height > width;
            
            // Dynamic Resolution Scaling
            // 1. Cap the pixel ratio (e.g., stop at 1.5x even on 3x screens)
            const pixelRatio = Math.min(window.devicePixelRatio, params.pixelRatioCap);
            renderer.setPixelRatio(pixelRatio);
            
            // 2. Apply internal render scaling (e.g., render at 0.5x resolution, stretch to fit)
            // efficient way to gain massive FPS on 4K
            renderer.setSize(width * params.renderScale, height * params.renderScale, false);
            
            // IMPORTANT: Style must stretch the canvas to fill the container
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            
            // Update uniform to match the actual drawing buffer size
            const drawingBuffer = new THREE.Vector2();
            renderer.getDrawingBufferSize(drawingBuffer);
			material.uniforms.iResolution.value.set(drawingBuffer.x, drawingBuffer.y, 1);

            // FIX: Render immediately to prevent flashing
            renderer.render(scene, camera);
		};

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
		// resize(); // Called in effect now

		const clock = new THREE.Clock();

		const animate = () => {
			animationId = requestAnimationFrame(animate);
            
            if (material) {
                const dt = clock.getDelta();

                // --- THEME SWITCHING — fade-through-black ---
                // 1. Request detected → start fading out
                if (latestStoreTheme !== currentThemeId && pendingThemeSwap === null) {
                    pendingThemeSwap = latestStoreTheme;
                }
                // 2. Fading logic
                if (pendingThemeSwap !== null) {
                    themeFade = Math.max(0.0, themeFade - dt * THEME_FADE_SPEED);
                    if (themeFade <= 0.0) {
                        // At full black — swap shader and snap uniforms
                        const newTheme = themeShaders[pendingThemeSwap];
                        if (newTheme) {
                            material.vertexShader = newTheme.vertex;
                            material.fragmentShader = newTheme.fragment;
                            material.needsUpdate = true;
                            currentThemeId = pendingThemeSwap;
                            material.uniforms.CLOUD_DENSITY.value = params.cloudDensity;
                            material.uniforms.TUNNEL_RADIUS.value = params.tunnelRadius;
                            material.uniforms.NOISE_SCALE_BASE.value = params.noiseScaleBase;
                            material.uniforms.NOISE_SCALE_DET.value = params.noiseScaleDet;
                            material.uniforms.FOG_DENSITY.value = params.fogDensity;
                            material.uniforms.DRAW_DIST.value = params.drawDist;
                            material.uniforms.NEBULA_DENSITY.value = params.nebulaDensity;
                            material.uniforms.NEBULA_FALLOFF.value = params.nebulaFalloff;
                            material.uniforms.STAR_BRIGHTNESS.value = params.starBrightness;
                            material.uniforms.STAR_DENSITY.value = params.starDensity;
                            material.uniforms.STAR_GLOW_SIZE.value = params.starGlowSize;
                            material.uniforms.VORTEX_SPEED.value = params.vortexSpeed;
                            material.uniforms.VORTEX_TWIST.value = params.vortexTwist;
                            // Snap colours
                            material.uniforms.NEBULA_COLOR_1.value.copy(colorTargets.nebulaColor1);
                            material.uniforms.NEBULA_COLOR_2.value.copy(colorTargets.nebulaColor2);
                            material.uniforms.NEBULA_COLOR_3.value.copy(colorTargets.nebulaColor3);
                        }
                        pendingThemeSwap = null;
                        // themeFade stays at 0 → will ramp back up below
                    }
                } else {
                    // Fade back in
                    themeFade = Math.min(1.0, themeFade + dt * THEME_FADE_SPEED);
                }

                // Wrap iTime to prevent float32 precision degradation over long sessions
                material.uniforms.iTime.value = clock.elapsedTime % TIME_WRAP_PERIOD;

                // Interpolation factor for smooth transitions
                // Value logic: 1.0 - exp(-dt * speed)
                // Speed 5.0 -> ~8% per frame (60fps) -> Fast
                // Speed 1.5 -> ~2.5% per frame (60fps) -> Slow/Graceful
                const lerpFactor = 1.0 - Math.exp(-dt * 0.5); 

                // --- ADAPTIVE ASPECT RATIO LOGIC ---
                // Calculate current aspect ratio (Width / Height)
                // Use container dimensions if possible, or internal resolution (though 'container' is safest for layout sync)
                const aspect = container.clientWidth / container.clientHeight;

                // 1. Adaptive FOV (Focal Length)
                // We want to widen the angle (decrease FOV value) as the aspect ratio decreases (gets narrower).
                // Formula: Smoothly transition from full FOV at >1.0 aspect to reduced FOV at <0.5 aspect.
                // Use a saturation curve: min(1.0, k * aspect)
                // At aspect 1.0 (square) -> Multiplier 1.0
                // At aspect 0.5 (phone)  -> Multiplier 0.7 (Widened view)
                // Base Formula: 0.4 + 0.6 * aspect (Clamped to 1.0)
                const fovAdjustment = Math.min(1.0, 0.4 + 0.6 * aspect);
                const targetFov = params.camFov * fovAdjustment;
                
                material.uniforms.CAM_FOV.value += (targetFov - material.uniforms.CAM_FOV.value) * lerpFactor;
                
                // 2. Adaptive Path Amplitude (X-Axis)
                // Reduce lateral swing on narrow screens so the camera doesn't look at walls.
                // Formula: min(1.0, aspect) - straight linear reduction.
                // At aspect 0.5 -> 50% amplitude.
                // At aspect 1.0 -> 100% amplitude.
                const ampAdjustment = Math.min(1.0, aspect);
                
                const targetAmpX = params.pathAmpX * ampAdjustment;
                material.uniforms.PATH_AMP_X.value += (targetAmpX - material.uniforms.PATH_AMP_X.value) * lerpFactor;

                material.uniforms.CAM_SPEED.value += (params.camSpeed - material.uniforms.CAM_SPEED.value) * lerpFactor;
                
                material.uniforms.CAM_ROLL_AMP.value += (params.camRollAmp - material.uniforms.CAM_ROLL_AMP.value) * lerpFactor;
                material.uniforms.CAM_ROLL_FREQ.value += (params.camRollFreq - material.uniforms.CAM_ROLL_FREQ.value) * lerpFactor;
                material.uniforms.CAM_LOOK_AHEAD.value += (params.camLookAhead - material.uniforms.CAM_LOOK_AHEAD.value) * lerpFactor;
                material.uniforms.SUN_PATH_OFFSET.value += (params.sunPathOffset - material.uniforms.SUN_PATH_OFFSET.value) * lerpFactor;
                
                material.uniforms.TUNNEL_RADIUS.value += (params.tunnelRadius - material.uniforms.TUNNEL_RADIUS.value) * lerpFactor;
                // Use Adaptive X Amp
                // material.uniforms.PATH_AMP_X.value set above
                material.uniforms.PATH_FREQ_X.value += (params.pathFreqX - material.uniforms.PATH_FREQ_X.value) * lerpFactor;
                material.uniforms.PATH_AMP_Y.value += (params.pathAmpY - material.uniforms.PATH_AMP_Y.value) * lerpFactor;
                material.uniforms.PATH_FREQ_Y.value += (params.pathFreqY - material.uniforms.PATH_FREQ_Y.value) * lerpFactor;
                
                material.uniforms.VORTEX_SPEED.value += (params.vortexSpeed - material.uniforms.VORTEX_SPEED.value) * lerpFactor;
                material.uniforms.VORTEX_TWIST.value += (params.vortexTwist - material.uniforms.VORTEX_TWIST.value) * lerpFactor;
                material.uniforms.NOISE_SCALE_BASE.value += (params.noiseScaleBase - material.uniforms.NOISE_SCALE_BASE.value) * lerpFactor;
                material.uniforms.NOISE_SCALE_DET.value += (params.noiseScaleDet - material.uniforms.NOISE_SCALE_DET.value) * lerpFactor;
                material.uniforms.CLOUD_DENSITY.value += (params.cloudDensity - material.uniforms.CLOUD_DENSITY.value) * lerpFactor;
                material.uniforms.DRAW_DIST.value += (params.drawDist - material.uniforms.DRAW_DIST.value) * lerpFactor;
                
                material.uniforms.FOG_DENSITY.value += (params.fogDensity - material.uniforms.FOG_DENSITY.value) * lerpFactor;
                material.uniforms.SUN_GLOW_POW.value += (params.sunGlowPow - material.uniforms.SUN_GLOW_POW.value) * lerpFactor;
                material.uniforms.SUN_CORE_POW.value += (params.sunCorePow - material.uniforms.SUN_CORE_POW.value) * lerpFactor;
                material.uniforms.SUN_GLARE_POW.value += (params.sunGlarePow - material.uniforms.SUN_GLARE_POW.value) * lerpFactor;
                
                material.uniforms.LIGHTNING_ENABLED.value = params.lightningEnabled;
                material.uniforms.LIGHTNING_CHANCE.value = params.lightningChance;
                material.uniforms.LIGHTNING_INTENSITY.value = params.lightningIntensity;

                material.uniforms.BG_COLOR.value.lerp(colorTargets.bgColor, lerpFactor);
                material.uniforms.LIGHT_COLOR_1.value.lerp(colorTargets.lightColor1, lerpFactor);
                material.uniforms.LIGHT_COLOR_2.value.lerp(colorTargets.lightColor2, lerpFactor);
                material.uniforms.CLOUD_BASE_COL.value.lerp(colorTargets.cloudBaseCol, lerpFactor);
                material.uniforms.CLOUD_SHADOW_COL.value.lerp(colorTargets.cloudShadowCol, lerpFactor);
                material.uniforms.SUN_GLOW_COL.value.lerp(colorTargets.sunGlowCol, lerpFactor);
                material.uniforms.SUN_CORE_COL.value.lerp(colorTargets.sunCoreCol, lerpFactor);
                material.uniforms.SUN_GLARE_COL.value.lerp(colorTargets.sunGlareCol, lerpFactor);
                material.uniforms.LIGHTNING_COLOR.value.lerp(colorTargets.lightningColor, lerpFactor);

                // --- INTEGRATION ---
                // Integrate position and rotation based on *current* smoothed speed
                // This prevents jumps when parameters change
                camZ += dt * material.uniforms.CAM_SPEED.value;
                vortexPhase += dt * material.uniforms.VORTEX_SPEED.value;

                // Wrap accumulated values to prevent float32 precision loss
                // camZ wraps at a path-period multiple so sin(camZ * freq) is continuous
                if (camZ > CAMZ_WRAP) camZ -= CAMZ_WRAP;
                if (camZ < -CAMZ_WRAP) camZ += CAMZ_WRAP;
                // Vortex phase only used in sin/cos, so wrap at 2*PI
                vortexPhase = ((vortexPhase % VORTEX_WRAP) + VORTEX_WRAP) % VORTEX_WRAP;

                // --- NOISE TRANSITION LOGIC ---
                const targetNoiseType = params.noiseMethod;
                
                if (noiseMix <= 0.0 && noiseTypeA !== targetNoiseType) {
                    noiseTypeB = targetNoiseType;
                    noiseMix = 0.001; 
                }
                
                if (noiseMix > 0.0) {
                    // Ease-in-out logic for smoother landing
                    // Instead of linear 0.0 -> 1.0, we use a smoothed curve
                    // But we need to drive the 't' linearly and apply easing to the uniform value
                    
                    noiseMix += dt * 0.5; // Base speed (approx 2 seconds)
                    
                    if (noiseMix >= 1.0) {
                        noiseMix = 0.0;
                        noiseTypeA = noiseTypeB;
                        // Ensure final state is exact
                        material.uniforms.uNoiseMix.value = 0.0;
                        material.uniforms.uNoiseTypeA.value = noiseTypeA;
                    } else {
                        // Smoothstep easing: 3t^2 - 2t^3
                        // This eases both start and end of the transition
                        const smoothMix = noiseMix * noiseMix * (3.0 - 2.0 * noiseMix);
                        material.uniforms.uNoiseMix.value = smoothMix;
                        
                        // Sync types during transition
                        material.uniforms.uNoiseTypeA.value = noiseTypeA;
                        material.uniforms.uNoiseTypeB.value = noiseTypeB;
                    }
                } else {
                    // Idle state
                     material.uniforms.uNoiseTypeA.value = noiseTypeA;
                     material.uniforms.uNoiseTypeB.value = noiseTypeB; // Prep for next
                }

                material.uniforms.uCamZ.value = camZ;
                material.uniforms.uVortexPhase.value = vortexPhase;
                // Pre-compute noise phase on CPU where we have float64 precision
                // This avoids the shader doing (uCamZ - iTime*0.5) with two large floats
                const wrappedTime = material.uniforms.iTime.value;
                material.uniforms.uNoisePhase.value = (camZ - wrappedTime * 0.5) % TIME_WRAP_PERIOD;
                
                // Update Audio Uniforms
                // Fallback to random mode if audio sync is requested but music is not playing
                const shouldUseAudio = params.lightningAudioSync && $audioState.isPlaying;
                material.uniforms.LIGHTNING_AUDIO_SYNC.value = shouldUseAudio ? 1 : 0;
                
                // Pass all audio data for theme-specific reactivity
                material.uniforms.AUDIO_BEAT.value = $audioState.beat;
                material.uniforms.AUDIO_BASS.value = $audioState.bass || 0;
                material.uniforms.AUDIO_MID.value = $audioState.mid || 0;
                material.uniforms.AUDIO_HIGH.value = $audioState.high || 0;

                // Cosmos uniforms (smooth lerp)
                material.uniforms.NEBULA_DENSITY.value += (params.nebulaDensity - material.uniforms.NEBULA_DENSITY.value) * lerpFactor;
                material.uniforms.NEBULA_FALLOFF.value += (params.nebulaFalloff - material.uniforms.NEBULA_FALLOFF.value) * lerpFactor;
                material.uniforms.STAR_DENSITY.value += (params.starDensity - material.uniforms.STAR_DENSITY.value) * lerpFactor;
                material.uniforms.STAR_BRIGHTNESS.value += (params.starBrightness - material.uniforms.STAR_BRIGHTNESS.value) * lerpFactor;
                material.uniforms.STAR_GLOW_SIZE.value += (params.starGlowSize - material.uniforms.STAR_GLOW_SIZE.value) * lerpFactor;
                material.uniforms.NEBULA_COLOR_1.value.lerp(colorTargets.nebulaColor1, lerpFactor);
                material.uniforms.NEBULA_COLOR_2.value.lerp(colorTargets.nebulaColor2, lerpFactor);
                material.uniforms.NEBULA_COLOR_3.value.lerp(colorTargets.nebulaColor3, lerpFactor);

                material.uniforms.uFadeAlpha.value = themeFade;
            }

			renderer.render(scene, camera);
		};

		animate();
	});

    $effect(() => {
        colorTargets.bgColor.set(params.bgColor);
        colorTargets.lightColor1.set(params.lightColor1);
        colorTargets.lightColor2.set(params.lightColor2);
        colorTargets.cloudBaseCol.set(params.cloudBaseCol);
        colorTargets.cloudShadowCol.set(params.cloudShadowCol);
        colorTargets.sunGlowCol.set(params.sunGlowCol);
        colorTargets.sunCoreCol.set(params.sunCoreCol);
        colorTargets.sunGlareCol.set(params.sunGlareCol);
        colorTargets.lightningColor.set(params.lightningColor);
        colorTargets.nebulaColor1.set(params.nebulaColor1);
        colorTargets.nebulaColor2.set(params.nebulaColor2);
        colorTargets.nebulaColor3.set(params.nebulaColor3);

        // Ensure clear color is synced with background color target to minimize flash artifact
        if (renderer) {
            renderer.setClearColor(colorTargets.bgColor);
        }

        // Theme switching handled in animate loop (polled from store)
        if (false) {
            const newTheme = themeShaders[activeTheme];
            if (newTheme) {
                material.vertexShader = newTheme.vertex;
                material.fragmentShader = newTheme.fragment;
                material.needsUpdate = true;
                currentThemeId = activeTheme;

                // Snap ALL structural uniforms instantly
                material.uniforms.CLOUD_DENSITY.value = params.cloudDensity;
                material.uniforms.TUNNEL_RADIUS.value = params.tunnelRadius;
                material.uniforms.NOISE_SCALE_BASE.value = params.noiseScaleBase;
                material.uniforms.NOISE_SCALE_DET.value = params.noiseScaleDet;
                material.uniforms.FOG_DENSITY.value = params.fogDensity;
                material.uniforms.DRAW_DIST.value = params.drawDist;
                material.uniforms.NEBULA_DENSITY.value = params.nebulaDensity;
                material.uniforms.NEBULA_FALLOFF.value = params.nebulaFalloff;
                material.uniforms.STAR_BRIGHTNESS.value = params.starBrightness;
                material.uniforms.STAR_DENSITY.value = params.starDensity;
                material.uniforms.VORTEX_SPEED.value = params.vortexSpeed;
                material.uniforms.VORTEX_TWIST.value = params.vortexTwist;
                // Snap colors
                material.uniforms.BG_COLOR.value.copy(colorTargets.bgColor);
                material.uniforms.LIGHT_COLOR_1.value.copy(colorTargets.lightColor1);
                material.uniforms.LIGHT_COLOR_2.value.copy(colorTargets.lightColor2);
                material.uniforms.CLOUD_BASE_COL.value.copy(colorTargets.cloudBaseCol);
                material.uniforms.CLOUD_SHADOW_COL.value.copy(colorTargets.cloudShadowCol);
                material.uniforms.SUN_GLOW_COL.value.copy(colorTargets.sunGlowCol);
                material.uniforms.SUN_CORE_COL.value.copy(colorTargets.sunCoreCol);
                material.uniforms.SUN_GLARE_COL.value.copy(colorTargets.sunGlareCol);
                material.uniforms.NEBULA_COLOR_1.value.copy(colorTargets.nebulaColor1);
                material.uniforms.NEBULA_COLOR_2.value.copy(colorTargets.nebulaColor2);
                material.uniforms.NEBULA_COLOR_3.value.copy(colorTargets.nebulaColor3);
            }
        }

        if (material) {
            material.uniforms.LOOK.value = params.look;
            material.uniforms.NOISE_METHOD.value = params.noiseMethod;
            material.uniforms.USE_LOD.value = params.useLod;
            material.uniforms.RENDER_STEPS.value = params.renderSteps;
            
            // Trigger resize if performance params change
            // This is cheap because we are just setting size, not reallocating everything usually
            if (container && renderer) {
                 // Check if resize is needed (simple check to avoid thrashing)
                 const currentPixelRatio = renderer.getPixelRatio();
                 const targetPixelRatio = Math.min(window.devicePixelRatio, params.pixelRatioCap);
                 
                 // We just call resize to be safe and apply both scale and ratio
                 // Debouncing could be added if this feels stuttery on slider drag
                 // But usually setSize is fast enough for 60fps UI
                 const width = container.clientWidth;
                 const height = container.clientHeight;
                 
                 renderer.setPixelRatio(targetPixelRatio);
                 renderer.setSize(width * params.renderScale, height * params.renderScale, false);
                 canvas.style.width = `${width}px`;
                 canvas.style.height = `${height}px`;
                 
                 const drawingBuffer = new THREE.Vector2();
                 renderer.getDrawingBufferSize(drawingBuffer);
                 material.uniforms.iResolution.value.set(drawingBuffer.x, drawingBuffer.y, 1);
                 
                 // FIX: Render immediately after setSize changes
                 renderer.render(scene, camera);
            }
        }
    });

	onDestroy(() => {
		if (animationId) cancelAnimationFrame(animationId);
        if (resizeObserver) resizeObserver.disconnect();
        if (noiseTex) noiseTex.dispose();
        if (blueNoiseTex) blueNoiseTex.dispose();
		if (renderer) renderer.dispose();
        if (material) material.dispose();
        themeUnsub(); // Clean up store subscription
	});
</script>

<div bind:this={container} class="fixed inset-0 -z-10 w-full h-full">
	<canvas 
        bind:this={canvas} 
        class="w-full h-full block"
    ></canvas>
</div>
