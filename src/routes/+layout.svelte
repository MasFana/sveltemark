<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import './layout.css';

	let { children } = $props();

	// Register service worker for offline support
	onMount(() => {
		if ('serviceWorker' in navigator && !dev) {
			// Only register in production
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('SW registered:', registration.scope);

					// Check for updates periodically
					setInterval(
						() => {
							registration.update();
						},
						60 * 60 * 1000
					); // Check every hour
				})
				.catch((error) => {
					console.error('SW registration failed:', error);
				});
		}
	});

	// SEO Configuration
	const siteConfig = {
		title: 'Offline in Browser Markdown Viewer and Renderer | SvelteMark',
		description:
			'Flawlessly render markdown from ChatGPT and Other AI models. Supports Mermaid diagrams, math equations, and syntax highlighting. 100% private, offline & free.',
		url: 'https://sm.fana.my.id',
		siteName: 'SvelteMark',
		locale: 'en_US',
		type: 'website',
		twitterHandle: '@masfana_',
		themeColor: '#161b22',
		keywords: [
			'markdown editor',
			'AI markdown viewer',
			'ChatGPT markdown',
			'Claude markdown preview',
			'Gemini markdown editor',
			'privacy-first markdown',
			'local markdown editor',
			'offline markdown editor',
			'Mermaid diagram editor',
			'math equation markdown',
			'LaTeX markdown editor',
			'code syntax highlighting',
			'GitHub flavored markdown',
			'DeepSeek markdown',
			'Perplexity markdown'
		]
	};

	// Use absolute URL for OG image (social platforms need full URL)
	const ogImageUrl = `${siteConfig.url}/logo.webp`;
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{siteConfig.title}</title>
	<meta name="title" content={siteConfig.title} />
	<meta name="description" content={siteConfig.description} />
	<meta name="keywords" content={siteConfig.keywords.join(', ')} />
	<meta name="author" content="MasFana" />
	<meta name="robots" content="index, follow" />
	<meta name="language" content="English" />
	<meta name="revisit-after" content="7 days" />

	<!-- Favicon -->
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/logo.webp" />
	<link rel="manifest" href="/manifest.json" />

	<!-- Theme Color -->
	<meta name="theme-color" content={siteConfig.themeColor} />
	<meta name="msapplication-TileColor" content={siteConfig.themeColor} />
	<meta name="msapplication-navbutton-color" content={siteConfig.themeColor} />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content={siteConfig.type} />
	<meta property="og:url" content={siteConfig.url} />
	<meta property="og:title" content={siteConfig.title} />
	<meta property="og:description" content={siteConfig.description} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="SvelteMark - Privacy-First Markdown Editor" />
	<meta property="og:site_name" content={siteConfig.siteName} />
	<meta property="og:locale" content={siteConfig.locale} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={siteConfig.url} />
	<meta name="twitter:title" content={siteConfig.title} />
	<meta name="twitter:description" content={siteConfig.description} />
	<meta name="twitter:image" content={ogImageUrl} />
	<meta name="twitter:image:alt" content="SvelteMark - Privacy-First Markdown Editor" />
	<meta name="twitter:site" content={siteConfig.twitterHandle} />
	<meta name="twitter:creator" content={siteConfig.twitterHandle} />

	<!-- Canonical URL -->
	<link rel="canonical" href={siteConfig.url} />

	<!-- Base Structured Data / JSON-LD (can be overridden by specific pages) -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: siteConfig.siteName,
		description: siteConfig.description,
		url: siteConfig.url,
		applicationCategory: 'ProductivityApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requires JavaScript. Requires HTML5.',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		},
		author: {
			'@type': 'Person',
			name: 'MasFana',
			url: 'https://github.com/MasFana'
		}
	})}</script>`}

	<!-- Additional SEO Tags -->
	<meta name="application-name" content={siteConfig.siteName} />
	<meta name="apple-mobile-web-app-title" content={siteConfig.siteName} />
	<meta name="format-detection" content="telephone=no" />

	<!-- Preconnect for performance -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />

	<!-- Google Fonts - Non-render-blocking -->
	{@html `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" media="print" onload="this.media='all'">`}
	<noscript>
		<link
			rel="stylesheet"
			href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
		/>
	</noscript>
</svelte:head>

<main>
	{@render children()}
</main>
