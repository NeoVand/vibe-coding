import type { ShaderParams } from '$lib/shaderParams';
import type { Preset } from '$lib/presets';

export type ThemeDefinition = {
    id: string;
    name: string;
    vertexShader: string;
    fragmentShader: string;
    // Theme-specific uniforms to add to the base set
    setupUniforms?: (material: any, params: ShaderParams) => void;
    // Theme-specific uniform updates per frame
    updateUniforms?: (material: any, params: ShaderParams, dt: number) => void;
};

// Lazy-load themes to avoid importing all shaders upfront
export async function loadTheme(themeId: string): Promise<ThemeDefinition> {
    switch (themeId) {
        case 'clouds': {
            const mod = await import('./clouds/index');
            return {
                id: 'clouds',
                name: 'Clouds',
                vertexShader: mod.vertexShader,
                fragmentShader: mod.fragmentShader,
            };
        }
        case 'cosmos': {
            const mod = await import('./cosmos/index');
            return {
                id: 'cosmos',
                name: 'Cosmos',
                vertexShader: mod.vertexShader,
                fragmentShader: mod.fragmentShader,
            };
        }
        default:
            throw new Error(`Unknown theme: ${themeId}`);
    }
}

// Synchronous loader for themes already imported
const themeCache = new Map<string, ThemeDefinition>();

export function getThemeSync(themeId: string): ThemeDefinition | undefined {
    return themeCache.get(themeId);
}

export function cacheTheme(theme: ThemeDefinition) {
    themeCache.set(theme.id, theme);
}
