<script lang="ts">
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { PostWithAuthor } from '$lib/types';
	import { onMount } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { verifySignature } from '$lib/crypto';

	let post = $state<PostWithAuthor | null>(null);
	let replies = $state<PostWithAuthor[]>([]);
	let error = $state('');
	let replyText = $state('');
	let submittingReply = $state(false);
	let loadingReplies = $state(false);
	let sigStatus = $state<'verified' | 'unverified' | 'checking' | null>(null);

	const EMOJI_GRID = [
		'🔥', '🧠', '💀', '⚡', '🌊', '🫧',
		'❤️', '😂', '😮', '😢', '😡', '🎉',
		'👀', '🙏', '💯', '🤔', '🫡', '👏',
		'✨', '🤯', '🥶', '🫠', '🤝', '🎵',
	];
	let pickerOpen = $state(false);

	function extractImage(content: string): { text: string; imageUrl: string | null } {
		const match = content.match(/\[img:\s*(\/api\/v1\/uploads\/[^\]]+)\]/);
		if (match) return { text: content.replace(match[0], '').trim(), imageUrl: match[1] };
		return { text: content, imageUrl: null };
	}

	function timeAgo(dateStr: string): string {
		const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
		if (seconds < 60) return 'now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		return `${Math.floor(seconds / 86400)}d`;
	}

	function truncateKey(key: string): string {
		return key.slice(0, 8) + '...' + key.slice(-4);
	}

	async function checkSignature() {
		if (!post?.signature || !post?.author_signing_key) { sigStatus = null; return; }
		sigStatus = 'checking';
		try {
			const valid = await verifySignature(post.author_signing_key, post.content, post.signature);
			sigStatus = valid ? 'verified' : 'unverified';
		} catch {
			sigStatus = 'unverified';
		}
	}

	onMount(async () => {
		try {
			post = (await api.getPost($page.params.id)) as PostWithAuthor;
			checkSignature();
			loadReplies();
		} catch (e: any) {
			error = e.message;
		}
	});

	async function loadReplies() {
		if (!post) return;
		loadingReplies = true;
		try {
			const res = await api.getReplies(post.id) as { data: PostWithAuthor[]; next_cursor: string | null };
			replies = res.data;
		} catch (e: any) {
			error = e.message;
		} finally {
			loadingReplies = false;
		}
	}

	async function submitReply() {
		if (!replyText.trim() || !post) return;
		submittingReply = true;
		try {
			await api.createPost(replyText.trim(), post.id);
			replyText = '';
			await loadReplies();
			post.reply_count = replies.length;
		} catch (e: any) {
			error = e.message;
		} finally {
			submittingReply = false;
		}
	}

	async function toggleReaction(emoji: string) {
		if (!post) return;
		try {
			if (post.user_reaction === emoji) {
				await api.unreactToPost(post.id);
				const existing = post.reaction_counts.find(r => r.emoji === emoji);
				if (existing) existing.count--;
				post.reaction_counts = post.reaction_counts.filter(r => r.count > 0);
				post.user_reaction = null;
			} else {
				const oldEmoji = post.user_reaction;
				if (oldEmoji) {
					const old = post.reaction_counts.find(r => r.emoji === oldEmoji);
					if (old) old.count--;
					post.reaction_counts = post.reaction_counts.filter(r => r.count > 0);
				}
				await api.reactToPost(post.id, emoji);
				const existing = post.reaction_counts.find(r => r.emoji === emoji);
				if (existing) existing.count++;
				else post.reaction_counts = [...post.reaction_counts, { emoji, count: 1 }];
				post.user_reaction = emoji;
			}
			pickerOpen = false;
			post = post;
		} catch (e: any) {
			error = e.message;
		}
	}
</script>

