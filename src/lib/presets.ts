import type { ShaderParams } from './shaderParams';
import { Cloud, Haze, CloudLightning, Moon, Droplets, Waves, Snowflake } from 'lucide-svelte';
import WaveCircle from '$lib/components/icons/WaveCircle.svelte';
import WavesSharkFin from '$lib/components/icons/WavesSharkFin.svelte';
import Whale from '$lib/components/icons/Whale.svelte';

export type Preset = {
    id: string;
    name: string;
    icon: any;
    theme: string;  // Which theme this preset belongs to
    params: Partial<ShaderParams>;
};

export type ThemeCategory = {
    id: string;
    name: string;
    icon: any;
};

export const THEME_CATEGORIES: ThemeCategory[] = [
    { id: 'clouds', name: 'Clouds', icon: Cloud },
    { id: 'cosmos', name: 'Water', icon: WaveCircle },
];

export const PRESETS: Preset[] = [
    {
        id: 'default',
        name: 'Dreamy',
        icon: Cloud,
        theme: 'clouds',
        params: {
            noiseMethod: 1, // Soft Clouds
            bgColor: '#c7e6ff',
            lightColor1: '#d1d6e0',
            lightColor2: '#FFF0F2',
            cloudBaseCol: '#f0f6ff',
            cloudShadowCol: '#535b65',
            sunGlowCol: '#ffffff',
            sunCoreCol: '#feffc7',
            sunGlareCol: '#c3bffd',
            sunGlowPow: 100,
            sunCorePow: 36,
            sunGlarePow: 16,
            vortexSpeed: 0.1,
            vortexTwist: 0.05,
            camSpeed: 1.9,
            camFov: 1.2,
            camRollAmp: 0.2,
            camRollFreq: 0.1,
            camLookAhead: 1,
            sunPathOffset: 21,
            tunnelRadius: 2.2,
            pathAmpX: 1.4,
            pathFreqX: 0.2,
            pathAmpY: 3.8,
            pathFreqY: 0.15,
            noiseScaleBase: 0.3,
            noiseScaleDet: 0.8,
            cloudDensity: 3.8,
            drawDist: 80,
            lightningEnabled: 0,
            lightningIntensity: 1.0,
        }
    },
    {
        id: 'sunset',
        name: 'Sunset',
        icon: Haze,
        theme: 'clouds',
        params: {
            noiseMethod: 3, // Organic Cells - veiny sunset clouds
            bgColor: '#DABCCA',
            lightColor1: '#ff9900',
            lightColor2: '#E7D4CB',
            cloudBaseCol: '#ffdab9',
            cloudShadowCol: '#04052F',
            sunGlowCol: '#ffaa00',
            sunCoreCol: '#ffffcc',
            sunGlareCol: '#E2C5A7',
            cloudDensity: 3.2,
            sunCorePow: 36,
            sunGlarePow: 16,
            vortexSpeed: -0.4,
            vortexTwist: 0.034,
            noiseScaleBase: 0.25,
            noiseScaleDet: 0.9,
            drawDist: 120,
            camSpeed: 2.5,
            camFov: 1.6,
            camRollAmp: 0.15,
            camRollFreq: 0.08,
            camLookAhead: 1,
            sunPathOffset: 21.4,
            tunnelRadius: 2.8,
            pathAmpX: 1.4,
            pathFreqX: 0.2,
            pathAmpY: 2.99,
            pathFreqY: 0.15,
            lightningEnabled: 0,
            lightningIntensity: 0.5,
        }
    },
    {
        id: 'storm',
        name: 'Storm',
        icon: CloudLightning,
        theme: 'clouds',
        params: {
            noiseMethod: 2, // Ridged Billows - dramatic storm clouds
            bgColor: '#05186B',
            lightColor1: '#B4BFCB',
            lightColor2: '#A6BACE',
            cloudBaseCol: '#4b5c74',
            cloudShadowCol: '#000000',
            sunGlowCol: '#DFE3EC',
            sunCoreCol: '#aaddff',
            sunGlareCol: '#0F2D61',
            vortexSpeed: 0.7,
            vortexTwist: -0.12,
            noiseScaleBase: 0.25,
            noiseScaleDet: 0.85,
            cloudDensity: 2.5,
            drawDist: 90,
            sunCorePow: 11,
            sunGlarePow: 16,
            lightningEnabled: 1,
            lightningChance: 0.46,
            lightningColor: '#cccbec',
            lightningIntensity: 1.4,
            lightningAudioSync: 1,
            lightningThreshold: 0.81,
        }
    },
    {
        id: 'moon',
        name: 'Moonlight',
        icon: Moon,
        theme: 'clouds',
        params: {
            noiseMethod: 4, // Flowing Warp - flowing, liquid moonlit clouds
            cloudBaseCol: '#a2a196',
            cloudShadowCol: '#050810',
            sunGlowCol: '#F4FFA3',
            sunCoreCol: '#FFFCE5',
            sunGlareCol: '#10337A',
            sunCorePow: 67,
            sunGlarePow: 16,
            vortexSpeed: -0.4,
            vortexTwist: 0.15,
            noiseScaleBase: 0.28,
            noiseScaleDet: 0.9,
            cloudDensity: 3.2,
            drawDist: 140,
            tunnelRadius: 3.5,
            pathAmpX: 1.4,
            pathFreqX: 0.2,
            pathAmpY: 2.99,
            pathFreqY: 0.15,
            bgColor: '#080C15',
            lightColor1: '#6B6D70',
            lightColor2: '#6b6d70',
            camSpeed: 2.0,
            camFov: 1.8,
            camRollAmp: 0.15,
            camRollFreq: 0.08,
            camLookAhead: 1,
            sunPathOffset: 30.4,
            lightningEnabled: 0,
            lightningIntensity: 0.8,
        }
    },
    // ═══════════════════════════════════════════════════════
    // WATER PRESETS — Shadertoy-style vortex tunnel
    //   nebulaDensity  → vortex opening size + raymarch threshold
    //   noiseScaleBase → water texture scale
    //   vortexSpeed    → noise rotation speed
    //   starGlowSize   → camera drift amplitude
    //   nebulaFalloff  → fresnel max reflectivity
    //   starDensity    → fog start distance
    //   starBrightness → fog depth range
    //   nebulaColor1   → shallow colour
    //   nebulaColor2   → deep colour
    //   nebulaColor3   → mist / fog colour
    // ═══════════════════════════════════════════════════════
    {
        id: 'maelstrom',
        name: 'Maelstrom',
        icon: WaveCircle,
        theme: 'cosmos',
        params: {
            bgColor: '#1A2D3D',
            nebulaDensity: 4.0,
            noiseScaleBase: 0.3,
            vortexSpeed: 1.0,
            vortexTwist: 1.0,          // natural rolling water texture
            noiseScaleDet: 0.18,       // medium wave frequency
            starGlowSize: 1.0,
            nebulaFalloff: 0.75,
            starDensity: 25.0,
            starBrightness: 15.0,
            sunGlowCol: '#C8E8F8',     // reflection tint — cool blue-white highlights
            nebulaColor1: '#334D66',   // shallow  ≈ vec3(0.20, 0.30, 0.40)
            nebulaColor2: '#1A5D70',   // deep     ≈ vec3(0.10, 0.365, 0.44)
            nebulaColor3: '#D9D9D9',   // mist     ≈ vec3(0.85, 0.85, 0.85)
            renderSteps: 150,
        }
    },
    {
        id: 'abyss',
        name: 'Abyss',
        icon: Whale,
        theme: 'cosmos',
        params: {
            bgColor: '#030508',
            nebulaDensity: 5.0,        // wider, more open vortex
            noiseScaleBase: 0.22,      // larger water features
            vortexSpeed: 0.35,         // slow, ominous spin
            vortexTwist: 0.3,          // barely-textured — glassy dark mirror
            noiseScaleDet: 0.1,        // very low frequency = huge gentle undulations
            starGlowSize: 0.4,         // subtle drift
            nebulaFalloff: 0.88,       // highly reflective (glassy dark water)
            starDensity: 10.0,         // fog starts close
            starBrightness: 22.0,      // deep fog range
            sunGlowCol: '#0D1A28',     // reflection tint — nearly black, minimal highlights
            nebulaColor1: '#0A1422',   // near-black shallow
            nebulaColor2: '#060E18',   // near-black deep
            nebulaColor3: '#0A1220',   // dark fog — abyss swallows the light
            renderSteps: 150,
        }
    },
    {
        id: 'lagoon',
        name: 'Lagoon',
        icon: Waves,
        theme: 'cosmos',
        params: {
            bgColor: '#0B3344',
            nebulaDensity: 3.5,        // smaller, tighter vortex opening
            noiseScaleBase: 0.38,      // finer ripple detail
            vortexSpeed: 1.6,          // fast, playful spin
            vortexTwist: 1.5,          // choppy, turbulent surface
            noiseScaleDet: 0.35,       // high frequency = tight cresting ripples
            starGlowSize: 1.4,         // active camera drift
            nebulaFalloff: 0.6,        // moderate reflectivity (clear shallow water)
            starDensity: 30.0,         // fog starts far (clear water)
            starBrightness: 10.0,      // tight fog band → white-bright centre
            sunGlowCol: '#AAFFEE',     // reflection tint — bright aqua highlights
            nebulaColor1: '#0099BB',   // bright cyan shallow
            nebulaColor2: '#005F80',   // rich teal deep
            nebulaColor3: '#E0F8FF',   // pale-ice fog
            renderSteps: 150,
        }
    },
    {
        id: 'arctic',
        name: 'Arctic',
        icon: Snowflake,
        theme: 'cosmos',
        params: {
            bgColor: '#0E1A25',
            nebulaDensity: 4.5,        // broad, open funnel
            noiseScaleBase: 0.25,      // smooth, glassy surface
            vortexSpeed: 0.5,          // slow, meditative rotation
            vortexTwist: 0.2,          // barely-there texture — ice-smooth surface
            noiseScaleDet: 0.12,       // very low frequency = smooth glass undulations
            starGlowSize: 0.5,         // very subtle drift
            nebulaFalloff: 0.5,        // low reflectivity (matte ice)
            starDensity: 20.0,
            starBrightness: 18.0,
            sunGlowCol: '#E8F4FF',     // reflection tint — ice-white cold highlights
            nebulaColor1: '#8BAABB',   // pale steel-blue shallow
            nebulaColor2: '#5580AA',   // cold slate deep
            nebulaColor3: '#EEF5FF',   // white-blue ice-mist fog
            renderSteps: 150,
        }
    }
];
