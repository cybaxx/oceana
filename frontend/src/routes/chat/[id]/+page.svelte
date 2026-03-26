<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { activeMessages, loadMessages, initChatListeners, sendEncryptedMessage, typingUsers, messagesCursor, keyChangeAlerts, verifiedUsers, verificationReceived, setChatUserId } from '$lib/stores/chat';
	import SafetyNumberModal from '$lib/components/SafetyNumberModal.svelte';
	import { connectWs, sendWsMessage } from '$lib/ws';
	import { api } from '$lib/api';
	import { initCrypto, getCryptoStore } from '$lib/crypto';
	import Markdown from '$lib/components/Markdown.svelte';

	let input = $state('');
	let messagesDiv: HTMLDivElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let uploading = $state(false);
	let memberIds = $state<string[]>([]);
	let encrypting = $state(false);
	let cryptoReady = $state(false);
	let showVerifyModal = $state(false);
	let verifyUserId = $state('');
	let verifyUsername = $state('');
	let memberUsernames = $state<Record<string, string>>({});
	let sendError = $state('');
	let convName = $state<string | null>(null);
	let editingName = $state(false);
	let editNameValue = $state('');

	const conversationId = $derived($page.params.id!);

	let lastTypingSent = 0;
	function sendTypingEvent() {
		const now = Date.now();
		if (now - lastTypingSent > 2000) {
			lastTypingSent = now;
			sendWsMessage({ type: 'typing', conversation_id: conversationId });
		}
	}

	const currentTypingUsers = $derived(
		Array.from($typingUsers.entries())
			.filter(([key]) => key.startsWith(conversationId + ':'))
			.map(([, username]) => username)
	);

	onMount(async () => {
		if (!$auth.user) {
			window.location.href = '/login';
			return;
		}
		setChatUserId($auth.user.id);

		// Init E2EE before WS so incoming messages can be decrypted
		await initCrypto($auth.user.id).catch((e: unknown) => console.error('Crypto init failed:', e));
		cryptoReady = !!getCryptoStore();

		connectWs();
		initChatListeners();

		// Fetch conversation details for name
		try {
			const convs = (await api.listConversations()) as import('$lib/types').Conversation[];
			const conv = convs.find((c) => c.id === conversationId);
			if (conv?.name) convName = conv.name;
		} catch { /* ignore */ }

		// Fetch conversation members for encryption targets
		try {
			memberIds = (await api.getConversationMembers(conversationId)) as string[];
			// Fetch usernames for member list
			for (const id of memberIds) {
				if (id !== $auth.user!.id) {
					try {
						const u = await api.getUser(id) as { username: string };
						memberUsernames[id] = u.username;
					} catch { /* ignore */ }
				}
			}
		} catch (e) {
			console.error('Failed to fetch members:', e);
		}

		loadMessages(conversationId).then(() => scrollToBottom());
	});

	// Auto-scroll when new messages arrive
	$effect(() => {
		const _len = $activeMessages.length;
		tick().then(() => scrollToBottom());
	});

	function scrollToBottom() {
		if (messagesDiv) {
			messagesDiv.scrollTop = messagesDiv.scrollHeight;
		}
	}

	async function send(imageUrl?: string) {
		const text = input.trim();
		if (!text && !imageUrl) return;
		input = '';
		sendError = '';
		encrypting = true;
		try {
			await sendEncryptedMessage(
				conversationId,
				text,
				memberIds,
				$auth.user!.id,
				imageUrl
			);
		} catch (e) {
			input = text;
			sendError = e instanceof Error ? e.message : 'Encryption failed. Message not sent.';
		} finally {
			encrypting = false;
		}
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

	function isEncrypted(msg: { ciphertext: string | null; message_type?: number | null }): boolean {
		return !!msg.ciphertext || !!msg.message_type;
	}

	const isGroup = $derived(memberIds.length > 2);

	function openVerify(userId: string, username: string) {
		verifyUserId = userId;
		verifyUsername = username;
		showVerifyModal = true;
	}

	function dismissKeyAlert(userId: string) {
		keyChangeAlerts.update((s) => { s.delete(userId); return new Set(s); });
	}

	function startEditName() {
		editingName = true;
		editNameValue = convName || '';
	}

	async function saveConvName() {
		try {
			const updated = await api.updateConversation(conversationId, editNameValue.trim() || null) as import('$lib/types').Conversation;
			convName = updated.name || null;
			editingName = false;
		} catch (e: any) {
			sendError = e.message;
		}
	}
</script>

<div class="flex h-[calc(100vh-80px)] flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--terminal-border)] pb-3">
		<div class="flex items-center gap-3">
			<a href="/chat" class="text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">&larr;</a>
			{#if editingName}
				<form onsubmit={(e) => { e.preventDefault(); saveConvName(); }} class="flex items-center gap-2">
					<input
						bind:value={editNameValue}
						placeholder="chat name..."
						class="rounded border border-[var(--ocean-400)] bg-[var(--ocean-950)] px-2 py-1 text-sm text-[var(--ocean-100)] focus:outline-none"
						autofocus
					/>
					<button type="submit" class="text-xs text-[var(--ocean-300)] hover:underline">save</button>
					<button type="button" onclick={() => (editingName = false)} class="text-xs text-[var(--terminal-dim)] hover:underline">cancel</button>
				</form>
			{:else}
				<h1 class="text-sm font-bold text-[var(--ocean-300)]">
					<span class="text-[var(--terminal-dim)]">chat/</span>{convName || conversationId.slice(0, 8)}
				</h1>
				<button onclick={startEditName} class="text-[var(--terminal-dim)] hover:text-[var(--ocean-300)] transition-colors" title="Edit name">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>
				</button>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if cryptoReady}
				<button
					onclick={() => {
						if (!isGroup) {
							const otherId = memberIds.find((id) => id !== $auth.user?.id);
							if (otherId) openVerify(otherId, memberUsernames[otherId] || otherId.slice(0, 8));
						}
					}}
					class="flex items-center gap-1 rounded-full border border-[var(--ocean-400)]/30 bg-[var(--ocean-400)]/5 px-2 py-1 text-[10px] text-[var(--ocean-300)] transition-colors hover:bg-[var(--ocean-400)]/15"
					title="Verify safety number"
				>
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
					verify
				</button>
				<div class="flex items-center gap-1.5 rounded-full border border-[var(--terminal-green)]/30 bg-[var(--terminal-green)]/5 px-2.5 py-1 text-[10px] text-[var(--terminal-green)]">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
					{isGroup ? 'Group E2EE' : 'Signal Protocol E2EE'}
				</div>
			{:else}
				<div class="flex items-center gap-1.5 rounded-full border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 px-2.5 py-1 text-[10px] text-[var(--terminal-red)]">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
					plaintext (no encryption)
				</div>
			{/if}
		</div>
	</div>

	<!-- Verification received notification -->
	{#if $verificationReceived && memberIds.includes($verificationReceived.userId)}
		{@const vr = $verificationReceived}
		<div class="flex items-center justify-between rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/5 px-3 py-2 text-xs text-[var(--terminal-green)]">
			<span>
				<svg class="mr-1 inline h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
				{vr.username} has verified your identity
			</span>
			<div class="flex gap-2">
				<button onclick={() => openVerify(vr.userId, vr.username)} class="underline">Verify back</button>
				<button onclick={() => verificationReceived.set(null)} class="opacity-60 hover:opacity-100">&times;</button>
			</div>
		</div>
	{/if}

	<!-- Key change warnings -->
	{#each [...$keyChangeAlerts] as alertUserId}
		<div class="flex items-center justify-between rounded border border-[var(--terminal-yellow)]/40 bg-[var(--terminal-yellow)]/5 px-3 py-2 text-xs text-[var(--terminal-yellow)]">
			<span>Security alert: identity key changed for {memberUsernames[alertUserId] || alertUserId.slice(0, 8)}. Verify their safety number.</span>
			<div class="flex gap-2">
				<button onclick={() => openVerify(alertUserId, memberUsernames[alertUserId] || alertUserId.slice(0, 8))} class="underline">Verify</button>
				<button onclick={() => dismissKeyAlert(alertUserId)} class="opacity-60 hover:opacity-100">&times;</button>
			</div>
		</div>
	{/each}

	<!-- Messages -->
	<div bind:this={messagesDiv} class="flex-1 overflow-y-auto py-4 space-y-2">
		{#each $activeMessages as msg}
			{@const isMe = msg.sender_id === $auth.user?.id}
			{@const encrypted = isEncrypted(msg)}
			<div class="flex {isMe ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[75%] rounded-lg px-3 py-2 text-sm {isMe
						? 'bg-[var(--ocean-600)] text-white'
						: 'border border-[var(--terminal-border)] bg-[var(--ocean-900)] text-[var(--terminal-text)]'}"
				>
					{#if !isMe}
					<div class="mb-1 flex items-center gap-1">
						<span class="text-[10px] text-[var(--terminal-dim)]">{msg.sender_username ?? ''}</span>
						{#if msg.sender_is_bot}
							<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1 py-0 text-[9px] font-medium text-[var(--ocean-300)]">BOT</span>
						{:else}
							<span class="rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-1 py-0 text-[9px] font-medium text-[var(--terminal-green)]">HUMAN</span>
						{/if}
					</div>
				{/if}
				{#if msg.image_url}
					<img src={msg.image_url} alt="attachment" class="max-w-full rounded" />
				{/if}
				{#if msg.plaintext}
					<div class="break-words"><Markdown content={msg.plaintext} /></div>
				{/if}
					<div class="mt-1 flex items-center justify-end gap-1.5">
						{#if encrypted}
							<svg class="h-2.5 w-2.5 {isMe ? 'text-white/40' : 'text-[var(--terminal-green)]/60'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" title="Decrypted from Signal Protocol ciphertext (type {msg.message_type === 3 ? 'PreKey' : 'Whisper'})"><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
						{/if}
						<span class="text-[10px] {isMe ? 'text-white/40' : 'opacity-60'}">
							{formatTime(msg.created_at)}
						</span>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				{#if cryptoReady}
					<svg class="mb-3 h-8 w-8 text-[var(--ocean-400)]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
					<p class="text-sm text-[var(--terminal-dim)]">messages are end-to-end encrypted</p>
					<p class="mt-1 text-[10px] text-[var(--terminal-dim)]/60">Signal Protocol · X3DH + Double Ratchet</p>
				{:else}
					<p class="py-8 text-sm text-[var(--terminal-dim)]">no messages yet — say something</p>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Typing indicator -->
	{#if currentTypingUsers.length > 0}
		<div class="px-1 pb-1 text-xs text-[var(--terminal-dim)]">
			{currentTypingUsers.join(', ')} {currentTypingUsers.length === 1 ? 'is' : 'are'} typing<span class="inline-block animate-pulse">...</span>
		</div>
	{/if}

	<!-- Send error -->
	{#if sendError}
		<div class="flex items-center justify-between rounded border border-[var(--terminal-red)]/40 bg-[var(--terminal-red)]/5 px-3 py-2 text-xs text-[var(--terminal-red)]">
			<span>{sendError}</span>
			<button onclick={() => (sendError = '')} class="opacity-60 hover:opacity-100">&times;</button>
		</div>
	{/if}

	<!-- Input -->
	<div class="border-t border-[var(--terminal-border)] pt-3">
		{#if encrypting}
			<div class="mb-2 flex items-center gap-1.5 text-[10px] text-[var(--ocean-400)]">
				<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3m0 12v3m-7.8-4.2 2.1-2.1m11.4-5.4 2.1-2.1M3 12h3m12 0h3M6.3 6.3l2.1 2.1m5.4 11.4 2.1 2.1"/></svg>
				encrypting with Signal Protocol...
			</div>
		{/if}
		<form onsubmit={(e) => { e.preventDefault(); send(); }} class="flex gap-2">
			<input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleImageUpload} />
			<button
				type="button"
				disabled={uploading}
				onclick={() => fileInput?.click()}
				class="rounded border border-[var(--terminal-border)] px-3 py-2 text-sm text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50"
			>
				{uploading ? '...' : '📎'}
			</button>
			<div class="relative flex-1">
				<input
					bind:value={input}
					oninput={sendTypingEvent}
					placeholder={cryptoReady ? 'encrypted message...' : 'type a message...'}
					disabled={encrypting}
					class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 pr-8 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none disabled:opacity-50"
				/>
				{#if cryptoReady}
					<svg class="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--terminal-green)]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
				{/if}
			</div>
			<button
				type="submit"
				disabled={encrypting}
				class="flex items-center gap-1.5 rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-50"
			>
				{#if encrypting}
					<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3m0 12v3m-7.8-4.2 2.1-2.1m11.4-5.4 2.1-2.1M3 12h3m12 0h3M6.3 6.3l2.1 2.1m5.4 11.4 2.1 2.1"/></svg>
				{:else}
					send
				{/if}
			</button>
		</form>
	</div>
</div>

{#if showVerifyModal}
	<SafetyNumberModal
		contactUserId={verifyUserId}
		contactUsername={verifyUsername}
		onclose={() => (showVerifyModal = false)}
	/>
{/if}
