<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { PostWithAuthor } from '$lib/types';
	import { onMount } from 'svelte';

	let posts = $state<PostWithAuthor[]>([]);
	let newPost = $state('');
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

	async function submitPost() {
		if (!newPost.trim()) return;
		try {
			await api.createPost(newPost.trim());
			newPost = '';
			await loadFeed();
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
			<div class="mt-2 flex items-center justify-between">
				<span class="text-xs text-[var(--terminal-dim)]">{newPost.length}/10000</span>
				<button
					type="submit"
					disabled={!newPost.trim()}
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
				<div class="group rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4 transition-all hover:border-[var(--ocean-400)]/40 hover:shadow-[0_0_12px_var(--terminal-glow)]">
					<div class="mb-2 flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-xs font-bold text-[var(--ocean-300)]">
							{post.author_username[0].toUpperCase()}
						</div>
						<a href="/users/{post.author_id}" class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">
							@{post.author_username}
						</a>
						{#if post.author_display_name}
							<span class="text-xs text-[var(--terminal-dim)]">{post.author_display_name}</span>
						{/if}
						<span class="ml-auto text-xs text-[var(--terminal-dim)]">{timeAgo(post.created_at)}</span>
					</div>
					<p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ocean-100)]">{post.content}</p>
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
