import { s as store_get, e as escape_html, a as attr, c as ensure_array_like, b as stringify, u as unsubscribe_stores } from "../../chunks/index2.js";
import { a as auth } from "../../chunks/auth.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let posts = [];
    let newPost = "";
    let loadingMore = false;
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
      $$renderer2.push(`</textarea> <div class="mt-2 flex items-center justify-between"><span class="text-xs text-[var(--terminal-dim)]">${escape_html(newPost.length)}/10000</span> <button type="submit"${attr("disabled", !newPost.trim(), true)} class="rounded border border-[var(--ocean-400)] bg-transparent px-4 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-30 disabled:hover:shadow-none">transmit</button></div></form></div> `);
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
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let post = each_array[$$index];
          $$renderer2.push(`<div class="group rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4 transition-all hover:border-[var(--ocean-400)]/40 hover:shadow-[0_0_12px_var(--terminal-glow)]"><div class="mb-2 flex items-center gap-2"><div class="flex h-7 w-7 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-xs font-bold text-[var(--ocean-300)]">${escape_html(post.author_username[0].toUpperCase())}</div> <a${attr("href", `/users/${stringify(post.author_id)}`)} class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">@${escape_html(post.author_username)}</a> `);
          if (post.author_display_name) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="text-xs text-[var(--terminal-dim)]">${escape_html(post.author_display_name)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <span class="ml-auto text-xs text-[var(--terminal-dim)]">${escape_html(timeAgo(post.created_at))}</span></div> <p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ocean-100)]">${escape_html(post.content)}</p></div>`);
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
