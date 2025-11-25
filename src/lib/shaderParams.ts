
export type ShaderParams = {
    look: number;
    noiseMethod: number;
    useLod: number;
    renderSteps: number;
    drawDist: number;
    camSpeed: number;
    camFov: number;
    camRollAmp: number;
    camRollFreq: number;
    camLookAhead: number;
    sunPathOffset: number;
    tunnelRadius: number;
    pathAmpX: number;
    pathFreqX: number;
    pathAmpY: number;
    pathFreqY: number;
    vortexSpeed: number;
    vortexTwist: number;
    noiseScaleBase: number;
    noiseScaleDet: number;
    cloudDensity: number;
    bgColor: string;
    lightColor1: string;
    lightColor2: string;
    cloudBaseCol: string;
    cloudShadowCol: string;
    fogDensity: number;
    sunGlowCol: string;
    sunGlowPow: number;
    sunCoreCol: string;
    sunCorePow: number;
    sunGlareCol: string;
    sunGlarePow: number;
    
    // Lightning
    lightningEnabled: number;
    lightningChance: number;
    lightningColor: string;
    lightningIntensity: number;
    lightningAudioSync: number; // 0 or 1
    lightningThreshold: number; // 1.0 - 3.0 typically for ratio
    
    // Performance Tuning
    pixelRatioCap: number;    // Hard cap on devicePixelRatio (e.g. 1.0, 1.5, 2.0)
    renderScale: number;      // Internal resolution scaler (0.1 - 1.0)
};

// Helper to convert Linear float to sRGB Hex for matching ShaderToy visuals
// ShaderToy: vec3(0.4) -> Linear 0.4
// Three.js Color(Hex): Hex is sRGB. Color.r becomes Linear.
// We want Color.r to be 0.4. So Hex must be sRGB(0.4).
// sRGB(x) ~= x^(1/2.2)
// 0.4 -> 0.66 -> A8
// 0.5 -> 0.73 -> BA
// 0.6 -> 0.79 -> C9
// 0.65 -> 0.82 -> D1
// 0.75 -> 0.88 -> E0
// 0.9 -> 0.95 -> F2
// 0.95 -> 0.98 -> FA
// 1.0 -> 1.0 -> FF
// 0.1 -> 0.35 -> 59
// 0.2 -> 0.48 -> 7A
// 0.8 -> 0.90 -> E6
// 0.7 -> 0.85 -> D9

export const defaultParams: ShaderParams = {
    look: 1,
    noiseMethod: 1,
    useLod: 1,
    renderSteps: 150,
    drawDist: 80.0,
    camSpeed: 2.5,
    camFov: 1.8,
    camRollAmp: 0.2,
    camRollFreq: 0.1,
    camLookAhead: 1.0,
    sunPathOffset: 15.0,
    tunnelRadius: 1.7,
    pathAmpX: 2.5,
    pathFreqX: 0.2,
    pathAmpY: 2.5,
    pathFreqY: 0.15,
    vortexSpeed: 0.3,
    vortexTwist: 0.1,
    noiseScaleBase: 0.3,
    noiseScaleDet: 0.7,
    cloudDensity: 3.0,
    
    // Updated colors to match ShaderToy linear intensity
    bgColor: '#A8BAC9',       // vec3(0.4, 0.5, 0.6)
    lightColor1: '#D1D1E0',   // vec3(0.65, 0.65, 0.75)
    lightColor2: '#FFF0F2',   // vec3(1.0, 1.0, 0.95) - Close enough to white
    cloudBaseCol: '#F2F2FF',  // vec3(0.9, 0.9, 1.0)
    cloudShadowCol: '#59597A',// vec3(0.1, 0.1, 0.2)
    
    fogDensity: 0.03,
    sunGlowCol: '#FFFFFF',
    sunGlowPow: 100.0,
    sunCoreCol: '#FFFFFF',
    sunCorePow: 80.0,
    sunGlareCol: '#FFD9CC',   // vec3(1.0, 0.8, 0.7) -> sRGB(1.0, 0.9, 0.85) approx
    sunGlarePow: 8.0,

    // Lightning
    lightningEnabled: 0,      // 0 or 1
    lightningChance: 0.5,     // How often it flashes
    lightningColor: '#FFFFFF', // Color of the lightning
    lightningIntensity: 1.0,  // Strength of the lightning
    lightningAudioSync: 0,
    lightningThreshold: 1.5, // Beat detection ratio threshold

    // Performance Defaults
    pixelRatioCap: 1.5,       // Good balance for Retina screens
    renderScale: 1.0,         // Full resolution of the capped buffer
};
