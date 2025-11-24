
<script lang="ts">
	import Controls from '$lib/components/Controls.svelte';
	import { defaultParams } from '$lib/shaderParams';
    import { onMount } from 'svelte';
    import type { Component } from 'svelte';

	let params = $state({ ...defaultParams });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ShaderBackgroundComponent = $state<Component<any> | null>(null);

    onMount(async () => {
        const module = await import('$lib/components/ShaderBackground.svelte');
        ShaderBackgroundComponent = module.default;
    });
</script>

{#if ShaderBackgroundComponent}
    <ShaderBackgroundComponent {params} />
{/if}

<Controls bind:params />
