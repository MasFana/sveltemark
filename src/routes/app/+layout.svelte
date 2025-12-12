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
	<link rel="canonical" href="https://sm.fana.my.id/app" />

	<!-- App Breadcrumb Schema -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Home',
				item: 'https://sm.fana.my.id/'
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Editor',
				item: 'https://sm.fana.my.id/app'
			}
		]
	})}</script>`}
</svelte:head>

{@render children()}
