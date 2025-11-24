
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
        float noise(in vec3 x)
        {
            vec3 p = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);

            // NOISE_METHOD 1: Two 2D texture lookups
            vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
            vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
            return mix(rg.x, rg.y, f.z) * 2.0 - 1.0;  
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
            
            // Calculate rotation angle based on Time (spin) and Depth (twist)
            float angle = -iTime * VORTEX_SPEED + p.z * VORTEX_TWIST;
            float s = sin(angle);
            float c = cos(angle);
            mat2 rot = mat2(c, -s, s, c);
            
            // Rotate the XY coordinates relative to the path center
            vec2 twistedXY = rot * relP.xy;
            
            // Construct the noise coordinate system 'q'
            vec3 q = vec3(twistedXY, p.z - iTime * 0.5);
            
            // Initial large scale noise (Base shape)
            float g = 0.5 + 0.5 * noise(q * NOISE_SCALE_BASE);
            
            float f;
            // Detail noise
            f  = 0.50000 * noise(q * NOISE_SCALE_DET); 
            
            if (USE_LOD == 1 && oct >= 2) 
                f += 0.25000 * noise(q * NOISE_SCALE_DET * 2.25); 
                
            if (USE_LOD == 1 && oct >= 3)
                f += 0.12500 * noise(q * NOISE_SCALE_DET * 5.0); 
                
            if (USE_LOD == 1 && oct >= 4)
                f += 0.06250 * noise(q * NOISE_SCALE_DET * 10.0); 
            
            f = mix(f * 0.1 - 0.5, f, g * g);
            
            // 4. Combine Tunnel + Noise
            float density = (tunnelDist - TUNNEL_RADIUS) + (f * CLOUD_DENSITY); 
            
            return clamp(density, 0.0, 1.0);
        }

        const int kDiv = 1; 

        vec4 raymarch(in vec3 ro, in vec3 rd, in vec3 bgcol, in ivec2 px, in vec3 sundir)
        {
            // dithered near distance
            float t = 0.0 + 0.1 * texelFetch(iChannel1, px & ivec2(1023), 0).x;
            
            vec4 sum = vec4(0.0);
            
            // Standard step count
            for (int i = 0; i < 150; i++) // Hardcoded max steps for safety, usually loop bounds must be const
            {
               if (i >= RENDER_STEPS) break; // Dynamic break

               // Step size 
               float dt = max(0.1, 0.07 * t / float(kDiv));

               // LOD calculation
               int oct = 5;
               if (USE_LOD == 1) {
                   oct = 5 - int(log2(1.0 + t * 0.5)); 
               }
               
               // sample cloud
               vec3 pos = ro + t * rd;
               float den = map(pos, oct);
               
               if (den > 0.01) // if inside
               {
                   // do lighting
                   float dif = clamp((den - map(pos + 0.6 * sundir, oct)) / 0.5, 0.0, 1.0);
                   
                   // Light Colors
                   vec3  lin = LIGHT_COLOR_1 * 1.1 + 0.8 * LIGHT_COLOR_2 * dif;
                   
                   // Cloud Color Mixing
                   vec4  col = vec4(mix(CLOUD_BASE_COL, CLOUD_SHADOW_COL, den), den);
                   
                   col.xyz *= lin;
                   
                   // Fog
                   col.xyz = mix(col.xyz, bgcol, 1.0 - exp2(-FOG_DENSITY * t));
                   
                   col.w    = min(col.w * 8.0 * dt, 1.0);
                   col.rgb *= col.a;
                   sum += col * (1.0 - sum.a);
               }
               
               t += dt;
               
               if (t > DRAW_DIST || sum.a > 0.99) break;
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

            float t = iTime * CAM_SPEED; 
            
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
		renderer.setPixelRatio(1); // Force 1:1 pixel ratio for performance (ShaderToy standard)

		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const scene = new THREE.Scene();
		const geometry = new THREE.PlaneGeometry(2, 2);

        const loader = new THREE.TextureLoader();
        
        // Load provided textures
        noiseTex = loader.load('/textures/noise.png');
        noiseTex.wrapS = THREE.RepeatWrapping;
        noiseTex.wrapT = THREE.RepeatWrapping;
        noiseTex.minFilter = THREE.LinearMipMapLinearFilter;
        noiseTex.magFilter = THREE.LinearFilter;
        noiseTex.generateMipmaps = true;
        
        blueNoiseTex = loader.load('/textures/blue_noise.png');
        blueNoiseTex.wrapS = THREE.RepeatWrapping;
        blueNoiseTex.wrapT = THREE.RepeatWrapping;
        blueNoiseTex.minFilter = THREE.NearestFilter; // Nearest for dithering
        blueNoiseTex.magFilter = THREE.NearestFilter;
        blueNoiseTex.generateMipmaps = false; // Blue noise usually doesn't need mipmaps for this usage

		material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms: {
				iTime: { value: 0 },
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
			}
		});

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		const resize = () => {
            if (!container) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
			renderer.setSize(width, height, false);
			material.uniforms.iResolution.value.set(width, height, 1);
		};

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
		resize();

		const clock = new THREE.Clock();

		const animate = () => {
			animationId = requestAnimationFrame(animate);
			material.uniforms.iTime.value = clock.getElapsedTime();
			renderer.render(scene, camera);
		};

		animate();
	});

    $effect(() => {
        if (material) {
            // Update uniforms when params change
            material.uniforms.LOOK.value = params.look;
            material.uniforms.NOISE_METHOD.value = params.noiseMethod;
            material.uniforms.USE_LOD.value = params.useLod;
            material.uniforms.RENDER_STEPS.value = params.renderSteps;
            material.uniforms.DRAW_DIST.value = params.drawDist;
            material.uniforms.CAM_SPEED.value = params.camSpeed;
            material.uniforms.CAM_FOV.value = params.camFov;
            material.uniforms.CAM_ROLL_AMP.value = params.camRollAmp;
            material.uniforms.CAM_ROLL_FREQ.value = params.camRollFreq;
            material.uniforms.CAM_LOOK_AHEAD.value = params.camLookAhead;
            material.uniforms.SUN_PATH_OFFSET.value = params.sunPathOffset;
            material.uniforms.TUNNEL_RADIUS.value = params.tunnelRadius;
            material.uniforms.PATH_AMP_X.value = params.pathAmpX;
            material.uniforms.PATH_FREQ_X.value = params.pathFreqX;
            material.uniforms.PATH_AMP_Y.value = params.pathAmpY;
            material.uniforms.PATH_FREQ_Y.value = params.pathFreqY;
            material.uniforms.VORTEX_SPEED.value = params.vortexSpeed;
            material.uniforms.VORTEX_TWIST.value = params.vortexTwist;
            material.uniforms.NOISE_SCALE_BASE.value = params.noiseScaleBase;
            material.uniforms.NOISE_SCALE_DET.value = params.noiseScaleDet;
            material.uniforms.CLOUD_DENSITY.value = params.cloudDensity;
            material.uniforms.BG_COLOR.value.set(params.bgColor);
            material.uniforms.LIGHT_COLOR_1.value.set(params.lightColor1);
            material.uniforms.LIGHT_COLOR_2.value.set(params.lightColor2);
            material.uniforms.CLOUD_BASE_COL.value.set(params.cloudBaseCol);
            material.uniforms.CLOUD_SHADOW_COL.value.set(params.cloudShadowCol);
            material.uniforms.FOG_DENSITY.value = params.fogDensity;
            material.uniforms.SUN_GLOW_COL.value.set(params.sunGlowCol);
            material.uniforms.SUN_GLOW_POW.value = params.sunGlowPow;
            material.uniforms.SUN_CORE_COL.value.set(params.sunCoreCol);
            material.uniforms.SUN_CORE_POW.value = params.sunCorePow;
            material.uniforms.SUN_GLARE_COL.value.set(params.sunGlareCol);
            material.uniforms.SUN_GLARE_POW.value = params.sunGlarePow;
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
	<canvas bind:this={canvas} class="w-full h-full block"></canvas>
</div>
