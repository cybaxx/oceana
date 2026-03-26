import { c as store_get, d as attr, f as escape_html, h as ensure_array_like, b as stringify, a as attr_class, u as unsubscribe_stores } from "../../chunks/index2.js";
import { a as auth } from "../../chunks/auth.js";
import { M as Markdown } from "../../chunks/Markdown.js";
import "@privacyresearch/libsignal-protocol-typescript";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let searchQuery = "";
    let posts = [];
    let newPost = "";
    let uploading = false;
    let loadingMore = false;
    let signatureStatus = {};
    let signing = false;
    let editingPost = null;
    let editContent = "";
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
    const EMOJI_GRID = [
      "🔥",
      "🧠",
      "💀",
      "⚡",
      "🌊",
      "🫧",
      "❤️",
      "😂",
      "😮",
      "😢",
      "😡",
      "🎉",
      "👀",
      "🙏",
      "💯",
      "🤔",
      "🫡",
      "👏",
      "✨",
      "🤯",
      "🥶",
      "🫠",
      "🤝",
      "🎵"
    ];
    let pickerOpenFor = null;
    let expandedComments = {};
    let replies = {};
    let loadingReplies = {};
    let replyInputs = {};
    let submittingReply = {};
    function timeAgo(dateStr) {
      const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1e3);
      if (seconds < 60) return "now";
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
      return `${Math.floor(seconds / 86400)}d`;
    }
    function truncateKey(key) {
      return key.slice(0, 8) + "..." + key.slice(-4);
    }
    if (!store_get($$store_subs ??= {}, "$auth", auth).token) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-20 text-center"><pre class="mb-6 text-[var(--ocean-300)] text-sm leading-relaxed">
  ~~~~~~~~~~~~~~~
 ~~  oceana  ~~
  ~~~~~~~~~~~~~~~</pre> <p class="mb-1 text-sm text-[var(--ocean-100)]">a calm place to share thoughts</p> <p class="mb-8 text-xs text-[var(--terminal-dim)]">deep signals, not surface noise</p> <a href="/register" class="inline-block rounded border border-[var(--ocean-400)] px-6 py-2 text-sm text-[var(--ocean-300)] no-underline transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_12px_var(--ocean-400)]">$ init --new-user</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="relative mb-4"><input type="text"${attr("value", searchQuery)} placeholder="$ find --user" class="w-full rounded border border-[var(--terminal-border)] bg-[var(--ocean-900)] px-3 py-2 text-sm text-[var(--terminal-text)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"/> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="mb-6 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4"><div class="mb-2 flex items-center justify-between text-xs text-[var(--terminal-dim)]"><span><span class="text-[var(--terminal-green)]">@${escape_html(store_get($$store_subs ??= {}, "$auth", auth).user?.username)}</span> <span class="text-[var(--terminal-dim)]">~</span> compose</span> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <form><textarea placeholder="> what's on your mind?" rows="3" class="w-full resize-none rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] p-3 text-sm text-[var(--ocean-100)] focus:border-[var(--ocean-400)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]">`);
      const $$body = escape_html(newPost);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="mt-2 flex items-center justify-between"><div class="flex items-center gap-2"><input type="file" accept="image/*" class="hidden"/> <button type="button"${attr("disabled", uploading, true)} class="rounded border border-[var(--terminal-border)] px-2 py-1 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)] hover:text-[var(--ocean-300)] disabled:opacity-50">${escape_html("+ image")}</button> <span class="text-xs text-[var(--terminal-dim)]">${escape_html(newPost.length)}/10000</span></div> <button type="submit"${attr("disabled", !newPost.trim() && true || signing, true)} class="flex items-center gap-1.5 rounded border border-[var(--ocean-400)] bg-transparent px-4 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)] disabled:opacity-30 disabled:hover:shadow-none">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`transmit`);
      }
      $$renderer2.push(`<!--]--></button></div></form></div> `);
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
        const each_array_1 = ensure_array_like(posts);
        for (let $$index_4 = 0, $$length = each_array_1.length; $$index_4 < $$length; $$index_4++) {
          let post = each_array_1[$$index_4];
          const parsed = extractImage(post.content);
          const sigStatus = signatureStatus[post.id];
          $$renderer2.push(`<div class="post-card group rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-4 transition-all hover:border-[var(--ocean-400)]/40 hover:shadow-[0_0_12px_var(--terminal-glow)]"><div class="mb-2 flex items-center gap-2">`);
          if (post.author_avatar_url) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<img${attr("src", post.author_avatar_url)} alt="" class="h-7 w-7 rounded border border-[var(--terminal-border)] object-cover"/>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="flex h-7 w-7 items-center justify-center rounded border border-[var(--terminal-border)] bg-[var(--ocean-800)] text-xs font-bold text-[var(--ocean-300)]">${escape_html(post.author_username[0].toUpperCase())}</div>`);
          }
          $$renderer2.push(`<!--]--> <a${attr("href", `/users/${stringify(post.author_id)}`)} class="text-xs font-semibold text-[var(--terminal-green)] no-underline hover:underline">@${escape_html(post.author_username)}</a> `);
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
          $$renderer2.push(`<!--]--> <span class="ml-auto flex items-center gap-1.5 text-xs text-[var(--terminal-dim)]">`);
          if (post.updated_at) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="text-[10px] italic">(edited)</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> ${escape_html(timeAgo(post.created_at))} `);
          if (post.author_id === store_get($$store_subs ??= {}, "$auth", auth).user?.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<button class="text-[var(--terminal-dim)] hover:text-[var(--ocean-300)] transition-colors" title="Edit post"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"></path></svg></button>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></span></div> `);
          if (editingPost === post.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="mt-2"><textarea rows="3" class="w-full resize-none rounded border border-[var(--ocean-400)] bg-[var(--ocean-950)] p-3 text-sm text-[var(--ocean-100)] focus:outline-none focus:shadow-[0_0_8px_var(--terminal-glow)]">`);
            const $$body_1 = escape_html(editContent);
            if ($$body_1) {
              $$renderer2.push(`${$$body_1}`);
            }
            $$renderer2.push(`</textarea> <div class="mt-1 flex gap-2 justify-end"><button class="rounded border border-[var(--terminal-border)] px-3 py-1 text-xs text-[var(--terminal-dim)] hover:text-[var(--ocean-100)]">cancel</button> <button${attr("disabled", !editContent.trim(), true)} class="rounded border border-[var(--ocean-400)] px-3 py-1 text-xs text-[var(--ocean-300)] hover:bg-[var(--ocean-400)]/10 disabled:opacity-30">save</button></div></div>`);
          } else if (parsed.text) {
            $$renderer2.push("<!--[1-->");
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
          $$renderer2.push(`<!--]--> `);
          if (sigStatus === "verified") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-green)]"${attr("title", `Ed25519 signature verified against ${stringify(post.author_signing_key ? truncateKey(post.author_signing_key) : "unknown key")}`)}><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"></path></svg> <span>verified signature</span> `);
            if (post.author_signing_key) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="text-[var(--terminal-dim)]">· key ${escape_html(truncateKey(post.author_signing_key))}</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          } else if (sigStatus === "unverified") {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-red)]" title="Signature verification failed"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v3.75m0 3.75h.007v.008H12v-.008ZM21.721 12.752c0 5.592-3.824 10.29-9 11.623-5.176-1.332-9-6.03-9-11.622 0-1.31.21-2.571.598-3.751A11.959 11.959 0 0 1 12.721 2.715a11.959 11.959 0 0 1 8.25 3.285h.152c.388 1.18.598 2.442.598 3.752Z"></path></svg> <span>bad signature</span></div>`);
          } else if (sigStatus === "checking") {
            $$renderer2.push("<!--[2-->");
            $$renderer2.push(`<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-dim)]"><svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3m0 12v3m-7.8-4.2 2.1-2.1m11.4-5.4 2.1-2.1M3 12h3m12 0h3M6.3 6.3l2.1 2.1m5.4 11.4 2.1 2.1"></path></svg> <span>verifying signature...</span></div>`);
          } else if (!post.signature) {
            $$renderer2.push("<!--[3-->");
            $$renderer2.push(`<div class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--terminal-dim)]/50"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"></path></svg> <span>unsigned</span></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--terminal-border)]/50 pt-2"><button${attr_class(`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${stringify(post.user_reaction === "👍" ? "border-[var(--terminal-green)] bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]" : "border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--terminal-green)]/60")}`)}><span class="text-[10px]">▲</span>`);
          if ((post.reaction_counts.find((r) => r.emoji === "👍")?.count || 0) > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span>${escape_html(post.reaction_counts.find((r) => r.emoji === "👍")?.count)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></button> <button${attr_class(`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${stringify(post.user_reaction === "😬" ? "border-[var(--terminal-red)] bg-[var(--terminal-red)]/15 text-[var(--terminal-red)]" : "border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--terminal-red)]/60")}`)}><span class="text-[10px]">▼</span>`);
          if ((post.reaction_counts.find((r) => r.emoji === "😬")?.count || 0) > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span>${escape_html(post.reaction_counts.find((r) => r.emoji === "😬")?.count)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></button> <div class="relative"><button class="flex items-center gap-0.5 rounded-full border border-[var(--terminal-border)] px-2 py-0.5 text-xs text-[var(--terminal-dim)] transition-all hover:border-[var(--ocean-400)]/60 hover:text-[var(--ocean-300)]">😀<span class="text-[10px]">+</span></button> `);
          if (pickerOpenFor === post.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="absolute bottom-full left-0 z-10 mb-1 w-56 grid grid-cols-6 gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--ocean-900)] p-2 shadow-lg"><!--[-->`);
            const each_array_2 = ensure_array_like(EMOJI_GRID);
            for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
              let emoji = each_array_2[$$index_1];
              $$renderer2.push(`<button${attr_class(`flex h-8 w-8 items-center justify-center rounded text-base transition-all hover:bg-[var(--ocean-400)]/15 ${stringify(post.user_reaction === emoji ? "bg-[var(--ocean-400)]/20" : "")}`)}>${escape_html(emoji)}</button>`);
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <!--[-->`);
          const each_array_3 = ensure_array_like(post.reaction_counts.filter((r) => r.count > 0 && r.emoji !== "👍" && r.emoji !== "😬"));
          for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
            let reaction = each_array_3[$$index_2];
            $$renderer2.push(`<button${attr_class(`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${stringify(post.user_reaction === reaction.emoji ? "border-[var(--ocean-400)] bg-[var(--ocean-400)]/15 text-[var(--ocean-200)]" : "border-[var(--terminal-border)] text-[var(--terminal-dim)] hover:border-[var(--ocean-400)]/60")}`)}><span>${escape_html(reaction.emoji)}</span> <span>${escape_html(reaction.count)}</span></button>`);
          }
          $$renderer2.push(`<!--]--></div> <button class="mt-2 flex items-center gap-1.5 text-xs text-[var(--terminal-dim)] transition-all hover:text-[var(--ocean-300)]"><span class="text-[10px]">${escape_html(expandedComments[post.id] ? "▼" : "▶")}</span> <span>${escape_html(post.reply_count === 0 ? "comment" : `${post.reply_count} comment${post.reply_count === 1 ? "" : "s"}`)}</span></button> `);
          if (expandedComments[post.id]) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="mt-2 space-y-2 border-l-2 border-[var(--terminal-border)]/50 pl-3">`);
            if (loadingReplies[post.id]) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<p class="text-xs text-[var(--terminal-dim)]">loading comments...</p>`);
            } else if (replies[post.id]?.length) {
              $$renderer2.push("<!--[1-->");
              $$renderer2.push(`<!--[-->`);
              const each_array_4 = ensure_array_like(replies[post.id]);
              for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
                let reply = each_array_4[$$index_3];
                const replyParsed = extractImage(reply.content);
                $$renderer2.push(`<div class="rounded border border-[var(--terminal-border)]/40 bg-[var(--ocean-950)] p-2.5"><div class="mb-1 flex items-center gap-1.5"><a${attr("href", `/users/${stringify(reply.author_id)}`)} class="text-[10px] font-semibold text-[var(--terminal-green)] no-underline hover:underline">@${escape_html(reply.author_username)}</a> `);
                if (reply.author_is_bot) {
                  $$renderer2.push("<!--[0-->");
                  $$renderer2.push(`<span class="rounded border border-[var(--ocean-400)]/40 bg-[var(--ocean-400)]/10 px-1 py-0 text-[8px] font-medium text-[var(--ocean-300)]">BOT</span>`);
                } else {
                  $$renderer2.push("<!--[-1-->");
                }
                $$renderer2.push(`<!--]--> <span class="ml-auto text-[10px] text-[var(--terminal-dim)]">${escape_html(timeAgo(reply.created_at))}</span></div> <div class="text-xs leading-relaxed text-[var(--ocean-100)]">`);
                Markdown($$renderer2, { content: replyParsed.text });
                $$renderer2.push(`<!----></div> `);
                if (replyParsed.imageUrl) {
                  $$renderer2.push("<!--[0-->");
                  $$renderer2.push(`<img${attr("src", replyParsed.imageUrl)} alt="reply attachment" class="mt-1 max-w-full rounded border border-[var(--terminal-border)]"/>`);
                } else {
                  $$renderer2.push("<!--[-1-->");
                }
                $$renderer2.push(`<!--]--></div>`);
              }
              $$renderer2.push(`<!--]-->`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> <form class="flex gap-2"><input type="text" placeholder="write a comment..."${attr("value", replyInputs[post.id])} class="flex-1 rounded border border-[var(--terminal-border)] bg-[var(--ocean-950)] px-2.5 py-1.5 text-xs text-[var(--ocean-100)] placeholder:text-[var(--terminal-dim)] focus:border-[var(--ocean-400)] focus:outline-none"/> <button type="submit"${attr("disabled", !(replyInputs[post.id] || "").trim() || submittingReply[post.id], true)} class="rounded border border-[var(--ocean-400)] px-3 py-1.5 text-xs text-[var(--ocean-300)] transition-all hover:bg-[var(--ocean-400)]/10 disabled:opacity-30">${escape_html(submittingReply[post.id] ? "..." : "reply")}</button></form></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
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
