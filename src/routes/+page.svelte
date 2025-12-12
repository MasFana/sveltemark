<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import {
		Bot,
		GitGraph,
		Sigma,
		Code2,
		Lock,
		Zap,
		Smartphone,
		Palette,
		Github,
		Shield,
		ShieldCheck,
		Code,
		ArrowRight,
		Rocket,
		FileText,
		WifiOff
	} from 'lucide-svelte';

	// Get data from load function
	interface Props {
		data: {
			currentYear: number;
			publishDate: string;
			modifiedDate: string;
			version: string;
			buildTime: string;
		};
	}

	let { data }: Props = $props();

	let isVisible = $state(false);
	let scrollY = $state(0);
	let scrollProgress = $state(0);
	let typingText = $state('');
	let wordIndex = $state(0);
	let charIndex = $state(0);
	let isDeleting = $state(false);
	let modalImage = $state<string | null>(null);
	let modalAlt = $state<string>('');

	function openModal(src: string, alt: string) {
		modalImage = src;
		modalAlt = alt;
		document.body.style.overflow = 'hidden';
	}

	function closeModal() {
		modalImage = null;
		modalAlt = '';
		document.body.style.overflow = '';
	}

	// Ensure scroll is enabled when navigating to landing page
	afterNavigate(() => {
		// Force enable scrolling on html and body
		if (typeof document !== 'undefined') {
			document.documentElement.style.overflow = '';
			document.documentElement.style.height = '';
			document.body.style.overflow = '';
			document.body.style.height = '';
		}
	});

	onMount(() => {
		isVisible = true;

		// Extra safeguard: ensure scroll is enabled
		document.documentElement.style.overflow = '';
		document.documentElement.style.height = '';
		document.body.style.overflow = '';
		document.body.style.height = '';

		// Parallax scroll effect and progress
		const handleScroll = () => {
			scrollY = window.scrollY;
			const windowHeight = window.innerHeight;
			const documentHeight = document.documentElement.scrollHeight;
			const scrolled = (scrollY / (documentHeight - windowHeight)) * 100;
			scrollProgress = Math.min(scrolled, 100);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });

		// Typing animation
		const words = ['Free', 'Feature Rich', 'Light Weight', 'Open Source'];
		const typingSpeed = 150;
		const deletingSpeed = 75;
		const delayBetweenWords = 2000;

		let timeout: ReturnType<typeof setTimeout>;

		const typeWriter = () => {
			const currentWord = words[wordIndex];

			if (!isDeleting && charIndex < currentWord.length) {
				// Typing
				typingText = currentWord.substring(0, charIndex + 1);
				charIndex++;
				timeout = setTimeout(typeWriter, typingSpeed);
			} else if (isDeleting && charIndex > 0) {
				// Deleting
				typingText = currentWord.substring(0, charIndex - 1);
				charIndex--;
				timeout = setTimeout(typeWriter, deletingSpeed);
			} else if (!isDeleting && charIndex === currentWord.length) {
				// Pause before deleting
				isDeleting = true;
				timeout = setTimeout(typeWriter, delayBetweenWords);
			} else if (isDeleting && charIndex === 0) {
				// Move to next word
				isDeleting = false;
				wordIndex = (wordIndex + 1) % words.length;
				timeout = setTimeout(typeWriter, 500);
			}
		};

		// Start typing animation after a delay
		timeout = setTimeout(typeWriter, 1000);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			clearTimeout(timeout);
		};
	});
	const features = [
		{
			icon: Bot,
			title: 'AI-Generated Content',
			description:
				'Perfect for viewing and editing markdown from ChatGPT, Claude, Gemini, DeepSeek, and other AI models'
		},
		{
			icon: GitGraph,
			title: 'Mermaid Diagrams',
			description:
				'Render flowcharts, sequence diagrams, Gantt charts, and more with built-in Mermaid support'
		},
		{
			icon: Sigma,
			title: 'Math Equations',
			description:
				'Display LaTeX and KaTeX equations beautifully for scientific and technical content'
		},
		{
			icon: Code2,
			title: 'Code Highlighting',
			description: 'Syntax highlighting for 100+ programming languages with copy-to-clipboard'
		},
		{
			icon: Lock,
			title: 'Privacy-First',
			description: 'Your data never leaves your device. No accounts, no cloud, no tracking'
		},
		{
			icon: Zap,
			title: 'Lightning Fast',
			description: 'Instant preview, real-time sync, and smooth scrolling for the best experience'
		},
		{
			icon: WifiOff,
			title: 'Works Offline',
			description: 'Progressive Web App that works perfectly even without internet connection'
		},
		{
			icon: Palette,
			title: 'Beautiful UI',
			description: 'Clean, modern interface with dark theme and customizable layouts'
		},
		{
			icon: FileText,
			title: 'Download Export Import',
			description: 'Easily download, export, and import your markdown files to keep your data safe'
		}
	];

	const aiModels = [
		{ name: 'ChatGPT', color: '#10a37f', company: 'OpenAI' },
		{ name: 'Claude', color: '#cc785c', company: 'Anthropic' },
		{ name: 'Gemini', color: '#4285f4', company: 'Google' },
		{ name: 'DeepSeek', color: '#7c3aed', company: 'DeepSeek' },
		{ name: 'Perplexity', color: '#20808d', company: 'Perplexity' }
	];
</script>

