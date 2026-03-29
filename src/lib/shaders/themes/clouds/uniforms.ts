// Cloud-specific uniform extensions
export const cloudUniforms = `
    uniform int LOOK;
    uniform int NOISE_METHOD;

    // Noise Transition Uniforms
    uniform int uNoiseTypeA;
    uniform int uNoiseTypeB;
    uniform float uNoiseMix;

    // Lightning
    uniform int LIGHTNING_ENABLED;
    uniform float LIGHTNING_CHANCE;
    uniform vec3 LIGHTNING_COLOR;
    uniform float LIGHTNING_INTENSITY;
    uniform int LIGHTNING_AUDIO_SYNC;
`;
