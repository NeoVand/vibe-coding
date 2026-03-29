// Base uniforms shared across all themes
export const baseUniforms = `
    uniform vec3 iResolution;
    uniform float iTime;

    // Integrated uniforms for stability
    uniform float uCamZ;
    uniform float uVortexPhase;

    // Pre-computed noise phase (wrapped for precision safety)
    uniform float uNoisePhase;

    uniform sampler2D iChannel0;
    uniform sampler2D iChannel1;

    uniform int USE_LOD;
    uniform int RENDER_STEPS;
    uniform float DRAW_DIST;
    uniform float CAM_SPEED;
    uniform float CAM_FOV;
    uniform float CAM_ROLL_AMP;
    uniform float CAM_ROLL_FREQ;
    uniform float CAM_LOOK_AHEAD;
    uniform float SUN_PATH_OFFSET;
    uniform float TUNNEL_RADIUS;
    uniform float PATH_AMP_X;
    uniform float PATH_FREQ_X;
    uniform float PATH_AMP_Y;
    uniform float PATH_FREQ_Y;
    uniform float VORTEX_SPEED;
    uniform float VORTEX_TWIST;
    uniform float NOISE_SCALE_BASE;
    uniform float NOISE_SCALE_DET;
    uniform float CLOUD_DENSITY;
    uniform vec3 BG_COLOR;
    uniform vec3 LIGHT_COLOR_1;
    uniform vec3 LIGHT_COLOR_2;
    uniform vec3 CLOUD_BASE_COL;
    uniform vec3 CLOUD_SHADOW_COL;
    uniform float FOG_DENSITY;
    uniform vec3 SUN_GLOW_COL;
    uniform float SUN_GLOW_POW;
    uniform vec3 SUN_CORE_COL;
    uniform float SUN_CORE_POW;
    uniform vec3 SUN_GLARE_COL;
    uniform float SUN_GLARE_POW;

    // Theme fade for smooth transitions
    uniform float uFadeAlpha;

    // Audio
    uniform float AUDIO_BEAT;
    uniform float AUDIO_BASS;
    uniform float AUDIO_MID;
    uniform float AUDIO_HIGH;
`;
