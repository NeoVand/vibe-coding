
<script lang="ts">
	import Controls from '$lib/components/Controls.svelte';
	import { defaultParams } from '$lib/shaderParams';
    import { onMount } from 'svelte';
    import { activeThemeStore } from '$lib/stores/theme';
    import { getDefaultPreset } from '$lib/presets';
    import { get } from 'svelte/store';

    // Start on the active theme's default preset, so the very first frame is
    // one of the presets reachable from the icons (never the bare defaults).
    const savedTheme = get(activeThemeStore);
	let params = $state({ ...defaultParams, ...getDefaultPreset(savedTheme).params });
    let activeTheme = $state(savedTheme);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ShaderBackgroundModule: any = $state(null);

    onMount(async () => {
        ShaderBackgroundModule = await import('$lib/components/ShaderBackground.svelte');
    });
</script>

{#if ShaderBackgroundModule}
    <svelte:component this={ShaderBackgroundModule.default} {params} {activeTheme} />
{/if}

<Controls bind:params bind:activeTheme />
