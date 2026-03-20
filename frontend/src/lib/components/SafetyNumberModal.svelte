<script lang="ts">
	import { getCryptoStore } from '$lib/crypto';
	import { generateSafetyNumber, formatSafetyNumber } from '$lib/crypto/fingerprint';
	import { sendVerification, verifiedUsers, keyChangeAlerts } from '$lib/stores/chat';
	import { onMount } from 'svelte';

	interface Props {
		contactUserId: string;
		contactUsername: string;
		onclose: () => void;
	}

	let { contactUserId, contactUsername, onclose }: Props = $props();

	let safetyNumber = $state('');
	let error = $state('');
	let loading = $state(true);
	let verified = $state(false);
	let sent = $state(false);

	// Check if already verified
	const alreadyVerified = $derived($verifiedUsers.has(contactUserId));

	onMount(async () => {
		try {
			const store = getCryptoStore();
			if (!store) throw new Error('Crypto not initialized');
			const raw = await generateSafetyNumber(store, store['userId'], contactUserId);
			safetyNumber = formatSafetyNumber(raw);
		} catch (e: any) {
			error = e.message || 'Failed to generate safety number';
		} finally {
			loading = false;
		}
	});

	// Split into rows of 3 groups (15 digits per row) for 4x3 grid
	const numberRows = $derived(() => {
		if (!safetyNumber) return [];
		const groups = safetyNumber.split(' ');
		const rows: string[][] = [];
		for (let i = 0; i < groups.length; i += 3) {
			rows.push(groups.slice(i, i + 3));
		}
		return rows;
	});

	function handleVerify() {
		sendVerification(contactUserId);
		verifiedUsers.update((s) => { s.add(contactUserId); return new Set(s); });
		keyChangeAlerts.update((s) => { s.delete(contactUserId); return new Set(s); });
		verified = true;
		sent = true;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onclick={onclose}>
	<div
		class="mx-4 w-full max-w-sm rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-6"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-bold text-[var(--ocean-300)]">
				<span class="text-[var(--terminal-dim)]">verify/</span>{contactUsername}
			</h2>
			<button onclick={onclose} class="text-[var(--terminal-dim)] hover:text-[var(--terminal-text)]">
				&times;
			</button>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="text-xs text-[var(--terminal-dim)]">generating safety number...</span>
			</div>
		{:else if error}
			<div class="rounded border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-xs text-[var(--terminal-red)]">
				{error}
			</div>
		{:else}
			<div class="mb-4 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4">
				<div class="grid gap-2">
					{#each numberRows() as row}
						<div class="flex justify-center gap-4 font-mono text-sm tracking-wider text-[var(--terminal-green)]">
							{#each row as group}
								<span>{group}</span>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<p class="mb-4 text-[10px] leading-relaxed text-[var(--terminal-dim)]">
				Compare this safety number with your contact via a trusted channel (in person, voice call, etc). If they match, click verify to confirm.
			</p>

			{#if verified || alreadyVerified}
				<div class="flex items-center justify-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green)]/5 px-3 py-2 text-xs text-[var(--terminal-green)]">
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
					{sent ? 'Verified — notification sent to ' + contactUsername : 'Identity verified'}
				</div>
			{:else}
				<div class="flex gap-2">
					<button
						onclick={handleVerify}
						class="flex-1 rounded border border-[var(--terminal-green)] px-3 py-2 text-xs font-medium text-[var(--terminal-green)] transition-colors hover:bg-[var(--terminal-green)]/10"
					>
						I've verified the numbers match
					</button>
					<button
						onclick={onclose}
						class="rounded border border-[var(--terminal-border)] px-3 py-2 text-xs text-[var(--terminal-dim)] transition-colors hover:border-[var(--terminal-text)]"
					>
						Cancel
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
