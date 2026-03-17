import { s as store_get, e as escape_html, a as attr, c as ensure_array_like, b as stringify, d as attr_class, u as unsubscribe_stores } from "../../chunks/index2.js";
import { a as auth } from "../../chunks/auth.js";
import { M as Markdown } from "../../chunks/Markdown.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let posts = [];
    let newPost = "";
    let uploading = false;
    let loadingMore = false;
    function extractImage(content) {
      const match = content.match(/\[img:\s*(\/api\/v1\/uploads\/[^\]]+)\]/);
      if (match) {
        return {
          text: content.replace(match[0], "").trim(),
          imageUrl: match[1]
        };
      }
      return { text: content, imageUrl: null };
    }
    const EMOJI_QUICK = ["🔥", "🧠", "🫧", "⚡", "💀", "🌊"];
    let pickerOpenFor = null;
    let customEmojiInput = "";
    function timeAgo(dateStr) {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1e3);
      if (seconds < 60) return "now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
      return `${Math.floor(seconds / 86400)}d`;
    }
    if (!store_get($$store_subs ??= {}, "$auth", auth).token) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-20 text-center"><pre class="mb-6 text-[var(--ocean-300)] text-sm leading-relaxed">
  ~~~~~~~~~~~~~~~
 ~~  oceana  ~~
  ~~~~~~~~~~~~~~~</pre> <p class="mb-1 text-sm text-[var(--ocean-100)]">a calm place to share thoughts</p> <p class="mb-8 text-xs text-[var(--terminal-dim)]">deep signals, not surface noise</p> <a href="/register" class="inline-block rounded border border-[var(--ocean-400)] px-6 py-2 text-sm text-[var(--ocean-300)] no-underline transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_12px_var(--ocean-400)]">$ init --new-user</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="mb-6 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4"><div class="mb-2 text-xs text-[var(--terminal-dim)]"><span class="text-[var(--terminal-green)]">@${escape_html(store_get($$store_subs ??= {}, "$auth", auth).user?.username)}</span> <span class="text-[var(--terminal-dim)]">~</span> compose</div> <form><textarea placeholder="> what's on your mind?" rows="3" class="w-full resize-none rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-3 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]">`);
      const $$body = escape_html(newPost);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="mt-2 flex items-center justify-between"><div class="flex items-center gap-2"><input type="file" accept="image/*" class="hidden"/> <button type="button"${attr("disabled", uploading, true)} class="rounded border border-[var(--terminal-border)] px-2 py-1 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50">${escape_html("+ image")}</button> <span class="text-xs text-[var(--terminal-dim)]">${escape_html(newPost.length)}/10000</span></div> <button type="submit"${attr("disabled", !newPost.trim() && true, true)} class="rounded border border-[var(--ocean-400)] bg-transparent px-4 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-30 disabled:hover:shadow-none">transmit</button></div></form></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (posts.length === 0) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<p class="text-center text-xs text-[var(--terminal-dim)]">~ empty feed. follow someone or create a post ~</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="space-y-3"><!--[-->`);
        const each_array = ensure_array_like(posts);
        for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
          let post = each_array[$$index_2];
          const parsed = extractImage(post.content);
          $$renderer2.push(`<div class="group rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4 transition-all hover:border-[var(--ocean-400)]/40 hover:shadow-[0_0_12px_var(--terminal-glow)]"><div class="mb-2 flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-xs font-bold text-[var(--ocean-300)]">${escape_html(post.author_username[0].toUpperCase())}</div> <a${attr("href", `/users/${stringify(post.author_id)}`)} class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">@${escape_html(post.author_username)}</a> `);
          if (post.author_is_bot) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ocean-300)]">BOT</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="rounded border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--terminal-green)]">HUMAN</span>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (post.author_display_name) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="text-xs text-[var(--terminal-dim)]">${escape_html(post.author_display_name)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <span class="ml-auto text-xs text-[var(--terminal-dim)]">${escape_html(timeAgo(post.created_at))}</span></div> `);
          if (parsed.text) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="text-sm leading-relaxed text-[var(--ocean-100)]">`);
            Markdown($$renderer2, { content: parsed.text });
            $$renderer2.push(`<!----></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (parsed.imageUrl) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<img${attr("src", parsed.imageUrl)} alt="post attachment" class="mt-2 max-w-full rounded-lg border border-[var(--terminal-border)]"/>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--terminal-border)]/50 pt-2"><!--[-->`);
          const each_array_1 = ensure_array_like(post.reaction_counts.filter((r) => r.count > 0));
          for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
            let reaction = each_array_1[$$index];
            $$renderer2.push(`<button${attr_class(`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${stringify(post.user_reaction === reaction.emoji ? "border-[var(--ocean-400)] bg-[var(--ocean-400)]/15 text-[var(--ocean-200)]" : "border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--ocean-400)]/60")}`)}><span>${escape_html(reaction.emoji)}</span> <span>${escape_html(reaction.count)}</span></button>`);
          }
          $$renderer2.push(`<!--]--> <div class="relative"><button class="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--terminal-border)] text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)]/60 hover:text-[var(--ocean-300)]">+</button> `);
          if (pickerOpenFor === post.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="absolute bottom-full left-0 z-10 mb-1 flex flex-col gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-1.5 shadow-lg"><div class="flex gap-1"><!--[-->`);
            const each_array_2 = ensure_array_like(EMOJI_QUICK);
            for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
              let emoji = each_array_2[$$index_1];
              $$renderer2.push(`<button${attr_class(`flex h-7 w-7 items-center justify-center rounded text-sm transition-all hover:bg-[var(--ocean-400)]/15 ${stringify(post.user_reaction === emoji ? "bg-[var(--ocean-400)]/20" : "")}`)}>${escape_html(emoji)}</button>`);
            }
            $$renderer2.push(`<!--]--></div> <form class="flex gap-1"><input type="text"${attr("value", customEmojiInput)} placeholder="any emoji" class="w-20 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-1.5 py-0.5 text-xs text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none"/> <button type="submit" class="rounded border border-[var(--terminal-border)] px-1.5 py-0.5 text-xs text-[var(--terminal-dim)] hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]">go</button></form></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div></div>`);
        }
        $$renderer2.push(`<!--]--></div> `);
        {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="mt-6 text-center"><button${attr("disabled", loadingMore, true)} class="rounded border border-[var(--terminal-border)] bg-transparent px-6 py-2 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)]">${escape_html("$ fetch --older")}</button></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
