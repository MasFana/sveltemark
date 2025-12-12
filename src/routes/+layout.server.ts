import type { LayoutServerLoad } from './$types';

// Server-side load function for global data
// This is compatible with prerendering and will be cached by the service worker
export const load: LayoutServerLoad = async () => {
    const now = new Date();

    return {
        buildTimestamp: now.toISOString(),
        serverTime: now.getTime()
    };
};
