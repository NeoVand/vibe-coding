import { writable } from 'svelte/store';

export type AudioState = {
    isPlaying: boolean;
    volume: number;      // 0.0 - 1.0 (smoothed overall)
    bass: number;        // 0.0 - 1.0
    mid: number;         // 0.0 - 1.0
    high: number;        // 0.0 - 1.0
    beat: number;        // 0.0 - 1.0 (decaying trigger value)
    beatDetected: boolean; // True for one frame when beat occurs
};

export const audioState = writable<AudioState>({
    isPlaying: false,
    volume: 0,
    bass: 0,
    mid: 0,
    high: 0,
    beat: 0,
    beatDetected: false
});

