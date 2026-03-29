// Shared camera setup and entry point used by all themes
export const main = `
    mat3 setCamera(in vec3 ro, in vec3 ta, float cr)
    {
        vec3 cw = normalize(ta - ro);
        vec3 cp = vec3(sin(cr), cos(cr), 0.0);
        vec3 cu = normalize(cross(cw, cp));
        vec3 cv = normalize(cross(cu, cw));
        return mat3(cu, cv, cw);
    }

    void main() {
        vec2 fragCoord = gl_FragCoord.xy;
        vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

        float t = uCamZ;

        // Current position on path
        vec3 ro = path(t);
        // Look ahead on the path
        vec3 ta = path(t + CAM_LOOK_AHEAD);

        float roll = CAM_ROLL_AMP * sin(t * CAM_ROLL_FREQ);

        mat3 ca = setCamera(ro, ta, roll);

        vec3 rd = ca * normalize(vec3(p.xy, CAM_FOV));

        // Call theme-specific render
        vec4 col = render(ro, rd, ivec2(fragCoord - 0.5), t);

        // Apply theme fade for smooth transitions
        col.rgb *= uFadeAlpha;

        gl_FragColor = col;
    }
`;
