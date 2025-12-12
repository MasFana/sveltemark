<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>SvelteMark - Markdown Editor App | Privacy-First Editor</title>
	<meta
		name="description"
		content="SvelteMark editor - privacy-first markdown editor for AI-generated content. Edit markdown with Mermaid diagrams, math equations, and code highlighting. Works offline."
	/>
	<meta name="robots" content="index, follow" />

	<!-- Open Graph -->
	<meta property="og:title" content="SvelteMark - Markdown Editor App" />
	<meta
		property="og:description"
		content="Privacy-first markdown editor for AI-generated content. Edit with Mermaid diagrams, math equations, and code highlighting."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://sm.fana.my.id/app" />

	<!-- Canonical URL -->
	<link rel="canonical" href="https://sm.fana.my.id/app" />
</svelte:head>

{@render children()}
