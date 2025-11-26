export const noise = `
    float noiseImpl(in vec3 x, int type)
    {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        
        if (type == 1) {
            // NOISE_METHOD 1: Soft Clouds (Standard Value Noise)
            // Add subtle drift for dynamic feel
            vec3 q = x + vec3(iTime * 0.05, iTime * 0.02, 0.0);
            vec3 p1 = floor(q);
            vec3 f1 = fract(q);
            f1 = f1 * f1 * (3.0 - 2.0 * f1);
            
            vec2 uv = (p1.xy + vec2(37.0, 239.0) * p1.z) + f1.xy;
            vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
            return mix(rg.x, rg.y, f1.z) * 2.0 - 1.0;  
        } else if (type == 2) {
            // NOISE_METHOD 2: Billows (Puffy Clouds)
            // Slow Morphing
            vec3 q = x + vec3(0.0, 0.0, iTime * 0.1);
            vec3 p2 = floor(q);
            vec3 f2 = fract(q);
            f2 = f2 * f2 * (3.0 - 2.0 * f2);

            vec2 uv = (p2.xy + vec2(37.0, 239.0) * p2.z) + f2.xy;
            vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
            float n = mix(rg.x, rg.y, f2.z) * 2.0 - 1.0;
            
            float n2 = abs(n); 
            return 1.0 - 2.0 * n2; 
        } else if (type == 3) {
            // NOISE_METHOD 3: Inky / Cells
            
            // Center masking
            float r = length(x.xy);
            float mask = smoothstep(0.2, 0.8, r); 
            
            // Organic Drift (Lava Lamp suspension)
            // Instead of global breathing, we use coordinate distortion
            // This makes the blobs squish and drift slowly
            vec3 drift = vec3(
                sin(x.z * 0.5 + iTime * 0.2) * 0.3, // Wavy X
                cos(x.z * 0.3 + iTime * 0.15) * 0.3, // Wavy Y
                iTime * 0.15 // Constant flow Z
            );
            
            vec3 q = x * 0.6 + drift;
            vec3 p3 = floor(q);
            vec3 f3 = fract(q);
            f3 = f3 * f3 * (3.0 - 2.0 * f3);
            
            vec2 uv = (p3.xy + vec2(37.0, 239.0) * p3.z) + f3.xy;
            vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
            float n = mix(rg.x, rg.y, f3.z);
            
            // Fixed threshold for stable shapes
            // Smoothstep creates the blob boundaries
            float blob = smoothstep(0.35, 0.65, n);
            
            return (blob * 2.0 - 1.0) * mask - (1.0 - mask);
        } else if (type == 4) {
             // NOISE_METHOD 4: Liquid Metal
            
            // Animate warp field for swirling
            vec3 warpScale = x * 0.5 + vec3(iTime * 0.1, -iTime * 0.1, iTime * 0.2);
            vec3 pW = floor(warpScale);
            vec3 fW = fract(warpScale);
            fW = fW * fW * (3.0 - 2.0 * fW);
            
            vec2 uvW = (pW.xy + vec2(37.0, 239.0) * pW.z) + fW.xy;
            vec2 rgW = textureLod(iChannel0, (uvW + 0.5) / 256.0, 0.0).yx;
            float warpVal = mix(rgW.x, rgW.y, fW.z) * 2.0 - 1.0;
            
            // Apply Offset
            vec3 q = x + vec3(warpVal * 4.0, warpVal * 2.0, 0.0); 
            
            vec3 p2 = floor(q);
            vec3 f2 = fract(q);
            f2 = f2 * f2 * (3.0 - 2.0 * f2);
            
            vec2 uv2 = (p2.xy + vec2(37.0, 239.0) * p2.z) + f2.xy;
            vec2 rg2 = textureLod(iChannel0, (uv2 + 0.5) / 256.0, 0.0).yx;
            
            return mix(rg2.x, rg2.y, f2.z) * 2.0 - 1.0;
        }
        return 0.0;
    }

    float noise(in vec3 x) {
        float nA = noiseImpl(x, uNoiseTypeA);
        
        if (uNoiseMix <= 0.01) return nA;
        if (uNoiseMix >= 0.99) return noiseImpl(x, uNoiseTypeB);
        
        float nB = noiseImpl(x, uNoiseTypeB);
        return mix(nA, nB, uNoiseMix);
    }
`;
