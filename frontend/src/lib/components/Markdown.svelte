<script lang="ts">
	import { browser } from '$app/environment';
	import { Marked } from 'marked';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/github-dark-dimmed.css';
	import DOMPurify from 'dompurify';

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

	const html = $derived.by(() => {
		const raw = marked.parse(content) as string;
		if (browser) {
			return DOMPurify.sanitize(raw);
		}
		return raw;
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
</style>
