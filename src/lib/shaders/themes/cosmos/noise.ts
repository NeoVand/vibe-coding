export const noise = `
    // Water noise: uses the SAME fast texture noise as clouds
    // The difference is in HOW the map uses it (multiplicative, progressive scrolling)
    // and HOW the surface is rendered (normals + fresnel, not volumetric)
    // 1 texture lookup per call = fast

    float noise(in vec3 x) {
        return texNoise(x); // Returns [0,1], same as reference
    }
`;