<svelte:head>
	<title>SvelteMark - Markdown Editor for AI Content | Privacy-First & Offline</title>
	<meta
		name="description"
		content="Privacy-first markdown editor for viewing and editing AI-generated content from ChatGPT, Claude, Gemini, and more. Render Mermaid diagrams, math equations (KaTeX/LaTeX), and code with syntax highlighting. Works offline, no cloud, 100% local."
	/>
	<meta
		name="keywords"
		content="markdown editor, AI markdown viewer, ChatGPT markdown, Claude markdown preview, Gemini markdown editor, privacy-first markdown, local markdown editor, offline markdown, Mermaid diagram editor, math equation markdown, LaTeX markdown editor, code syntax highlighting, GitHub flavored markdown"
	/>

	<!-- Open Graph -->
	<meta property="og:title" content="SvelteMark - Markdown Editor for AI Content" />
	<meta
		property="og:description"
		content="Privacy-first markdown editor for viewing and editing AI-generated content from ChatGPT, Claude, Gemini, and more. Render Mermaid diagrams, math equations, and code with syntax highlighting."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://sm.fana.my.id/" />
	<meta property="og:image" content="https://sm.fana.my.id/screenshot.webp" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="SvelteMark Editor Interface" />
	<meta property="og:site_name" content="SvelteMark" />
	<meta property="og:updated_time" content={data.modifiedDate} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="SvelteMark - Markdown Editor for AI Content" />
	<meta
		name="twitter:description"
		content="Privacy-first markdown editor for AI-generated content. Render Mermaid diagrams, math equations, and code."
	/>
	<meta name="twitter:image" content="https://sm.fana.my.id/screenshot.webp" />
	<meta name="twitter:image:alt" content="SvelteMark Editor Interface" />
	<meta name="twitter:site" content="@masfana_" />
	<meta name="twitter:creator" content="@masfana_" />

	<!-- Canonical URL -->
	<link rel="canonical" href="https://sm.fana.my.id/" />

	<!-- Additional Meta Tags -->
	<meta name="google-site-verification" content="your-google-verification-code" />
	<meta name="rating" content="general" />
	<meta name="referrer" content="no-referrer-when-downgrade" />

	<!-- Enhanced SEO Meta Tags -->
	<meta name="distribution" content="global" />
	<meta name="coverage" content="worldwide" />
	<meta name="target" content="all" />
	<meta name="HandheldFriendly" content="true" />
	<meta name="MobileOptimized" content="width" />
	<meta name="last-modified" content={data.modifiedDate} />
	<meta name="article:modified_time" content={data.modifiedDate} />
	<meta name="article:published_time" content={data.publishDate} />

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'SvelteMark',
		alternateName: 'Svelte Markdown Editor',
		url: 'https://sm.fana.my.id',
		applicationCategory: 'ProductivityApplication',
		applicationSubCategory: 'Markdown Editor',
		operatingSystem: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'],
		browserRequirements: 'Requires JavaScript. Requires HTML5.',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
			availability: 'https://schema.org/InStock'
		},
		description: 'Privacy-first, open-source, local-only markdown editor for viewing and editing AI-generated content from ChatGPT, Claude, Gemini, and more. Supports Mermaid diagrams, math equations (KaTeX/LaTeX), and code syntax highlighting. Works offline as a Progressive Web App.',
		featureList: [
			'AI-generated content support (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Mistral)',
			'Mermaid diagram rendering (flowcharts, sequence diagrams, Gantt charts, class diagrams)',
			'Math equation support (KaTeX/LaTeX)',
			'Syntax highlighting for 100+ programming languages',
			'Privacy-first architecture (no cloud, no tracking, no analytics)',
			'Offline support (Progressive Web App)',
			'Real-time markdown preview',
			'GitHub Flavored Markdown support',
			'File and folder organization',
			'Export and import functionality',
			'Dark theme interface',
			'No account or registration required',
			'Local storage only',
			'Copy code to clipboard',
			'Table of contents generation'
		],
		screenshot: [
			'https://sm.fana.my.id/screenshot.webp',
			'https://sm.fana.my.id/preview.webp',
			'https://sm.fana.my.id/toolbar.webp',
			'https://sm.fana.my.id/filetree.webp'
		],
		image: 'https://sm.fana.my.id/logo.webp',
		author: {
			'@type': 'Person',
			name: 'MasFana',
			url: 'https://github.com/MasFana'
		},
		creator: {
			'@type': 'Person',
			name: 'MasFana',
			url: 'https://github.com/MasFana'
		},
		softwareVersion: data.version,
		datePublished: data.publishDate,
		dateModified: data.modifiedDate,
		aggregateRating: {
			'@type': 'AggregateRating',
			ratingValue: '4.9',
			ratingCount: '185',
			bestRating: '5',
			worstRating: '1'
		},
		softwareHelp: {
			'@type': 'WebPage',
			url: 'https://github.com/MasFana/sveltemark'
		},
		license: 'https://opensource.org/licenses/MIT',
		codeRepository: 'https://github.com/MasFana/sveltemark',
		programmingLanguage: ['TypeScript', 'Svelte', 'JavaScript'],
		keywords: 'markdown editor, AI markdown viewer, ChatGPT markdown, Claude markdown preview, Gemini markdown editor, privacy-first markdown, local markdown editor, offline markdown editor, Mermaid diagram editor, math equation markdown, LaTeX markdown editor, code syntax highlighting, GitHub flavored markdown, DeepSeek markdown, Perplexity markdown, progressive web app, PWA, local-first, privacy-focused'
	})}</script>`}

	<!-- Breadcrumb Structured Data -->
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

	<!-- FAQ Structured Data -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: [
			{
				'@type': 'Question',
				name: 'Is SvelteMark free to use?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Yes, SvelteMark is completely free and open-source under the MIT License. There are no subscriptions, no premium features, and no hidden costs.'
				}
			},
			{
				'@type': 'Question',
				name: 'Does SvelteMark work offline?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Yes! SvelteMark is a Progressive Web App (PWA) that works completely offline. Once loaded, you can use all features without an internet connection. Your data is stored locally on your device.'
				}
			},
			{
				'@type': 'Question',
				name: 'Is my data private and secure?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Absolutely. SvelteMark runs entirely in your browser. Your documents never leave your device - there\'s no cloud storage, no tracking, no analytics, and no account required. Your privacy is guaranteed by design.'
				}
			},
			{
				'@type': 'Question',
				name: 'Can I use SvelteMark with AI-generated content?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Yes! SvelteMark is perfect for viewing and editing markdown from ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and other AI models. It supports Mermaid diagrams, math equations, code highlighting, and all GitHub Flavored Markdown features.'
				}
			},
			{
				'@type': 'Question',
				name: 'What platforms does SvelteMark support?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'SvelteMark works on any modern web browser across Windows, macOS, Linux, iOS, and Android. You can install it as a Progressive Web App on mobile devices and desktop computers for a native-like experience.'
				}
			},
			{
				'@type': 'Question',
				name: 'Does SvelteMark support Mermaid diagrams?',
				acceptedAnswer: {
					'@type': 'Answer',
					text: 'Yes! SvelteMark has built-in support for Mermaid diagrams including flowcharts, sequence diagrams, Gantt charts, class diagrams, and more. Simply paste your Mermaid code and see it rendered instantly.'
				}
			}
		]
	})}</script>`}
</svelte:head>

<div class="scroll-progress-container">
	<div class="scroll-progress" style="width: {scrollProgress}%"></div>
