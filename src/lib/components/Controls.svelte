
<script lang="ts">
	import { Cloud, Settings, Video, CircleDot, Sun, Image } from 'lucide-svelte';
	import type { ShaderParams } from '$lib/shaderParams';
	import { slide } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';
    import TunnelIcon from '$lib/components/icons/TunnelIcon.svelte';

	let { params = $bindable() }: { params: ShaderParams } = $props();

	let isOpen = $state(false);
    let activeGroup = $state("Camera");

    function toggle() {
        isOpen = !isOpen;
    }

    function close() {
        isOpen = false;
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
            "fixed bottom-20 right-6 z-50 w-72 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden origin-bottom-right transition-colors duration-500",
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

<div class="fixed bottom-6 right-6 z-50">
    <button 
        onclick={toggle}
        class={cn(
            "group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 shadow-lg backdrop-blur-md border",
            isOpen 
                ? (isDarkScene ? "bg-white/20 border-white/20" : "bg-black/10 border-black/10")
                : (isDarkScene ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-white/40 border-white/40 hover:bg-white/60")
        )}
        aria-label="Open controls"
    >
        {#if isOpen}
             <Settings size={18} class={cn("animate-[spin_3s_linear_infinite]", isDarkScene ? "text-white" : "text-black")} />
        {:else}
             <Cloud size={18} class={cn("absolute transition-all duration-300 scale-100 opacity-100 group-hover:scale-0 group-hover:opacity-0", isDarkScene ? "text-white" : "text-black")} />
             <Settings size={18} class={cn("absolute transition-all duration-300 scale-0 opacity-0 rotate-[-90deg] group-hover:scale-100 group-hover:opacity-100 group-hover:rotate-0", isDarkScene ? "text-white" : "text-black")} />
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
