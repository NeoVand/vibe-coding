
<script lang="ts">
    import { Settings, Video, CircleDot, Image, Zap, Volume2, VolumeX, Cloud, Sun, Sunset, CloudLightning, Moon } from 'lucide-svelte';
    import { PRESETS, type Preset } from '$lib/presets';
	import type { ShaderParams } from '$lib/shaderParams';
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
        if (isOpen) return;
        clearTimeout(hoverTimeout);
        showPresets = true;
    }

    function handleMainMouseLeave() {
        // Small delay to allow moving to satellites
        hoverTimeout = setTimeout(() => {
            showPresets = false;
        }, 100);
    }
    
    function handleMobileClick(e: MouseEvent) {
        // Keep this if we want to use it for touch events explicitly, 
        // but standard click handler usually covers it.
        // For now, I'll remove the duplicate logic and rely on handleClick.
    }
    
    function handleClick(e: MouseEvent) {
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
        audio = new Audio('/music/intro-wind.mp3');
        audio.loop = true;
        audio.volume = 0; // Start silent
        
        // Attempt auto-play with fade in
        audio.play().then(() => {
             fadeVolume(1.0);
             // Start visualizer immediately if autoplay works
             initAudioContext(); 
        }).catch(() => {
            // Autoplay blocked - set UI to muted state
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
        type: 'slider' | 'color';
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
                { key: 'pixelRatioCap', label: 'Max Pixel Ratio', min: 0.5, max: 3.0, step: 0.1, type: 'slider' },
                { key: 'renderScale', label: 'Render Scale', min: 0.1, max: 1.0, step: 0.05, type: 'slider' },
                { key: 'renderSteps', label: 'Max Steps', min: 50, max: 300, step: 10, type: 'slider' },
                { key: 'useLod', label: 'Use LOD (1=On)', min: 0, max: 1, step: 1, type: 'slider' },
            ]
        },
        {
            title: "Camera",
            icon: Video,
            items: [
                { key: 'camSpeed', label: 'Speed', min: 0, max: 10, step: 0.1, type: 'slider' },
                { key: 'camFov', label: 'FOV', min: 1.0, max: 3.0, step: 0.1, type: 'slider' },
                { key: 'camRollAmp', label: 'Roll Amp', min: 0, max: 1.0, step: 0.05, type: 'slider' },
                { key: 'camRollFreq', label: 'Roll Freq', min: 0, max: 1.0, step: 0.05, type: 'slider' },
                { key: 'camLookAhead', label: 'Look', min: 0, max: 5.0, step: 0.1, type: 'slider' },
                { key: 'sunPathOffset', label: 'Sun Off', min: 0, max: 50.0, step: 1.0, type: 'slider' },
            ]
        },
        {
            title: "Tunnel",
            icon: TunnelIcon,
            items: [
                { key: 'tunnelRadius', label: 'Radius', min: 0.1, max: 5.0, step: 0.1, type: 'slider' },
                { key: 'pathAmpX', label: 'Amp X', min: 0, max: 10.0, step: 0.1, type: 'slider' },
                { key: 'pathFreqX', label: 'Freq X', min: 0, max: 2.0, step: 0.01, type: 'slider' },
                { key: 'pathAmpY', label: 'Amp Y', min: 0, max: 10.0, step: 0.1, type: 'slider' },
                { key: 'pathFreqY', label: 'Freq Y', min: 0, max: 2.0, step: 0.01, type: 'slider' },
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
                { key: 'vortexSpeed', label: 'Vortex', min: -2.0, max: 2.0, step: 0.1, type: 'slider' },
                { key: 'vortexTwist', label: 'Twist', min: -1.0, max: 1.0, step: 0.05, type: 'slider' },
                { key: 'noiseScaleBase', label: 'Base', min: 0.1, max: 2.0, step: 0.1, type: 'slider' },
                { key: 'noiseScaleDet', label: 'Detail', min: 0.1, max: 2.0, step: 0.1, type: 'slider' },
                { key: 'cloudDensity', label: 'Density', min: 0, max: 10.0, step: 0.1, type: 'slider' },
                { key: 'drawDist', label: 'Dist', min: 10, max: 200, step: 1, type: 'slider' },
                // Colors
                { key: 'cloudBaseCol', label: 'Base', type: 'color' },
                { key: 'cloudShadowCol', label: 'Shadow', type: 'color' },
            ]
        },
        {
            title: "Sun",
            icon: Sun,
            items: [
                { key: 'sunGlowPow', label: 'Glow', min: 1, max: 200, step: 1, type: 'slider' },
                { key: 'sunCorePow', label: 'Core', min: 1, max: 200, step: 1, type: 'slider' },
                { key: 'sunGlarePow', label: 'Glare', min: 1, max: 50, step: 1, type: 'slider' },
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
            "fixed top-4 right-16 z-50 w-72 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden origin-top-right transition-colors duration-500",
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
                </button>
                
                {#if activeGroup === group.title}
                    <div transition:slide={{ duration: 300, easing: cubicOut }} class={cn("px-4 pb-5 pt-1", isDarkScene ? "bg-black/20" : "bg-white/20")}>
                        <div class="flex flex-col gap-4">
                            <!-- Sliders -->
                            {#each group.items.filter(i => i.type === 'slider') as item}
                                <div class="group/slider flex flex-col gap-1.5 relative">
                                    <div class={cn(
                                        "flex justify-between items-end text-[10px] font-bold tracking-wide transition-colors",
                                        isDarkScene ? "text-white/70 group-hover/slider:text-white" : "text-black/60 group-hover/slider:text-black"
                                    )}>
                                        <label for={item.key}>{item.label}</label>
                                        <span class={cn(
                                            "font-mono text-[9px] opacity-60 px-1 rounded",
                                            isDarkScene ? "bg-white/10" : "bg-black/5"
                                        )}>{params[item.key]}</span>
                                    </div>
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
         {#if showPresets && !isOpen}
            {#each PRESETS as preset, i}
                {@const angle = Math.PI - (i * (Math.PI / 2) / (PRESETS.length - 1))}
                {@const r = 42} 
                {@const x = Math.cos(angle) * r}
                {@const y = Math.sin(angle) * r}
                <!-- Wrapper div for positioning so hover scaling doesn't affect layout flow or cause jitter -->
                <div 
                    class="absolute w-5 h-5 z-0 flex items-center justify-center"
                    style="transform: translate(calc(-50% + {x}px), calc(-50% + {y}px)); top: 50%; left: 50%;" 
                    in:fly={{ x: x*0.5, y: y*0.5, duration: 300, delay: i * 50 }}
                    out:scale={{ duration: 200 }}
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
            class={cn(
                "group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 shadow-lg backdrop-blur-md border z-10",
                isDarkScene 
                    ? "bg-white/5 border-white/20 hover:bg-white/10"
                    : "bg-white/10 border-white/40 hover:bg-white/20"
            )}
            aria-label="Open controls"
        >
            {#if isOpen}
                 <Settings size={18} class={cn("animate-[spin_3s_linear_infinite]", isDarkScene ? "text-white" : "text-black")} />
            {:else}
                 <div class="absolute transition-all duration-300 scale-100 opacity-100 group-hover:scale-0 group-hover:opacity-0 flex items-center justify-center">
                    <ActiveIcon size={18} class={isDarkScene ? "text-white" : "text-black"} />
                 </div>
                 <Settings size={18} class={cn("absolute transition-all duration-300 scale-0 opacity-0 rotate-[-90deg] group-hover:scale-100 group-hover:opacity-100 group-hover:rotate-0", isDarkScene ? "text-white" : "text-black")} />
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
             <VolumeX size={18} class={cn("transition-all duration-300", isDarkScene ? "text-white" : "text-black/60")} />
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