</div>
<div class="landing-page" class:visible={isVisible}>
	<!-- Scroll Progress Bar - Always Visible -->

	<!-- Hero Section -->
	<section class="hero">
		<!-- Animated Background -->
		<div class="hero-background">
			<!-- Gradient Mesh -->
			<div class="gradient-mesh"></div>

			<!-- Gradient Orbs with Parallax -->
			<div class="gradient-orb orb-1" style="transform: translate(0, {scrollY * 0.15}px)"></div>
			<div class="gradient-orb orb-2" style="transform: translate(0, {scrollY * 0.25}px)"></div>
			<div class="gradient-orb orb-3" style="transform: translate(0, {scrollY * 0.1}px)"></div>

			<!-- Floating Geometric Shapes -->
			<div class="geometric-shapes">
				<div class="shape shape-circle"></div>
				<div class="shape shape-triangle"></div>
				<div class="shape shape-square"></div>
				<div class="shape shape-hexagon"></div>
			</div>

			<!-- Grid Pattern -->
			<div class="grid-pattern" style="transform: translateY({scrollY * 0.3}px)"></div>
		</div>

		<div class="container">
			<div class="hero-content">
				<div class="hero-badge-top">
					<Shield size={14} />
					<span>Privacy-First • Open Source • 100% Free</span>
				</div>

				<h1 class="hero-title">
					<span class="title-line-1">
						The Modern <span class="typing-wrapper">
							<span class="typing-text">{typingText}</span>
							<span class="typing-cursor">|</span>
						</span>
					</span>
					<span class="title-line-2">
						<span class="gradient-text">Markdown Editor</span>
					</span>
					<span class="title-line-3">for AI-Powered Workflows</span>
				</h1>

				<p class="hero-subtitle">
					Seamlessly render and edit markdown from <strong>ChatGPT</strong>,
					<strong>Claude</strong>, <strong>Gemini</strong>, and other AI models. Features Mermaid
					diagrams, LaTeX equations, code syntax highlighting, and more all while keeping your data
					completely private.
				</p>

				<div class="hero-actions">
					<a
						href="/app"
						class="btn btn-primary"
						data-sveltekit-preload-data="off"
						data-sveltekit-preload-code="off"
						data-sveltekit-reload
					>
						<span class="btn-shine"></span>
						<Rocket size={20} />
						Start Creating Now
						<ArrowRight size={18} />
					</a>
					<a
						href="https://github.com/MasFana/sveltemark"
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-secondary"
					>
						<Github size={20} />
						View on GitHub
					</a>
				</div>

				<div class="hero-features">
					<div class="hero-feature-item">
						<div class="feature-icon-wrapper">
							<Shield size={18} />
						</div>
						<span>100% Private</span>
					</div>
					<div class="hero-feature-item">
						<div class="feature-icon-wrapper">
							<Zap size={18} />
						</div>
						<span>Lightning Fast</span>
					</div>
					<div class="hero-feature-item">
						<div class="feature-icon-wrapper">
							<Code size={18} />
						</div>
						<span>Open Source</span>
					</div>
					<div class="hero-feature-item">
						<div class="feature-icon-wrapper">
							<Smartphone size={18} />
						</div>
						<span>Works Offline</span>
					</div>
				</div>
			</div>
			<div class="hero-visual">
				<div class="editor-mockup">
					<div class="mockup-header">
						<div class="mockup-dots">
							<span></span>
							<span></span>
							<span></span>
						</div>
						<span class="mockup-title">example.md</span>
					</div>
					<div class="mockup-content">
						<pre class="mockup-code"><code
								># Welcome to SvelteMark

Perfect for viewing markdown from AI models:
- ChatGPT responses with diagrams
- Claude's technical explanations
- Gemini's code examples

```mermaid
graph LR
  A[AI Model] --> B[Generate Markdown]
  B --> C[SvelteMark]
  C --> D[Beautiful Preview]
```

Math equations: $E = mc^2$

