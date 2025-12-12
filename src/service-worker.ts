/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `sveltemark-cache-${version}`;

// All assets to cache - the app itself, static files, and prerendered pages
const ASSETS = [
    ...build,       // the app itself (JS, CSS bundles)
    ...files,       // everything in `static` folder
    ...prerendered  // prerendered pages (the index.html)
];

// Install event - cache all assets immediately
self.addEventListener('install', (event) => {
    async function addFilesToCache() {
        const cache = await caches.open(CACHE);

        // Cache assets individually to handle failures gracefully
        // (addAll fails if ANY request fails)
        await Promise.all(
            ASSETS.map(async (asset) => {
                try {
                    const response = await fetch(asset);
                    if (response.ok) {
                        await cache.put(asset, response);
                    }
                } catch {
                    // Ignore individual fetch failures
                    console.warn(`Failed to cache: ${asset}`);
                }
            })
        );

        // Also explicitly cache the root and app routes for navigation fallback
        try {
            const indexResponse = await fetch('/');
            if (indexResponse.ok) {
                await cache.put('/', indexResponse.clone());
                await cache.put('/index.html', indexResponse.clone());
            }

            // Cache the /app route as well for proper offline support
            const appResponse = await fetch('/app');
            if (appResponse.ok) {
                await cache.put('/app', appResponse.clone());
            }
        } catch {
            // Ignore fetch errors during install
        }

        // Take over immediately
        await self.skipWaiting();
    }

    event.waitUntil(addFilesToCache());
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
    async function deleteOldCaches() {
        for (const key of await caches.keys()) {
            if (key !== CACHE) await caches.delete(key);
        }
        // Take control of all pages immediately
        await self.clients.claim();
    }

    event.waitUntil(deleteOldCaches());
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Ignore non-GET requests
    if (event.request.method !== 'GET') return;

    async function respond(): Promise<Response> {
        const url = new URL(event.request.url);
        const cache = await caches.open(CACHE);

        // For build/static assets, always serve from cache first (cache-first strategy)
        if (ASSETS.includes(url.pathname)) {
            const cachedResponse = await cache.match(url.pathname);
            if (cachedResponse) {
                return cachedResponse;
            }
        }

        // For navigation requests (HTML pages), use cache-first with network fallback
        if (event.request.mode === 'navigate') {
            // First try exact match
            let cachedResponse = await cache.match(event.request);

            // If no exact match, try the URL pathname
            if (!cachedResponse) {
                cachedResponse = await cache.match(url.pathname);
            }

            // If we have a cached response, return it and update in background
            if (cachedResponse) {
                // Also try to update in background (stale-while-revalidate)
                fetch(event.request).then(response => {
                    if (response.status === 200) {
                        cache.put(event.request, response.clone());
                        cache.put(url.pathname, response.clone());
                    }
                }).catch(() => {/* ignore network errors */ });
                return cachedResponse;
            }
        }

        // For everything else, try network first, fallback to cache
        try {
            const response = await fetch(event.request);

            // Validate response
            if (!(response instanceof Response)) {
                throw new Error('Invalid response from fetch');
            }

            // Cache successful responses
            if (response.status === 200) {
                cache.put(event.request, response.clone());
            }

            return response;
        } catch (err) {
            // Network failed, try cache
            const cachedResponse = await cache.match(event.request);

            if (cachedResponse) {
                return cachedResponse;
            }

            // For navigation requests, return cached page as fallback
            if (event.request.mode === 'navigate') {
                // Try to match the exact pathname first
                const pathname = url.pathname;
                const pathnameResponse = await cache.match(pathname);
                if (pathnameResponse) {
                    return pathnameResponse;
                }

                // Fall back to root if no specific route is cached
                const indexResponse = await cache.match('/');
                if (indexResponse) {
                    return indexResponse;
                }
            }

            // Nothing in cache, throw error
            throw err;
        }
    }

    event.respondWith(respond());
});
