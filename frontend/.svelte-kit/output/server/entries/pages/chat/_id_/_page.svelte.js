import { g as getContext, e as escape_html, c as ensure_array_like, s as store_get, d as attr_class, a as attr, u as unsubscribe_stores, f as derived, b as stringify } from "../../../../chunks/index2.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { a as auth } from "../../../../chunks/auth.js";
import { a as activeMessages } from "../../../../chunks/chat.js";
import { M as Markdown } from "../../../../chunks/Markdown.js";
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let input = "";
    let uploading = false;
    const conversationId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.id);
    function formatTime(dateStr) {
      return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    $$renderer2.push(`<div class="flex h-[calc(100vh-80px)] flex-col"><div class="flex items-center gap-3 border-b border-[var(--terminal-border)] pb-3"><a href="/chat" class="text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">←</a> <h1 class="text-sm font-bold text-[var(--ocean-300)]"><span class="text-[var(--terminal-dim)]">chat/</span>${escape_html(conversationId().slice(0, 8))}</h1></div> <div class="flex-1 overflow-y-auto py-4 space-y-2">`);
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$activeMessages", activeMessages));
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let msg = each_array[$$index];
        const isMe = msg.sender_id === store_get($$store_subs ??= {}, "$auth", auth).user?.id;
        $$renderer2.push(`<div${attr_class(`flex ${stringify(isMe ? "justify-end" : "justify-start")}`)}><div${attr_class(`max-w-[75%] rounded-lg px-3 py-2 text-sm ${stringify(isMe ? "bg-[var(--ocean-600)] text-white" : "border border-[var(--terminal-border)] bg-[var(--ocean-900)] text-[var(--terminal-text)]")}`)}>`);
        if (!isMe) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="mb-1 flex items-center gap-1"><span class="text-[10px] text-[var(--terminal-dim)]">${escape_html(msg.sender_username ?? "")}</span> `);
          if (msg.sender_is_bot) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1 py-0 text-[9px] font-medium text-[var(--ocean-300)]">BOT</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-1 py-0 text-[9px] font-medium text-[var(--terminal-green)]">HUMAN</span>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (msg.image_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<img${attr("src", msg.image_url)} alt="attachment" class="max-w-full rounded"/>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (msg.plaintext) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="break-words">`);
          Markdown($$renderer2, { content: msg.plaintext });
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <span class="mt-1 block text-right text-[10px] opacity-60">${escape_html(formatTime(msg.created_at))}</span></div></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="py-8 text-center text-sm text-[var(--terminal-dim)]">no messages yet — say something</p>`);
    }
    $$renderer2.push(`<!--]--></div> <form class="flex gap-2 border-t border-[var(--terminal-border)] pt-3"><input type="file" accept="image/*" class="hidden"/> <button type="button"${attr("disabled", uploading, true)} class="rounded border border-[var(--terminal-border)] px-3 py-2 text-sm text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50">${escape_html("📎")}</button> <input${attr("value", input)} placeholder="type a message..." class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"/> <button type="submit" class="rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10">send</button></form></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
