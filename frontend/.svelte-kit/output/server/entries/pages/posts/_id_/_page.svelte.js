import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/auth.js";
import "marked";
/* empty css                                                        */
import "isomorphic-dompurify";
import "@privacyresearch/libsignal-protocol-typescript";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<p class="text-center text-xs text-[var(--terminal-dim)] mt-8">loading...</p>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
