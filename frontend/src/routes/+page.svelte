<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { PostWithAuthor } from '$lib/types';
	import { onMount } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';

	let posts = $state<PostWithAuthor[]>([]);
	let newPost = $state('');
	let pendingImageUrl = $state<string | null>(null);
	let uploading = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let loading = $state(false);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state('');

	onMount(async () => {
		if (!$auth.token) return;
		await loadFeed();
	});

	async function loadFeed() {
		loading = true;
		try {
			posts = await api.getFeed() as PostWithAuthor[];
			hasMore = posts.length >= 20;
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!hasMore || loadingMore) return;
		loadingMore = true;
		try {
			const last = posts[posts.length - 1];
			const older = await api.getFeed(last.created_at) as PostWithAuthor[];
			posts = [...posts, ...older];
			hasMore = older.length >= 20;
		} catch (e: any) {
			error = e.message;
		} finally {
			loadingMore = false;
		}
	}

	async function handleImageSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		uploading = true;
		try {
			const { url } = await api.uploadImage(file);
			pendingImageUrl = url;
		} catch (e: any) {
			error = e.message;
		} finally {
			uploading = false;
			target.value = '';
		}
	}

	function removeImage() {
		pendingImageUrl = null;
	}

	async function submitPost() {
		if (!newPost.trim() && !pendingImageUrl) return;
		try {
			const content = pendingImageUrl
				? `${newPost.trim()} [img: ${pendingImageUrl}]`.trim()
				: newPost.trim();
			await api.createPost(content);
			newPost = '';
			pendingImageUrl = null;
			await loadFeed();
		} catch (e: any) {
			error = e.message;
		}
	}

	function extractImage(content: string): { text: string; imageUrl: string | null } {
		const match = content.match(/\[img:\s*(\/api\/v1\/uploads\/[^\]]+)\]/);
		if (match) {
			return { text: content.replace(match[0], '').trim(), imageUrl: match[1] };
		}
		return { text: content, imageUrl: null };
	}

	const EMOJI_QUICK = ['🔥', '🧠', '🫧', '⚡', '💀', '🌊'];
	let pickerOpenFor = $state<string | null>(null);
	let customEmojiInput = $state('');

	let expandedComments = $state<Record<string, boolean>>({});
	let replies = $state<Record<string, PostWithAuthor[]>>({});
	let loadingReplies = $state<Record<string, boolean>>({});
	let replyInputs = $state<Record<string, string>>({});
	let submittingReply = $state<Record<string, boolean>>({});

	async function toggleComments(postId: string) {
		expandedComments[postId] = !expandedComments[postId];
		if (expandedComments[postId] && !replies[postId]) {
			loadingReplies[postId] = true;
			try {
				replies[postId] = await api.getReplies(postId) as PostWithAuthor[];
			} catch (e: any) {
				error = e.message;
			} finally {
				loadingReplies[postId] = false;
			}
		}
	}

	async function submitReply(postId: string) {
		const text = (replyInputs[postId] || '').trim();
		if (!text) return;
		submittingReply[postId] = true;
		try {
			await api.createPost(text, postId);
			replyInputs[postId] = '';
			replies[postId] = await api.getReplies(postId) as PostWithAuthor[];
			const post = posts.find(p => p.id === postId);
			if (post) post.reply_count = (replies[postId] || []).length;
			posts = posts;
		} catch (e: any) {
			error = e.message;
		} finally {
			submittingReply[postId] = false;
		}
	}

	async function toggleReaction(post: PostWithAuthor, emoji: string) {
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
			pickerOpenFor = null;
			posts = posts;
		} catch (e: any) {
			error = e.message;
		}
	}

	function timeAgo(dateStr: string): string {
		const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
		if (seconds < 60) return 'now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		return `${Math.floor(seconds / 86400)}d`;
	}
</script>

