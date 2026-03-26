import { s as ssr_context, a as attr_class, b as stringify, c as store_get, d as attr, u as unsubscribe_stores, e as derived } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
import { a as auth } from "../../chunks/auth.js";
import { w as writable } from "../../chunks/index.js";
import "@privacyresearch/libsignal-protocol-typescript";
import "clsx";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function createBloomStore() {
  const initial = false;
  const { subscribe, set, update } = writable(initial);
  return {
    subscribe,
    toggle() {
      update((v) => {
        const next = !v;
        return next;
      });
    },
    set(value) {
      set(value);
    }
  };
}
const bloomMode = createBloomStore();
function BloomBackground($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    onDestroy(() => {
    });
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function BloomToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    let isBloomRoute = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname === "/" || store_get($$store_subs ??= {}, "$page", page).url.pathname === "/login");
    if (isBloomRoute()) {
      $$renderer2.push("<!--[0-->");
      BloomBackground($$renderer2);
      $$renderer2.push(`<!----> `);
      BloomToggle($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class(`min-h-screen ${stringify(isBloomRoute() && store_get($$store_subs ??= {}, "$bloomMode", bloomMode) ? "bloom-active bg-transparent" : "bg-[var(--ocean-950)]")}`)}><header${attr_class(`sticky top-0 z-10 border-b border-[var(--terminal-border)] ${stringify(isBloomRoute() && store_get($$store_subs ??= {}, "$bloomMode", bloomMode) ? "bg-[var(--ocean-900)]/70" : "bg-[var(--ocean-900)]/90")} backdrop-blur`)}><nav class="mx-auto flex max-w-2xl items-center justify-between px-4 py-3"><a href="/" class="group flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--ocean-300)] no-underline"><span class="text-[var(--terminal-dim)]">~/</span>oceana <span class="animate-pulse text-[var(--ocean-300)]">_</span></a> <div class="flex items-center gap-4 text-xs">`);
    if (store_get($$store_subs ??= {}, "$auth", auth).user) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)] hover:drop-shadow-[0_0_4px_var(--ocean-300)]">feed</a> <a href="/chat" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">chat</a> <a${attr("href", `/users/${stringify(store_get($$store_subs ??= {}, "$auth", auth).user.id)}`)} class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">profile</a> <a href="/settings" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">config</a> <a href="/about" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">about</a> <button class="rounded border border-[var(--terminal-border)] bg-transparent px-3 py-1 text-[var(--terminal-red)] transition-colors hover:border-[var(--terminal-red)] hover:bg-[var(--terminal-red)]/10">exit</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<a href="/about" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">about</a> <a href="/login" class="text-[var(--terminal-dim)] no-underline transition-colors hover:text-[var(--ocean-300)]">login</a> <a href="/register" class="rounded border border-[var(--ocean-400)] px-3 py-1 text-[var(--ocean-300)] no-underline transition-all hover:bg-[var(--ocean-400)]/10 hover:shadow-[0_0_8px_var(--ocean-400)]">register</a>`);
    }
    $$renderer2.push(`<!--]--></div></nav></header> <main class="mx-auto max-w-2xl px-4 py-6">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
