import { g as getContext, e as escape_html, s as store_get, c as ensure_array_like, d as attr_class, a as attr, b as stringify, u as unsubscribe_stores, f as derived } from "../../../../chunks/index2.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { a as auth } from "../../../../chunks/auth.js";
import { v as verificationReceived, k as keyChangeAlerts, a as activeMessages, t as typingUsers } from "../../../../chunks/chat.js";
import "@privacyresearch/libsignal-protocol-typescript";
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
    let memberIds = [];
    let encrypting = false;
    let memberUsernames = {};
    const conversationId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.id);
    const currentTypingUsers = derived(() => Array.from(store_get($$store_subs ??= {}, "$typingUsers", typingUsers).entries()).filter(([key]) => key.startsWith(conversationId() + ":")).map(([, username]) => username));
    function formatTime(dateStr) {
      return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    function isEncrypted(msg) {
      return !!msg.ciphertext || !!msg.message_type;
    }
    $$renderer2.push(`<div class="flex h-[calc(100vh-80px)] flex-col"><div class="flex items-center justify-between border-b border-[var(--terminal-border)] pb-3"><div class="flex items-center gap-3"><a href="/chat" class="text-[var(--terminal-dim)] no-underline hover:text-[var(--ocean-300)]">←</a> <h1 class="text-sm font-bold text-[var(--ocean-300)]"><span class="text-[var(--terminal-dim)]">chat/</span>${escape_html(conversationId().slice(0, 8))}</h1></div> <div class="flex items-center gap-2">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex items-center gap-1.5 rounded-full border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 px-2.5 py-1 text-[10px] text-[var(--terminal-red)]"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"></path></svg> plaintext (no encryption)</div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (store_get($$store_subs ??= {}, "$verificationReceived", verificationReceived) && memberIds.includes(store_get($$store_subs ??= {}, "$verificationReceived", verificationReceived).userId)) {
      $$renderer2.push("<!--[0-->");
      const vr = store_get($$store_subs ??= {}, "$verificationReceived", verificationReceived);
      $$renderer2.push(`<div class="flex items-center justify-between rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/5 px-3 py-2 text-xs text-[var(--terminal-green)]"><span><svg class="mr-1 inline h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"></path></svg> ${escape_html(vr.username)} has verified your identity</span> <div class="flex gap-2"><button class="underline">Verify back</button> <button class="opacity-60 hover:opacity-100">×</button></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like([
      ...store_get($$store_subs ??= {}, "$keyChangeAlerts", keyChangeAlerts)
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let alertUserId = each_array[$$index];
      $$renderer2.push(`<div class="flex items-center justify-between rounded border border-[var(--terminal-yellow)]/40 bg-[var(--terminal-yellow)]/5 px-3 py-2 text-xs text-[var(--terminal-yellow)]"><span>Security alert: identity key changed for ${escape_html(memberUsernames[alertUserId] || alertUserId.slice(0, 8))}. Verify their safety number.</span> <div class="flex gap-2"><button class="underline">Verify</button> <button class="opacity-60 hover:opacity-100">×</button></div></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="flex-1 overflow-y-auto py-4 space-y-2">`);
    const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$activeMessages", activeMessages));
    if (each_array_1.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let msg = each_array_1[$$index_1];
        const isMe = msg.sender_id === store_get($$store_subs ??= {}, "$auth", auth).user?.id;
        const encrypted = isEncrypted(msg);
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
        $$renderer2.push(`<!--]--> <div class="mt-1 flex items-center justify-end gap-1.5">`);
        if (encrypted) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<svg${attr_class(`h-2.5 w-2.5 ${stringify(isMe ? "text-white/40" : "text-[var(--terminal-green)]/60")}`)} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"${attr("title", `Decrypted from Signal Protocol ciphertext (type ${stringify(msg.message_type === 3 ? "PreKey" : "Whisper")})`)}><path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"></path></svg>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <span${attr_class(`text-[10px] ${stringify(isMe ? "text-white/40" : "opacity-60")}`)}>${escape_html(formatTime(msg.created_at))}</span></div></div></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="flex flex-col items-center justify-center py-12 text-center">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="py-8 text-sm text-[var(--terminal-dim)]">no messages yet — say something</p>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (currentTypingUsers().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="px-1 pb-1 text-xs text-[var(--terminal-dim)]">${escape_html(currentTypingUsers().join(", "))} ${escape_html(currentTypingUsers().length === 1 ? "is" : "are")} typing<span class="inline-block animate-pulse">...</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="border-t border-[var(--terminal-border)] pt-3">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <form class="flex gap-2"><input type="file" accept="image/*" class="hidden"/> <button type="button"${attr("disabled", uploading, true)} class="rounded border border-[var(--terminal-border)] px-3 py-2 text-sm text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50">${escape_html("📎")}</button> <div class="relative flex-1"><input${attr("value", input)}${attr("placeholder", "type a message...")}${attr("disabled", encrypting, true)} class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 pr-8 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none disabled:opacity-50"/> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <button type="submit"${attr("disabled", encrypting, true)} class="flex items-center gap-1.5 rounded border border-[var(--ocean-400)] px-4 py-2 text-sm text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-50">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`send`);
    }
    $$renderer2.push(`<!--]--></button></form></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
