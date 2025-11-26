
<script lang="ts">
    import { Settings, Video, CircleDot, Image, Zap, Volume2, VolumeX, Headphones, Cloud, Sun, Sunset, Sunrise, Haze, CloudLightning, Moon, Download, RotateCcw, Check, Gauge, Wind, Droplets, Waves, CloudFog, Mountain, Snowflake, Shell, Radar } from 'lucide-svelte';
    import { PRESETS, type Preset } from '$lib/presets';
	import { type ShaderParams, defaultParams } from '$lib/shaderParams';
	import { slide, fly, scale, fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { cubicOut, elasticOut } from 'svelte/easing';
    import { clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';
    import TunnelIcon from '$lib/components/icons/TunnelIcon.svelte';

    import { audioState } from '$lib/stores/audio';

	let { params = $bindable() }: { params: ShaderParams } = $props();

	let isOpen = $state(false);
    let activeGroup = $state("Camera");
    let activePresetId = $state("default");
    // Single state controls visibility - elements always in DOM, no insertion/removal
    let presetsVisible = $state(false);
    let hoverTimeout: NodeJS.Timeout;

    function toggle() {
        // Desktop: toggle open/close
        // Mobile: Handled by click logic below
        isOpen = !isOpen;
        if (isOpen) presetsVisible = false;
    }

    function close() {
        isOpen = false;
    }

    function applyPreset(preset: Preset) {
        Object.assign(params, preset.params);
        activePresetId = preset.id;
    }
    
    // Determine active icon
    let ActiveIcon = $derived(PRESETS.find(p => p.id === activePresetId)?.icon || PRESETS[0].icon);

    function handleMainMouseEnter() {
        if (isOpen || isTouch) return;
        clearTimeout(hoverTimeout);
        presetsVisible = true;
    }

    function handleMainMouseLeave() {
        if (isOpen || isTouch) return;
        hoverTimeout = setTimeout(() => {
            presetsVisible = false;
        }, 300);
    }
    
    // Touch handling for Mobile
    let longPressTimer: ReturnType<typeof setTimeout>;
    let isLongPress = $state(false);
    let isTouch = $state(false);

    function handleTouchStart(e: TouchEvent) {
        isTouch = true;
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            presetsVisible = false;
            if (navigator.vibrate) navigator.vibrate(50);
            setTimeout(() => {
                isOpen = true;
            }, 200);
        }, 500);
    }

    function handleTouchEnd(e: TouchEvent) {
        clearTimeout(longPressTimer);
        e.preventDefault();
        
        if (isLongPress) {
            return;
        }
        
        if (isOpen) {
            toggle();
        } else {
            presetsVisible = !presetsVisible;
        }
    }

    function handleContextMenu(e: Event) {
        if (isTouch) e.preventDefault();
    }
    
    function handleClick(e: MouseEvent) {
        // If we just had a touch event, ignore this click
        if (isTouch) {
            return;
        }

        // Desktop behavior:
        // First click: show presets
        // Second click: open GUI (toggle)
        if (!isOpen && !presetsVisible) {
            presetsVisible = true;
            return;
        }
        toggle();
    }

    function toggleGroup(title: string) {
        if (activeGroup !== title) {
            activeGroup = title;
        }
    }

    function getGroupDefaults(group: Group) {
        const preset = PRESETS.find(p => p.id === activePresetId) || PRESETS[0];
        const defaults: Partial<ShaderParams> = {};
        
        // Fallback hierarchy: Active Preset -> Default Preset -> System Defaults
        const defaultPreset = PRESETS.find(p => p.id === 'default') || PRESETS[0];
        
        for (const item of group.items) {
            const key = item.key;
            // Check if key exists in active preset
            if (preset.params && key in preset.params) {
                 defaults[key] = preset.params[key] as any;
            } 
            // If not, check default preset
            else if (defaultPreset.params && key in defaultPreset.params) {
                 defaults[key] = defaultPreset.params[key] as any;
            }
            // Finally check shaderParams defaults
            else {
                 defaults[key] = defaultParams[key] as any;
            }
        }
        return defaults;
    }

    function isGroupDirty(group: Group) {
        const defaults = getGroupDefaults(group);
        for (const item of group.items) {
            const key = item.key;
            // Loose equality check for floats might be needed, but strict is probably fine for now
            // given we are setting from defaults.
            if (params[key] !== defaults[key]) {
                return true;
            }
        }
        return false;
    }

    function handleReset(group: Group) {
        const defaults = getGroupDefaults(group);
        Object.assign(params, defaults);
    }

    function handleDownload(group: Group) {
        const data: Record<string, any> = {};
        
        // Add metadata header
        data['preset'] = activePresetId;
        data['group'] = group.title;

        for (const item of group.items) {
            data[item.key] = params[item.key];
        }
        
        // Simple YAML-like format
        const yamlLines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
        const content = yamlLines.join('\n');
        
        const blob = new Blob([content], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.title.toLowerCase()}-${activePresetId}.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function cn(...inputs: (string | undefined | null | false)[]) {
        return twMerge(clsx(inputs));
    }

    // --- Adaptive Theme Logic ---
    function getLuminance(hex: string): number {
        const c = hex.substring(1); // strip #
        const rgb = parseInt(c, 16); // convert rrggbb to decimal
        const r = (rgb >> 16) & 0xff; // extract red
        const g = (rgb >> 8) & 0xff; // extract green
        const b = (rgb >> 0) & 0xff; // extract blue

        // Standard luminance formula
        // 0.2126 R + 0.7152 G + 0.0722 B
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    // --- Audio Logic ---
    let isPlaying = $state(true);
    let isMuted = $state(false);
    let audio: HTMLAudioElement;
    
    // Web Audio API context
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let gainNode: GainNode | null = null;
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let animationFrameId: number;
    
    // Waveform path for SVG
    let visualizerPath = $state("M 0 50 L 100 50");
    let phase = 0;
    
    // Smoothing state
    let smoothBass = 0;
    let smoothHigh = 0;
    let smoothFlux = 0; // Background average of Spectral Flux
    let previousSpectrum = new Float32Array(0);
    let lastBeatTime = 0;

    function initAudioContext() {
        if (audioContext) return;
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; 
        // Use 0 to get raw data instantly, we handle smoothing manually for better control
        analyser.smoothingTimeConstant = 0; 

        gainNode = audioContext.createGain();

        if (audio) {
            sourceNode = audioContext.createMediaElementSource(audio);
            sourceNode.connect(gainNode);
            gainNode.connect(analyser);
            analyser.connect(audioContext.destination);
        }
        
        // Sync state
        audioState.update(s => ({ ...s, isPlaying: true }));
        
        updateVisualizer();
    }

    function updateVisualizer() {
        if (!analyser || isMuted || audio?.paused) {
            if (isMuted || audio?.paused) {
                 visualizerPath = "M 0 50 Q 50 50 100 50"; // Flat line
                 audioState.update(s => ({ ...s, isPlaying: false }));
                 if (animationFrameId) cancelAnimationFrame(animationFrameId);
                 return;
            }
        }

        if (analyser && audioContext) {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            
            const startBin = 5; 
            const midSplit = Math.floor(bufferLength * 0.2); 
            
            let bassSum = 0;
            let midSum = 0;
            let highSum = 0;
            
            // BASS: 0 - 150Hz approx (bins 0 to ~15 at 44.1k/512)
            // FFT resolution = 44100 / 512 ~= 86Hz per bin. Wait, 512 fftSize -> 256 bins. 
            // Actually, sampleRate/fftSize = frequency resolution. 44100/512 = 86Hz. 
            // Bin 0: DC, Bin 1: 86Hz, Bin 2: 172Hz. 
            // Bass needs to be very low index.
            
            // Let's refine the ranges roughly
            const bassEnd = 4; // ~350Hz
            const midEnd = 64; // ~5kHz
            
            for (let i = 0; i < bufferLength; i++) {
                if (i < bassEnd) bassSum += dataArray[i];
                else if (i < midEnd) midSum += dataArray[i];
                else highSum += dataArray[i];
            }
            
            // Averages 0-255
            const bassAvg = bassSum / bassEnd;
            const midAvg = midSum / (midEnd - bassEnd);
            const highAvg = highSum / (bufferLength - midEnd);
            
            // Normalized 0-1
            const nBass = bassAvg / 255;
            const nMid = midAvg / 255;
            const nHigh = highAvg / 255;
            
            // --- BEAT DETECTION (SPECTRAL FLUX) ---
            const now = performance.now();
            
            // Initialize previous frame buffer if needed (or size changed)
            if (previousSpectrum.length !== bufferLength) {
                previousSpectrum = new Float32Array(bufferLength);
            }
            
            // Calculate Flux: Sum of positive changes in energy per bin
            // We focus on Bass/Mid-Low for rhythm detection (bins 0 to ~100)
            // This avoids high-hats/noise triggering lightning too often
            let currentFlux = 0;
            const detectionCutoff = Math.min(bufferLength, 100); // ~4kHz limit
            
            for (let i = 0; i < detectionCutoff; i++) {
                // Use dataArray (Uint8) normalized to 0-1
                const value = dataArray[i] / 255;
                const diff = value - previousSpectrum[i];
                if (diff > 0) {
                    currentFlux += diff;
                }
                // Update history
                previousSpectrum[i] = value;
            }
            
            // Normalize flux by number of bins check to keep it in manageable range
            currentFlux /= detectionCutoff;
            
            // --- VISUALIZER LOGIC ---
            // Target Inputs
            const targetMid = Math.max(0, nMid - 0.1) * 0.5; 
            const targetHigh = nHigh * 8.0; 
            
            // Manual Smoothing with Asymmetric Attack/Release
            const smooth = (current: number, target: number, attack: number, decay: number) => {
                if (target > current) { 
                    return current + (target - current) * attack; // Snappy Up
                } 
                return current + (target - current) * decay; // Smooth Down
            };
            
            // Attack 0.8 = Nearly instant response. Decay 0.1 = Controlled release.
            smoothBass = smooth(smoothBass, targetMid, 0.8, 0.1); 
            smoothHigh = smooth(smoothHigh, targetHigh, 0.8, 0.15);
            
            // Update Flux Average (Adaptive Threshold)
            // Slow attack/decay to track the "busy-ness" of the track
            smoothFlux = smooth(smoothFlux, currentFlux, 0.05, 0.02); 
            
            // Update Store
            audioState.update(s => ({
                ...s,
                volume: (nBass + nMid + nHigh) / 3,
                bass: nBass,
                mid: nMid,
                high: nHigh,
                beat: Math.max(0, s.beat * 0.92), // Decay beat value slightly slower
                beatDetected: false
            }));
            
            // Dynamic variables
            phase += 0.05; 
            const volume = 0.2 + (smoothBass * 0.5) + (smoothHigh * 1.5);
            
            // --- TRIGGER BEAT ---
            // Algorithm: Is current Flux significantly higher than average Flux?
            // This works for both quiet and loud sections because it's relative to recent activity.
            
            // Avoid noise in silence
            if (currentFlux > 0.02) {
                // Slider 0.0 - 1.0
                // 0.0 -> Multiplier 1.1 (Very sensitive)
                // 0.5 -> Multiplier 1.5
                // 1.0 -> Multiplier 2.0 (Strict)
                const sensitivity = params.lightningThreshold || 0.25;
                const multiplier = 1.1 + (sensitivity * 0.9);
                
                // Trigger condition
                if (currentFlux > smoothFlux * multiplier && (now - lastBeatTime > 150)) {
                    lastBeatTime = now;
                    
                    // Update Store with Beat
                    audioState.update(s => ({
                        ...s,
                        beat: 1.0,
                        beatDetected: true
                    }));
                }
            }
            
            // Draw Visualizer
            const width = 100;
            const points = 64;
            // Generate Mirrored Waveform Path (Filled)
            let path = `M 0 50`;
            
            // Forward Pass (Top Half)
            for (let i = 0; i <= points; i++) {
                const normX = i / points;
                const window = Math.sin(normX * Math.PI);
                
                const yOffset = 
                    (Math.sin(normX * 6 + phase) * 8 * volume) + 
                    (Math.sin(normX * 12 + phase * 1.5) * 25 * volume);
                
                const y = 50 - (yOffset * window); // Upwards
                const x = normX * width;
                path += ` L ${x} ${y}`;
            }

            // Backward Pass (Bottom Half) - creates the symmetric mirror
            for (let i = points; i >= 0; i--) {
                const normX = i / points;
                const window = Math.sin(normX * Math.PI);
                
                const yOffset = 
                    (Math.sin(normX * 6 + phase) * 8 * volume) + 
                    (Math.sin(normX * 12 + phase * 1.5) * 25 * volume);
                
                const y = 50 + (yOffset * window); // Downwards
                const x = normX * width;
                path += ` L ${x} ${y}`;
            }
            
            path += " Z"; // Close shape
            
            visualizerPath = path;
        }
        
        animationFrameId = requestAnimationFrame(updateVisualizer);
    }

    function toggleAudio() {
        if (!audio) return;
        
        // Initialize Web Audio on first user interaction to bypass browser policies
        if (!audioContext) {
            initAudioContext();
        }
        
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (isMuted) {
            // Unmute: Fade In
            isMuted = false;
            
            // Ensure gain is 0 before playing
            if (gainNode) gainNode.gain.value = 0;
            
            audio.play().catch(() => {
                // If autoplay blocked, we just stay muted until user interacts again
                isMuted = true; 
            });
            fadeVolume(1.0);
            updateVisualizer(); // Restart loop
        } else {
            // Mute: Fade Out
            // Change icon IMMEDIATELY for instant user feedback
            isMuted = true;
            fadeVolume(0.0, () => {
                audio.pause();
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                visualizerPath = "M 0 50 L 100 50";
            });
        }
    }

    let fadeInterval: ReturnType<typeof setInterval>;

    function fadeVolume(target: number, onComplete?: () => void) {
        if (fadeInterval) clearInterval(fadeInterval);
        
        // Use gainNode if available (required for iOS), fallback to audio.volume
        const start = gainNode ? gainNode.gain.value : audio.volume;
        const diff = target - start;
        const duration = 1000; // 1 second fade
        const stepTime = 50;
        const steps = duration / stepTime;
        const stepValue = diff / steps;
        
        let currentStep = 0;
        
        fadeInterval = setInterval(() => {
            currentStep++;
            const newVolume = start + (stepValue * currentStep);
            const clampedVolume = Math.max(0, Math.min(1, newVolume));
            
            if (gainNode) {
                gainNode.gain.value = clampedVolume;
            } else {
                audio.volume = clampedVolume;
            }
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                if (gainNode) gainNode.gain.value = target;
                else audio.volume = target;
                
                if (onComplete) onComplete();
            }
        }, stepTime);
    }

    onMount(() => {
        const base = import.meta.env.BASE_URL;
        const audioPath = `${base === '/' ? '' : base}/music/intro-wind.mp3`;
        audio = new Audio(audioPath);
        audio.loop = true;
        // Remove initial silence and fade-in to fix "not immediately on" issue
        // audio.volume = 0; 
        
        // Attempt auto-play
        audio.play().then(() => {
             initAudioContext(); 
             if (audioContext && audioContext.state === 'suspended') {
                 audioContext.resume();
             }
             isMuted = false;
        }).catch(() => {
            // Autoplay blocked - set UI to muted state
            console.log("Autoplay blocked by browser policy - User interaction required");
            isMuted = true;
        });

        return () => {
            if (fadeInterval) clearInterval(fadeInterval);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (audioContext) audioContext.close();
            audio.pause();
            audio.src = '';
        };
    });
    
    // Calculate perceived scene brightness based on dominant colors
    let sceneBrightness = $derived.by(() => {
        const bgLum = getLuminance(params.bgColor);
        const cloudLum = getLuminance(params.cloudBaseCol);
        const lightLum = getLuminance(params.lightColor1);
        
        // Weighted average: Background matters most, then clouds
        return (bgLum * 0.5) + (cloudLum * 0.3) + (lightLum * 0.2);
    });

    // Threshold for switching UI text color
    let isDarkScene = $derived(sceneBrightness < 0.4);

    // --- End Adaptive Theme Logic ---

    type ControlItem = {
        key: keyof ShaderParams;
        label: string;
        type: 'slider' | 'color' | 'checkbox' | 'select';
        min?: number;
        max?: number;
        step?: number;
        options?: { label: string, value: any, icon?: any }[];
    };

    type Group = {
        title: string;
        icon: any;
        items: ControlItem[];
    };

    const groups: Group[] = [
        {
            title: "Performance",
            icon: Gauge,
            items: [
                { key: 'pixelRatioCap', label: 'Max Pixel Ratio', min: 0.5, max: 3.0, step: 0.05, type: 'slider' },
                { key: 'renderScale', label: 'Render Scale', min: 0.1, max: 1.0, step: 0.01, type: 'slider' },
                { key: 'renderSteps', label: 'Max Steps', min: 50, max: 300, step: 1, type: 'slider' },
                { key: 'useLod', label: 'Use LOD (1=On)', type: 'checkbox' },
            ]
        },
        {
            title: "Camera",
            icon: Video,
            items: [
                { key: 'camSpeed', label: 'Speed', min: 0, max: 10, step: 0.01, type: 'slider' },
                { key: 'camFov', label: 'FOV', min: 1.0, max: 3.0, step: 0.01, type: 'slider' },
                { key: 'camRollAmp', label: 'Roll Amp', min: 0, max: 1.0, step: 0.01, type: 'slider' },
                { key: 'camRollFreq', label: 'Roll Freq', min: 0, max: 1.0, step: 0.01, type: 'slider' },
                { key: 'camLookAhead', label: 'Look', min: 0, max: 5.0, step: 0.01, type: 'slider' },
                { key: 'sunPathOffset', label: 'Sun Off', min: 0, max: 50.0, step: 0.1, type: 'slider' },
            ]
        },
        {
            title: "Tunnel",
            icon: TunnelIcon,
            items: [
                { key: 'tunnelRadius', label: 'Radius', min: 0.1, max: 5.0, step: 0.01, type: 'slider' },
                { key: 'pathAmpX', label: 'Amp X', min: 0, max: 10.0, step: 0.01, type: 'slider' },
                { key: 'pathFreqX', label: 'Freq X', min: 0, max: 2.0, step: 0.001, type: 'slider' },
                { key: 'pathAmpY', label: 'Amp Y', min: 0, max: 10.0, step: 0.01, type: 'slider' },
                { key: 'pathFreqY', label: 'Freq Y', min: 0, max: 2.0, step: 0.001, type: 'slider' },
                // Colors
                { key: 'bgColor', label: 'Background', type: 'color' },
                { key: 'lightColor1', label: 'Ambient', type: 'color' },
                { key: 'lightColor2', label: 'Direct Light', type: 'color' },
            ]
        },
        {
            title: "Clouds",
            icon: Cloud,
            items: [
                { key: 'noiseMethod', label: 'Pattern', type: 'select', options: [
                    { label: 'Soft Clouds', value: 1, icon: Cloud },
                    { label: 'Billows', value: 2, icon: Radar },
                    { label: 'Rocky', value: 3, icon: Mountain },
                    { label: 'Liquid', value: 4, icon: Shell }
                ]},
                { key: 'vortexSpeed', label: 'Vortex', min: -2.0, max: 2.0, step: 0.01, type: 'slider' },
                { key: 'vortexTwist', label: 'Twist', min: -1.0, max: 1.0, step: 0.001, type: 'slider' },
                { key: 'noiseScaleBase', label: 'Base', min: 0.1, max: 2.0, step: 0.01, type: 'slider' },
                { key: 'noiseScaleDet', label: 'Detail', min: 0.1, max: 2.0, step: 0.01, type: 'slider' },
                { key: 'cloudDensity', label: 'Density', min: 0, max: 10.0, step: 0.01, type: 'slider' },
                { key: 'drawDist', label: 'Dist', min: 10, max: 200, step: 0.1, type: 'slider' },
                // Colors
                { key: 'cloudBaseCol', label: 'Base', type: 'color' },
                { key: 'cloudShadowCol', label: 'Shadow', type: 'color' },
            ]
        },
        {
            title: "Lightning",
            icon: Zap,
            items: [
                // Lightning
                { key: 'lightningEnabled', label: 'Enabled', type: 'checkbox' },
                { key: 'lightningChance', label: 'Flash Freq', min: 0.0, max: 1.0, step: 0.01, type: 'slider' },
                { key: 'lightningIntensity', label: 'Intensity', min: 0.0, max: 5.0, step: 0.1, type: 'slider' },
                { key: 'lightningAudioSync', label: 'Audio Sync', type: 'checkbox' },
                { key: 'lightningThreshold', label: 'Threshold', min: 0.0, max: 1.0, step: 0.01, type: 'slider' },
                // Colors
                { key: 'lightningColor', label: 'Color', type: 'color' },
            ]
        },
        {
            title: "Sun",
            icon: Sun,
            items: [
                { key: 'sunGlowPow', label: 'Glow', min: 1, max: 200, step: 0.1, type: 'slider' },
                { key: 'sunCorePow', label: 'Core', min: 1, max: 200, step: 0.1, type: 'slider' },
                { key: 'sunGlarePow', label: 'Glare', min: 1, max: 50, step: 0.1, type: 'slider' },
                // Colors
                { key: 'sunGlowCol', label: 'Glow', type: 'color' },
                { key: 'sunCoreCol', label: 'Core', type: 'color' },
                { key: 'sunGlareCol', label: 'Glare', type: 'color' },
            ]
        }
    ];
</script>

<!-- Backdrop -->
{#if isOpen}
    <div 
        class="fixed inset-0 z-40"
        onclick={close}
        onkeydown={(e) => e.key === 'Escape' && close()}
        role="button"
        tabindex="0"
        aria-label="Close panel"
    ></div>

    <div 
        transition:slide={{ duration: 300, axis: 'y' }}
        class={cn(
            "fixed top-4 right-16 z-50 w-72 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden origin-top-right transition-colors duration-500 select-none",
            isDarkScene 
                ? "bg-white/10 border border-white/20" // Dark Scene -> Light UI (Glass)
                : "bg-white/20 border border-white/40" // Light Scene -> Darker/Sharper Glass or stick to light? 
                // Actually, the user asked for legibility. 
                // If Scene is Dark -> UI needs LIGHT text. 
                // If Scene is Light -> UI needs DARK text.
                // The container background should provide some contrast too.
        )}
        style={isDarkScene ? "background-color: rgba(255,255,255,0.15);" : "background-color: rgba(255,255,255,0.4);"}
    >
        {#each groups as group}
            <div class={cn("border-b last:border-0 transition-colors duration-500", isDarkScene ? "border-white/10" : "border-black/5")}>
                <button 
                    onclick={() => toggleGroup(group.title)}
                    class={cn(
                        "w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-200 group",
                        activeGroup === group.title 
                            ? (isDarkScene ? "bg-black/20" : "bg-white/20")
                            : (isDarkScene ? "hover:bg-white/10" : "hover:bg-white/20")
                    )}
                >
                    <div class="flex items-center gap-3">
                        <group.icon size={14} class={cn(
                            "transition-colors duration-200",
                            activeGroup === group.title 
                                ? (isDarkScene ? "text-white" : "text-black") 
                                : (isDarkScene ? "text-white/50 group-hover:text-white/80" : "text-black/40 group-hover:text-black/60")
                        )} 
                        fill={activeGroup === group.title ? "currentColor" : "none"}
                        />
                        <span class={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-200",
                            activeGroup === group.title 
                                ? (isDarkScene ? "text-white" : "text-black") 
                                : (isDarkScene ? "text-white/50 group-hover:text-white/80" : "text-black/50 group-hover:text-black/80")
                        )}>
                            {group.title}
                        </span>
                    </div>

                    {#if activeGroup === group.title && isGroupDirty(group)}
                        <div transition:fly={{ x: 10, duration: 200 }} class="flex items-center gap-2">
                            <div 
                                role="button"
                                tabindex="0"
                                onclick={(e) => { e.stopPropagation(); handleReset(group); }}
                                onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleReset(group); }}} 
                                class={cn(
                                    "p-1.5 rounded-full transition-all duration-200 hover:scale-110", 
                                    isDarkScene 
                                        ? "text-white/30 hover:text-white hover:bg-white/10" 
                                        : "text-black/30 hover:text-black hover:bg-black/5"
                                )}
                                title="Reset to defaults"
                            >
                                <RotateCcw size={11} />
                            </div>
                            <div 
                                role="button"
                                tabindex="0"
                                onclick={(e) => { e.stopPropagation(); handleDownload(group); }}
                                onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleDownload(group); }}}
                                class={cn(
                                    "p-1.5 rounded-full transition-all duration-200 hover:scale-110", 
                                    isDarkScene 
                                        ? "text-white/30 hover:text-white hover:bg-white/10" 
                                        : "text-black/30 hover:text-black hover:bg-black/5"
                                )}
                                title="Save config"
                            >
                                <Download size={11} />
                            </div>
                        </div>
                    {/if}
                </button>
                
                {#if activeGroup === group.title}
                    <div transition:slide={{ duration: 300, easing: cubicOut }} class={cn("px-4 pb-5 pt-1 relative", isDarkScene ? "bg-black/20" : "bg-white/20")}>
                        <div class="flex flex-col gap-4 mt-1">
                            <!-- Sliders, Checkboxes & Selects -->
                            {#each group.items.filter(i => i.type === 'slider' || i.type === 'checkbox' || i.type === 'select') as item}
                                {#if group.title !== 'Lightning' || (item.key === 'lightningEnabled' || params.lightningEnabled)}
                                    <div class="group/slider flex flex-col gap-1.5 relative">
                                        <div class={cn(
                                            "flex justify-between items-end text-[10px] font-bold tracking-wide transition-colors",
                                            isDarkScene ? "text-white/70 group-hover/slider:text-white" : "text-black/60 group-hover/slider:text-black"
                                        )}>
                                            <label for={item.key}>{item.label}</label>
                                            {#if item.type === 'slider'}
                                                <span class={cn(
                                                    "font-mono text-[9px] opacity-60 px-1 rounded",
                                                    isDarkScene ? "bg-white/10" : "bg-black/5"
                                                )}>
                                                    {typeof params[item.key] === 'number' 
                                                        ? (params[item.key] as number).toFixed(item.step && item.step < 0.1 ? 3 : (item.step && item.step < 1 ? 2 : 0))
                                                        : params[item.key]}
                                                </span>
                                            {/if}
                                        </div>

                                        {#if item.type === 'slider'}
                                            <input 
                                                type="range" 
                                                id={item.key} 
                                                min={item.min} 
                                                max={item.max} 
                                                step={item.step}
                                                bind:value={params[item.key] as number}
                                                class={cn(
                                                    "slider-input w-full h-0.5 rounded-full cursor-pointer appearance-none transition-colors",
                                                    isDarkScene ? "bg-white/20 hover:bg-white/40" : "bg-black/10 hover:bg-black/30"
                                                )}
                                            />
                                        {:else if item.type === 'checkbox'}
                                            <button
                                                onclick={() => {
                                                     // TS workaround: Force cast the key access
                                                     (params as any)[item.key] = params[item.key] ? 0 : 1; 
                                                }}
                                                class={cn(
                                                    "w-full flex items-center gap-3 p-2 rounded-md transition-all duration-200 border",
                                                    isDarkScene 
                                                        ? "bg-white/5 border-white/10 hover:bg-white/10" 
                                                        : "bg-black/5 border-black/5 hover:bg-black/10",
                                                    params[item.key] ? (isDarkScene ? "bg-white/20 border-white/30" : "bg-black/10 border-black/20") : ""
                                                )}
                                            >
                                                <div class={cn(
                                                    "w-4 h-4 rounded flex items-center justify-center transition-colors border",
                                                    isDarkScene ? "border-white/40" : "border-black/40",
                                                    params[item.key] ? (isDarkScene ? "bg-white text-black border-white" : "bg-black text-white border-black") : "bg-transparent"
                                                )}>
                                                     {#if params[item.key]}
                                                        <Check size={10} strokeWidth={4} />
                                                     {/if}
                                                </div>
                                                <span class={cn("text-xs opacity-80", isDarkScene ? "text-white" : "text-black")}>
                                                    {params[item.key] ? "Enabled" : "Disabled"}
                                                </span>
                                            </button>
                                        {:else if item.type === 'select'}
                                            {#if item.key === 'noiseMethod'}
                                                <div class="flex gap-2 mt-1">
                                                    {#each item.options || [] as option}
                                                        <button 
                                                            onclick={() => (params as any)[item.key] = option.value}
                                                            class={cn(
                                                                "flex-1 py-2 rounded-md flex items-center justify-center transition-all duration-200 relative group/btn",
                                                                params[item.key] === option.value
                                                                    ? (isDarkScene ? "bg-white/40 text-white shadow-lg scale-105" : "bg-black/40 text-white shadow-lg scale-105")
                                                                    : (isDarkScene ? "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white" : "bg-black/5 text-black/60 hover:bg-black/10 hover:text-black")
                                                            )}
                                                            title={option.label}
                                                        >
                                                            <option.icon size={16} />
                                                            <!-- Tooltip -->
                                                            <span class={cn(
                                                                "absolute bottom-full mb-2 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50",
                                                                isDarkScene ? "bg-white text-black" : "bg-black text-white"
                                                            )}>
                                                                {option.label}
                                                            </span>
                                                        </button>
                                                    {/each}
                                                </div>
                                            {:else}
                                                <div class="relative">
                                                    <select
                                                        id={item.key}
                                                        bind:value={params[item.key]}
                                                        class={cn(
                                                            "w-full p-1.5 text-[10px] rounded border appearance-none cursor-pointer transition-colors outline-none font-mono",
                                                            isDarkScene 
                                                                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 focus:border-white/30" 
                                                                : "bg-black/5 border-black/5 text-black hover:bg-black/10 focus:border-black/20"
                                                        )}
                                                    >
                                                        {#each item.options || [] as option}
                                                            <option value={option.value} class="text-black bg-white">{option.label}</option>
                                                        {/each}
                                                    </select>
                                                    <div class={cn(
                                                        "absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none",
                                                        isDarkScene ? "text-white/50" : "text-black/50"
                                                    )}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <path d="m6 9 6 6 6-6"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                            {/if}
                                        {/if}
                                    </div>
                                {/if}
                            {/each}

                            <!-- Colors Row -->
                            {#if group.items.filter(i => i.type === 'color').length > 0}
                                <div class="grid grid-cols-3 gap-2 mt-2">
                                    {#each group.items.filter(i => i.type === 'color') as color}
                                        {#if group.title !== 'Lightning' || params.lightningEnabled}
                                            <div class="flex flex-col items-center gap-1.5">
                                                <div class={cn(
                                                    "w-7 h-7 rounded-full overflow-hidden ring-1 hover:scale-110 transition-all cursor-pointer shadow-sm relative",
                                                    isDarkScene ? "ring-white/20 hover:ring-white/60" : "ring-black/10 hover:ring-black/40"
                                                )}>
                                                    <input 
                                                        type="color" 
                                                        id={color.key} 
                                                        bind:value={params[color.key] as string}
                                                        class="absolute inset-0 -top-[50%] -left-[50%] w-[200%] h-[200%] p-0 m-0 border-0 cursor-pointer opacity-0"
                                                    />
                                                    <div class="w-full h-full" style:background-color={params[color.key] as string}></div>
                                                </div>
                                                <label for={color.key} class={cn(
                                                    "text-[8px] font-semibold uppercase tracking-wide text-center leading-tight w-full transition-colors",
                                                    isDarkScene ? "text-white/50" : "text-black/50"
                                                )}>
                                                    {color.label}
                                                </label>
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<div class="fixed top-4 right-4 z-50 flex flex-col items-end gap-4 pointer-events-none">
    <!-- Main Toggle Wrapper -->
    <div 
        class="relative pointer-events-auto"
        onmouseenter={handleMainMouseEnter} 
        onmouseleave={handleMainMouseLeave}
        role="presentation"
    >
         <!-- Satellites - ALWAYS in DOM, visibility controlled by CSS only -->
         <!-- No Svelte transitions - pure CSS handles all animation to avoid iOS 17 WebKit bugs -->
         {#if !isOpen}
            {#each PRESETS as preset, i (preset.id)}
                {@const totalSweep = (Math.PI / 2) + (14 * Math.PI / 180)} 
                {@const startAngle = Math.PI + (7 * Math.PI / 180)}
                {@const angle = startAngle - (i * totalSweep / (PRESETS.length - 1))}
                {@const r = 42} 
                {@const x = Math.cos(angle) * r}
                {@const y = Math.sin(angle) * r}
                <div 
                    class={cn(
                        "absolute w-5 h-5 z-0 flex items-center justify-center preset-satellite",
                        presetsVisible ? "preset-visible" : "preset-hidden"
                    )}
                    style="--x: {x}px; --y: {y}px; --i: {i}; --total: {PRESETS.length}; top: 50%; left: 50%;"
                >
                    <button
                        onclick={() => applyPreset(preset)}
                        disabled={!presetsVisible}
                        class={cn(
                            "w-5 h-5 rounded-full shadow-lg backdrop-blur-md border flex items-center justify-center hover:scale-125",
                            isDarkScene 
                                ? "bg-white/10 border-white/20 text-white" 
                                : "bg-white/20 border-white/40 text-black",
                             activePresetId === preset.id && "scale-110 brightness-125"
                        )}
                        aria-label={preset.name}
                        title={preset.name}
                    >
                       <preset.icon size={10} fill={activePresetId === preset.id ? "currentColor" : "none"} />
                    </button>
                </div>
            {/each}
         {/if}

        <button 
            onclick={handleClick}
            ontouchstart={handleTouchStart}
            ontouchend={handleTouchEnd}
            oncontextmenu={handleContextMenu}
            class={cn(
                "group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 shadow-lg backdrop-blur-md border z-10 select-none",
                isDarkScene 
                    ? "bg-white/5 border-white/20 hover:bg-white/10"
                    : "bg-white/10 border-white/40 hover:bg-white/20"
            )}
            aria-label="Open controls"
        >
            {#if isOpen}
                 <Settings size={18} class={cn("animate-[spin_3s_linear_infinite]", isDarkScene ? "text-white" : "text-black/60")} />
            {:else}
                 <!-- Icon swap controlled by presetsVisible state (not CSS hover) so it syncs with satellite animation -->
                 <div class={cn(
                    "absolute transition-all duration-300 flex items-center justify-center",
                    presetsVisible ? "scale-0 opacity-0" : "scale-100 opacity-100"
                 )}>
                    <ActiveIcon size={18} class={isDarkScene ? "text-white" : "text-black/60"} />
                 </div>
                 <Settings size={18} class={cn(
                    "absolute transition-all duration-300",
                    presetsVisible ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-[-90deg]",
                    isDarkScene ? "text-white" : "text-black/60"
                 )} />
            {/if}
        </button>
    </div>

    <!-- Audio Button -->
    <button 
        onclick={toggleAudio}
        class={cn(
            "group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 shadow-lg backdrop-blur-md border overflow-hidden pointer-events-auto",
             isDarkScene 
                ? "bg-white/5 border-white/20 hover:bg-white/10"
                : "bg-white/10 border-white/40 hover:bg-white/20",
             presetsVisible ? "translate-y-7" : "" 
        )}
        aria-label="Toggle Audio"
    >
        {#if isMuted}
             <Headphones size={18} class={cn("transition-all duration-300", isDarkScene ? "text-white" : "text-black/60")} />
        {:else}
             <!-- Waveform Visualizer -->
             <div class="w-5 h-5 flex items-center justify-center opacity-80">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full overflow-visible">
                    <path 
                        d={visualizerPath} 
                        fill={isDarkScene ? "white" : "black"} 
                        fill-opacity="0.8"
                        stroke="none"
                        class="transition-colors duration-300"
                    />
                </svg>
             </div>
        {/if}
    </button>
</div>

<style lang="postcss">
    .slider-input {
        @apply relative;
    }

    /* Preset satellite - PURE CSS animation, no DOM insertion/removal */
    /* Elements always exist, visibility controlled entirely by CSS classes */
    .preset-satellite {
        /* Start at center (hidden position) */
        transform: translate(-50%, -50%);
        opacity: 0;
        pointer-events: none;
        /* Smooth transition for both show and hide - slower, more elegant */
        transition: 
            transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1),
            opacity 0.4s ease-out;
        /* Staggered delay using CSS custom property */
        transition-delay: calc(var(--i) * 70ms);
    }
    
    /* Visible state - fly out to final position */
    .preset-satellite.preset-visible {
        transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y)));
        opacity: 1;
        pointer-events: auto;
        /* Staggered entrance - slower cascade */
        transition-delay: calc(var(--i) * 100ms);
    }
    
    /* Hidden state - return to center */
    .preset-satellite.preset-hidden {
        transform: translate(-50%, -50%);
        opacity: 0;
        pointer-events: none;
        /* Reverse stagger for exit (last one first) - gentler retreat */
        transition-delay: calc((var(--total) - 1 - var(--i)) * 80ms);
    }

    /* Slider Thumb - Adaptive logic handled by CSS vars could be cleaner, but here we use specific colors */
    /* We need to hardcode colors or use currentcolor for thumbs. 
       Let's use a neutral satisfying gray that works on both, or adaptive. */
    
    .slider-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #52525b; /* Zinc-600 - works well on both light and dark */
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.1s ease, background-color 0.1s ease, box-shadow 0.1s ease;
    }

    .slider-input:hover::-webkit-slider-thumb {
        transform: scale(1.2);
        background: #27272a; /* Zinc-800 */
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.4);
    }

    /* Firefox Slider Thumb */
    .slider-input::-moz-range-thumb {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #52525b;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.1s ease, background-color 0.1s ease, box-shadow 0.1s ease;
    }

    .slider-input:hover::-moz-range-thumb {
        transform: scale(1.2);
        background: #27272a;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.4);
    }
</style>
