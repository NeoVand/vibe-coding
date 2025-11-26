export const path = `
    // --- PATH FUNCTION ---
    vec3 path(in float z)
    {
        float t = z;
        vec3 p = vec3(sin(t * PATH_FREQ_X) * PATH_AMP_X, 
                      cos(t * PATH_FREQ_Y) * PATH_AMP_Y, 
                      z);
        return p;
    }
`;

