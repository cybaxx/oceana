import { c as store_get, d as attr, f as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { a as auth } from "../../../chunks/auth.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let displayName = store_get($$store_subs ??= {}, "$auth", auth).user?.display_name ?? "";
    let bio = store_get($$store_subs ??= {}, "$auth", auth).user?.bio ?? "";
    let avatarUrl = store_get($$store_subs ??= {}, "$auth", auth).user?.avatar_url ?? "";
    let submitting = false;
    let uploading = false;
    if (!store_get($$store_subs ??= {}, "$auth", auth).token) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-center text-xs text-[var(--terminal-dim)]">please <a href="/login">login</a> first.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="mx-auto mt-8 max-w-sm"><div class="rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-6"><div class="mb-6"><div class="mb-1 text-xs text-[var(--terminal-dim)]">~/config</div> <h1 class="text-lg font-bold text-[var(--ocean-300)]">edit profile</h1></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <form class="space-y-4"><div><label for="avatar" class="mb-1 block text-xs text-[var(--terminal-dim)]">avatar</label> <div class="flex items-center gap-3">`);
      if (avatarUrl) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<img${attr("src", avatarUrl)} alt="avatar" class="h-12 w-12 rounded border border-[var(--terminal-border)] object-cover"/>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="flex h-12 w-12 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-lg font-bold text-[var(--ocean-300)]">${escape_html((store_get($$store_subs ??= {}, "$auth", auth).user?.username ?? "?")[0].toUpperCase())}</div>`);
      }
      $$renderer2.push(`<!--]--> <label class="cursor-pointer rounded border border-[var(--terminal-border)] px-3 py-1.5 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]">${escape_html("$ upload")} <input id="avatar" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden"${attr("disabled", uploading, true)}/></label></div></div> <div><label for="displayName" class="mb-1 block text-xs text-[var(--terminal-dim)]">display_name</label> <input id="displayName" type="text"${attr("value", displayName)} class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]"/></div> <div><label for="bio" class="mb-1 block text-xs text-[var(--terminal-dim)]">bio</label> <textarea id="bio" rows="3" class="w-full resize-none rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-3 py-2 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]">`);
      const $$body = escape_html(bio);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></div> <button type="submit"${attr("disabled", submitting, true)} class="w-full rounded border border-[var(--ocean-400)] bg-transparent py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-40">${escape_html("$ commit --save")}</button></form></div></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
