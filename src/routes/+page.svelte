
<script lang="ts">
	import Controls from '$lib/components/Controls.svelte';
	import { defaultParams } from '$lib/shaderParams';
    import { onMount } from 'svelte';
    import { activeThemeStore } from '$lib/stores/theme';
    import { PRESETS } from '$lib/presets';
    import { get } from 'svelte/store';

	let params = $state({ ...defaultParams });
    let activeTheme = $state(get(activeThemeStore));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ShaderBackgroundModule: any = $state(null);

    onMount(async () => {
        ShaderBackgroundModule = await import('$lib/components/ShaderBackground.svelte');

        // If loading with a saved theme, apply its first preset
        const savedTheme = get(activeThemeStore);
        if (savedTheme !== 'clouds') {
            activeTheme = savedTheme;
            const firstPreset = PRESETS.find(p => p.theme === savedTheme);
            if (firstPreset) {
                Object.assign(params, firstPreset.params);
            }
        }
    });
</script>

{#if ShaderBackgroundModule}
    <svelte:component this={ShaderBackgroundModule.default} {params} {activeTheme} />
{/if}

<Controls bind:params bind:activeTheme />
