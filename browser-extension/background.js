const CLIENT_LOCKER_PORT = 4000;
const REPORT_URL = `http://127.0.0.1:${CLIENT_LOCKER_PORT}/report`;

function parseSearchQuery(urlStr) {
    try {
        const url = new URL(urlStr);
        // Common search parameters
        const searchParams = ['q', 'p', 'query', 'search_query', 'text'];

        for (const param of searchParams) {
            if (url.searchParams.has(param)) {
                return url.searchParams.get(param);
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}

async function reportToClientLocker(data) {
    try {
        await fetch(REPORT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            // Don't wait long, fail fast if ClientLocker is not running
            signal: AbortSignal.timeout(1000)
        });
    } catch (e) {
        // Silent fail if local client isn't listening
        console.log("Could not report to ClientLocker", e);
    }
}

// Listen for navigations to capture search queries even in Incognito/DuckDuckGo
chrome.webNavigation.onCompleted.addListener((details) => {
    // Only care about main frame navigations
    if (details.frameId !== 0) return;

    const url = details.url;
    if (url.startsWith('chrome://') || url.startsWith('edge://')) return;

    const searchQuery = parseSearchQuery(url);

    // Always report the domain
    try {
        const domain = new URL(url).hostname;

        reportToClientLocker({
            type: 'navigation',
            url: url,
            domain: domain,
            searchQuery: searchQuery,
            incognito: false // Manifest V3 extensions in Incognito can't reliably read this property from details directly, it's tied to the tab. So we just assume it's browser data.
        });
    } catch (e) { }
});

// Also monitor tab updates for title changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const domain = new URL(tab.url).hostname;
            const searchQuery = parseSearchQuery(tab.url);
            reportToClientLocker({
                type: 'tab_update',
                title: tab.title || domain,
                url: tab.url,
                domain: domain,
                searchQuery: searchQuery
            });
        } catch (e) { }
    }
});
