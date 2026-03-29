export const raymarch = `
    // ============================================================
    // WATER SURFACE RENDERER
    // Key insight from reference shader:
    //   - Fog is BRIGHT (light scattering in water), not dark
    //   - Environment reflection is a bright sky, not darkness
    //   - Water body color is muted grey-blue, not vivid
    //   - Fresnel makes glancing angles highly reflective
    // ============================================================

    // Sky/environment color for reflections
    // Modeled after reference: getSkyColor returns warm bright gradient
    // vec3(pow(1-y,2), 1-y, 0.6+(1-y)*0.4) — warm at horizon, cool at zenith
    vec3 getEnvColor(vec3 dir, vec3 sundir) {
        float y = abs(dir.y);
        y = max(y, 0.0);
        // Bright warm sky gradient (reference-accurate)
        vec3 env = vec3(pow(1.0 - y, 2.0), 1.0 - y, 0.6 + (1.0 - y) * 0.4);
        // Tint slightly toward the water theme color
        env = mix(env, env * (NEBULA_COLOR_1 * 2.0 + vec3(0.5)), 0.25);
        // Sun caustic spots
        float sunDot = max(0.0, dot(dir, sundir));
        env += SUN_CORE_COL * pow(sunDot, 64.0) * 0.3;
        return env;
    }

    vec4 raymarch(in vec3 ro, in vec3 rd, in vec3 bgcol, in ivec2 px, in vec3 sundir)
    {
        float t = 0.05 + 0.05 * texelFetch(iChannel1, px & ivec2(1023), 0).x;

        for (int i = 0; i < 300; i++)
        {
            if (i >= RENDER_STEPS) break;

            vec3 pos = ro + t * rd;

            int oct = 4;
            if (USE_LOD == 1) {
                if (t > 5.0) oct = 3;
                if (t > 15.0) oct = 2;
                if (t > 30.0) oct = 1;
            }

            float den = map(pos, oct);

            if (den > 0.04) {
                // Refine hit position (one bisection step)
                float dt = max(0.05, 0.05 * t);
                float t2 = t - dt * 0.5;
                vec3 pos2 = ro + t2 * rd;
                if (map(pos2, min(oct, 3)) > 0.04) {
                    pos = pos2;
                    t = t2;
                }

                // Surface normal via finite differences
                float eps = 0.06;
                float d0 = map(pos, 2);
                vec3 nor = normalize(vec3(
                    d0 - map(pos - vec3(eps, 0.0, 0.0), 2),
                    d0 - map(pos - vec3(0.0, eps, 0.0), 2),
                    d0 - map(pos - vec3(0.0, 0.0, eps), 2)
                ));

                // ========== WATER SHADING (matching reference) ==========
                vec3 V = -rd;
                float NdotV = max(0.001, dot(nor, V));

                // Fresnel — the #1 cue that says "this is water"
                float fresnel = pow(1.0 - NdotV, 4.0);
                fresnel = clamp(fresnel, 0.04, NEBULA_FALLOFF);

                // Reflection (blend normal with up for smoother reflections, like reference)
                vec3 smoothNor = normalize(nor * 0.6 + vec3(0.0, 1.0, 0.0) * 0.4);
                vec3 reflDir = reflect(rd, smoothNor);
                vec3 reflCol = getEnvColor(reflDir, sundir);

                // Water body color: muted grey-blue (like reference)
                // Head-on → deep color, glancing → shallow/surface color
                vec3 waterCol = mix(NEBULA_COLOR_1, NEBULA_COLOR_2, NdotV);

                // Subtle subsurface light
                float diff = max(0.0, dot(nor, sundir));
                waterCol += LIGHT_COLOR_2 * diff * 0.15;

                // Specular (subtle, not audio-twitchy)
                vec3 H = normalize(sundir + V);
                float spec = pow(max(0.0, dot(nor, H)), 48.0);
                // Audio: very gentle specular shimmer on beat
                spec *= (1.0 + AUDIO_BEAT * 1.0);

                // Foam at wave crests
                float foamMask = smoothstep(0.08, 0.4, den) * STAR_DENSITY;
                vec3 foamCol = vec3(0.7, 0.75, 0.8) * foamMask;

                // === COMBINE (matching reference: col = mix(col, reflected, fresnel*reflected)) ===
                // The reference multiplies fresnel by reflected brightness
                // This means brighter reflections show through more strongly
                vec3 col = mix(waterCol, reflCol, fresnel * reflCol);
                // Specular highlight
                col += NEBULA_COLOR_3 * spec * 0.3;
                // Foam
                col += foamCol;

                // Audio: mid creates very subtle subsurface glow
                col += NEBULA_COLOR_1 * AUDIO_MID * 0.08 * (1.0 - NdotV);

                // CRITICAL: Underwater fog is BRIGHT (scattered light)
                // Reference fades to vec3(0.85) starting close
                // This is THE key to water look vs cave look
                vec3 fogCol = vec3(0.65, 0.7, 0.75) + NEBULA_COLOR_1 * 0.1;
                float fog = clamp((t - 8.0) / 35.0, 0.0, 1.0);
                col = mix(col, fogCol, fog);

                return vec4(col, 1.0);
            }

            float dt = max(0.05, 0.06 * t);
            t += dt;
            if (t > DRAW_DIST) break;
        }

        return vec4(0.0, 0.0, 0.0, 0.0);
    }
`;
