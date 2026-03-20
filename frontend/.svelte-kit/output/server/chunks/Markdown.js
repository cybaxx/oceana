import { f as derived } from "./index2.js";
import { Marked } from "marked";
import hljs from "highlight.js";
import DOMPurify from "isomorphic-dompurify";
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
    function extractEmbeds(text) {
      const embeds = [];
      const lines = text.split("\n");
      const cleaned = lines.map((line) => {
        const trimmed = line.trim();
        let embed = null;
        let match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})(?:[&?].*)?$/);
        if (match) {
          embed = {
            type: "youtube",
            html: `<div class="embed-container embed-video"><iframe src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
          };
        }
        if (!embed && /^https?:\/\/soundcloud\.com\/[\w-]+\/[\w-]+/.test(trimmed)) {
          embed = {
            type: "soundcloud",
            html: `<div class="embed-container embed-audio"><iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23176B87&auto_play=false" frameborder="0" allow="autoplay" loading="lazy"></iframe></div>`
          };
        }
        if (!embed) {
          match = trimmed.match(/^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([\w]+)(?:\?.*)?$/);
          if (match) {
            embed = {
              type: "spotify",
              html: `<div class="embed-container embed-audio"><iframe src="https://open.spotify.com/embed/${match[1]}/${match[2]}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
            };
          }
        }
        if (embed) {
          const idx = embeds.length;
          embeds.push(embed);
          return `<div data-embed="${idx}"></div>`;
        }
        return line;
      }).join("\n");
      return { cleaned, embeds };
    }
    const html$1 = derived(() => {
      const { cleaned, embeds } = extractEmbeds(content);
      const raw = marked.parse(cleaned);
      const withEmbeds = raw.replace(/<div data-embed="(\d+)"><\/div>/g, (_, idx) => {
        const embed = embeds[parseInt(idx)];
        return embed ? embed.html : "";
      });
      return DOMPurify.sanitize(withEmbeds, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "src"]
      });
    });
    $$renderer2.push(`<div class="markdown-content svelte-z28whr">${html(html$1())}</div>`);
  });
}
export {
  Markdown as M
};
