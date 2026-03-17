<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { PostWithAuthor } from '$lib/types';
	import { onMount } from 'svelte';

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
						<p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ocean-100)]">{parsed.text}</p>
					{/if}
					{#if parsed.imageUrl}
						<img src={parsed.imageUrl} alt="post attachment" class="mt-2 max-w-full rounded-lg border border-[var(--terminal-border)]" />
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
