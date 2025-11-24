
import * as THREE from 'three';

export function createNoiseTexture(size = 256): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size * 4; i++) {
        data[i] = Math.floor(Math.random() * 255);
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

export function createBlueNoiseTexture(size = 1024): THREE.DataTexture {
    const sizeSq = size * size;
    const data = new Uint8Array(sizeSq * 4);
    
    // Generate initial white noise
    const temp = new Float32Array(sizeSq * 4);
    for (let i = 0; i < sizeSq * 4; i++) {
        temp[i] = Math.random();
    }

    // Approximate Blue Noise by subtracting a Gaussian blur (High-pass filter)
    // This removes low-frequency clumps, leaving high-frequency noise (Blue Noise)
    // We process each channel independently
    
    const blurred = new Float32Array(sizeSq * 4);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            
            // Simple box blur
            let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
            let count = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const ny = (y + ky + size) % size;
                    const nx = (x + kx + size) % size;
                    const ni = (ny * size + nx) * 4;
                    
                    sumR += temp[ni];
                    sumG += temp[ni + 1];
                    sumB += temp[ni + 2];
                    sumA += temp[ni + 3];
                    count++;
                }
            }
            
            blurred[i] = sumR / count;
            blurred[i + 1] = sumG / count;
            blurred[i + 2] = sumB / count;
            blurred[i + 3] = sumA / count;
        }
    }
    
    // Subtract blurred from original and normalize
    for (let i = 0; i < sizeSq * 4; i++) {
        let val = temp[i] - blurred[i];
        // Normalize to 0..1 (approximate range shift)
        val = val + 0.5;
        val = Math.max(0, Math.min(1, val)); // Clamp
        
        data[i] = Math.floor(val * 255);
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
}
