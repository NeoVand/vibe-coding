export const lightning = `
    // --- LIGHTNING FUNCTION ---
    // Returns { intensity (0-1+), flashFactor (0-1) }
    vec2 getLightningField(vec3 p, float time) {
        if (LIGHTNING_ENABLED == 0) return vec2(0.0);

        // Timing
        float t = time * 8.0;
        float id = floor(t);
        float localT = fract(t);
        
        // Random chance logic (Standard vs Audio Sync)
        float chance = LIGHTNING_CHANCE;
        bool triggered = false;
        
        if (LIGHTNING_AUDIO_SYNC == 1) {
            // Audio Sync Mode:
            // 1. Use AUDIO_BEAT uniform (value 0.0 - 1.0) to trigger
            // 2. Still use randomness to decide WHERE it strikes (id), 
            //    but the TIMING is driven by the beat.
            // 3. Maybe boost chance significantly when beat is high?
            
            // Thresholding in shader is tricky due to interpolation, 
            // but we can check if beat > 0.1
            if (AUDIO_BEAT > 0.1) {
                // Beat happened recently.
                // We use the beat value as the "flash" envelope directly or mix it?
                triggered = true;
            }
        } else {
            // Standard Random Mode
            if (hash(id) < chance) {
                triggered = true;
            }
        }
        
        if (!triggered) return vec2(0.0);
        
        // Flash envelope
        float flash = 0.0;
        
        if (LIGHTNING_AUDIO_SYNC == 1) {
            // Use the beat envelope directly for smooth decay
            // Squared for sharper attack
            flash = pow(AUDIO_BEAT, 2.0); 
        } else {
            // Standard ADSR
            flash = smoothstep(0.0, 0.1, localT) * smoothstep(1.0, 0.3, localT);
            flash = pow(flash, 3.0); 
        }
        
        if (flash < 0.001) return vec2(0.0);

        // Path / Position
        // Determine a random angle for this strike
        // In Audio Sync, we need to make sure the 'id' (position seed) 
        // changes with every beat or time step.
        // Using 'id' derived from 'time' works if 'time' keeps moving.
        // But for Audio Sync, we might want the bolt to stay for the duration of the beat?
        // No, lightning is instant.
        
        float strikeAngle = hash(id + 13.0) * 6.28;
        
        vec3 pPath = path(p.z);
        vec3 relP = p - pPath;
        
        // Wiggle the angle along Z to make it a "vein"
        // Use lower frequency for main shape
        float wiggle = noise(vec3(0.0, 0.0, p.z * 0.15 + id * 10.0)) * 2.0; 
        // Add detail
        wiggle += noise(vec3(0.0, 0.0, p.z * 0.8)) * 0.5;
        
        float targetAngle = strikeAngle + wiggle;
        float myAngle = atan(relP.y, relP.x);
        float diff = abs(myAngle - targetAngle);
        if (diff > 3.14159) diff = 6.28318 - diff;
        
        // Distance from center (wall proximity)
        float r = length(relP.xy);
        float distFromWall = abs(r - TUNNEL_RADIUS);
        
        // Combined distance to the "vein"
        // We treat the vein as a line running along the wall at that angle
        float d = length(vec2(diff * r, distFromWall));
        
        // Volumetric Glow Falloff
        // Inverse square law-ish for the glow
        float glow = 1.0 / (d * d + 0.1);
        
        // Core Beam (The actual plasma channel) - Thinner and sharper
        float core = 0.002 / (d * d + 0.0001);
        
        return vec2(core, glow) * flash;
    }
`;

