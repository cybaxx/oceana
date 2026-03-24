<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { User } from '$lib/types';

	let displayName = $state($auth.user?.display_name ?? '');
	let bio = $state($auth.user?.bio ?? '');
	let avatarUrl = $state($auth.user?.avatar_url ?? '');
	let error = $state('');
	let success = $state(false);
	let submitting = $state(false);
	let uploading = $state(false);

	async function handleAvatarUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		error = '';
		try {
			const { url } = await api.uploadImage(file);
			avatarUrl = url;
		} catch (err: any) {
			error = err.message;
		} finally {
			uploading = false;
		}
	}

	async function submit() {
		error = '';
		success = false;
		submitting = true;
		try {
			const user = (await api.updateProfile({
				display_name: displayName || undefined,
				bio: bio || undefined,
				avatar_url: avatarUrl || undefined
			})) as User;
			auth.updateUser(user);
			success = true;
		} catch (e: any) {
			error = e.message;
		} finally {
			submitting = false;
		}
	}
</script>

{#if !$auth.token}
	<p class="text-center text-xs text-[var(--terminal-dim)]">please <a href="/login">login</a> first.</p>
{:else}
	<div class="mx-auto mt-8 max-w-sm">
		<div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6">
			<div class="mb-6">
				<div class="mb-1 text-xs text-[var(--terminal-dim)]">~/config</div>
				<h1 class="text-lg font-bold text-[var(--ocean-300)]">edit profile</h1>
			</div>

			{#if error}
				<p class="mb-4 rounded border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-xs text-[var(--terminal-red)]">err: {error}</p>
			{/if}
			{#if success}
				<p class="mb-4 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green)]/5 p-3 text-xs text-[var(--terminal-green)]">profile updated.</p>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
				<div>
					<label for="avatar" class="mb-1 block text-xs text-[var(--terminal-dim)]">avatar</label>
					<div class="flex items-center gap-3">
						{#if avatarUrl}
							<img src={avatarUrl} alt="avatar" class="h-12 w-12 rounded border border-[var(--terminal-border)] object-cover" />
						{:else}
							<div class="flex h-12 w-12 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-lg font-bold text-[var(--ocean-300)]">
								{($auth.user?.username ?? '?')[0].toUpperCase()}
							</div>
						{/if}
						<label class="cursor-pointer rounded border border-[var(--terminal-border)] px-3 py-1.5 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]">
							{uploading ? 'uploading...' : '$ upload'}
							<input id="avatar" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onchange={handleAvatarUpload} class="hidden" disabled={uploading} />
						</label>
					</div>
				</div>
				<div>
					<label for="displayName" class="mb-1 block text-xs text-[var(--terminal-dim)]">display_name</label>
					<input
						id="displayName"
						type="text"
						bind:value={displayName}
						class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
					/>
				</div>
				<div>
					<label for="bio" class="mb-1 block text-xs text-[var(--terminal-dim)]">bio</label>
					<textarea
						id="bio"
						bind:value={bio}
						rows="3"
						class="w-full resize-none rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
					></textarea>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="w-full rounded border border-[var(--ocean-400)] bg-transparent py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-40"
				>
					{submitting ? 'writing...' : '$ commit --save'}
				</button>
			</form>
		</div>
	</div>
{/if}
