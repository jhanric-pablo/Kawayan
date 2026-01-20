// content_instagram_insights.js
console.log("Kawayan IG Scraper Loaded");

// Listen for command from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'KAWAYAN_CMD_SCRAPE') {
        console.log("Received Scrape Command");
        showOverlay();
        // Allow DOM to settle slightly if just loaded
        setTimeout(scrapeIG, 2000);
    }
});

// Also keep URL check just in case it survives
if (location.href.includes('kawayan_action=scrape')) {
    console.log("URL Param Detected");
    showOverlay();
    setTimeout(scrapeIG, 3000);
}

function showOverlay() {
    // Check if exists
    if (document.getElementById('kawayan-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'kawayan-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999999;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;pointer-events:none;';
    overlay.innerHTML = `
        <h2 style="font-size:24px;margin-bottom:10px">Kawayan AI</h2>
        <p style="font-size:16px">Fetching Instagram Stats...</p>
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
    return parseFloat(str) * multiplier;
}

function scrapeIG() {
    console.log("Scraping IG Logic...");
    
    // 1. Meta Tags (Most Reliable for Public Profiles)
    // <meta property="og:description" content="100 Followers, 50 Following, 10 Posts ...">
    const metaDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    
    let followers = 0;
    let following = 0;
    let posts = 0;

    if (metaDesc) {
        console.log("Found Meta Desc:", metaDesc);
        const followersMatch = metaDesc.match(/([\d,.]+[KMB]?)\s+Followers/i);
        const followingMatch = metaDesc.match(/([\d,.]+[KMB]?)\s+Following/i);
        const postsMatch = metaDesc.match(/([\d,.]+[KMB]?)\s+Posts/i);

        if (followersMatch) followers = parseNumber(followersMatch[1]);
        if (followingMatch) following = parseNumber(followingMatch[1]);
        if (postsMatch) posts = parseNumber(postsMatch[1]);
    } else {
        // 2. DOM Fallback (Classes change, so look for text content logic)
        console.log("Meta missing, trying DOM scan...");
        // Look for common structure: header containing numbers
        const spans = Array.from(document.querySelectorAll('span'));
        
        // Find span containing "followers" then find the number before it? 
        // Or specific title attributes often used for exact numbers
        
        // Try finding links with 'followers' in href
        const links = Array.from(document.querySelectorAll('a'));
        const followersLink = links.find(l => l.href.includes('followers'));
        const followingLink = links.find(l => l.href.includes('following'));
        
        if (followersLink) {
            // Usually the span inside the link or the text content
            const numSpan = followersLink.querySelector('span');
            followers = parseNumber(numSpan ? numSpan.innerText : followersLink.innerText);
        }
        
        if (followingLink) {
            const numSpan = followingLink.querySelector('span');
            following = parseNumber(numSpan ? numSpan.innerText : followingLink.innerText);
        }
    }

    const stats = {
        platform: 'instagram',
        followers: followers,
        following: following,
        posts: posts,
        engagement: 0 
    };

    console.log("Scraped Data:", stats);

    if (stats.followers > 0 || stats.following > 0) {
        // Show success on overlay
        const overlay = document.getElementById('kawayan-overlay');
        if (overlay) overlay.innerHTML = '<h2 style="color:#10b981">Success!</h2><p>Closing tab...</p>';
        
        chrome.runtime.sendMessage({
            type: 'KAWAYAN_STATS_SCRAPED',
            data: stats
        });
    } else {
        console.error("Failed to find stats");
        // Retry once?
        if (!window.hasRetried) {
            window.hasRetried = true;
            setTimeout(scrapeIG, 2000);
        } else {
             const overlay = document.getElementById('kawayan-overlay');
             if (overlay) overlay.innerHTML = '<h2 style="color:red">Failed</h2><p>Could not read stats.</p>';
        }
    }
}