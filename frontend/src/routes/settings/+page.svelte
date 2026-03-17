<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import type { User } from '$lib/types';

	let displayName = $state($auth.user?.display_name ?? '');
	let bio = $state($auth.user?.bio ?? '');
	let error = $state('');
	let success = $state(false);
	let submitting = $state(false);

	async function submit() {
		error = '';
		success = false;
		submitting = true;
		try {
			const user = (await api.updateProfile({
				display_name: displayName || undefined,
				bio: bio || undefined
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
