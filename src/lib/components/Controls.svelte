
<script lang="ts">
    import { Settings, Video, CircleDot, Image, Zap, Volume2, VolumeX, Headphones, Cloud, Sun, Sunset, Sunrise, Haze, CloudLightning, Moon, Download, RotateCcw, Check } from 'lucide-svelte';
    import { PRESETS, type Preset } from '$lib/presets';
	import { type ShaderParams, defaultParams } from '$lib/shaderParams';
	import { slide, fly, scale } from 'svelte/transition';
    import { onMount } from 'svelte';
    import { cubicOut, elasticOut } from 'svelte/easing';
    import { clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';
    import TunnelIcon from '$lib/components/icons/TunnelIcon.svelte';

	let { params = $bindable() }: { params: ShaderParams } = $props();

	let isOpen = $state(false);
    let activeGroup = $state("Camera");
    let activePresetId = $state("default");
    let showPresets = $state(false);
    let hoverTimeout: NodeJS.Timeout;

    function toggle() {
        // Desktop: toggle open/close
        // Mobile: Handled by click logic below
        isOpen = !isOpen;
        if (isOpen) showPresets = false;
    }

    function close() {
        isOpen = false;
    }

    function applyPreset(preset: Preset) {
        Object.assign(params, preset.params);
        activePresetId = preset.id;
        // Keep presets open for a moment or close? 
        // User said: "when the user clicks on them, we would automatically set the settings"
        // Does not explicitly say close.
    }
    
    // Determine active icon
    let ActiveIcon = $derived(PRESETS.find(p => p.id === activePresetId)?.icon || PRESETS[0].icon);

    function handleMainMouseEnter() {
        if (isOpen || isTouch) return;
        clearTimeout(hoverTimeout);
        showPresets = true;
    }

    function handleMainMouseLeave() {
        if (isOpen || isTouch) return; // Don't hide if open
        // Use a longer timeout to allow bridging the gap
        hoverTimeout = setTimeout(() => {
            showPresets = false;
        }, 300); // Increased from 100ms
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
            // Long Press: Open GUI, Hide Presets
            // showPresets = false; 
            // isOpen = true;
            
            // Sequence the state changes:
            // 1. Start hiding presets immediately
            showPresets = false;
            if (navigator.vibrate) navigator.vibrate(50);
            
            // 2. Open GUI after a short delay to prevent frame drops from interrupting the exit animation
            requestAnimationFrame(() => {
                setTimeout(() => {
                    isOpen = true;
                }, 50);
            });
        }, 500);
    }

    function handleTouchEnd(e: TouchEvent) {
        clearTimeout(longPressTimer);
        e.preventDefault(); // Prevent default click/mouse emulation
        
        if (isLongPress) {
            return; // Long press action handled in timer
        }
        
        // Short Tap Logic
        if (isOpen) {
            // If GUI open, close it (Toggle behavior)
            toggle();
        } else {
            // Toggle presets visibility
            showPresets = !showPresets;
        }
    }

    function handleContextMenu(e: Event) {
        if (isTouch) e.preventDefault();
    }
    
    function handleClick(e: MouseEvent) {
        // If we just had a touch event, ignore this click (double safety, though preventDefault handles it)
        if (isTouch) {
             // Reset touch flag after a delay to allow mouse usage again if hybrid device?
             // For now, just return.
             // Actually, preventDefault in touchend stops this from firing usually.
             return;
        }

        if (!isOpen && !showPresets) {
            showPresets = true;
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
    let sourceNode: MediaElementAudioSourceNode | null = null;
    let animationFrameId: number;
    
    // Waveform path for SVG
    let visualizerPath = $state("M 0 50 L 100 50");
    let phase = 0;
    
    // Smoothing state
    let smoothBass = 0;
    let smoothHigh = 0;

    function initAudioContext() {
        if (audioContext) return;
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; 
        // Use 0 to get raw data instantly, we handle smoothing manually for better control
        analyser.smoothingTimeConstant = 0; 

        if (audio) {
            sourceNode = audioContext.createMediaElementSource(audio);
            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);
        }
        
        updateVisualizer();
    }

    function updateVisualizer() {
        if (!analyser || isMuted || audio?.paused) {
            if (isMuted || audio?.paused) {
                 visualizerPath = "M 0 50 Q 50 50 100 50"; // Flat line
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
            
            let midSum = 0;
            let highSum = 0;
            
            for (let i = startBin; i < bufferLength; i++) {
                if (i < midSplit) midSum += dataArray[i];
                else highSum += dataArray[i];
            }
            
            const midAvg = midSum / (midSplit - startBin);
            const highAvg = highSum / (bufferLength - midSplit);
            
            // Target Inputs
            const targetMid = Math.max(0, (midAvg / 255) - 0.1) * 0.5; 
            const targetHigh = Math.max(0, (highAvg / 255)) * 8.0; 
            
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
            
            // Dynamic variables
            phase += 0.05; 
            
            const volume = 0.2 + (smoothBass * 0.5) + (smoothHigh * 1.5);
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
            audio.play().catch(() => {
                // If autoplay blocked, we just stay muted until user interacts again
                isMuted = true; 
            });
            fadeVolume(1.0);
            updateVisualizer(); // Restart loop
        } else {
            // Mute: Fade Out
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
        
        const start = audio.volume;
        const diff = target - start;
        const duration = 1000; // 1 second fade
        const stepTime = 50;
        const steps = duration / stepTime;
        const stepValue = diff / steps;
        
        let currentStep = 0;
        
        fadeInterval = setInterval(() => {
            currentStep++;
            const newVolume = start + (stepValue * currentStep);
            
            // Clamp to valid range
            audio.volume = Math.max(0, Math.min(1, newVolume));
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                audio.volume = target;
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
        type: 'slider' | 'color' | 'checkbox';
        min?: number;
        max?: number;
        step?: number;
    };

    type Group = {
        title: string;
        icon: any;
        items: ControlItem[];
    };

    const groups: Group[] = [
        {
            title: "Performance",
            icon: Zap,
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
                            <!-- Sliders & Checkboxes -->
                            {#each group.items.filter(i => i.type === 'slider' || i.type === 'checkbox') as item}
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
                                    {/if}
                                </div>
                            {/each}

                            <!-- Colors Row -->
                            {#if group.items.filter(i => i.type === 'color').length > 0}
                                <div class="grid grid-cols-3 gap-2 mt-2">
                                    {#each group.items.filter(i => i.type === 'color') as color}
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
         <!-- Satellites -->
        <!-- Use a keyed block to ensure Svelte tracks entrance/exit correctly when showPresets changes -->
         {#if showPresets && !isOpen}
            {#each PRESETS as preset, i (preset.id)}
                {@const angle = Math.PI - (i * (Math.PI / 2) / (PRESETS.length - 1))}
                {@const r = 42} 
                {@const x = Math.cos(angle) * r}
                {@const y = Math.sin(angle) * r}
                <!-- Wrapper div for positioning so hover scaling doesn't affect layout flow or cause jitter -->
                <div 
                    class="absolute w-5 h-5 z-0 flex items-center justify-center"
                    style="transform: translate(calc(-50% + {x}px), calc(-50% + {y}px)); top: 50%; left: 50%;" 
                    in:fly|global={{ x: -x, y: -y, duration: 300, delay: i * 60, easing: cubicOut }}
                    out:scale|global={{ duration: 200, delay: (PRESETS.length - 1 - i) * 50 }}
                >
                    <button
                        onclick={() => applyPreset(preset)}
                        class={cn(
                            "w-5 h-5 rounded-full shadow-lg backdrop-blur-md border flex items-center justify-center transition-all duration-200 hover:scale-125",
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
                 <div class="absolute transition-all duration-300 scale-100 opacity-100 group-hover:scale-0 group-hover:opacity-0 flex items-center justify-center">
                    <ActiveIcon size={18} class={isDarkScene ? "text-white" : "text-black/60"} />
                 </div>
                 <Settings size={18} class={cn("absolute transition-all duration-300 scale-0 opacity-0 rotate-[-90deg] group-hover:scale-100 group-hover:opacity-100 group-hover:rotate-0", isDarkScene ? "text-white" : "text-black/60")} />
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
             showPresets && !isOpen ? "translate-y-7" : "" 
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
