<script lang="ts">
	import './layout.css';

	let { children } = $props();

	// SEO Configuration
	const siteConfig = {
		title: 'SvelteMark - Privacy-First Markdown Editor',
		description:
			'A privacy-first, open-source, local-only markdown editor built with Svelte 5. Your notes never leave your device. No accounts, no tracking, no cloud.',
		url: 'https://sveltemark.fana.my.id',
		siteName: 'SvelteMark',
		locale: 'en_US',
		type: 'website',
		twitterHandle: '@masfana',
		themeColor: '#0d1117',
		keywords: [
			'markdown editor',
			'privacy-first',
			'local-first',
			'open-source',
			'svelte',
			'note taking',
			'offline editor',
			'no cloud',
			'private notes',
			'markdown preview',
			'codemirror',
			'mermaid diagrams',
			'katex math',
			'github flavored markdown'
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

	<!-- Structured Data / JSON-LD -->
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
		},
		publisher: {
			'@type': 'Person',
			name: 'MasFana'
		},
		softwareVersion: '1.0.0',
		featureList: [
			'Privacy-first local storage',
			'Markdown editing with live preview',
			'GitHub Flavored Markdown support',
			'Math equations with KaTeX',
			'Mermaid diagrams',
			'Syntax highlighting',
			'File and folder organization',
			'Export and import functionality',
			'Dark theme',
			'No account required'
		],
		screenshot: ogImageUrl,
		aggregateRating: {
			'@type': 'AggregateRating',
			ratingValue: '5',
			ratingCount: '1'
		}
	})}</script>`}

	<!-- Additional SEO Tags -->
	<meta name="application-name" content={siteConfig.siteName} />
	<meta name="apple-mobile-web-app-title" content={siteConfig.siteName} />
	<meta name="format-detection" content="telephone=no" />

	<!-- Preconnect for performance -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
</svelte:head>

{@render children()}
