<script lang="ts">
	import { onMount } from 'svelte';
	import { bloomMode } from '$lib/stores/bloom';

	let supported = $state(false);

	onMount(() => {
		supported = !!navigator.gpu;
	});
</script>

{#if supported}
	<button
		onclick={() => bloomMode.toggle()}
		class="fixed right-0 top-1/2 z-20 -translate-y-1/2 rounded-l border border-r-0 border-[var(--terminal-border)] bg-[var(--ocean-900)]/80 px-1.5 py-3 text-[10px] backdrop-blur transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] {$bloomMode ? 'text-[var(--ocean-300)] border-[var(--ocean-400)]/60' : 'text-[var(--terminal-dim)]'}"
		style="writing-mode: vertical-rl;"
		title="{$bloomMode ? 'Disable' : 'Enable'} bloom mode"
	>
		bloom {$bloomMode ? 'on' : 'off'}
	</button>
{/if}