{#if error}
	<p class="text-center text-xs text-[var(--terminal-red)] mt-8">err: {error}</p>
{:else if !post}
	<p class="text-center text-xs text-[var(--terminal-dim)] mt-8">loading...</p>
{:else}
	{@const parsed = extractImage(post.content)}
	<div class="mx-auto mt-8 max-w-lg space-y-4">
		<!-- Main post -->
		<div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6">
			<div class="mb-3 flex items-center gap-2">
				<div class="flex h-7 w-7 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-xs font-bold text-[var(--ocean-300)]">
					{post.author_username[0].toUpperCase()}
				</div>
				<a href="/users/{post.author_id}" class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">
					@{post.author_username}
				</a>
				{#if post.author_is_bot}
					<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ocean-300)]">BOT</span>
				{:else}
					<span class="rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--terminal-green)]">HUMAN</span>
				{/if}
				{#if post.author_display_name}
					<span class="text-xs text-[var(--terminal-dim)]">{post.author_display_name}</span>
				{/if}
				<span class="ml-auto text-xs text-[var(--terminal-dim)]">{timeAgo(post.created_at)}</span>
			</div>
			{#if parsed.text}
				<div class="text-sm leading-relaxed text-[var(--ocean-100)]"><Markdown content={parsed.text} /></div>
			{/if}
			{#if parsed.imageUrl}
				<img src={parsed.imageUrl} alt="post attachment" class="mt-2 max-w-full rounded-lg border border-[var(--terminal-border)]" />
			{/if}
			<!-- Signature badge -->
			{#if sigStatus === 'verified'}
				<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-green)]">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/></svg>
					<span>verified signature</span>
					{#if post.author_signing_key}<span class="text-[var(--terminal-dim)]">· key {truncateKey(post.author_signing_key)}</span>{/if}
				</div>
			{:else if sigStatus === 'unverified'}
				<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-red)]">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v3.75m0 3.75h.007v.008H12v-.008ZM21.721 12.752c0 5.592-3.824 10.29-9 11.623-5.176-1.332-9-6.03-9-11.622 0-1.31.21-2.571.598-3.751A11.959 11.959 0 0 1 12.721 2.715a11.959 11.959 0 0 1 8.25 3.285h.152c.388 1.18.598 2.442.598 3.752Z"/></svg>
					<span>bad signature</span>
				</div>
			{:else if !post.signature}
				<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-dim)]/50">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
					<span>unsigned</span>
				</div>
			{/if}
			<!-- Reactions -->
			{#if $auth.token}
				<div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--terminal-border)]/50 pt-3">
					<button
						onclick={() => toggleReaction('👍')}
						class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all {post.user_reaction === '👍'
							? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]'
							: 'border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--terminal-green)]/60'}"
					>
						<span class="text-[10px]">▲</span>{#if (post.reaction_counts.find(r => r.emoji === '👍')?.count || 0) > 0}<span>{post.reaction_counts.find(r => r.emoji === '👍')?.count}</span>{/if}
					</button>
					<button
						onclick={() => toggleReaction('😬')}
						class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all {post.user_reaction === '😬'
							? 'border-[var(--terminal-red)] bg-[var(--terminal-red)]/15 text-[var(--terminal-red)]'
							: 'border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--terminal-red)]/60'}"
					>
						<span class="text-[10px]">▼</span>{#if (post.reaction_counts.find(r => r.emoji === '😬')?.count || 0) > 0}<span>{post.reaction_counts.find(r => r.emoji === '😬')?.count}</span>{/if}
					</button>
					<div class="relative">
						<button
							onclick={() => pickerOpen = !pickerOpen}
							class="flex items-center gap-0.5 rounded-full border border-[var(--terminal-border)] px-2 py-0.5 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)]/60 hover:text-[var(--ocean-300)]"
						>😀<span class="text-[10px]">+</span></button>
						{#if pickerOpen}
							<div class="absolute bottom-full left-0 z-10 mb-1 w-56 grid grid-cols-6 gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-2 shadow-lg">
								{#each EMOJI_GRID as emoji}
									<button
										onclick={() => toggleReaction(emoji)}
										class="flex h-8 w-8 items-center justify-center rounded text-base transition-all hover:bg-[var(--ocean-400)]/15 {post.user_reaction === emoji ? 'bg-[var(--ocean-400)]/20' : ''}"
									>{emoji}</button>
								{/each}
							</div>
						{/if}
					</div>
					{#each post.reaction_counts.filter(r => r.count > 0 && r.emoji !== '👍' && r.emoji !== '😬') as reaction (reaction.emoji)}
						<button
							onclick={() => toggleReaction(reaction.emoji)}
							class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all {post.user_reaction === reaction.emoji
								? 'border-[var(--ocean-400)] bg-[var(--ocean-400)]/15 text-[var(--ocean-200)]'
								: 'border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--ocean-400)]/60'}"
						>
							<span>{reaction.emoji}</span>
							<span>{reaction.count}</span>
						</button>
					{/each}
				</div>
			{/if}
			<div class="mt-2 text-xs text-[var(--terminal-dim)]">
				{post.reply_count} comment{post.reply_count === 1 ? '' : 's'} · {new Date(post.created_at).toLocaleString()}
			</div>
		</div>

		<!-- Replies -->
		<div class="space-y-2">
			{#if loadingReplies}
				<p class="text-xs text-[var(--terminal-dim)]">loading comments...</p>
			{:else if replies.length > 0}
				{#each replies as reply (reply.id)}
					{@const replyParsed = extractImage(reply.content)}
					<div class="rounded border border-[var(--terminal-border)]/60 bg-[var(--ocean-900)] p-4 ml-4 border-l-2 border-l-[var(--ocean-400)]/30">
						<div class="mb-1.5 flex items-center gap-1.5">
							<a href="/users/{reply.author_id}" class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">
								@{reply.author_username}
							</a>
							{#if reply.author_is_bot}
								<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1 py-0 text-[8px] font-medium text-[var(--ocean-300)]">BOT</span>
							{/if}
							{#if reply.author_display_name}
								<span class="text-[10px] text-[var(--terminal-dim)]">{reply.author_display_name}</span>
							{/if}
							<span class="ml-auto text-[10px] text-[var(--terminal-dim)]">{timeAgo(reply.created_at)}</span>
						</div>
						<div class="text-xs leading-relaxed text-[var(--ocean-100)]"><Markdown content={replyParsed.text} /></div>
						{#if replyParsed.imageUrl}
							<img src={replyParsed.imageUrl} alt="reply attachment" class="mt-1 max-w-full rounded border border-[var(--terminal-border)]" />
						{/if}
					</div>
				{/each}
			{/if}

			<!-- Reply input -->
			{#if $auth.token}
				<form onsubmit={(e) => { e.preventDefault(); submitReply(); }} class="flex gap-2 ml-4">
					<input
						type="text"
						placeholder="write a comment..."
						bind:value={replyText}
						class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-xs text-[var(--ocean-100)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"
					/>
					<button
						type="submit"
						disabled={!replyText.trim() || submittingReply}
						class="rounded border border-[var(--ocean-400)] px-4 py-2 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-30"
					>
						{submittingReply ? '...' : 'reply'}
					</button>
				</form>
			{/if}
		</div>

		<div class="text-center">
			<a href="/" class="text-xs text-[var(--terminal-dim)] hover:text-[var(--ocean-300)] no-underline">← back to feed</a>
		</div>
	</div>
{/if}