And much more!</code
							></pre>
					</div>
				</div>
			</div>
		</div>

		<!-- Scroll Indicator -->
		<div class="scroll-indicator" class:hidden={scrollY > 100}>
			<div class="scroll-line"></div>
			<div class="scroll-dot"></div>
			<span class="scroll-text">Scroll to explore</span>
		</div>
	</section>

	<!-- AI Compatibility Section -->
	<section class="ai-section">
		<div class="container">
			<h2 class="section-title">Render Complex Markdown from Any AI Model</h2>
			<p class="section-subtitle">
				Seamlessly view and edit markdown content generated by leading AI assistants
			</p>
			<div class="ai-grid">
				{#each aiModels as model}
					<div class="ai-card">
						<div
							class="ai-logo"
							style="background: {model.color}20; border: 2px solid {model.color}40;"
						>
							<Bot size={32} style="color: {model.color};" />
						</div>
						<h3>{model.name}</h3>
						<p>{model.company}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="features-section">
		<div class="container">
			<h2 class="section-title">Powerful Features for Modern Markdown</h2>
			<div class="features-grid">
				{#each features as feature}
					{@const Icon = feature.icon}
					<div class="feature-card">
						<div class="feature-icon">
							<Icon size={40} strokeWidth={1.5} />
						</div>
						<h3 class="feature-title">{feature.title}</h3>
						<p class="feature-description">{feature.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Screenshots Section -->
	<section class="screenshots-section">
		<div class="container">
			<h2 class="section-title">See It In Action</h2>
			<p class="section-subtitle">A powerful yet intuitive interface designed for productivity</p>
			<div class="screenshots-grid">
				<div class="screenshot-item">
					<button
						type="button"
						class="screenshot-btn"
						onclick={() => openModal('/preview.webp', 'SvelteMark Preview Mode')}
						aria-label="View preview mode screenshot"
					>
						<img src="/preview.webp" alt="SvelteMark Preview Mode" loading="lazy" />
					</button>
					<h3>Real-time Preview</h3>
					<p>See your markdown rendered instantly with support for diagrams and equations</p>
				</div>
				<div class="screenshot-item">
					<button
						type="button"
						class="screenshot-btn"
						onclick={() => openModal('/toolbar.webp', 'SvelteMark Toolbar')}
						aria-label="View toolbar screenshot"
					>
						<img src="/toolbar.webp" alt="SvelteMark Toolbar" loading="lazy" />
					</button>
					<h3>Rich Toolbar</h3>
					<p>Quick access to formatting, file management, and export options</p>
				</div>
				<div class="screenshot-item">
					<button
						type="button"
						class="screenshot-btn"
						onclick={() => openModal('/filetree.webp', 'SvelteMark File Tree')}
						aria-label="View file tree screenshot"
					>
						<img src="/filetree.webp" alt="SvelteMark File Tree" loading="lazy" />
					</button>
					<h3>File Organization</h3>
					<p>Organize your documents with folders and a clean file tree</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Use Cases Section -->
	<section class="use-cases-section">
		<div class="container">
			<h2 class="section-title">Perfect For</h2>
			<div class="use-cases-grid">
				<div class="use-case-card">
					<div class="use-case-number">01</div>
					<h3>AI Conversations</h3>
					<p>
						Save and organize your ChatGPT or Claude conversations with full formatting, diagrams,
						and code blocks preserved.
					</p>
				</div>
				<div class="use-case-card">
					<div class="use-case-number">02</div>
					<h3>Technical Documentation</h3>
					<p>
						Write documentation with equations, diagrams, and code examples. Preview everything in
						real-time.
					</p>
				</div>
				<div class="use-case-card">
					<div class="use-case-number">03</div>
					<h3>Note Taking</h3>
					<p>
						Capture ideas, meeting notes, or research with rich formatting. Everything stays private
						on your device.
					</p>
				</div>
				<div class="use-case-card">
					<div class="use-case-number">04</div>
					<h3>Learning & Education</h3>
					<p>
						Create study materials with math equations, diagrams, and code snippets. Perfect for
						STEM subjects.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Privacy Guarantee Section -->
	<section class="privacy-section">
		<div class="container">
			<div class="privacy-content">
				<div class="privacy-icon">
					<ShieldCheck size={64} strokeWidth={1.5} />
				</div>
				<h2>Your Privacy is Guaranteed</h2>
				<p class="privacy-text">
					SvelteMark runs entirely in your browser. Your notes, documents, and data <strong
						>never leave your device</strong
					>. No accounts, no cloud sync, no tracking, no analytics. Just you and your markdown.
				</p>
				<div class="privacy-features">
					<div class="privacy-item">
						<Shield size={32} />
						<span>No Tracking</span>
					</div>
					<div class="privacy-item">
						<Lock size={32} />
						<span>No Accounts</span>
					</div>
					<div class="privacy-item">
						<Code size={32} />
						<span>100% Open Source</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="cta-section">
		<div class="container">
			<h2 class="cta-title">Ready to Get Started?</h2>
			<p class="cta-subtitle">
				Start editing your markdown content right now. No installation required.
			</p>
			<a
				href="/app"
				class="btn btn-primary btn-large"
				data-sveltekit-preload-data="off"
				data-sveltekit-preload-code="off"
				data-sveltekit-reload
			>
				<span class="btn-shine"></span>
				Launch SvelteMark
				<ArrowRight size={24} />
			</a>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="container">
			<div class="footer-content">
				<div class="footer-brand">
					<h3>SvelteMark</h3>
					<p>Privacy-first markdown editor</p>
				</div>
				<div class="footer-links">
					<div class="footer-column">
						<h4>Product</h4>
						<a
							href="/app"
							data-sveltekit-preload-data="off"
							data-sveltekit-preload-code="off"
							data-sveltekit-reload>Launch Editor</a
						>
						<a
							href="https://github.com/MasFana/sveltemark"
							target="_blank"
							rel="noopener noreferrer">Documentation</a
						>
						<a
							href="https://github.com/MasFana/sveltemark/releases"
							target="_blank"
							rel="noopener noreferrer">Changelog</a
						>
					</div>
					<div class="footer-column">
						<h4>Resources</h4>
						<a
							href="https://github.com/MasFana/sveltemark"
							target="_blank"
							rel="noopener noreferrer">GitHub</a
						>
						<a
							href="https://www.producthunt.com/products/sveltemark"
							target="_blank"
							rel="noopener noreferrer">Product Hunt</a
						>
						<a
							href="https://medium.com/@fanaapi425/building-sveltemark-a-local-first-privacy-focused-markdown-editor-with-svelte-5-e5ab878fa0e1"
							target="_blank"
							rel="noopener noreferrer">Blog Post</a
						>
					</div>
					<div class="footer-column">
						<h4>Community</h4>
						<a
							href="https://github.com/MasFana/sveltemark/issues"
							target="_blank"
							rel="noopener noreferrer">Issues</a
						>
						<a
							href="https://github.com/MasFana/sveltemark/discussions"
							target="_blank"
							rel="noopener noreferrer">Discussions</a
						>
						<a
							href="https://www.linkedin.com/pulse/introducing-sveltemark-local-first-privacy-focused-markdown-imama-frcyc/"
							target="_blank"
							rel="noopener noreferrer">LinkedIn</a
						>
					</div>
					<div class="footer-column">
						<h4>External</h4>
						<a href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte</a>
						<a href="https://www.markdownguide.org/" target="_blank" rel="noopener noreferrer"
							>Markdown Guide</a
						>
						<a href="https://mermaid.js.org/" target="_blank" rel="noopener noreferrer">Mermaid</a>
					</div>
				</div>
			</div>
			<div class="footer-bottom">
				<p>
					© {data.currentYear} SvelteMark v{data.version}. Open source under MIT License. Built with
					❤️ by
					<a href="https://github.com/MasFana" target="_blank" rel="noopener noreferrer">MasFana</a>
				</p>
				<p class="build-info">
					Last updated: {new Date(data.modifiedDate).toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})}
				</p>
			</div>
		</div>
	</footer>
</div>

<!-- Image Modal -->
{#if modalImage}
	<div
		class="modal-overlay"
		onclick={closeModal}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="modal-content"
	
			role="document"
		>
			<button type="button" class="modal-close" onclick={closeModal} aria-label="Close modal">
				✕
			</button>
			<img src={modalImage} alt={modalAlt} />
		</div>
	</div>
{/if}

<style>
	:global(:root) {
		/* Dark Orange Theme Colors */
		--bg-primary: #1a1a1a;
		--bg-secondary: #242424;
		--bg-elevated: #2d2d2d;
		--border-color: #3a3a3a;

		--text-primary: #e8e8e8;
		--text-secondary: #a8a8a8;
		--text-tertiary: #707070;

		--orange-primary: #ff6b35;
		--orange-hover: #ff8555;
		--orange-subtle: #ff6b3520;

		--success: #10b981;
		--warning: #f59e0b;
		--error: #ef4444;

		--code-bg: #1e1e1e;

		--spacing-xs: 4px;
		--spacing-sm: 8px;
		--spacing-md: 16px;
		--spacing-lg: 24px;
		--spacing-xl: 32px;
		--spacing-2xl: 48px;
		--spacing-3xl: 64px;

		--radius-sm: 4px;
		--radius-md: 8px;
		--radius-lg: 12px;

		--transition: 200ms ease-out;
	}

	:global(body) {
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			'Roboto',
			'Oxygen',
			'Ubuntu',
			'Cantarell',
			'Fira Sans',
			'Droid Sans',
			'Helvetica Neue',
			sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.landing-page {
		background: var(--bg-primary);
		color: var(--text-primary);
		min-height: 100vh;
		opacity: 0;
		transform: translateY(20px);
		transition:
			opacity 0.6s ease-out,
			transform 0.6s ease-out;
		overflow-x: hidden;
	}

	.landing-page.visible {
		opacity: 1;
		transform: translateY(0);
	}

	/* Scroll Progress Bar - Always Visible */
	.scroll-progress-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 4px;
		background: rgba(255, 107, 53, 0.1);
		z-index: 9999;
		backdrop-filter: blur(10px);
	}

	.scroll-progress {
		height: 100%;
		background: linear-gradient(90deg, var(--orange-primary), var(--orange-hover));
		transition: width 0.1s ease-out;
		box-shadow:
			0 0 10px var(--orange-primary),
			0 0 20px rgba(255, 107, 53, 0.5);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 var(--spacing-lg);
	}

	/* Hero Section */
	.hero {
		padding: 160px 0 120px;
		background: radial-gradient(ellipse at top, rgba(255, 107, 53, 0.05) 0%, transparent 50%);
		border-bottom: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	/* Hero Background */
	.hero-background {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
		overflow: hidden;
	}

	/* Animated Gradient Mesh */
	.gradient-mesh {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background:
			linear-gradient(45deg, transparent 0%, rgba(255, 107, 53, 0.03) 25%, transparent 50%),
			linear-gradient(-45deg, transparent 0%, rgba(255, 133, 85, 0.02) 25%, transparent 50%),
			linear-gradient(90deg, transparent 0%, rgba(255, 107, 53, 0.02) 50%, transparent 100%);
		background-size: 400% 400%;
		animation: gradientMesh 20s ease infinite;
		opacity: 0.5;
	}

	@keyframes gradientMesh {
		0%,
		100% {
			background-position:
				0% 0%,
				100% 100%,
				0% 50%;
		}
		25% {
			background-position:
				50% 25%,
				50% 75%,
				25% 50%;
		}
		50% {
			background-position:
				100% 50%,
				0% 50%,
				50% 50%;
		}
		75% {
			background-position:
				50% 75%,
				50% 25%,
				75% 50%;
		}
	}

	/* Grid Pattern */
	.grid-pattern {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image:
			linear-gradient(rgba(255, 107, 53, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 107, 53, 0.03) 1px, transparent 1px);
		background-size: 50px 50px;
		opacity: 0.3;
		mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
		-webkit-mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
	}

	.gradient-orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0.25;
		animation: orbFloat 25s ease-in-out infinite;
		will-change: transform;
	}

	.orb-1 {
		width: 600px;
		height: 600px;
		top: -300px;
		right: -150px;
		background: radial-gradient(circle, var(--orange-primary), transparent 70%);
		animation-delay: 0s;
	}

	.orb-2 {
		width: 500px;
		height: 500px;
		bottom: -250px;
		left: -100px;
		background: radial-gradient(circle, var(--orange-hover), transparent 70%);
		animation-delay: 8s;
	}

	.orb-3 {
		width: 400px;
		height: 400px;
		top: 40%;
		left: 50%;
		margin-left: -200px;
		background: radial-gradient(circle, rgba(255, 153, 102, 0.4), transparent 70%);
		animation-delay: 16s;
	}

	@keyframes orbFloat {
		0%,
		100% {
			transform: translate(0, 0) scale(1) rotate(0deg);
		}
		25% {
			transform: translate(40px, -40px) scale(1.15) rotate(90deg);
		}
		50% {
			transform: translate(-30px, 30px) scale(0.85) rotate(180deg);
		}
		75% {
			transform: translate(20px, 20px) scale(1.05) rotate(270deg);
		}
	}

	/* Floating Geometric Shapes */
	.geometric-shapes {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.shape {
		position: absolute;
		opacity: 0.08;
		animation: shapeFloat 30s ease-in-out infinite;
	}

	.shape-circle {
		width: 120px;
		height: 120px;
		border: 2px solid var(--orange-primary);
		border-radius: 50%;
		top: 20%;
		left: 10%;
		animation-delay: 0s;
	}

	.shape-triangle {
		width: 0;
		height: 0;
		border-left: 60px solid transparent;
		border-right: 60px solid transparent;
		border-bottom: 100px solid var(--orange-primary);
		top: 60%;
		right: 15%;
		animation-delay: 7s;
	}

	.shape-square {
		width: 80px;
		height: 80px;
		border: 2px solid var(--orange-hover);
		transform: rotate(45deg);
		top: 15%;
		right: 20%;
		animation-delay: 14s;
	}

	.shape-hexagon {
		width: 100px;
		height: 57.74px;
		background: var(--orange-primary);
		position: absolute;
		top: 70%;
		left: 20%;
		animation-delay: 21s;
	}

	.shape-hexagon:before,
	.shape-hexagon:after {
		content: '';
		position: absolute;
		width: 0;
		border-left: 50px solid transparent;
		border-right: 50px solid transparent;
	}

	.shape-hexagon:before {
		bottom: 100%;
		border-bottom: 28.87px solid var(--orange-primary);
	}

	.shape-hexagon:after {
		top: 100%;
		width: 0;
		border-top: 28.87px solid var(--orange-primary);
	}

	@keyframes shapeFloat {
		0%,
		100% {
			transform: translateY(0px) rotate(0deg);
			opacity: 0.08;
		}
		50% {
			transform: translateY(-50px) rotate(180deg);
			opacity: 0.15;
		}
	}

	.hero-content {
		text-align: center;
		margin-bottom: var(--spacing-3xl);
		position: relative;
		z-index: 1;
		max-width: 900px;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-badge-top {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 133, 85, 0.1));
		border: 1px solid rgba(255, 107, 53, 0.3);
		border-radius: 50px;
		color: var(--orange-primary);
		font-size: 0.8125rem;
		font-weight: 600;
		margin-bottom: var(--spacing-2xl);
		opacity: 0;
		animation: fadeInDown 0.6s ease-out forwards;
		backdrop-filter: blur(10px);
		transition: all 0.3s ease;
	}

	.hero-badge-top:hover {
		background: linear-gradient(135deg, rgba(255, 107, 53, 0.25), rgba(255, 133, 85, 0.15));
		border-color: var(--orange-primary);
		transform: translateY(-2px);
	}

	@keyframes fadeInDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.hero-title {
		font-size: clamp(2.75rem, 6vw, 4.5rem);
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: var(--spacing-2xl);
		letter-spacing: -0.03em;
	}

	.title-line-1,
	.title-line-2,
	.title-line-3 {
		display: block;
		opacity: 0;
	}

	.title-line-1 {
		font-size: 0.5em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--text-tertiary);
		margin-bottom: 0.3em;
		animation: fadeInUp 0.6s ease-out 0.1s forwards;
	}

	.typing-wrapper {
		display: inline-block;
		margin-left: 0.3em;
	}

	.typing-text {
		color: var(--orange-primary);
		font-weight: 700;
	}

	.typing-cursor {
		color: var(--orange-primary);
		font-weight: 300;
		animation: blink 1s step-end infinite;
		margin-left: 2px;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	.title-line-2 {
		animation: fadeInUp 0.8s ease-out 0.2s forwards;
	}

	.title-line-3 {
		font-size: 0.55em;
		font-weight: 500;
		color: var(--text-secondary);
		margin-top: 0.5em;
		animation: fadeInUp 0.8s ease-out 0.35s forwards;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.gradient-text {
		background: linear-gradient(135deg, var(--orange-primary) 0%, var(--orange-hover) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: clamp(1.05rem, 2vw, 1.2rem);
		color: var(--text-secondary);
		line-height: 1.8;
		max-width: 720px;
		margin: 0 auto var(--spacing-3xl);
		opacity: 0;
		animation: fadeInUp 0.8s ease-out 0.5s forwards;
		font-weight: 400;
	}

	.hero-subtitle strong {
		color: var(--orange-primary);
		font-weight: 700;
	}

	.hero-actions {
		display: flex;
		gap: var(--spacing-md);
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: var(--spacing-3xl);
		opacity: 0;
		animation: fadeInUp 0.8s ease-out 0.65s forwards;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: 14px 28px;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		transition: all var(--transition);
		cursor: pointer;
		border: none;
		position: relative;
		overflow: hidden;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--orange-primary) 0%, var(--orange-hover) 100%);
		color: white;
		box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
		padding: 16px 32px;
		font-size: 1.05rem;
	}

	.btn-primary:hover {
		background: linear-gradient(135deg, var(--orange-hover) 0%, var(--orange-primary) 100%);
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 8px 28px rgba(255, 107, 53, 0.5);
	}

	.btn-secondary {
		background: var(--bg-elevated);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		border-color: var(--orange-primary);
		color: var(--orange-primary);
		transform: translateY(-2px);
	}

	.btn-large {
		padding: 18px 36px;
		font-size: 1.1rem;
	}

	/* Cartoonish Slide Shine Effect - Periodic Animation */
	.btn-shine {
		position: absolute;
		top: 0;
		left: -100%;
		width: 50%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.3),
			rgba(255, 255, 255, 0.6),
			rgba(255, 255, 255, 0.3),
			transparent
		);
		transform: skewX(-25deg);
		pointer-events: none;
		animation: slideShine 3s ease-in-out infinite;
	}

	@keyframes slideShine {
		0% {
			left: -100%;
		}
		70% {
			left: 150%;
		}
		100% {
			left: 150%;
		}
	}

	.hero-features {
		display: flex;
		gap: var(--spacing-xl);
		justify-content: center;
		flex-wrap: wrap;
		opacity: 0;
		animation: fadeInUp 0.8s ease-out 0.8s forwards;
	}

	.hero-feature-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		color: var(--text-secondary);
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.3s ease;
	}

	.hero-feature-item:hover {
		color: var(--orange-primary);
		transform: translateY(-2px);
	}

	.hero-feature-item:hover .feature-icon-wrapper {
		background: var(--orange-primary);
		color: white;
		box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
	}

	.feature-icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--orange-subtle);
		border-radius: 8px;
		color: var(--orange-primary);
		transition: all 0.3s ease;
	}

	/* Scroll Indicator */
	.scroll-indicator {
		position: absolute;
		bottom: 40px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		z-index: 10;
		transition:
			opacity 0.5s ease,
			transform 0.5s ease;
		opacity: 1;
	}

	.scroll-indicator.hidden {
		opacity: 0;
		transform: translateX(-50%) translateY(20px);
		pointer-events: none;
	}

	.scroll-line {
		width: 2px;
		height: 60px;
		background: linear-gradient(to bottom, transparent, var(--orange-primary));
		position: relative;
		animation: scrollLine 2s ease-in-out infinite;
	}

	.scroll-dot {
		width: 8px;
		height: 8px;
		background: var(--orange-primary);
		border-radius: 50%;
		box-shadow: 0 0 20px var(--orange-primary);
		animation: scrollDot 2s ease-in-out infinite;
	}

	.scroll-text {
		color: var(--text-tertiary);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		animation: scrollText 2s ease-in-out infinite;
	}

	@keyframes scrollLine {
		0%,
		100% {
			opacity: 0.5;
			transform: scaleY(0.8);
		}
		50% {
			opacity: 1;
			transform: scaleY(1);
		}
	}

	@keyframes scrollDot {
		0%,
		100% {
			transform: translateY(0px);
			box-shadow: 0 0 15px var(--orange-primary);
		}
		50% {
			transform: translateY(10px);
			box-shadow: 0 0 25px var(--orange-primary);
		}
	}

	@keyframes scrollText {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	/* Editor Mockup */
	.hero-visual {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-3xl);
		opacity: 0;
		animation: fadeInScale 1s ease-out 0.9s forwards;
	}

	@keyframes fadeInScale {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.editor-mockup {
		width: 100%;
		max-width: 800px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		transition: all 0.3s ease;
	}

	.editor-mockup:hover {
		transform: translateY(-4px);
		box-shadow:
			0 24px 70px rgba(0, 0, 0, 0.5),
			0 0 40px rgba(255, 107, 53, 0.5),
			0 0 80px rgba(255, 107, 53, 0.3);
	}

	.mockup-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--border-color);
	}

	.mockup-dots {
		display: flex;
		gap: 6px;
	}

	.mockup-dots span {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--border-color);
	}

	.mockup-dots span:nth-child(1) {
		background: #ff5f57;
	}

	.mockup-dots span:nth-child(2) {
		background: #febc2e;
	}

	.mockup-dots span:nth-child(3) {
		background: #28c840;
	}

	.mockup-title {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.mockup-content {
		padding: var(--spacing-xl);
		background: var(--code-bg);
	}

	.mockup-code {
		margin: 0;
		font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
		font-size: 0.9rem;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	/* AI Section */
	.ai-section {
		padding: 120px 0;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	.ai-section::before {
		content: '';
		position: absolute;
		top: -30%;
		left: -5%;
		width: 700px;
		height: 700px;
		background: radial-gradient(
			circle,
			rgba(255, 107, 53, 0.18) 0%,
			rgba(255, 107, 53, 0.12) 40%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(50px);
		animation: floatOrb1 15s ease-in-out infinite;
		pointer-events: none;
	}

	.ai-section::after {
		content: '';
		position: absolute;
		bottom: -30%;
		right: -5%;
		width: 800px;
		height: 800px;
		background: radial-gradient(
			circle,
			rgba(255, 133, 85, 0.15) 0%,
			rgba(255, 153, 102, 0.08) 40%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(60px);
		animation: floatOrb2 20s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes floatOrb1 {
		0%,
		100% {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
		33% {
			transform: translate(50px, -30px) scale(1.15) rotate(120deg);
			opacity: 0.8;
		}
		66% {
			transform: translate(-30px, 60px) scale(0.95) rotate(240deg);
			opacity: 1;
		}
	}

	@keyframes floatOrb2 {
		0%,
		100% {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
		33% {
			transform: translate(-60px, 40px) scale(1.2) rotate(-120deg);
			opacity: 0.85;
		}
		66% {
			transform: translate(40px, -50px) scale(0.9) rotate(-240deg);
			opacity: 1;
		}
	}

	.section-title {
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 700;
		text-align: center;
		margin-bottom: var(--spacing-lg);
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.section-subtitle {
		text-align: center;
		color: var(--text-secondary);
		font-size: 1.125rem;
		line-height: 1.7;
		max-width: 650px;
		margin: 0 auto var(--spacing-3xl);
	}

	.ai-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--spacing-lg);
		max-width: 900px;
		margin: 0 auto;
	}

	.ai-card {
		text-align: center;
		padding: var(--spacing-xl);
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		transition: all 0.3s ease;
		cursor: default;
	}

	.ai-card:hover {
		transform: translateY(-6px);
		border-color: var(--orange-primary);
		box-shadow: 0 12px 32px rgba(255, 107, 53, 0.2);
	}

	.ai-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		margin: 0 auto var(--spacing-md);
		border-radius: 50%;
		transition: transform 0.3s ease;
	}

	.ai-card:hover .ai-logo {
		transform: scale(1.1);
	}

	.ai-card h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: var(--spacing-xs);
		color: var(--text-primary);
	}

	.ai-card p {
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	/* Features Section */
	.features-section {
		padding: 120px 0;
		background: var(--bg-primary);
		position: relative;
		overflow: hidden;
	}

	.features-section::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image:
			linear-gradient(rgba(255, 107, 53, 0.08) 2px, transparent 2px),
			linear-gradient(90deg, rgba(255, 107, 53, 0.08) 2px, transparent 2px),
			linear-gradient(rgba(255, 133, 85, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 133, 85, 0.04) 1px, transparent 1px);
		background-size:
			100px 100px,
			100px 100px,
			20px 20px,
			20px 20px;
		background-position:
			0 0,
			0 0,
			0 0,
			0 0;
		opacity: 0.7;
		animation: gridScroll 30s linear infinite;
		pointer-events: none;
	}

	.features-section::after {
		content: '';
		position: absolute;
		top: 20%;
		right: 5%;
		width: 600px;
		height: 600px;
		background: conic-gradient(
			from 0deg,
			rgba(255, 107, 53, 0.15),
			rgba(255, 133, 85, 0.08),
			rgba(255, 107, 53, 0.15)
		);
		border-radius: 50%;
		filter: blur(60px);
		animation: pulseRotate 12s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes gridScroll {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(60px);
		}
	}

	@keyframes pulseRotate {
		0%,
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 0.8;
		}
		50% {
			transform: scale(1.3) rotate(180deg);
			opacity: 1;
		}
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-xl);
		margin-top: var(--spacing-2xl);
	}

	.feature-card {
		padding: var(--spacing-xl);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		transition: all 0.3s ease;
		position: relative;
	}

	.feature-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 3px;
		background: linear-gradient(90deg, var(--orange-primary), var(--orange-hover));
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.3s ease;
	}

	.feature-card:hover {
		border-color: var(--orange-primary);
		transform: translateY(-8px);
		box-shadow: 0 12px 32px rgba(255, 107, 53, 0.2);
	}

	.feature-card:hover::before {
		transform: scaleX(1);
	}

	.feature-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		margin-bottom: var(--spacing-md);
		background: var(--orange-subtle);
		border-radius: var(--radius-md);
		color: var(--orange-primary);
		transition: all 0.3s ease;
	}

	.feature-card:hover .feature-icon {
		transform: translateY(-4px);
		background: var(--orange-primary);
		color: white;
	}

	.feature-title {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: var(--spacing-sm);
		color: var(--text-primary);
	}

	.feature-description {
		color: var(--text-secondary);
		line-height: 1.6;
	}

	/* Screenshots Section */
	.screenshots-section {
		padding: 120px 0;
		background: var(--bg-primary);
		border-bottom: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	.screenshots-section::before {
		content: '';
		position: absolute;
		top: -15%;
		left: -10%;
		width: 500px;
		height: 500px;
		background: radial-gradient(
			circle,
			transparent 48%,
			rgba(255, 107, 53, 0.25) 50%,
			rgba(255, 107, 53, 0.15) 52%,
			transparent 54%
		);
		border: 3px solid rgba(255, 107, 53, 0.2);
		border-radius: 50%;
		box-shadow:
			0 0 30px rgba(255, 107, 53, 0.3),
			inset 0 0 30px rgba(255, 107, 53, 0.1);
		animation: rotateCircleGlow 25s linear infinite;
		pointer-events: none;
	}

	.screenshots-section::after {
		content: '';
		position: absolute;
		bottom: -10%;
		right: -10%;
		width: 550px;
		height: 550px;
		background: radial-gradient(
			circle,
			transparent 48%,
			rgba(255, 133, 85, 0.2) 50%,
			rgba(255, 133, 85, 0.12) 52%,
			transparent 54%
		);
		border: 3px solid rgba(255, 133, 85, 0.18);
		border-radius: 50%;
		box-shadow:
			0 0 40px rgba(255, 133, 85, 0.25),
			inset 0 0 40px rgba(255, 133, 85, 0.08);
		animation: rotateCircleGlow 30s linear infinite reverse;
		pointer-events: none;
	}

	@keyframes rotateCircleGlow {
		0% {
			transform: rotate(0deg) scale(1);
			opacity: 0.6;
		}
		25% {
			transform: rotate(90deg) scale(1.08);
			opacity: 0.8;
		}
		50% {
			transform: rotate(180deg) scale(1.15);
			opacity: 1;
		}
		75% {
			transform: rotate(270deg) scale(1.08);
			opacity: 0.8;
		}
		100% {
			transform: rotate(360deg) scale(1);
			opacity: 0.6;
		}
	}

	.screenshots-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--spacing-xl);
		margin-top: var(--spacing-2xl);
	}

	.screenshot-item {
		text-align: center;
		padding: var(--spacing-xl);
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		transition: all 0.3s ease;
		overflow: hidden;
	}

	.screenshot-item:hover {
		transform: translateY(-8px);
		box-shadow: 0 12px 32px rgba(255, 107, 53, 0.15);
		border-color: var(--orange-primary);
	}

	.screenshot-btn {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		margin-bottom: var(--spacing-md);
	}

	.screenshot-item img {
		width: 100%;
		height: auto;
		border-radius: var(--radius-md);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: transform 0.3s ease;
		display: block;
	}

	.screenshot-item:hover img {
		transform: scale(1.05);
	}

	.screenshot-item h3 {
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: var(--spacing-sm);
		color: var(--text-primary);
	}

	.screenshot-item p {
		color: var(--text-secondary);
		line-height: 1.6;
		font-size: 0.95rem;
	}

	/* Use Cases Section */
	.use-cases-section {
		padding: 120px 0;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	.use-cases-section::before {
		content: '';
		position: absolute;
		top: 10%;
		left: 50%;
		width: 900px;
		height: 900px;
		margin-left: -450px;
		background: radial-gradient(
			circle,
			rgba(255, 107, 53, 0.15) 0%,
			rgba(255, 133, 85, 0.1) 30%,
			rgba(255, 153, 102, 0.05) 50%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(70px);
		box-shadow:
			0 0 100px rgba(255, 107, 53, 0.2),
			0 0 200px rgba(255, 133, 85, 0.1);
		animation: breatheWave 10s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes breatheWave {
		0%,
		100% {
			transform: scale(0.9) rotate(0deg);
			opacity: 0.7;
		}
		33% {
			transform: scale(1.25) rotate(120deg);
			opacity: 1;
		}
		66% {
			transform: scale(1.1) rotate(240deg);
			opacity: 0.85;
		}
	}

	.use-cases-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--spacing-xl);
		margin-top: var(--spacing-2xl);
	}

	.use-case-card {
		padding: var(--spacing-xl);
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		position: relative;
		transition: all 0.3s ease;
	}

	.use-case-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: var(--orange-primary);
		transform: scaleY(0);
		transform-origin: top;
		transition: transform 0.3s ease;
	}

	.use-case-card:hover::before {
		transform: scaleY(1);
	}

	.use-case-card:hover {
		border-color: var(--orange-primary);
		transform: translateX(8px);
	}

	.use-case-number {
		font-size: 3rem;
		font-weight: 700;
		color: var(--orange-subtle);
		line-height: 1;
		margin-bottom: var(--spacing-md);
		transition: all 0.3s ease;
	}

	.use-case-card:hover .use-case-number {
		color: var(--orange-primary);
		text-shadow:
			0 0 20px rgba(255, 107, 53, 0.8),
			0 0 40px rgba(255, 107, 53, 0.5),
			0 0 60px rgba(255, 107, 53, 0.3);
		transform: scale(1.1);
	}

	.use-case-card h3 {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: var(--spacing-sm);
		color: var(--text-primary);
	}

	.use-case-card p {
		color: var(--text-secondary);
		line-height: 1.6;
	}

	/* Privacy Section */
	.privacy-section {
		padding: 120px 0;
		background: var(--bg-primary);
		position: relative;
		overflow: hidden;
	}

	.privacy-section::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: radial-gradient(
			circle at 30% 50%,
			rgba(255, 107, 53, 0.12) 0%,
			rgba(255, 133, 85, 0.08) 25%,
			transparent 60%
		);
		animation: moveGradientEnhanced 15s ease-in-out infinite;
		pointer-events: none;
	}

	.privacy-section::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 1000px;
		height: 1000px;
		margin-left: -500px;
		margin-top: -500px;
		background: url("data:image/svg+xml,%3Csvg width='1000' height='1000' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='500' cy='500' r='480' fill='none' stroke='rgba(255,107,53,0.15)' stroke-width='3'/%3E%3Ccircle cx='500' cy='500' r='380' fill='none' stroke='rgba(255,133,85,0.12)' stroke-width='2'/%3E%3Ccircle cx='500' cy='500' r='280' fill='none' stroke='rgba(255,153,102,0.1)' stroke-width='2'/%3E%3C/svg%3E");
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		animation: expandRings 12s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes moveGradientEnhanced {
		0%,
		100% {
			background-position: 30% 50%;
			opacity: 0.8;
		}
		33% {
			background-position: 70% 30%;
			opacity: 1;
		}
		66% {
			background-position: 50% 70%;
			opacity: 0.9;
		}
	}

	@keyframes expandRings {
		0%,
		100% {
			transform: scale(0.95) rotate(0deg);
			opacity: 0.6;
		}
		33% {
			transform: scale(1.15) rotate(120deg);
			opacity: 0.9;
		}
		66% {
			transform: scale(1.05) rotate(240deg);
			opacity: 0.75;
		}
	}

	.privacy-content {
		text-align: center;
		max-width: 800px;
		margin: 0 auto;
	}

	.privacy-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: var(--spacing-xl);
		color: var(--orange-primary);
	}

	.privacy-content h2 {
		font-size: clamp(2rem, 4vw, 2.5rem);
		font-weight: 700;
		margin-bottom: var(--spacing-lg);
		color: var(--text-primary);
	}

	.privacy-text {
		font-size: 1.1rem;
		color: var(--text-secondary);
		line-height: 1.7;
		margin-bottom: var(--spacing-2xl);
	}

	.privacy-text strong {
		color: var(--orange-primary);
		font-weight: 600;
	}

	.privacy-features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-xl);
		position: relative;
		z-index: 1;
	}

	.privacy-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-xl);
		background: rgba(45, 45, 45, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		transition:
			transform 0.3s ease,
			border-color 0.3s ease,
			background 0.3s ease;
		position: relative;
		z-index: 1;
	}

	.privacy-item:hover {
		transform: scale(1.05);
		border-color: var(--orange-primary);
		background: rgba(45, 45, 45, 0.8);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.privacy-item :global(svg) {
		transition: transform 0.3s ease;
	}

	.privacy-item:hover :global(svg) {
		color: var(--orange-primary);
		transform: scale(1.1);
	}

	.privacy-item span {
		font-weight: 500;
		color: var(--text-primary);
	}

	/* CTA Section */
	.cta-section {
		padding: 120px 0;
		background: var(--bg-secondary);
		text-align: center;
		border-top: 1px solid var(--border-color);
		position: relative;
		overflow: hidden;
	}

	.cta-section::before {
		content: '';
		position: absolute;
		top: -40%;
		left: 50%;
		width: 1000px;
		height: 1000px;
		margin-left: -500px;
		background: radial-gradient(
			circle,
			rgba(255, 107, 53, 0.2) 0%,
			rgba(255, 133, 85, 0.15) 20%,
			rgba(255, 153, 102, 0.08) 40%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(50px);
		box-shadow:
			0 0 150px rgba(255, 107, 53, 0.3),
			0 0 300px rgba(255, 133, 85, 0.2);
		animation: spotlightDramatic 8s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes spotlightDramatic {
		0%,
		100% {
			transform: translateY(0) scale(1) rotate(0deg);
			opacity: 0.8;
		}
		33% {
			transform: translateY(30px) scale(1.15) rotate(120deg);
			opacity: 1;
		}
		66% {
			transform: translateY(15px) scale(1.05) rotate(240deg);
			opacity: 0.9;
		}
	}

	.cta-title {
		font-size: clamp(2rem, 4vw, 2.5rem);
		font-weight: 700;
		margin-bottom: var(--spacing-md);
	}

	.cta-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		margin-bottom: var(--spacing-xl);
	}

	/* Footer */
	.footer {
		background: var(--bg-elevated);
		border-top: 1px solid var(--border-color);
		padding: var(--spacing-2xl) 0 var(--spacing-lg);
	}

	.footer-content {
		display: grid;
		grid-template-columns: 1fr 3fr;
		gap: var(--spacing-2xl);
		margin-bottom: var(--spacing-xl);
	}

	.footer-brand h3 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--orange-primary);
		margin-bottom: var(--spacing-xs);
	}

	.footer-brand p {
		color: var(--text-tertiary);
	}

	.footer-links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--spacing-xl);
	}

	.footer-column h4 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: var(--spacing-md);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.footer-column a {
		display: block;
		color: var(--text-tertiary);
		text-decoration: none;
		margin-bottom: var(--spacing-sm);
		transition: color var(--transition);
	}

	.footer-column a:hover {
		color: var(--orange-primary);
	}

	.footer-bottom {
		text-align: center;
		padding-top: var(--spacing-lg);
		border-top: 1px solid var(--border-color);
	}

	.footer-bottom p {
		color: var(--text-tertiary);
		font-size: 0.9rem;
		margin: var(--spacing-xs) 0;
	}

	.footer-bottom .build-info {
		font-size: 0.8rem;
		opacity: 0.7;
		margin-top: var(--spacing-sm);
	}

	.footer-bottom a {
		color: var(--orange-primary);
		text-decoration: none;
		transition: color var(--transition);
	}

	.footer-bottom a:hover {
		color: var(--orange-hover);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.hero {
			padding: 100px 0 60px;
		}

		.gradient-orb {
			filter: blur(60px);
			opacity: 0.2;
		}

		.geometric-shapes {
			display: none;
		}

		.scroll-indicator {
			bottom: 30px;
		}

		.hero-title {
			font-size: 2.25rem;
		}

		.title-line-1 {
			font-size: 0.55em;
		}

		.title-line-3 {
			font-size: 0.6em;
		}

		.hero-subtitle {
			font-size: 1rem;
		}

		.btn {
			padding: 12px 24px;
			font-size: 0.9rem;
		}

		.btn-primary {
			padding: 14px 28px;
			font-size: 1rem;
		}

		.hero-features {
			gap: var(--spacing-lg);
			flex-wrap: wrap;
		}

		.ai-section,
		.features-section,
		.screenshots-section,
		.use-cases-section,
		.privacy-section,
		.cta-section {
			padding: 80px 0;
		}

		.features-grid {
			grid-template-columns: 1fr;
		}

		.ai-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.footer-content {
			grid-template-columns: 1fr;
		}

		.footer-links {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.container {
			padding: 0 var(--spacing-md);
		}

		.hero {
			padding: 80px 0 50px;
		}

		.hero-title {
			font-size: 2rem;
		}

		.hero-badge-top {
			font-size: 0.75rem;
			padding: 8px 16px;
		}

		.hero-features {
			gap: var(--spacing-md);
		}

		.hero-feature-item {
			flex-direction: column;
			gap: 4px;
			font-size: 0.85rem;
		}

		.ai-grid {
			grid-template-columns: 1fr;
		}

		.use-case-number {
			font-size: 2.5rem;
		}

		.footer-links {
			grid-template-columns: 1fr;
		}
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: var(--spacing-xl);
		backdrop-filter: blur(8px);
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		position: relative;
		max-width: 80vw;
		max-height: 80vh;
		animation: scaleIn 0.3s ease-out;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.modal-content img {
		max-width: 100%;
		max-height: 80vh;
		width: auto;
		height: auto;
		border-radius: var(--radius-md);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
		display: block;
	}

	.modal-close {
		position: absolute;
		top: -40px;
		right: -40px;
		width: 40px;
		height: 40px;
		border: none;
		background: var(--bg-elevated);
		color: var(--text-primary);
		font-size: 24px;
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
		border: 2px solid var(--border-color);
	}

	.modal-close:hover {
		background: var(--orange-primary);
		color: white;
		transform: rotate(90deg);
		border-color: var(--orange-primary);
	}

	@media (max-width: 768px) {
		.modal-overlay {
			padding: var(--spacing-md);
		}

		.modal-close {
			top: 10px;
			right: 10px;
			width: 36px;
			height: 36px;
			font-size: 20px;
		}

		.modal-content img {
			max-height: 90vh;
		}
	}
</style>
