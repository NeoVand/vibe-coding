export const map = `
    const mat3 OCTAVE_ROT = mat3(
         0.80, -0.48,  0.36,
         0.52,  0.85, -0.08,
        -0.27,  0.25,  0.93
    );

    // WATER DENSITY MAP — additive approach (reliable full-tunnel coverage)
    // Water look comes from surface shading (normals+fresnel), not from density shape
    // Progressive per-octave time scrolling makes small waves travel faster
    float map(in vec3 p, int oct)
    {
        vec3 pPath = path(p.z);
        vec3 relP = p - pPath;
        float tunnelDist = length(relP.xy);

        // Vortex twist
        float twistOffset = p.z - uCamZ;
        const float DEPTH_PARALLAX_STRENGTH = 0.015;
        float depthParallax = sin(uVortexPhase) * twistOffset * DEPTH_PARALLAX_STRENGTH;
        float angle = -uVortexPhase + depthParallax + twistOffset * VORTEX_TWIST;
        float sa = sin(angle), ca = cos(angle);
        vec2 twistedXY = mat2(ca, -sa, sa, ca) * relP.xy;

        // Base noise
        const float REF_SCALE_BASE = 0.3;
        float relZBase = (p.z - uCamZ) * NOISE_SCALE_BASE;
        float phaseBase = uNoisePhase * REF_SCALE_BASE + relZBase;
        vec3 qBase = vec3(twistedXY * NOISE_SCALE_BASE, phaseBase);
        float g = 0.5 + 0.5 * noise(qBase + vec3(0.0, 0.0, iTime * 0.06));

        // Density culling
        float baseDensity = (tunnelDist - TUNNEL_RADIUS) + ((g * 0.5) * CLOUD_DENSITY);
        if (baseDensity < -0.5 && oct < 10) {
            return clamp((tunnelDist - TUNNEL_RADIUS), 0.0, 1.0);
        }

        // Detail octaves — PROGRESSIVE time scrolling (water signature)
        float f;
        const float REF_SCALE_DET = 0.7;
        float relZDet = (p.z - uCamZ) * NOISE_SCALE_DET;
        float phaseDet = uNoisePhase * REF_SCALE_DET + relZDet;
        vec3 qDet = vec3(twistedXY * NOISE_SCALE_DET, phaseDet);

        // Vortical noise movement: waves swirl AROUND the tunnel, not just scroll forward
        // Each octave rotates in XY at its own speed (creating spiral wave patterns)
        float vortT = iTime * 0.15;
        float svt = sin(vortT), cvt = cos(vortT);
        vec3 vortOff1 = vec3(svt * 0.3, cvt * 0.3, iTime * 0.2);
        f  = 0.50000 * noise(qDet + vortOff1);

        if (USE_LOD == 1 && oct >= 2) {
            vec3 q2 = OCTAVE_ROT * qDet * 2.13;
            float svt2 = sin(vortT * 2.5), cvt2 = cos(vortT * 2.5);
            f += 0.25000 * noise(q2 + vec3(svt2 * 0.4, cvt2 * 0.4, iTime * 0.5));
        }

        if (USE_LOD == 1 && oct >= 3) {
            vec3 q3 = OCTAVE_ROT * (OCTAVE_ROT * qDet * 2.13) * 2.13;
            float svt3 = sin(vortT * 4.0), cvt3 = cos(vortT * 4.0);
            f += 0.12500 * noise(q3 + vec3(svt3 * 0.5, cvt3 * 0.5, iTime * 1.0));
        }

        if (USE_LOD == 1 && oct >= 4) {
            vec3 q4 = OCTAVE_ROT * (OCTAVE_ROT * (OCTAVE_ROT * qDet * 2.13) * 2.13) * 2.13;
            float svt4 = sin(vortT * 6.0), cvt4 = cos(vortT * 6.0);
            f += 0.06250 * noise(q4 + vec3(svt4 * 0.6, cvt4 * 0.6, iTime * 2.0));
        }

        // Audio: gentle bass breathing
        f += AUDIO_BASS * 0.04;

        f = mix(f * 0.1 - 0.5, f, g * g);
        float density = (tunnelDist - TUNNEL_RADIUS) + (f * CLOUD_DENSITY);
        return clamp(density, 0.0, 1.0);
    }
`;
