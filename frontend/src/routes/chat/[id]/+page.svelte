<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { activeMessages, loadMessages, initChatListeners } from '$lib/stores/chat';
	import { connectWs, sendWsMessage } from '$lib/ws';
	import { api } from '$lib/api';

	let input = $state('');
	let messagesDiv: HTMLDivElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let uploading = $state(false);

	const conversationId = $derived($page.params.id!);

	onMount(() => {
		if (!$auth.user) {
			window.location.href = '/login';
			return;
		}
		connectWs();
		initChatListeners();
		loadMessages(conversationId).then(() => scrollToBottom());
	});

	// Auto-scroll when new messages arrive
	$effect(() => {
		// subscribe to activeMessages length changes
		const _len = $activeMessages.length;
		tick().then(() => scrollToBottom());
	});

	function scrollToBottom() {
		if (messagesDiv) {
			messagesDiv.scrollTop = messagesDiv.scrollHeight;
		}
	}

	function send(imageUrl?: string) {
		const text = input.trim();
		if (!text && !imageUrl) return;
		sendWsMessage({
			type: 'send_message',
			conversation_id: conversationId,
			content: text,
			image_url: imageUrl ?? null
		});
		input = '';
	}

	async function handleImageUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		uploading = true;
		try {
			const { url } = await api.uploadImage(file);
			send(url);
		} catch (err) {
			console.error('Upload failed:', err);
		} finally {
			uploading = false;
			target.value = '';
		}
	}

	function formatTime(dateStr: string) {
		return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="flex h-[calc(100vh-80px)] flex-col">
	<!-- Header -->
	<div class="flex items-center gap-3 border-b border-[var(--terminal-border)] pb-3">
		<a href="/chat" class="text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">&larr;</a>
		<h1 class="text-sm font-bold text-[var(--ocean-300)]">
			<span class="text-[var(--terminal-dim)]">chat/</span>{conversationId.slice(0, 8)}
		</h1>
	</div>

	<!-- Messages -->
	<div bind:this={messagesDiv} class="flex-1 overflow-y-auto py-4 space-y-2">
		{#each $activeMessages as msg}
			{@const isMe = msg.sender_id === $auth.user?.id}
			<div class="flex {isMe ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[75%] rounded-lg px-3 py-2 text-sm {isMe
						? 'bg-[var(--ocean-600)] text-white'
						: 'border border-[var(--terminal-border)] bg-[var(--ocean-900)] text-[var(--terminal-text)]'}"
				>
					{#if msg.image_url}
					<img src={msg.image_url} alt="attachment" class="max-w-full rounded" />
				{/if}
				{#if msg.plaintext}
					<p class="break-words">{msg.plaintext}</p>
				{/if}
					<span class="mt-1 block text-right text-[10px] opacity-60">
						{formatTime(msg.created_at)}
					</span>
				</div>
			</div>
		{:else}
			<p class="py-8 text-center text-sm text-[var(--terminal-dim)]">
				no messages yet — say something
			</p>
		{/each}
	</div>

	<!-- Input -->
	<form onsubmit={(e) => { e.preventDefault(); send(); }}
		class="flex gap-2 border-t border-[var(--terminal-border)] pt-3">
		<input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleImageUpload} />
		<button
			type="button"
			disabled={uploading}
			onclick={() => fileInput?.click()}
			class="rounded border border-[var(--terminal-border)] px-3 py-2 text-sm text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50"
		>
			{uploading ? '...' : '📎'}
		</button>
		<input
			bind:value={input}
			placeholder="type a message..."
			class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"
		/>
		<button
			type="submit"
			class="rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10"
		>
			send
		</button>
	</form>
</div>
