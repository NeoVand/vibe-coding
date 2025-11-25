
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import type { ShaderParams } from '$lib/shaderParams';

	let { params }: { params: ShaderParams } = $props();

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let renderer: THREE.WebGLRenderer;
	let material: THREE.ShaderMaterial;
	let animationId: number;
    let resizeObserver: ResizeObserver;
    let noiseTex: THREE.Texture;
    let blueNoiseTex: THREE.Texture;

    // Integration state variables
    let camZ = 0;
    let vortexPhase = 0;

    // Helper for color interpolation
    const colorTargets = {
        bgColor: new THREE.Color(),
        lightColor1: new THREE.Color(),
        lightColor2: new THREE.Color(),
        cloudBaseCol: new THREE.Color(),
        cloudShadowCol: new THREE.Color(),
        sunGlowCol: new THREE.Color(),
        sunCoreCol: new THREE.Color(),
        sunGlareCol: new THREE.Color(),
        lightningColor: new THREE.Color(),
    };

	const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

	const fragmentShaderPrefix = `
        uniform vec3 iResolution;
        uniform float iTime;
        
        // Integrated uniforms for stability
        uniform float uCamZ;
        uniform float uVortexPhase;

        uniform sampler2D iChannel0;
        uniform sampler2D iChannel1;
        
        uniform int LOOK;
        uniform int NOISE_METHOD;
        uniform int USE_LOD;
        uniform int RENDER_STEPS;
        uniform float DRAW_DIST;
        uniform float CAM_SPEED;
        uniform float CAM_FOV;
        uniform float CAM_ROLL_AMP;
        uniform float CAM_ROLL_FREQ;
        uniform float CAM_LOOK_AHEAD;
        uniform float SUN_PATH_OFFSET;
        uniform float TUNNEL_RADIUS;
        uniform float PATH_AMP_X;
        uniform float PATH_FREQ_X;
        uniform float PATH_AMP_Y;
        uniform float PATH_FREQ_Y;
        uniform float VORTEX_SPEED;
        uniform float VORTEX_TWIST;
        uniform float NOISE_SCALE_BASE;
        uniform float NOISE_SCALE_DET;
        uniform float CLOUD_DENSITY;
        uniform vec3 BG_COLOR;
        uniform vec3 LIGHT_COLOR_1;
        uniform vec3 LIGHT_COLOR_2;
        uniform vec3 CLOUD_BASE_COL;
        uniform vec3 CLOUD_SHADOW_COL;
        uniform float FOG_DENSITY;
        uniform vec3 SUN_GLOW_COL;
        uniform float SUN_GLOW_POW;
        uniform vec3 SUN_CORE_COL;
        uniform float SUN_CORE_POW;
        uniform vec3 SUN_GLARE_COL;
        uniform float SUN_GLARE_POW;

        uniform int LIGHTNING_ENABLED;
        uniform float LIGHTNING_CHANCE;
        uniform vec3 LIGHTNING_COLOR;
        uniform float LIGHTNING_INTENSITY;
    `;

    // Adapted from ShaderToy code
	const fragmentShaderBody = `
        // --- PATH FUNCTION ---
        vec3 path(in float z)
        {
            float t = z;
            vec3 p = vec3(sin(t * PATH_FREQ_X) * PATH_AMP_X, 
                          cos(t * PATH_FREQ_Y) * PATH_AMP_Y, 
                          z);
            return p;
        }

        // --- NOISE FUNCTIONS ---
        float hash(float n) { return fract(sin(n)*43758.5453123); }
        
        float noise(in vec3 x)
        {
            vec3 p = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            
            // Simple hash for lightning noise if needed, but we use texture below
            // ...
            
            // NOISE_METHOD 1: Two 2D texture lookups
            vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
            vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
            return mix(rg.x, rg.y, f.z) * 2.0 - 1.0;  
        }

        // --- LIGHTNING FUNCTION ---
        // Returns { intensity (0-1+), flashFactor (0-1) }
        vec2 getLightningField(vec3 p, float time) {
            if (LIGHTNING_ENABLED == 0) return vec2(0.0);

            // Timing
            float t = time * 8.0;
            float id = floor(t);
            float localT = fract(t);
            
            // Random chance
            if (hash(id) > LIGHTNING_CHANCE) return vec2(0.0);
            
            // Flash envelope - fast attack, slow decay
            float flash = smoothstep(0.0, 0.1, localT) * smoothstep(1.0, 0.3, localT);
            flash = pow(flash, 3.0); 
            
            if (flash < 0.001) return vec2(0.0);

            // Path / Position
            // Determine a random angle for this strike
            float strikeAngle = hash(id + 13.0) * 6.28;
            
            vec3 pPath = path(p.z);
            vec3 relP = p - pPath;
            
            // Wiggle the angle along Z to make it a "vein"
            // Use lower frequency for main shape
            float wiggle = noise(vec3(0.0, 0.0, p.z * 0.15 + id * 10.0)) * 2.0; 
            // Add detail
            wiggle += noise(vec3(0.0, 0.0, p.z * 0.8)) * 0.5;
            
            float targetAngle = strikeAngle + wiggle;
            float myAngle = atan(relP.y, relP.x);
            float diff = abs(myAngle - targetAngle);
            if (diff > 3.14159) diff = 6.28318 - diff;
            
            // Distance from center (wall proximity)
            float r = length(relP.xy);
            float distFromWall = abs(r - TUNNEL_RADIUS);
            
            // Combined distance to the "vein"
            // We treat the vein as a line running along the wall at that angle
            float d = length(vec2(diff * r, distFromWall));
            
            // Volumetric Glow Falloff
            // Inverse square law-ish for the glow
            float glow = 1.0 / (d * d + 0.1);
            
            // Core Beam (The actual plasma channel) - Thinner and sharper
            float core = 0.002 / (d * d + 0.0001);
            
            return vec2(core, glow) * flash;
        }

        // --- MAP FUNCTION ---
        float map(in vec3 p, int oct)
        {
            // 1. Get position relative to the camera path
            vec3 pPath = path(p.z);
            vec3 relP = p - pPath;
            
            // 2. Base Tunnel Shape
            float tunnelDist = length(relP.xy);
            
            // 3. Noise Generation (Clouds) with VORTEX EFFECT
            
            // Calculate rotation angle
            // FIX: Use integrated phase + anchor twist to camera Z to prevent "helicoptering" when changing parameters
            float twistOffset = p.z - uCamZ; 
            float angle = -uVortexPhase + twistOffset * VORTEX_TWIST;
            
            float s = sin(angle);
            float c = cos(angle);
            mat2 rot = mat2(c, -s, s, c);
            
            // Rotate the XY coordinates relative to the path center
            vec2 twistedXY = rot * relP.xy;
            
            // Construct the noise coordinate system 'q'
            // FIX: Anchor scaling to camera Z to prevent massive phase shifts
            
            // Fixed Scale References (Defaults)
            const float REF_SCALE_BASE = 0.3;
            const float REF_SCALE_DET = 0.7;
            
            // Base Noise
            float phaseBase = (uCamZ - iTime * 0.5) * REF_SCALE_BASE;
            float relZBase = (p.z - uCamZ) * NOISE_SCALE_BASE;
            vec3 qBase = vec3(twistedXY * NOISE_SCALE_BASE, phaseBase + relZBase);
            
            // Detail Noise
            float phaseDet = (uCamZ - iTime * 0.5) * REF_SCALE_DET;
            float relZDet = (p.z - uCamZ) * NOISE_SCALE_DET;
            vec3 qDet = vec3(twistedXY * NOISE_SCALE_DET, phaseDet + relZDet);
            
            // Initial large scale noise (Base shape)
            float g = 0.5 + 0.5 * noise(qBase);
            
            // --- DENSITY CULLING OPTIMIZATION ---
            // If the base noise 'g' combined with the tunnel distance is too sparse,
            // we can predict that adding detail noise will NOT result in a visible cloud.
            // In the mix() function below, if g is small, f contributes mostly negatively (erodes).
            // So if we are already "thin" (g is low) and "far from wall" (tunnelDist high),
            // we can skip the expensive detail noise lookups entirely.
            
            // Calculate rough density contribution from base noise alone
            float baseDensity = (tunnelDist - TUNNEL_RADIUS) + ((g * 0.5) * CLOUD_DENSITY);
            
            // If we are clearly empty air, skip detail octaves
            if (baseDensity < -0.5 && oct < 10) { 
                // Return approximation. 
                // We subtract a constant to represent the "erosion" that detail noise would have done
                return clamp((tunnelDist - TUNNEL_RADIUS), 0.0, 1.0);
            }

            float f;
            // Detail noise - Octave 1
            f  = 0.50000 * noise(qDet); 
            
            // For higher octaves, we continue the pattern
            if (USE_LOD == 1 && oct >= 2) {
                float scale2 = 2.25;
                vec3 qDet2 = vec3(twistedXY * NOISE_SCALE_DET * scale2, (phaseDet + relZDet) * scale2);
                f += 0.25000 * noise(qDet2);
            }
                
            if (USE_LOD == 1 && oct >= 3) {
                float scale3 = 5.0;
                vec3 qDet3 = vec3(twistedXY * NOISE_SCALE_DET * scale3, (phaseDet + relZDet) * scale3);
                f += 0.12500 * noise(qDet3); 
            }
                
            if (USE_LOD == 1 && oct >= 4) {
                float scale4 = 10.0;
                vec3 qDet4 = vec3(twistedXY * NOISE_SCALE_DET * scale4, (phaseDet + relZDet) * scale4);
                f += 0.06250 * noise(qDet4); 
            }
            
            f = mix(f * 0.1 - 0.5, f, g * g);
            
            // 4. Combine Tunnel + Noise
            float density = (tunnelDist - TUNNEL_RADIUS) + (f * CLOUD_DENSITY); 
            
            return clamp(density, 0.0, 1.0);
        }

        const int kDiv = 1; // INTERLACED OPTIMIZATION
        
        vec4 raymarch(in vec3 ro, in vec3 rd, in vec3 bgcol, in ivec2 px, in vec3 sundir)
        {
            // --- SMART DITHERING ---
            // Use blue noise to randomize the start position
            float t = 0.0 + 0.1 * texelFetch(iChannel1, px & ivec2(1023), 0).x;
            
            vec4 sum = vec4(0.0);
            
            // --- DYNAMIC STEP LIMIT ---
            // Reduce max steps based on pixel vertical position (optimization)
            // Rays near the top/bottom (farther viewing angles) or peripheral often need fewer steps to hit "fog" or exit
            // This is a heuristic to save cycles on rays that are less critical
            // int max_steps = 150; // Removed hardcoded limit to respect uniform
            
            for (int i = 0; i < 300; i++) // Increased loop cap to allow slider up to 300
            {
               if (i >= RENDER_STEPS) break; // Respect user slider setting

               // Step size - Increase step size faster with distance
               // Original was: 0.07 * t
               // New: 0.08 * t (slightly more aggressive growth)
               float dt = max(0.1, 0.08 * t / float(kDiv));

               // --- LOD OPTIMIZATION ---
               // Aggressively degrade quality with distance
               // Clouds far away don't need 5 octaves of noise
               int oct = 5;
               if (USE_LOD == 1) {
                   // Faster LOD falloff: 
                   // t > 5.0 -> oct 4
                   // t > 15.0 -> oct 3
                   // t > 30.0 -> oct 2
                   // t > 60.0 -> oct 1
                   if (t > 5.0) oct = 4;
                   if (t > 15.0) oct = 3;
                   if (t > 30.0) oct = 2;
                   if (t > 60.0) oct = 1;
               }
               
               // sample cloud
               vec3 pos = ro + t * rd;
               
               // OPTIMIZATION: Removed unsafe skipping logic that caused artifacts when TUNNEL_RADIUS > 1.7
               // The previous logic assumed clouds never extended more than 1.5 units inward, which is false
               // when CLOUD_DENSITY is high.
               /*
               float centerDistApprox = length(pos.xy - path(pos.z).xy); 
               if (centerDistApprox < TUNNEL_RADIUS - 1.5) {
                    float distToCloud = (TUNNEL_RADIUS - 1.5) - centerDistApprox;
                    t += max(dt, distToCloud * 0.5); 
                    continue;
               }
               */

               float den = map(pos, oct);
               
               if (den > 0.01) // if inside
               {
                   // --- LIGHTING OPTIMIZATION ---
                   // Reduce shadow ray accuracy for distant clouds
                   // FORCE SHADOW to use lowest LOD (Octave 1 only) for massive speedup
                   // Shadows don't need high frequency detail to look correct
                   int shadowOct = 1; 
                   
                   // do lighting
                   float dif = clamp((den - map(pos + 0.6 * sundir, shadowOct)) / 0.5, 0.0, 1.0);
                   
                   // Light Colors
                   vec3  lin = LIGHT_COLOR_1 * 1.1 + 0.8 * LIGHT_COLOR_2 * dif;
                   
                   // Lightning Calculation
                   vec2 lightning = getLightningField(pos, iTime);
                   // Add volumetric glow to lighting (illuminates the cloud)
                   lin += LIGHTNING_COLOR * lightning.y * LIGHTNING_INTENSITY * 5.0;

                   // Cloud Color Mixing
                   vec4  col = vec4(mix(CLOUD_BASE_COL, CLOUD_SHADOW_COL, den), den);
                   
                   col.xyz *= lin;
                   
                   // Add Core (Emissive Plasma) - cuts through everything
                   col.xyz += LIGHTNING_COLOR * lightning.x * LIGHTNING_INTENSITY * 10.0;
                   
                   // Fog
                   col.xyz = mix(col.xyz, bgcol, 1.0 - exp2(-FOG_DENSITY * t));
                   
                   col.w    = min(col.w * 8.0 * dt, 1.0);
                   col.rgb *= col.a;
                   sum += col * (1.0 - sum.a);
               }
               
               t += dt;
               
               // Early exit if opaque enough
               if (t > DRAW_DIST || sum.a > 0.96) break; // Lowered threshold slightly from 0.99
            }

            return clamp(sum, 0.0, 1.0);
        }

        vec4 render(in vec3 ro, in vec3 rd, in ivec2 px, in float t)
        {
            // Calculate sun direction based on path offset
            vec3 sunPos = path(t + SUN_PATH_OFFSET);
            vec3 sundir = normalize(sunPos - ro);

            // Sun calculation
            float sun = clamp(dot(sundir, rd), 0.0, 1.0);

            // Background gradient
            vec3 col = BG_COLOR;
            
            // Add "Light at end of tunnel" glow
            col += 0.4 * SUN_GLOW_COL * pow(sun, SUN_GLOW_POW);
            
            // Core of the sun
            col += 1.0 * SUN_CORE_COL * pow(sun, SUN_CORE_POW);

            // clouds    
            vec4 res = raymarch(ro, rd, col, px, sundir);
            col = col * (1.0 - res.w) + res.xyz;
            
            // sun glare over clouds
            col += 0.2 * SUN_GLARE_COL * pow(sun, SUN_GLARE_POW);

            // tonemap
            col = smoothstep(0.0, 1.0, col);
            col = pow(col, vec3(0.4545)); 
         
            return vec4(col, 1.0);
        }

        mat3 setCamera(in vec3 ro, in vec3 ta, float cr)
        {
            vec3 cw = normalize(ta - ro);
            vec3 cp = vec3(sin(cr), cos(cr), 0.0);
            vec3 cu = normalize(cross(cw, cp));
            vec3 cv = normalize(cross(cu, cw));
            return mat3(cu, cv, cw);
        }

        void main() {
            vec2 fragCoord = gl_FragCoord.xy;
            vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

            // FIX: Use integrated camera position instead of iTime * Speed
            float t = uCamZ;
            
            // Current position on path
            vec3 ro = path(t);
            // Look ahead on the path
            vec3 ta = path(t + CAM_LOOK_AHEAD);
            
            float roll = CAM_ROLL_AMP * sin(t * CAM_ROLL_FREQ); 

            mat3 ca = setCamera(ro, ta, roll);
            
            vec3 rd = ca * normalize(vec3(p.xy, CAM_FOV)); 
            
            // Pass 't' to render so it can calculate the sun position ahead
            gl_FragColor = render(ro, rd, ivec2(fragCoord - 0.5), t);
        }
    `;

    const fragmentShader = fragmentShaderPrefix + fragmentShaderBody;

	onMount(() => {
        if (!container || !canvas) return;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
		// Initial setup will be handled by the effect below
		
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const scene = new THREE.Scene();
		const geometry = new THREE.PlaneGeometry(2, 2);

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
			}
		});

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		const resize = () => {
            if (!container || !renderer) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
            
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

                const lerpFactor = 1.0 - Math.exp(-dt * 5.0); 

                // --- SMOOTH PARAMETER INTERPOLATION ---
                material.uniforms.CAM_SPEED.value += (params.camSpeed - material.uniforms.CAM_SPEED.value) * lerpFactor;
                material.uniforms.CAM_FOV.value += (params.camFov - material.uniforms.CAM_FOV.value) * lerpFactor;
                material.uniforms.CAM_ROLL_AMP.value += (params.camRollAmp - material.uniforms.CAM_ROLL_AMP.value) * lerpFactor;
                material.uniforms.CAM_ROLL_FREQ.value += (params.camRollFreq - material.uniforms.CAM_ROLL_FREQ.value) * lerpFactor;
                material.uniforms.CAM_LOOK_AHEAD.value += (params.camLookAhead - material.uniforms.CAM_LOOK_AHEAD.value) * lerpFactor;
                material.uniforms.SUN_PATH_OFFSET.value += (params.sunPathOffset - material.uniforms.SUN_PATH_OFFSET.value) * lerpFactor;
                
                material.uniforms.TUNNEL_RADIUS.value += (params.tunnelRadius - material.uniforms.TUNNEL_RADIUS.value) * lerpFactor;
                material.uniforms.PATH_AMP_X.value += (params.pathAmpX - material.uniforms.PATH_AMP_X.value) * lerpFactor;
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

                material.uniforms.uCamZ.value = camZ;
                material.uniforms.uVortexPhase.value = vortexPhase;
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
