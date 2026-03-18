import { a as attr, c as ensure_array_like, s as store_get, b as stringify, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import "../../../chunks/auth.js";
import { c as conversations } from "../../../chunks/chat.js";
import "@privacyresearch/libsignal-protocol-typescript";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let newUserId = "";
    let creating = false;
    function formatTime(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const now = /* @__PURE__ */ new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString();
    }
    $$renderer2.push(`<div class="space-y-4"><div class="flex items-center justify-between"><h1 class="text-lg font-bold text-[var(--ocean-300)]"><span class="text-[var(--terminal-dim)]">$</span> messages</h1> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <form class="flex gap-2"><input${attr("value", newUserId)} placeholder="user ID to chat with..." class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"/> <button type="submit"${attr("disabled", creating, true)} class="rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-50">new chat</button></form> <div class="space-y-1">`);
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$conversations", conversations));
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let conv = each_array[$$index];
        $$renderer2.push(`<a${attr("href", `/chat/${stringify(conv.id)}`)} class="block rounded border border-[var(--terminal-border)] p-3 no-underline transition-colors hover:border-[var(--ocean-400)] hover:bg-[var(--ocean-900)]/50"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="font-mono text-xs text-[var(--terminal-dim)]">${escape_html(conv.id.slice(0, 8))}...</span> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <span class="text-xs text-[var(--terminal-dim)]">${escape_html(formatTime(conv.last_message_at || conv.created_at))}</span></div> `);
        if (conv.last_message_text) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="mt-1 truncate text-sm text-[var(--terminal-text)]">${escape_html(conv.last_message_text)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="mt-1 text-sm italic text-[var(--terminal-dim)]">no messages yet</p>`);
        }
        $$renderer2.push(`<!--]--></a>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="py-8 text-center text-sm text-[var(--terminal-dim)]">no conversations yet — start one above</p>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
