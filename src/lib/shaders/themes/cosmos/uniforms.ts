// Water theme uniform extensions
// These reuse the same GLSL names as cosmos for compatibility
// but are semantically repurposed for water surface rendering
export const cosmosUniforms = `
    // Wave pattern scale (higher = smaller waves)
    uniform float NEBULA_DENSITY;
    // Maximum fresnel reflectivity (0.3 = subtle, 0.9 = mirror)
    uniform float NEBULA_FALLOFF;
    // Shallow/surface water color
    uniform vec3 NEBULA_COLOR_1;
    // Deep water color
    uniform vec3 NEBULA_COLOR_2;
    // Specular highlight / accent color
    uniform vec3 NEBULA_COLOR_3;
    // Foam amount at wave crests
    uniform float STAR_DENSITY;
    // Particle / caustic brightness
    uniform float STAR_BRIGHTNESS;
    // (reserved)
    uniform float STAR_GLOW_SIZE;
`;
