import { d as attr, f as escape_html } from "../../../chunks/index2.js";
import "../../../chunks/auth.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let username = "";
    let email = "";
    let password = "";
    let submitting = false;
    $$renderer2.push(`<div class="mx-auto mt-16 max-w-sm"><div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6"><div class="mb-6"><div class="mb-1 text-xs text-[var(--terminal-dim)]">~/auth</div> <h1 class="text-lg font-bold text-[var(--ocean-300)]">register</h1></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <form class="space-y-4"><div><label for="username" class="mb-1 block text-xs text-[var(--terminal-dim)]">username</label> <input id="username" type="text"${attr("value", username)} required="" minlength="3" maxlength="32" class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"/></div> <div><label for="email" class="mb-1 block text-xs text-[var(--terminal-dim)]">email</label> <input id="email" type="email"${attr("value", email)} required="" class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"/></div> <div><label for="password" class="mb-1 block text-xs text-[var(--terminal-dim)]">password</label> <input id="password" type="password"${attr("value", password)} required="" minlength="8" class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"/></div> <button type="submit"${attr("disabled", submitting, true)} class="w-full rounded border border-[var(--ocean-400)] bg-transparent py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-40">${escape_html("$ init --new-user")}</button></form> <p class="mt-4 text-center text-xs text-[var(--terminal-dim)]">already have an account? <a href="/login">login</a></p></div></div>`);
  });
}
export {
  _page as default
};
