<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { conversations, loadConversations, initChatListeners } from '$lib/stores/chat';
	import { connectWs } from '$lib/ws';
	import { api } from '$lib/api';
	import type { Conversation } from '$lib/types';

	let newUserId = $state('');
	let creating = $state(false);

	onMount(() => {
		if (!$auth.user) {
			window.location.href = '/login';
			return;
		}
		connectWs();
		initChatListeners();
		loadConversations();
	});

	async function createChat() {
		if (!newUserId.trim()) return;
		creating = true;
		try {
			const conv = (await api.createConversation([newUserId.trim()])) as Conversation;
			await loadConversations();
			window.location.href = `/chat/${conv.id}`;
		} catch (e: any) {
			alert(e.message);
		} finally {
			creating = false;
		}
	}

	function formatTime(dateStr: string | null) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const now = new Date();
		if (d.toDateString() === now.toDateString()) {
			return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-bold text-[var(--ocean-300)]">
			<span class="text-[var(--terminal-dim)]">$</span> messages
		</h1>
	</div>

	<!-- New conversation -->
	<form onsubmit={(e) => { e.preventDefault(); createChat(); }}
		class="flex gap-2">
		<input
			bind:value={newUserId}
			placeholder="user ID to chat with..."
			class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"
		/>
		<button
			type="submit"
			disabled={creating}
			class="rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-50"
		>
			new chat
		</button>
	</form>

	<!-- Conversation list -->
	<div class="space-y-1">
		{#each $conversations as conv}
			<a
				href="/chat/{conv.id}"
				class="block rounded border border-[var(--terminal-border)] p-3 no-underline transition-colors hover:border-[var(--ocean-400)] hover:bg-[var(--ocean-900)]/50"
			>
				<div class="flex items-center justify-between">
					<span class="font-mono text-xs text-[var(--terminal-dim)]">
						{conv.id.slice(0, 8)}...
					</span>
					<span class="text-xs text-[var(--terminal-dim)]">
						{formatTime(conv.last_message_at || conv.created_at)}
					</span>
				</div>
				{#if conv.last_message_text}
					<p class="mt-1 truncate text-sm text-[var(--terminal-text)]">
						{conv.last_message_text}
					</p>
				{:else}
					<p class="mt-1 text-sm italic text-[var(--terminal-dim)]">no messages yet</p>
				{/if}
			</a>
		{:else}
			<p class="py-8 text-center text-sm text-[var(--terminal-dim)]">
				no conversations yet — start one above
			</p>
		{/each}
	</div>
</div>
