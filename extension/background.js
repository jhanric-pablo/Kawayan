// Listen for messages from the dashboard content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Post Request
  if (request.type === 'KAWAYAN_POST_REQUEST') {
    console.log("Background received post request:", request.data);

    // Store the data
    chrome.storage.local.set({ 'pendingPost': request.data }, () => {
      // Open the target social media tab
      let url = '';
      if (request.data.platform === 'tiktok') {
        url = 'https://www.tiktok.com/tiktokstudio/upload?lang=en';
      } else if (request.data.platform === 'facebook') {
        // Facebook Creator Studio or Business Suite is complex. 
        // Let's try the standard page composer if possible, or Business Suite.
        // Business Suite is usually: https://business.facebook.com/latest/composer
        url = 'https://business.facebook.com/latest/composer';
      } else if (request.data.platform === 'instagram') {
        // Instagram Web Create
        url = 'https://www.instagram.com/';
      }

      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
  }

  // 2. Update Stats Request (From Dashboard)
  if (request.type === 'KAWAYAN_UPDATE_STATS') {
    console.log("Opening Insights for scraping:", request.platform);
    if (request.platform === 'facebook' || request.platform === 'instagram') {
      // Meta Business Suite handles both
      const url = 'https://business.facebook.com/latest/insights/overview/';
      chrome.tabs.create({ url: url, active: true });
    }
  }

  // 3. Stats Scraped (From Content Script)
  if (request.type === 'KAWAYAN_STATS_SCRAPED') {
    console.log("Stats received:", request.data);
    
    // Save to storage
    chrome.storage.local.set({ 'latestStats': request.data }, () => {
      // Close the scraping tab
      if (sender.tab && sender.tab.id) {
        setTimeout(() => {
          chrome.tabs.remove(sender.tab.id);
        }, 1000); // Small delay to show "Done"
      }

      // Broadcast to Dashboard
      // Find tabs matching dashboard URL patterns
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && (tab.url.includes('localhost') || tab.url.includes('github.dev'))) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'KAWAYAN_STATS_UPDATED',
              data: request.data
            });
          }
        });
      });
    });
  }
});