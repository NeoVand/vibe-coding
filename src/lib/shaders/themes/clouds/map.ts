export const map = `
    // Per-octave rotation matrix to break axis-aligned artifacts
    // ~37.4 degrees (golden angle in radians) - irrational relative to grid
    const mat3 OCTAVE_ROT = mat3(
         0.80, -0.48, 0.36,
         0.52,  0.85, -0.08,
        -0.27,  0.25,  0.93
    );

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
        float twistOffset = p.z - uCamZ;

        // Bounded depth-dependent vortex parallax
        const float DEPTH_PARALLAX_STRENGTH = 0.015;
        float depthParallax = sin(uVortexPhase) * twistOffset * DEPTH_PARALLAX_STRENGTH;

        float angle = -uVortexPhase + depthParallax + twistOffset * VORTEX_TWIST;

        float s = sin(angle);
        float c = cos(angle);
        mat2 rot = mat2(c, -s, s, c);

        // Rotate the XY coordinates relative to the path center
        vec2 twistedXY = rot * relP.xy;

        // Construct the noise coordinate system 'q'
        // Fixed Scale References (Defaults)
        const float REF_SCALE_BASE = 0.3;
        const float REF_SCALE_DET = 0.7;

        // Base Noise - Main Structure
        // Use pre-computed uNoisePhase (wrapped on CPU) to avoid
        // precision loss from subtracting two large floats
        float relZBase = (p.z - uCamZ) * NOISE_SCALE_BASE;
        float phaseBase = uNoisePhase * REF_SCALE_BASE + relZBase;
        vec3 qBase = vec3(twistedXY * NOISE_SCALE_BASE, phaseBase);

        // Detail Noise - Smaller Features
        // DIFFERENTIAL SCROLL: Move detail slightly faster than base to create morphing
        float detailShift = iTime * 0.15;
        float relZDet = (p.z - uCamZ) * NOISE_SCALE_DET;
        float phaseDet = (uNoisePhase - detailShift) * REF_SCALE_DET + relZDet;
        vec3 qDet = vec3(twistedXY * NOISE_SCALE_DET, phaseDet);

        // Initial large scale noise (Base shape)
        float g = 0.5 + 0.5 * noise(qBase);

        // --- DENSITY CULLING OPTIMIZATION ---
        float baseDensity = (tunnelDist - TUNNEL_RADIUS) + ((g * 0.5) * CLOUD_DENSITY);

        // If we are clearly empty air, skip detail octaves
        if (baseDensity < -0.5 && oct < 10) {
            return clamp((tunnelDist - TUNNEL_RADIUS), 0.0, 1.0);
        }

        float f;
        // Detail noise - Octave 1
        f  = 0.50000 * noise(qDet);

        // Higher octaves with per-octave rotation to eliminate grid artifacts
        // Detuned lacunarity (2.13 instead of exact 2.0) prevents harmonic alignment
        if (USE_LOD == 1 && oct >= 2) {
            float shift2 = iTime * 0.25;
            vec3 q2 = OCTAVE_ROT * qDet * 2.13 + vec3(shift2);
            f += 0.25000 * noise(q2);
        }

        if (USE_LOD == 1 && oct >= 3) {
            float shift3 = iTime * 0.35;
            vec3 q3 = OCTAVE_ROT * (OCTAVE_ROT * qDet * 2.13) * 2.13 + vec3(shift3);
            f += 0.12500 * noise(q3);
        }

        if (USE_LOD == 1 && oct >= 4) {
            vec3 q4 = OCTAVE_ROT * (OCTAVE_ROT * (OCTAVE_ROT * qDet * 2.13) * 2.13) * 2.13;
            f += 0.06250 * noise(q4);
        }

        f = mix(f * 0.1 - 0.5, f, g * g);

        // 4. Combine Tunnel + Noise
        float density = (tunnelDist - TUNNEL_RADIUS) + (f * CLOUD_DENSITY);

        return clamp(density, 0.0, 1.0);
    }
`;
