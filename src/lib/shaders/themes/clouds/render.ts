export const render = `
    vec4 render(in vec3 ro, in vec3 rd, in ivec2 px, in float t)
    {
        // Calculate sun direction based on path offset
        vec3 sunPos = path(t + SUN_PATH_OFFSET);
        vec3 sundir = normalize(sunPos - ro);

        // Sun calculation
        float sun = clamp(dot(sundir, rd), 0.0, 1.0);

        // Background gradient
        vec3 col = BG_COLOR;
        
        // Add "Light at end of tunnel" glow
        col += 0.4 * SUN_GLOW_COL * pow(sun, SUN_GLOW_POW);
        
        // Core of the sun
        col += 1.0 * SUN_CORE_COL * pow(sun, SUN_CORE_POW);

        // clouds    
        vec4 res = raymarch(ro, rd, col, px, sundir);
        col = col * (1.0 - res.w) + res.xyz;
        
        // sun glare over clouds
        col += 0.2 * SUN_GLARE_COL * pow(sun, SUN_GLARE_POW);

        // tonemap
        col = smoothstep(0.0, 1.0, col);
        col = pow(col, vec3(0.4545)); 
     
        return vec4(col, 1.0);
    }
`;

