<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
    import type { ShaderParams } from '$lib/shaderParams';
    import { audioState } from '$lib/stores/audio';
    import { vertexShader, fragmentShader } from '$lib/shaders/cloud-tunnel';

	let { params }: { params: ShaderParams } = $props();

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

    // Noise transition state
    let noiseTypeA = params.noiseMethod;
    let noiseTypeB = params.noiseMethod;
    let noiseMix = 0;

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

		material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms: {
				iTime: { value: 0 },
                uCamZ: { value: 0 },
                uVortexPhase: { value: 0 },
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
                material.uniforms.iTime.value = clock.elapsedTime; 

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

                // --- NOISE TRANSITION LOGIC ---
                const targetNoiseType = params.noiseMethod;
                
                if (noiseMix <= 0.0 && noiseTypeA !== targetNoiseType) {
                    noiseTypeB = targetNoiseType;
                    noiseMix = 0.001; 
                }
                
                if (noiseMix > 0.0) {
                    noiseMix += dt * 0.5; // 2 second transition
                    if (noiseMix >= 1.0) {
                        noiseMix = 0.0;
                        noiseTypeA = noiseTypeB;
                    }
                }
                
                material.uniforms.uNoiseTypeA.value = noiseTypeA;
                material.uniforms.uNoiseTypeB.value = noiseTypeB;
                material.uniforms.uNoiseMix.value = noiseMix;

                material.uniforms.uCamZ.value = camZ;
                material.uniforms.uVortexPhase.value = vortexPhase;
                
                // Update Audio Uniforms
                // Fallback to random mode if audio sync is requested but music is not playing
                const shouldUseAudio = params.lightningAudioSync && $audioState.isPlaying;
                material.uniforms.LIGHTNING_AUDIO_SYNC.value = shouldUseAudio ? 1 : 0;
                
                // We access the store value directly for max speed
                material.uniforms.AUDIO_BEAT.value = $audioState.beat;
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
        
        // Ensure clear color is synced with background color target to minimize flash artifact
        if (renderer) {
            renderer.setClearColor(colorTargets.bgColor);
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
	});
</script>

<div bind:this={container} class="fixed inset-0 -z-10 w-full h-full">
	<canvas 
        bind:this={canvas} 
        class="w-full h-full block"
    ></canvas>
</div>
