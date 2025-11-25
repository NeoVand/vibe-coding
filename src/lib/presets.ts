import type { ShaderParams } from './shaderParams';
import { Cloud, Sunset, CloudLightning, Moon } from 'lucide-svelte';

export type Preset = {
    id: string;
    name: string;
    icon: any;
    params: Partial<ShaderParams>;
};

export const PRESETS: Preset[] = [
    {
        id: 'default',
        name: 'Dreamy',
        icon: Cloud,
        params: {
            bgColor: '#A8BAC9',
            lightColor1: '#D1D1E0',
            lightColor2: '#FFF0F2',
            cloudBaseCol: '#F2F2FF',
            cloudShadowCol: '#59597A',
            sunGlowCol: '#FFFFFF',
            sunCoreCol: '#FFFFFF',
            sunGlareCol: '#FFD9CC',
            vortexSpeed: 0.3,
            vortexTwist: 0.1,
        }
    },
    {
        id: 'sunset',
        name: 'Sunset',
        icon: Sunset,
        params: {
            bgColor: '#DABCCA',
            lightColor1: '#ff9900',
            lightColor2: '#E7D4CB',
            cloudBaseCol: '#ffdab9',
            cloudShadowCol: '#04052F',
            sunGlowCol: '#ffaa00',
            sunCoreCol: '#ffffcc',
            sunGlareCol: '#E2C5A7',
            cloudDensity: 3.8,
            sunCorePow: 36,
            sunGlarePow: 16,
            vortexSpeed: -0.6,
            vortexTwist: 0.2,
        }
    },
    {
        id: 'storm',
        name: 'Storm',
        icon: CloudLightning,
        params: {
            bgColor: '#05186B',
            lightColor1: '#B4BFCB',
            lightColor2: '#A6BACE',
            cloudBaseCol: '#4b5c74',
            cloudShadowCol: '#000000',
            sunGlowCol: '#DFE3EC',
            sunCoreCol: '#aaddff',
            sunGlareCol: '#0F2D61',
            vortexSpeed: 0.9,
            vortexTwist: -0.15,
            noiseScaleDet: 0.9,
            sunCorePow: 11,
            sunGlarePow: 16
        }
    },
    {
        id: 'moon',
        name: 'Moonlight',
        icon: Moon,
        params: {
            bgColor: '#080C15',
            lightColor1: '#6B6D70',
            lightColor2: '#BABEC5',
            cloudBaseCol: '#989655',
            cloudShadowCol: '#050810',
            sunGlowCol: '#F4FFA3',
            sunCoreCol: '#FFFCE5',
            sunGlareCol: '#10337A',
            sunCorePow: 67,
            sunGlarePow: 16,
            vortexSpeed: -0.6,
            vortexTwist: 0.2,
        }
    }
];

