// content_facebook_insights.js
console.log("Kawayan Insights Scraper Active");

// Helper to show overlay
function showScrapingOverlay() {
  if (document.getElementById('kawayan-scraping-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'kawayan-scraping-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
  overlay.style.color = '#fff';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontFamily = 'system-ui, sans-serif';

  overlay.innerHTML = `
    <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">🎋 Kawayan AI: Syncing Data...</div>
    <div id="kawayan-step" style="font-size: 16px; color: #aaa;">Scanning Meta Business Suite...</div>
    <div class="kawayan-spinner" style="margin-top: 30px; width: 40px; height: 40px; border: 4px solid #333; border-top: 4px solid #10b981; border-radius: 50%;"></div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .kawayan-spinner { animation: spin 1s linear infinite; }
    </style>
  `;

  document.body.appendChild(overlay);
}

function updateOverlayStep(text) {
  const el = document.getElementById('kawayan-step');
  if (el) el.innerText = text;
}

// Scrape logic
async function scrapeInsights() {
  let attempts = 0;
  const maxAttempts = 15;
  
  const checkData = setInterval(() => {
    attempts++;
    updateOverlayStep(`Extracting metrics (Attempt ${attempts}/${maxAttempts})...`);
    
    // Heuristic: Meta Business Suite uses specific labels and then the value.
    const bodyText = document.body.innerText;
    
    // Extract metrics using multiple possible patterns
    const followers = extractMetric(bodyText, ["Followers", "Facebook Page followers", "Page followers"]);
    const views = extractMetric(bodyText, ["Views", "Video views", "Page views"]);
    const viewers = extractMetric(bodyText, ["Viewers"]);
    const interactions = extractMetric(bodyText, ["Interactions", "Content interactions"]);
    const visits = extractMetric(bodyText, ["Visits", "Facebook visits"]);
    const follows = extractMetric(bodyText, ["Follows"]);
    const unfollows = extractMetric(bodyText, ["Unfollows"]);
    const netFollows = extractMetric(bodyText, ["Net follows"]);
    
    // Check if we found data or reached max attempts
    if (views > 0 || visits > 0 || followers > 0 || attempts >= maxAttempts) {
      clearInterval(checkData);
      
      const stats = {
        platform: 'facebook',
        followers: followers,
        views: views,
        viewers: viewers,
        interactions: interactions,
        visits: visits,
        follows: follows,
        unfollows: unfollows,
        netFollows: netFollows,
        scrapedAt: new Date().toISOString()
      };
      
      console.log("Kawayan: Scraped Stats:", stats);
      
      // Send back to background
      chrome.runtime.sendMessage({
        type: 'KAWAYAN_STATS_SCRAPED',
        data: stats
      });
      
      const overlay = document.getElementById('kawayan-scraping-overlay');
      if (overlay) {
        overlay.innerHTML = `
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">✅ Sync Complete!</div>
          <div style="margin-top: 10px; color: #fff;">${followers.toLocaleString()} Followers, ${reach.toLocaleString()} Reach</div>
          <div style="margin-top: 5px; color: #aaa; font-size: 14px;">Closing tab and returning to dashboard...</div>
        `;
      }
    }
  }, 2000);
}

function extractMetric(text, labels) {
  for (const label of labels) {
    // Regex explanation: Look for the label, followed by some whitespace/newlines, 
    // maybe a small amount of intermediate text, then a number (possibly with K/M/B or commas)
    // We use a more flexible regex to handle the complex layout of MBS
    const regex = new RegExp(`${label}[\\s\\S]{1,100}?([\\d,.]+[KMB]?)`, 'i');
    const match = text.match(regex);
    if (match) {
      const val = parseSocialNumber(match[1]);
      if (val > 0) return val;
    }
  }
  return 0;
}

function parseSocialNumber(str) {
  if (!str) return 0;
  // Clean string: remove commas, convert to upper for K/M/B
  str = str.toUpperCase().replace(/,/g, '');
  
  // Handle cases where there might be multiple decimal points from messy scraping
  const parts = str.match(/([\d.]+)([KMB]?)/);
  if (!parts) return 0;
  
  let num = parseFloat(parts[1]);
  const suffix = parts[2];
  
  if (suffix === 'K') num *= 1000;
  else if (suffix === 'M') num *= 1000000;
  else if (suffix === 'B') num *= 1000000000;
  
  return Math.floor(num);
}

// Initial Trigger
if (window.location.href.includes('business.facebook.com/latest/insights')) {
  showScrapingOverlay();
  // Wait for React to hydrate
  setTimeout(scrapeInsights, 3000);
}


function parseSocialNumber(str) {
  if (!str) return 0;
  str = str.toUpperCase().replace(/,/g, '');
  let multiplier = 1;
  if (str.includes('K')) multiplier = 1000;
  if (str.includes('M')) multiplier = 1000000;
  if (str.includes('B')) multiplier = 1000000000;
  
  return parseFloat(str.replace(/[KMB]/g, '')) * multiplier;
}

// Check if we should run
// We only run if the URL looks like insights overview
if (window.location.href.includes('business.facebook.com/latest/insights/overview')) {
  showScrapingOverlay();
  window.addEventListener('load', scrapeInsights);
  // Also run immediately just in case load already fired
  scrapeInsights();
}
