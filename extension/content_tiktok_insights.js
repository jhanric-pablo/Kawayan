// content_tiktok_insights.js
console.log("Kawayan TikTok Scraper Loaded");

// Listen for command from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'KAWAYAN_CMD_SCRAPE') {
        console.log("Received Scrape Command");
        showOverlay();
        setTimeout(scrapeTikTok, 2000);
    }
});

// URL Param Check
if (location.href.includes('kawayan_action=scrape')) {
    showOverlay();
    setTimeout(scrapeTikTok, 3000); 
}

function showOverlay() {
    if (document.getElementById('kawayan-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'kawayan-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999999;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;pointer-events:none;';
    overlay.innerHTML = `
        <h2 style="font-size:24px;margin-bottom:10px">Kawayan AI</h2>
        <p style="font-size:16px">Fetching TikTok Stats...</p>
        <div style="margin-top:20px;width:30px;height:30px;border:3px solid #333;border-top:3px solid #10b981;border-radius:50%;animation:spin 1s linear infinite"></div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
}

function parseNumber(str) {
    if (!str) return 0;
    str = str.replace(/,/g, '');
    let multiplier = 1;
    if (str.includes('K') || str.includes('k')) multiplier = 1000;
    if (str.includes('M') || str.includes('m')) multiplier = 1000000;
    if (str.includes('B') || str.includes('b')) multiplier = 1000000000;
    return parseFloat(str) * multiplier;
}

function scrapeTikTok() {
    console.log("Scraping TikTok...");
    
    // Stable selectors for TikTok Profile
    // <strong title="Followers" data-e2e="followers-count">100</strong>
    const followersEl = document.querySelector('[data-e2e="followers-count"]');
    const followingEl = document.querySelector('[data-e2e="following-count"]');
    const likesEl = document.querySelector('[data-e2e="likes-count"]');

    const stats = {
        platform: 'tiktok',
        followers: followersEl ? parseNumber(followersEl.innerText) : 0,
        following: followingEl ? parseNumber(followingEl.innerText) : 0,
        likes: likesEl ? parseNumber(likesEl.innerText) : 0,
        engagement: 0 
    };

    console.log("TikTok Stats:", stats);

    if (stats.followers > 0 || stats.likes > 0) {
        const overlay = document.getElementById('kawayan-overlay');
        if (overlay) overlay.innerHTML = '<h2 style="color:#10b981">Success!</h2><p>Closing tab...</p>';

        chrome.runtime.sendMessage({
            type: 'KAWAYAN_STATS_SCRAPED',
            data: stats
        });
    } else {
        // Retry
        if (!window.hasRetried) {
            window.hasRetried = true;
            setTimeout(scrapeTikTok, 2000);
        }
    }
}