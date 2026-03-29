export const render = `
    vec4 render(in vec3 ro, in vec3 rd, in ivec2 px, in float camT)
    {
        vec3 sunPos = path(camT + SUN_PATH_OFFSET);
        vec3 sundir = normalize(sunPos - ro);
        float sun = clamp(dot(sundir, rd), 0.0, 1.0);

        // Background for missed rays: bright misty water
        // Reference uses vec3(0.95) — near white
        vec3 col = vec3(0.8, 0.82, 0.85);
        col += SUN_CORE_COL * 0.3 * pow(sun, SUN_CORE_POW);

        // Raymarch water surface
        vec4 res = raymarch(ro, rd, col, px, sundir);
        col = col * (1.0 - res.w) + res.xyz;

        // Very subtle post glare
        col += SUN_GLARE_COL * 0.05 * pow(sun, SUN_GLARE_POW);

        // NO heavy tonemap — reference outputs color directly
        // Just a very mild gamma for screen correction
        col = pow(clamp(col, 0.0, 1.0), vec3(0.95));

        return vec4(col, 1.0);
    }
`;
