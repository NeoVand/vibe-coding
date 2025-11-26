export const map = `
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
        
        // Bounded depth-dependent vortex parallax
        // Creates visual depth variation that breaks the "camera spinning" illusion
        // by making clouds at different depths appear at slightly different rotation phases.
        // 
        // Key insight: We use sin(phase) to create an OSCILLATING offset, not accumulating.
        // This means far clouds "lead" and "lag" the rotation in a bounded cycle,
        // creating the perception of depth variation without the spiral-sink effect.
        // The effect scales with depth (twistOffset) and is more pronounced when vortex is active.
        const float DEPTH_PARALLAX_STRENGTH = 0.015;
        float depthParallax = sin(uVortexPhase) * twistOffset * DEPTH_PARALLAX_STRENGTH;
        
        float angle = -uVortexPhase + depthParallax + twistOffset * VORTEX_TWIST;
        
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
`;

