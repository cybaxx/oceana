<script lang="ts">
	import { Marked } from 'marked';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/github-dark-dimmed.css';
	import DOMPurify from 'isomorphic-dompurify';

	let { content }: { content: string } = $props();

	const marked = new Marked({
		renderer: {
			code({ text, lang }: { text: string; lang?: string }) {
				const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
				const highlighted = hljs.highlight(text, { language }).value;
				return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
			}
		},
		breaks: true,
		gfm: true
	});

	interface Embed {
		type: 'youtube' | 'soundcloud' | 'spotify';
		html: string;
	}

	function extractEmbeds(text: string): { cleaned: string; embeds: Embed[] } {
		const embeds: Embed[] = [];
		const lines = text.split('\n');
		const cleaned = lines
			.map((line) => {
				const trimmed = line.trim();
				let embed: Embed | null = null;

				// YouTube
				let match = trimmed.match(
					/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})(?:[&?].*)?$/
				);
				if (match) {
					embed = {
						type: 'youtube',
						html: `<div class="embed-container embed-video"><iframe src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
					};
				}

				// SoundCloud
				if (!embed && /^https?:\/\/soundcloud\.com\/[\w-]+\/[\w-]+/.test(trimmed)) {
					embed = {
						type: 'soundcloud',
						html: `<div class="embed-container embed-audio"><iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23176B87&auto_play=false" frameborder="0" allow="autoplay" loading="lazy"></iframe></div>`
					};
				}

				// Spotify
				if (!embed) {
					match = trimmed.match(
						/^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([\w]+)(?:\?.*)?$/
					);
					if (match) {
						embed = {
							type: 'spotify',
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
			})
			.join('\n');

		return { cleaned, embeds };
	}

	const html = $derived.by(() => {
		const { cleaned, embeds } = extractEmbeds(content);
		const raw = marked.parse(cleaned) as string;
		// Replace embed placeholders before sanitizing so final output is always sanitized
		const withEmbeds = raw.replace(/<div data-embed="(\d+)"><\/div>/g, (_, idx) => {
			const embed = embeds[parseInt(idx)];
			return embed ? embed.html : '';
		});
		return DOMPurify.sanitize(withEmbeds, {
			ADD_TAGS: ['iframe'],
			ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'src'],
			ALLOWED_URI_REGEXP: /^(?:(?:https?:\/\/(?:www\.youtube\.com|youtube\.com|w\.soundcloud\.com|open\.spotify\.com)\/)|(?:(?!javascript:)(?:[a-z][a-z0-9+\-.]*:))|(?:#|\/|\.\/))/i
		});
	});
</script>

<div class="markdown-content">
	{@html html}
</div>

<style>
	.markdown-content {
		line-height: 1.6;
		word-break: break-word;
	}
	.markdown-content :global(h1),
	.markdown-content :global(h2),
	.markdown-content :global(h3),
	.markdown-content :global(h4) {
		color: var(--ocean-200);
		margin: 0.5em 0 0.25em;
		font-weight: 600;
	}
	.markdown-content :global(h1) { font-size: 1.25em; }
	.markdown-content :global(h2) { font-size: 1.1em; }
	.markdown-content :global(h3) { font-size: 1em; }
	.markdown-content :global(p) {
		margin: 0.25em 0;
	}
	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0.25em 0;
		padding-left: 1.5em;
	}
	.markdown-content :global(li) {
		margin: 0.1em 0;
	}
	.markdown-content :global(li)::marker {
		color: var(--ocean-400);
	}
	.markdown-content :global(code) {
		background: var(--ocean-950);
		border: 1px solid var(--terminal-border);
		border-radius: 3px;
		padding: 0.1em 0.35em;
		font-size: 0.85em;
	}
	.markdown-content :global(pre) {
		background: var(--ocean-950);
		border: 1px solid var(--terminal-border);
		border-radius: 6px;
		padding: 0.75em;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.markdown-content :global(pre code) {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.85em;
	}
	.markdown-content :global(blockquote) {
		border-left: 3px solid var(--ocean-400);
		margin: 0.5em 0;
		padding: 0.25em 0.75em;
		color: var(--terminal-dim);
	}
	.markdown-content :global(a) {
		color: var(--ocean-300);
		text-decoration: underline;
	}
	.markdown-content :global(a:hover) {
		color: var(--ocean-200);
	}
	.markdown-content :global(img) {
		max-width: 100%;
		border-radius: 6px;
	}
	.markdown-content :global(hr) {
		border: none;
		border-top: 1px solid var(--terminal-border);
		margin: 0.5em 0;
	}
	.markdown-content :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.5em 0;
	}
	.markdown-content :global(th),
	.markdown-content :global(td) {
		border: 1px solid var(--terminal-border);
		padding: 0.35em 0.5em;
		font-size: 0.85em;
	}
	.markdown-content :global(th) {
		background: var(--ocean-900);
	}
	/* Embed styles */
	.markdown-content :global(.embed-container) {
		margin: 0.5em 0;
		border-radius: 8px;
		overflow: hidden;
	}
	.markdown-content :global(.embed-video) {
		position: relative;
		padding-bottom: 56.25%;
		height: 0;
	}
	.markdown-content :global(.embed-video iframe) {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}
	.markdown-content :global(.embed-audio) {
		height: 166px;
	}
	.markdown-content :global(.embed-audio iframe) {
		width: 100%;
		height: 100%;
		border: none;
	}
</style>
