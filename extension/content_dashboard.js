console.log("Kawayan Dashboard Listener Active (v5)");

// Listen for window messages (works across isolated worlds)
window.addEventListener('message', (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && (event.data.type === 'KAWAYAN_POST_REQUEST' || event.data.type === 'KAWAYAN_UPDATE_STATS')) {
    console.log("Extension received message from Dashboard:", event.data);
    
    // Check if chrome runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
            chrome.runtime.sendMessage(event.data); // Forward the whole event object structure
        } catch (e) {
            console.error("Extension context invalid (Orphaned). Please Refresh the Page.", e);
        }
    }
  }
});

// Listen for messages from background (e.g. Scraper results)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'KAWAYAN_STATS_UPDATED') {
            console.log("Content script received stats:", request.data);
            // Forward to React App
            window.postMessage({ type: 'KAWAYAN_STATS_UPDATED_CLIENT', data: request.data }, '*');
        }

        if (request.type === 'KAWAYAN_POST_SUCCESS_BG') {
            console.log("Content script received post success:", request.data);
            // Forward to React App
            window.postMessage({ type: 'KAWAYAN_POST_SUCCESS_CLIENT', data: request.data }, '*');
        }
    });
}
