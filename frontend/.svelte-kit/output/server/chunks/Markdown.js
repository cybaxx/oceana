import { f as derived } from "./index2.js";
import { Marked } from "marked";
import hljs from "highlight.js";
import "dompurify";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function Markdown($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { content } = $$props;
    const marked = new Marked({
      renderer: {
        code({ text, lang }) {
          const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
          const highlighted = hljs.highlight(text, { language }).value;
          return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
        }
      },
      breaks: true,
      gfm: true
    });
    const html$1 = derived(() => {
      const raw = marked.parse(content);
      return raw;
    });
    $$renderer2.push(`<div class="markdown-content svelte-z28whr">${html(html$1())}</div>`);
  });
}
export {
  Markdown as M
};