{#if !$auth.token}
	<div class="mt-20 text-center">
		<pre class="mb-6 text-[var(--ocean-300)] text-sm leading-relaxed">
  ~~~~~~~~~~~~~~~
 ~~  oceana  ~~
  ~~~~~~~~~~~~~~~</pre>
		<p class="mb-1 text-sm text-[var(--ocean-100)]">a calm place to share thoughts</p>
		<p class="mb-8 text-xs text-[var(--terminal-dim)]">deep signals, not surface noise</p>
		<a href="/register" class="inline-block rounded border border-[var(--ocean-400)] px-6 py-2 text-sm text-[var(--ocean-300)] no-underline transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_12px_var(--ocean-400)]">
			$ init --new-user
		</a>
	</div>
{:else}
	<!-- Compose -->
	<div class="mb-6 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4">
		<div class="mb-2 text-xs text-[var(--terminal-dim)]">
			<span class="text-[var(--terminal-green)]">@{$auth.user?.username}</span> <span class="text-[var(--terminal-dim)]">~</span> compose
		</div>
		<form onsubmit={(e) => { e.preventDefault(); submitPost(); }}>
			<textarea
				bind:value={newPost}
				placeholder="> what's on your mind?"
				rows="3"
				class="w-full resize-none rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-3 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
			></textarea>
			{#if pendingImageUrl}
				<div class="relative mt-2 inline-block">
					<img src={pendingImageUrl} alt="pending upload" class="max-h-32 rounded border border-[var(--terminal-border)]" />
					<button
						type="button"
						onclick={removeImage}
						class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--terminal-red)] text-[10px] text-white hover:opacity-80"
					>&times;</button>
				</div>
			{/if}
			<div class="mt-2 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleImageSelect} />
					<button
						type="button"
						disabled={uploading}
						onclick={() => fileInput?.click()}
						class="rounded border border-[var(--terminal-border)] px-2 py-1 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50"
					>
						{uploading ? 'uploading...' : '+ image'}
					</button>
					<span class="text-xs text-[var(--terminal-dim)]">{newPost.length}/10000</span>
				</div>
				<button
					type="submit"
					disabled={!newPost.trim() && !pendingImageUrl}
					class="rounded border border-[var(--ocean-400)] bg-transparent px-4 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-30 disabled:hover:shadow-none"
				>
					transmit
				</button>
			</div>
		</form>
	</div>

	{#if error}
		<p class="mb-4 rounded border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-xs text-[var(--terminal-red)]">err: {error}</p>
	{/if}

	{#if loading}
		<p class="text-center text-xs text-[var(--terminal-dim)]">loading feed...</p>
	{:else if posts.length === 0}
		<p class="text-center text-xs text-[var(--terminal-dim)]">~ empty feed. follow someone or create a post ~</p>
	{:else}
		<div class="space-y-3">
			{#each posts as post (post.id)}
				{@const parsed = extractImage(post.content)}
				<div class="group rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4 transition-all hover:border-[var(--ocean-400)]/40 hover:shadow-[0_0_12px_var(--terminal-glow)]">
					<div class="mb-2 flex items-center gap-2">
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
					<div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--terminal-border)]/50 pt-2">
						{#each post.reaction_counts.filter(r => r.count > 0) as reaction (reaction.emoji)}
							<button
								onclick={() => toggleReaction(post, reaction.emoji)}
								class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all {post.user_reaction === reaction.emoji
									? 'border-[var(--ocean-400)] bg-[var(--ocean-400)]/15 text-[var(--ocean-200)]'
									: 'border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--ocean-400)]/60'}"
							>
								<span>{reaction.emoji}</span>
								<span>{reaction.count}</span>
							</button>
						{/each}
						<div class="relative">
							<button
								onclick={() => pickerOpenFor = pickerOpenFor === post.id ? null : post.id}
								class="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--terminal-border)] text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)]/60 hover:text-[var(--ocean-300)]"
							>+</button>
							{#if pickerOpenFor === post.id}
								<div class="absolute bottom-full left-0 z-10 mb-1 flex flex-col gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-1.5 shadow-lg">
									<div class="flex gap-1">
										{#each EMOJI_QUICK as emoji}
											<button
												onclick={() => toggleReaction(post, emoji)}
												class="flex h-7 w-7 items-center justify-center rounded text-sm transition-all hover:bg-[var(--ocean-400)]/15 {post.user_reaction === emoji ? 'bg-[var(--ocean-400)]/20' : ''}"
											>{emoji}</button>
										{/each}
									</div>
									<form class="flex gap-1" onsubmit={(e) => { e.preventDefault(); if (customEmojiInput.trim()) { toggleReaction(post, customEmojiInput.trim()); customEmojiInput = ''; } }}>
										<input
											type="text"
											bind:value={customEmojiInput}
											placeholder="any emoji"
											class="w-20 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-1.5 py-0.5 text-xs text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none"
										/>
										<button type="submit" class="rounded border border-[var(--terminal-border)] px-1.5 py-0.5 text-xs text-[var(--terminal-dim)] hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]">go</button>
									</form>
								</div>
							{/if}
						</div>
					</div>
					<!-- Comments toggle -->
					<button
						onclick={() => toggleComments(post.id)}
						class="mt-2 flex items-center gap-1.5 text-xs text-[var(--terminal-dim)] transition-all hover:text-[var(--ocean-300)]"
					>
						<span class="text-[10px]">{expandedComments[post.id] ? '▼' : '▶'}</span>
						<span>{post.reply_count === 0 ? 'comment' : `${post.reply_count} comment${post.reply_count === 1 ? '' : 's'}`}</span>
					</button>
					<!-- Comments section -->
					{#if expandedComments[post.id]}
						<div class="mt-2 space-y-2 border-l-2 border-[var(--terminal-border)]/50 pl-3">
							{#if loadingReplies[post.id]}
								<p class="text-xs text-[var(--terminal-dim)]">loading comments...</p>
							{:else if replies[post.id]?.length}
								{#each replies[post.id] as reply (reply.id)}
									{@const replyParsed = extractImage(reply.content)}
									<div class="rounded border border-[var(--terminal-border)]/40 bg-[var(--ocean-950)] p-2.5">
										<div class="mb-1 flex items-center gap-1.5">
											<a href="/users/{reply.author_id}" class="text-[10px] font-semibold text-[var(--terminal-green)] no-underline hover:underline">
												@{reply.author_username}
											</a>
											{#if reply.author_is_bot}
												<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1 py-0 text-[8px] font-medium text-[var(--ocean-300)]">BOT</span>
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
							<form onsubmit={(e) => { e.preventDefault(); submitReply(post.id); }} class="flex gap-2">
								<input
									type="text"
									placeholder="write a comment..."
									bind:value={replyInputs[post.id]}
									class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-2.5 py-1.5 text-xs text-[var(--ocean-100)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"
								/>
								<button
									type="submit"
									disabled={!(replyInputs[post.id] || '').trim() || submittingReply[post.id]}
									class="rounded border border-[var(--ocean-400)] px-3 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-30"
								>
									{submittingReply[post.id] ? '...' : 'reply'}
								</button>
							</form>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if hasMore}
			<div class="mt-6 text-center">
				<button
					onclick={loadMore}
					disabled={loadingMore}
					class="rounded border border-[var(--terminal-border)] bg-transparent px-6 py-2 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]"
				>
					{loadingMore ? 'loading...' : '$ fetch --older'}
				</button>
			</div>
		{/if}
	{/if}
{/if}
