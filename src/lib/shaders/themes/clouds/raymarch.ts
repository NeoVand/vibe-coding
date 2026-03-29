export const raymarch = `
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
`;

