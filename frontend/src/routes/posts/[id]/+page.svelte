<script lang="ts">
	import { page } from '$app/stores';
	import { api } from '$lib/api';
	import type { Post } from '$lib/types';
	import { onMount } from 'svelte';

	let post = $state<Post | null>(null);
	let error = $state('');

	function extractImage(content: string): { text: string; imageUrl: string | null } {
		const match = content.match(/\[img:\s*(\/api\/v1\/uploads\/[^\]]+)\]/);
		if (match) return { text: content.replace(match[0], '').trim(), imageUrl: match[1] };
		return { text: content, imageUrl: null };
	}

	onMount(async () => {
		try {
			post = (await api.getPost($page.params.id)) as Post;
		} catch (e: any) {
			error = e.message;
		}
	});
</script>

{#if error}
	<p class="text-center text-xs text-[var(--terminal-red)]">err: {error}</p>
{:else if !post}
	<p class="text-center text-xs text-[var(--terminal-dim)]">loading...</p>
{:else}
	<div class="mx-auto mt-8 max-w-lg">
		<div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6">
			<div class="mb-4 text-xs text-[var(--terminal-dim)]">~/posts/{post.id.slice(0, 8)}</div>
			{#if extractImage(post.content).text}
				<p class="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ocean-100)]">{extractImage(post.content).text}</p>
			{/if}
			{#if extractImage(post.content).imageUrl}
				<img src={extractImage(post.content).imageUrl} alt="post attachment" class="mb-4 max-w-full rounded-lg border border-[var(--terminal-border)]" />
			{/if}
			<div class="flex items-center justify-between border-t border-[var(--terminal-border)] pt-3 text-xs text-[var(--terminal-dim)]">
				<a href="/users/{post.author_id}" class="text-[var(--terminal-green)] no-underline hover:underline">view author</a>
				<span>{new Date(post.created_at).toLocaleString()}</span>
			</div>
		</div>
	</div>
{/if}
