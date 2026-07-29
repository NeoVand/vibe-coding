import { baseUniforms, utils } from '../../core';
export { vertexShader } from '../../core/vertex';

// Extra uniforms for the water shader — reuses cosmos/nebula/star slots
// already present in the ShaderMaterial, so no new uniform objects needed.
const waterUniforms = `
    uniform vec3  NEBULA_COLOR_1;   // shallow water colour
    uniform vec3  NEBULA_COLOR_2;   // deep water colour
    uniform vec3  NEBULA_COLOR_3;   // mist / fog colour
    uniform float NEBULA_DENSITY;   // vortex opening size  (default 4.0)
    uniform float NEBULA_FALLOFF;   // fresnel max          (default 0.75)
    uniform float STAR_DENSITY;     // fog start distance   (default 25.0)
    uniform float STAR_BRIGHTNESS;  // fog depth range      (default 15.0)
    uniform float STAR_GLOW_SIZE;   // camera drift amp     (default 1.0)
`;

// Water tunnel shader — parameterised port of the Shadertoy reference
// Sky: TDM (shadertoy.com/view/Ms2SD1)
// Noise comes from the shared texNoise (core/utils) — one texture fetch per
// octave instead of the reference's 8-corner sin() hash, which cost ~64
// transcendentals per wWater() call and made the raymarch GPU-bound.
const waterGLSL = `
    mat2 wRot(float a) {
        float ca = cos(a);
        float sa = sin(a);
        return mat2(ca, sa, -sa, ca);
    }

    // Amplitude-weighted FBM (2, 1, 0.5, ...). Same lattice frequencies and
    // [0,1] value range as the old ALU noise, so scale/contrast are preserved.
    // oct is the LOD: the march uses 4 octaves (>94% of total amplitude — the
    // rest shifts the isosurface imperceptibly), surface normals use all 6.
    // Octaves 7-8 of the original sat below both pixel size and the normal
    // eps at water noise scales, contributing only aliasing shimmer.
    float wFbm(in vec3 p, in int oct) {
        float n1 = 0.0;
        float c = 1.0;
        float amp = 2.0;
        float d = 1.0;
        for (int i = 0; i < 6; ++i) {
            if (i >= oct) break;
            n1 += amp * texNoise((p * c - 0.5 * c * d) * NOISE_SCALE_BASE);
            c   *= 2.0;
            amp *= 0.5;
            d   += 1.5;
        }
        return n1;
    }

    // NOISE_SCALE_BASE — water noise texture scale  (finer = smaller ripples)
    // NOISE_SCALE_DET  — wave shape frequency       (Controls: "Wave Freq")
    // VORTEX_TWIST     — FBM texture amplitude      (Controls: "Bump Depth")
    //                    0 = glassy smooth, 1 = natural water, 2 = very rough
    // rot — vortex rotation from uVortexPhase, built once per pixel in main()
    //       (CPU-integrated phase; avoids jump when speed slider changes)
    float wWater(in vec3 p, in mat2 rot, in int oct) {
        // Tunnel geometry — NOISE_SCALE_DET controls ripple frequency.
        // Amplitude is fixed at 1.5 so the vortex opening stays stable regardless
        // of what VORTEX_TWIST (Bump Depth) is set to.
        vec3 tun = vec3(
            p.x + sin(length(p * NOISE_SCALE_DET) + iTime) * 1.5,
            p.y + sin(length(p * NOISE_SCALE_DET))          * 1.5,
            0.0
        );
        float coef = length(tun) - NEBULA_DENSITY;

        p.xy *= rot;
        // VORTEX_TWIST scales the FBM contribution → directly controls how much
        // the noise field textures the surface (visible bumps in the normals).
        // Geometry (coef) is unaffected, so the vortex opening never breaks.
        return (1.0 + wFbm(p, oct) * VORTEX_TWIST) * coef;
    }

    // Uses PATH_FREQ_X/Y so the tunnel path matches the cloud tunnel path,
    // giving a seamless spatial context across theme transitions.
    vec3 wTunnelPath(vec3 p) {
        vec3 off = vec3(0.0);
        off.x += sin(p.z * PATH_FREQ_X) * 1.5;
        off.y += sin(p.z * PATH_FREQ_Y) * 1.3;
        return off;
    }

    // SUN_GLOW_COL is repurposed as the sky/reflection tint in water mode.
    // It drives the specular-like highlights on the water surface.
    vec3 wSky(vec3 e) {
        e.y = max(e.y, 0.0);
        float fade = 1.0 - e.y;
        return SUN_GLOW_COL * (fade * fade * 0.9 + 0.1) * texNoise(e);
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
        uv.x *= iResolution.x / iResolution.y;

        // Camera — uses shared uniforms so sliders in the Camera group work here too.
        // STAR_GLOW_SIZE drives lateral drift amplitude.
        vec3 s = vec3(-1.0, -1.0, -3.0);
        // CAM_ROLL_FREQ / CAM_ROLL_AMP control the subtle camera roll
        s.xz *= wRot(sin(uVortexPhase * CAM_ROLL_FREQ) * CAM_ROLL_AMP * 0.1);
        vec3 tgt = vec3(0.0);
        s   -= wTunnelPath(s);
        tgt -= wTunnelPath(tgt);
        // Lateral drift uses the same path frequencies as the cloud tunnel,
        // so the view sway feels continuous when switching between themes.
        s.x += sin(uCamZ * PATH_FREQ_X) * STAR_GLOW_SIZE * 0.4;
        s.y += sin(uCamZ * PATH_FREQ_Y) * STAR_GLOW_SIZE * 0.4;

        vec3 cz = normalize(tgt - s);
        vec3 cx = normalize(cross(cz, vec3(0.0, 1.0, 0.0)));
        vec3 cy = normalize(cross(cz, cx));
        // CAM_FOV controls perspective. 1.26/FOV ≈ 0.7 at the default FOV of 1.8.
        vec3 rd = normalize(uv.x * cx + uv.y * cy + cz * (1.26 / CAM_FOV));

        // Raymarch — accumulate density until NEBULA_DENSITY threshold.
        // Coarse 4-octave LOD: only the converged position matters here, and
        // the dropped octaves carry <6% of the field's amplitude.
        mat2 vortRot = wRot(uVortexPhase);
        vec3 p = s;
        float acc = 0.0;
        float thresh = NEBULA_DENSITY;
        for (int i = 0; i < 200; ++i) {
            if (i >= RENDER_STEPS) break;
            float mH = wWater(p, vortRot, 4);
            acc += mH;
            if (acc > thresh) break;
            p += rd * (mH - thresh) * 0.09;
        }

        // Fog — STAR_DENSITY = start, STAR_BRIGHTNESS = range
        float fog = clamp((length(p - s) - STAR_DENSITY) / max(STAR_BRIGHTNESS, 0.1), 0.0, 1.0);

        vec3 col;
        if (fog >= 0.999) {
            // Fully fogged — normals and reflection can't affect the colour
            col = NEBULA_COLOR_3;
        } else {
            // Normal via backward finite differences, full 6-octave detail
            vec2 eps = vec2(0.05, 0.0);
            vec3 zV  = vec3(0.0, 0.0, 1.0);
            float d0 = wWater(p, vortRot, 6);
            vec3 n   = normalize(d0 - vec3(
                wWater(p - eps.xyy, vortRot, 6),
                wWater(p - eps.yxy, vortRot, 6),
                wWater(p - eps.yyx, vortRot, 6)
            ));

            // Base colour from shallow/deep mix + fresnel reflection
            col = mix(
                NEBULA_COLOR_1,
                NEBULA_COLOR_2,
                abs(1.0 + dot(n, s) * pow(dot(zV, rd), 5.0))
            );
            float fresnel  = clamp(1.0 - dot(n, s), 0.05, NEBULA_FALLOFF);
            vec3 reflected = wSky(abs(reflect(rd, n)));
            col = mix(col, reflected, fresnel * reflected.x);

            col = mix(col, NEBULA_COLOR_3, fog);
        }

        col *= uFadeAlpha;
        gl_FragColor = vec4(col, 1.0);
    }
`;

export const fragmentShader = [baseUniforms, waterUniforms, utils, waterGLSL].join('\n');
