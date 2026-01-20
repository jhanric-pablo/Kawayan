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
    console.log("Opening Insights for scraping:", request.platform, request.username);
    
    let url = '';
    if (request.platform === 'facebook') {
      url = 'https://business.facebook.com/latest/insights/overview/?business_id=712593713218711&asset_id=721534924910770';
    } else if (request.platform === 'instagram') {
      if (!request.username) { console.error("Username required for IG scrape"); return; }
      url = `https://www.instagram.com/${request.username}/?kawayan_action=scrape`;
    } else if (request.platform === 'tiktok') {
      if (!request.username) { console.error("Username required for TikTok scrape"); return; }
      const handle = request.username.startsWith('@') ? request.username : `@${request.username}`;
      url = `https://www.tiktok.com/${handle}?kawayan_action=scrape`;
    }

    if (url) {
      chrome.tabs.create({ url: url, active: true }, (tab) => {
        if (!tab || !tab.id) return;
        
        // Listener to trigger scrape when loaded
        const listener = (tabId, changeInfo, tabInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            console.log("Tab loaded, sending scrape command...", tabId);
            
            // Wait a moment for framework hydration
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { type: 'KAWAYAN_CMD_SCRAPE' })
                  .catch(err => console.log("Failed to send scrape cmd (script might not be ready):", err));
            }, 2000);

            // Remove listener after triggering
            chrome.tabs.onUpdated.removeListener(listener);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
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

  // 4. Post Success Confirmation (From Content Script)
  if (request.type === 'KAWAYAN_POST_SUCCESS') {
    console.log("Post Success confirmed:", request.data);
    
    // Broadcast to Dashboard
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.includes('localhost') || tab.url.includes('github.dev'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'KAWAYAN_POST_SUCCESS_BG',
            data: request.data
          });
        }
      });
    });
  }

  // 5. Close Tab Request
  if (request.type === 'KAWAYAN_CLOSE_TAB') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
});