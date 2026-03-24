<script lang="ts">
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { User } from '$lib/types';
	import { onMount } from 'svelte';

	interface UserListItem {
		id: string;
		username: string;
		display_name: string | null;
		is_bot: boolean;
	}

	let user = $state<User | null>(null);
	let error = $state('');
	let following = $state(false);
	let toggling = $state(false);
	let showList = $state<'followers' | 'following' | null>(null);
	let listUsers = $state<UserListItem[]>([]);
	let listLoading = $state(false);

	const userId = $derived($page.params.id);
	const isMe = $derived($auth.user?.id === userId);

	onMount(async () => {
		try {
			user = (await api.getUser(userId)) as User;
		} catch (e: any) {
			error = e.message;
		}
	});

	async function openList(type: 'followers' | 'following') {
		if (showList === type) { showList = null; return; }
		showList = type;
		listLoading = true;
		try {
			listUsers = (type === 'followers'
				? await api.getFollowers(userId)
				: await api.getFollowing(userId)) as UserListItem[];
		} catch (e: any) {
			listUsers = [];
		} finally {
			listLoading = false;
		}
	}

	async function toggleFollow() {
		toggling = true;
		try {
			if (following) {
				await api.unfollow(userId);
				following = false;
			} else {
				await api.follow(userId);
				following = true;
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			toggling = false;
		}
	}
</script>

{#if error}
	<p class="text-center text-xs text-[var(--terminal-red)]">err: {error}</p>
{:else if !user}
	<p class="text-center text-xs text-[var(--terminal-dim)]">loading...</p>
{:else}
	<div class="mx-auto mt-8 max-w-sm">
		<div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6">
			<div class="mb-1 text-xs text-[var(--terminal-dim)]">~/users/{user.username}</div>

			<div class="mb-4 mt-4 flex items-center gap-4">
				{#if user.avatar_url}
					<img src={user.avatar_url} alt="{user.username}'s avatar" class="h-12 w-12 rounded border border-[var(--terminal-border)] object-cover" />
				{:else}
					<div class="flex h-12 w-12 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-lg font-bold text-[var(--ocean-300)]">
						{user.username[0].toUpperCase()}
					</div>
				{/if}
				<div>
					<h1 class="text-base font-bold text-[var(--ocean-100)]">
						{user.display_name || user.username}
					</h1>
					<div class="flex items-center gap-1.5">
						<p class="text-xs text-[var(--terminal-green)]">@{user.username}</p>
						{#if user.is_bot}
							<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ocean-300)]">BOT</span>
						{:else}
							<span class="rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--terminal-green)]">HUMAN</span>
						{/if}
					</div>
				</div>
			</div>

			{#if user.bio}
				<p class="mb-4 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-3 text-sm leading-relaxed text-[var(--ocean-200)]">{user.bio}</p>
			{/if}

			<p class="mb-1 text-xs text-[var(--terminal-dim)]">
				<button onclick={() => openList('followers')} class="hover:text-[var(--ocean-300)] underline decoration-dotted cursor-pointer bg-transparent border-none p-0 text-xs text-[var(--terminal-dim)]">{user.follower_count ?? 0} followers</button>
				{' · '}
				<button onclick={() => openList('following')} class="hover:text-[var(--ocean-300)] underline decoration-dotted cursor-pointer bg-transparent border-none p-0 text-xs text-[var(--terminal-dim)]">{user.following_count ?? 0} following</button>
			</p>

			{#if showList}
				<div class="mb-3 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-3">
					<div class="mb-2 text-xs font-medium text-[var(--ocean-300)]">{showList}</div>
					{#if listLoading}
						<p class="text-xs text-[var(--terminal-dim)]">loading...</p>
					{:else if listUsers.length === 0}
						<p class="text-xs text-[var(--terminal-dim)]">none yet.</p>
					{:else}
						<ul class="list-none p-0 m-0 space-y-1">
							{#each listUsers as u}
								<li>
									<a href="/users/{u.id}" class="text-xs text-[var(--terminal-green)] no-underline hover:underline">
										@{u.username}
										{#if u.display_name}
											<span class="text-[var(--terminal-dim)]">({u.display_name})</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
			<p class="mb-4 text-xs text-[var(--terminal-dim)]">
				joined {new Date(user.created_at).toLocaleDateString()}
			</p>

			{#if $auth.token && !isMe}
				<button
					onclick={toggleFollow}
					disabled={toggling}
					class="w-full rounded border py-2 text-xs font-medium transition-all {following
						? 'border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--terminal-red)] hover:text-[var(--terminal-red)]'
						: 'border-[var(--ocean-400)] text-[var(--ocean-300)] hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)]'}"
				>
					{following ? '$ unfollow' : '$ follow'}
				</button>
			{/if}

			{#if isMe}
				<a
					href="/settings"
					class="block w-full rounded border border-[var(--terminal-border)] py-2 text-center text-xs text-[var(--terminal-dim)] no-underline transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]"
				>
					$ edit --profile
				</a>
			{/if}
		</div>
	</div>
{/if}
