<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { bloomMode } from '$lib/stores/bloom';

	let container: HTMLDivElement | undefined = $state();
	let fps = $state(0);
	let supported = $state(false);
	let loading = $state(false);
	let renderer: any = null;
	let app: any = null;
	let rafId: number | null = null;

	onMount(() => {
		supported = !!navigator.gpu;
	});

	async function startBloom() {
		if (!container || !supported || renderer) return;
		loading = true;

		try {
			const THREE = await import('three/webgpu');
			const { default: App } = await import('$lib/aurelia/app.js');
			const { conf } = await import('$lib/aurelia/conf.js');

			const r = new THREE.WebGPURenderer({ antialias: true, alpha: false });
			r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			r.setSize(window.innerWidth, window.innerHeight);
			container.appendChild(r.domElement);
			renderer = r;

			conf.onFpsUpdate = (v: number) => { fps = v; };

			app = new App(r);
			await app.init(async () => {});
			app.resize(window.innerWidth, window.innerHeight);

			const onResize = () => {
				if (!renderer || !app) return;
				renderer.setSize(window.innerWidth, window.innerHeight);
				app.resize(window.innerWidth, window.innerHeight);
			};
			window.addEventListener('resize', onResize);

			let lastTime = performance.now();
			function loop() {
				rafId = requestAnimationFrame(loop);
				const now = performance.now();
				const delta = (now - lastTime) / 1000;
				lastTime = now;
				app.update(delta, now / 1000);
			}
			loop();

			loading = false;

			// Store cleanup ref
			(container as any)._bloomCleanup = () => {
				window.removeEventListener('resize', onResize);
			};
		} catch (e) {
			console.error('Bloom init failed:', e);
			loading = false;
		}
	}

	function stopBloom() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		if (container && (container as any)._bloomCleanup) {
			(container as any)._bloomCleanup();
		}
		if (renderer) {
			renderer.dispose();
			if (renderer.domElement && renderer.domElement.parentNode) {
				renderer.domElement.parentNode.removeChild(renderer.domElement);
			}
			renderer = null;
		}
		app = null;
		fps = 0;
	}

	$effect(() => {
		if ($bloomMode && supported) {
			startBloom();
		} else {
			stopBloom();
		}
	});

	onDestroy(() => {
		stopBloom();
	});
</script>

{#if supported && $bloomMode}
	<div
		bind:this={container}
		class="fixed inset-0 z-0"
		style="pointer-events: none;"
	>
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center">
				<span class="text-xs text-[var(--terminal-dim)]">loading jellyfish...</span>
			</div>
		{/if}
	</div>

	<div class="fixed bottom-3 left-3 z-20 text-[10px] text-[var(--terminal-dim)]" style="pointer-events: none;">
		{fps} fps · jellyfish by <a href="https://github.com/holtsetio/aurelia" target="_blank" rel="noopener" class="text-[var(--terminal-dim)] underline" style="pointer-events: auto;">holtsetio/aurelia</a> (MIT)
	</div>
{/if}
