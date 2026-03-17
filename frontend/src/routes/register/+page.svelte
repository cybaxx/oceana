<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import { goto } from '$app/navigation';
	import type { AuthResponse } from '$lib/types';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function submit() {
		error = '';
		submitting = true;
		try {
			const res = (await api.register(username, email, password)) as AuthResponse;
			auth.login(res.user, res.token);
			goto('/');
		} catch (e: any) {
			error = e.message;
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mx-auto mt-16 max-w-sm">
	<div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6">
		<div class="mb-6">
			<div class="mb-1 text-xs text-[var(--terminal-dim)]">~/auth</div>
			<h1 class="text-lg font-bold text-[var(--ocean-300)]">register</h1>
		</div>

		{#if error}
			<p class="mb-4 rounded border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-xs text-[var(--terminal-red)]">err: {error}</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
			<div>
				<label for="username" class="mb-1 block text-xs text-[var(--terminal-dim)]">username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					required
					minlength="3"
					maxlength="32"
					class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
				/>
			</div>
			<div>
				<label for="email" class="mb-1 block text-xs text-[var(--terminal-dim)]">email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-xs text-[var(--terminal-dim)]">password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength="8"
					class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"
				/>
			</div>
			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded border border-[var(--ocean-400)] bg-transparent py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-40"
			>
				{submitting ? 'creating identity...' : '$ init --new-user'}
			</button>
		</form>

		<p class="mt-4 text-center text-xs text-[var(--terminal-dim)]">
			already have an account? <a href="/login">login</a>
		</p>
	</div>
</div>
