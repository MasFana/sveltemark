// SSR dynamic with client-side hydration
export const ssr = true;
export const csr = true;

interface PageData {
    currentYear: number;
    publishDate: string;
    modifiedDate: string;
    version: string;
    buildTime: string;
}

export function load(): PageData {
    // Static initial publish date (when the app was first released)
    const publishDate = '2024-12-01T00:00:00Z';

    // Use build-time constants injected by Vite
    // These are replaced at build time, so the build is always "latest"
    const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString();
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0';

    return {
        currentYear: new Date(buildDate).getFullYear(),
        publishDate,
        modifiedDate: buildDate,
        version,
        buildTime: buildDate
    };
}
