// content_facebook_insights.js
console.log("Kawayan Insights Scraper Active");

// Helper to show overlay
function showScrapingOverlay() {
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
    <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">Checking Data...</div>
    <div style="font-size: 16px; color: #aaa;">Please wait while we fetch your insights.</div>
    <div class="kawayan-spinner" style="margin-top: 30px; width: 40px; height: 40px; border: 4px solid #333; border-top: 4px solid #10b981; border-radius: 50%;"></div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .kawayan-spinner { animation: spin 1s linear infinite; }
    </style>
  `;

  document.body.appendChild(overlay);
}

// Scrape logic
async function scrapeInsights() {
  // Wait for elements to load. This is tricky with SPA/React apps like FB.
  // We'll look for specific metric containers.
  
  // Disclaimer: FB Business Suite DOM is heavily obfuscated and changes. 
  // This is a heuristic attempt based on typical "Reach" or "Followers" labels.
  
  // Let's try to find text like "Facebook Page reach" or "Instagram Reach" and the numbers near it.
  
  let attempts = 0;
  const maxAttempts = 10;
  
  const checkData = setInterval(() => {
    attempts++;
    console.log(`Scanning for insights (Attempt ${attempts})...`);
    
    // Fallback: Just grab the whole text and use Regex if specific selectors fail
    const bodyText = document.body.innerText;
    
    // Look for Reach
    // Pattern: "Reach" ... number
    const reachMatch = bodyText.match(/Reach[\s\S]{1,50}?([\d,]+[KMB]?)/i);
    const followersMatch = bodyText.match(/Followers[\s\S]{1,50}?([\d,]+[KMB]?)/i) || 
                           bodyText.match(/Likes[\s\S]{1,50}?([\d,]+[KMB]?)/i); // FB Page Likes often proxy for followers
                           
    if (reachMatch || followersMatch || attempts >= maxAttempts) {
      clearInterval(checkData);
      
      const stats = {
        platform: 'facebook', // Defaulting to FB, could infer from URL
        followers: followersMatch ? parseSocialNumber(followersMatch[1]) : 0,
        reach: reachMatch ? parseSocialNumber(reachMatch[1]) : 0,
        engagement: 0 // Hard to scrape aggregate engagement easily, setting 0
      };
      
      console.log("Scraped Stats:", stats);
      
      // Send back to background
      chrome.runtime.sendMessage({
        type: 'KAWAYAN_STATS_SCRAPED',
        data: stats
      });
      
      // Update overlay
      const overlay = document.getElementById('kawayan-scraping-overlay');
      if (overlay) {
        overlay.innerHTML = `
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">Done!</div>
          <div style="margin-top: 10px;">Closing tab...</div>
        `;
      }
    }
  }, 2000); // Check every 2 seconds
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
