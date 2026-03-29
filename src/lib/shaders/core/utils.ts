export const utils = `
    // --- UTILITY FUNCTIONS ---
    float hash(float n) { return fract(sin(n)*43758.5453123); }

    // Signed texture noise lookup (shared across themes)
    float texNoise(in vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
        vec2 rg = textureLod(iChannel0, (uv + 0.5) / 256.0, 0.0).yx;
        return mix(rg.x, rg.y, f.z);
    }

    float texNoiseSigned(in vec3 x) {
        return texNoise(x) * 2.0 - 1.0;
    }
`;
