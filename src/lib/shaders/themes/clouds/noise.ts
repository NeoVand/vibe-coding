export const noise = `
    float noiseImpl(in vec3 x, int type)
    {
        if (type == 1) {
            // Soft Clouds (Standard Value Noise)
            vec3 q = x + vec3(iTime * 0.05, iTime * 0.02, 0.0);
            return texNoiseSigned(q);

        } else if (type == 2) {
            // Ridged Billows (Dramatic Cumulonimbus)
            vec3 q = x + vec3(
                sin(x.z * 0.3 + iTime * 0.08) * 0.15,
                cos(x.z * 0.2 + iTime * 0.06) * 0.15,
                iTime * 0.08
            );
            float n = texNoiseSigned(q);
            float ridge = 1.0 - abs(n);
            ridge = ridge * ridge;
            return ridge * 2.0 - 1.0;

        } else if (type == 3) {
            // Organic Cells (Ink / Veins / Lava)
            vec3 drift = vec3(
                sin(x.z * 0.4 + iTime * 0.12) * 0.4,
                cos(x.z * 0.3 + iTime * 0.1) * 0.4,
                iTime * 0.12
            );
            vec3 q = x * 0.7 + drift;
            float n1 = texNoise(q);
            float n2 = texNoise(q + vec3(0.37, 0.61, 0.23));
            float edge = abs(n1 - n2);
            float cells = smoothstep(0.0, 0.25, edge);
            float interior = texNoiseSigned(q * 0.5);
            return mix(interior * 0.3, cells * 2.0 - 1.0, 0.7);

        } else if (type == 4) {
            // Flowing Warp (Rivers / Liquid Metal)
            vec3 q1 = x * 0.4 + vec3(iTime * 0.06, -iTime * 0.04, iTime * 0.08);
            float w1x = texNoiseSigned(q1);
            float w1y = texNoiseSigned(q1 + vec3(7.3, 2.1, 5.7));

            vec3 q2 = x * 0.8 + vec3(w1x * 1.5, w1y * 1.5, 0.0)
                     + vec3(-iTime * 0.05, iTime * 0.07, iTime * 0.03);
            float w2x = texNoiseSigned(q2);
            float w2y = texNoiseSigned(q2 + vec3(3.7, 8.3, 1.9));

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
