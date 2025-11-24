
<script lang="ts">
    import { clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';

    let { size = 24, fill = "none", class: className = "" } = $props();

    function cn(...inputs: (string | undefined | null | false)[]) {
        return twMerge(clsx(inputs));
    }
</script>

<svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    class={cn("lucide lucide-tunnel", className)}
>
    {#if fill !== 'none'}
        <!-- Active: Filled Circle with Hole (Transparent Dot) -->
        <!-- We apply stroke to match the visual size of the inactive outline -->
        <!-- We increase the inner hole radius in the path data (r=2.5) so that with the stroke (width=2), -->
        <!-- the visual hole remains r=1.5 (2.5 - 1) -->
        <path 
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" 
            fill="currentColor" 
            stroke="currentColor"
            stroke-width="2"
            fill-rule="evenodd"
        />
    {:else}
        <!-- Inactive: Circle Outline + Solid Dot -->
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    {/if}
</svg>
