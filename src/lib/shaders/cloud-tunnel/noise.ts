export const noise = `
    // --- BASE NOISE LOOKUP ---
    // Shared texture-based value noise used by all methods
    float texNoise(in vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
        vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
        return mix(rg.x, rg.y, f.z);
    }

    // Signed version (-1 to 1)
    float texNoiseSigned(in vec3 x) {
        return texNoise(x) * 2.0 - 1.0;
    }

    float noiseImpl(in vec3 x, int type)
    {
        if (type == 1) {
            // ═══════════════════════════════════════════════════════
            // NOISE METHOD 1: Soft Clouds (Standard Value Noise)
            // Gentle, dreamy clouds with subtle drift
            // ═══════════════════════════════════════════════════════
            vec3 q = x + vec3(iTime * 0.05, iTime * 0.02, 0.0);
            return texNoiseSigned(q);

        } else if (type == 2) {
            // ═══════════════════════════════════════════════════════
            // NOISE METHOD 2: Ridged Billows (Dramatic Cumulonimbus)
            // Sharp ridges where noise crosses zero, with erosion
            // weighting that concentrates detail at ridge peaks.
            // ═══════════════════════════════════════════════════════

            // Slow drift along Z and subtle XY swirl
            vec3 q = x + vec3(
                sin(x.z * 0.3 + iTime * 0.08) * 0.15,
                cos(x.z * 0.2 + iTime * 0.06) * 0.15,
                iTime * 0.08
            );

            // Ridged noise: sharp peaks where base noise crosses zero
            float n = texNoiseSigned(q);
            float ridge = 1.0 - abs(n);
            // Square to sharpen the ridges further
            ridge = ridge * ridge;

            // Map to signed range with ridge character
            return ridge * 2.0 - 1.0;

        } else if (type == 3) {
            // ═══════════════════════════════════════════════════════
            // NOISE METHOD 3: Organic Cells (Ink / Veins / Lava)
            // Voronoi-edge-inspired cell boundaries using distance
            // between two noise samples, creating organic vein/ink
            // patterns. Domain-warped for fluid drift.
            // ═══════════════════════════════════════════════════════

            // Domain warping for organic flow
            vec3 drift = vec3(
                sin(x.z * 0.4 + iTime * 0.12) * 0.4,
                cos(x.z * 0.3 + iTime * 0.1) * 0.4,
                iTime * 0.12
            );
            vec3 q = x * 0.7 + drift;

            // Sample noise at two nearby offsets to approximate cell edges
            // (pseudo-Voronoi: thin regions where two samples are similar)
            float n1 = texNoise(q);
            float n2 = texNoise(q + vec3(0.37, 0.61, 0.23));

            // Edge detection: where the two samples are close, we're on a boundary
            float edge = abs(n1 - n2);

            // Sharpen into veins/cells with smooth falloff
            float cells = smoothstep(0.0, 0.25, edge);

            // Blend cell interior with softer base for depth
            float interior = texNoiseSigned(q * 0.5);
            float result = mix(interior * 0.3, cells * 2.0 - 1.0, 0.7);

            return result;

        } else if (type == 4) {
            // ═══════════════════════════════════════════════════════
            // NOISE METHOD 4: Flowing Warp (Rivers / Liquid Metal)
            // Multi-level domain warping (Inigo Quilez technique):
            // fbm(p + fbm(p + fbm(p))) creates extraordinary organic
            // flowing patterns. Each warp level uses different params.
            // ═══════════════════════════════════════════════════════

            // Level 1: Coarse warp field (slow, large displacement)
            vec3 q1 = x * 0.4 + vec3(iTime * 0.06, -iTime * 0.04, iTime * 0.08);
            float w1x = texNoiseSigned(q1);
            float w1y = texNoiseSigned(q1 + vec3(7.3, 2.1, 5.7));

            // Level 2: Medium warp (faster, smaller displacement)
            vec3 q2 = x * 0.8 + vec3(w1x * 1.5, w1y * 1.5, 0.0)
                     + vec3(-iTime * 0.05, iTime * 0.07, iTime * 0.03);
            float w2x = texNoiseSigned(q2);
            float w2y = texNoiseSigned(q2 + vec3(3.7, 8.3, 1.9));

            // Level 3: Final sample with accumulated warping
            vec3 q3 = x + vec3(w1x * 1.2 + w2x * 0.4, w1y * 1.2 + w2y * 0.4, 0.0);

            return texNoiseSigned(q3);
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
