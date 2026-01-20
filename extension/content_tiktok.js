console.log("Kawayan TikTok Injector Active (v5)");

// Create a visual status indicator
function createStatusBox() {
  const box = document.createElement('div');
  box.id = 'kawayan-status-box';
  box.style.position = 'fixed';
  box.style.bottom = '20px';
  box.style.right = '20px';
  box.style.backgroundColor = '#1e293b'; // Slate 800
  box.style.color = 'white';
  box.style.padding = '15px';
  box.style.borderRadius = '12px';
  box.style.zIndex = '999999';
  box.style.fontFamily = 'sans-serif';
  box.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
  box.style.maxWidth = '300px';
  box.style.transition = 'all 0.3s ease';
  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
      <span style="font-size:20px;">🎋</span>
      <span style="font-weight:bold;">Kawayan Auto-Poster</span>
    </div>
    <div id="kawayan-status-text" style="font-size:13px; color:#cbd5e1;">Initializing...</div>
  `;
  document.body.appendChild(box);
  return box;
}

function updateStatus(text, color = '#cbd5e1') {
  const el = document.getElementById('kawayan-status-text');
  if (el) {
    el.innerText = text;
    el.style.color = color;
  }
}

// Main Logic
chrome.storage.local.get(['pendingPost'], (result) => {
  if (result.pendingPost && result.pendingPost.platform === 'tiktok') {
    const post = result.pendingPost;
    console.log("Found pending post for TikTok:", post);
    
    createStatusBox();
    updateStatus("Waiting for you to upload a video...");

    let attempts = 0;
    const maxAttempts = 600; // 10 minutes

    const injectorInterval = setInterval(() => {
      attempts++;
      
      // 1. Check if we are on the upload page
      if (!window.location.href.includes('upload') && !window.location.href.includes('tiktokstudio')) {
        return; // Just wait
      }

      // 2. Look for the editor
      // TikTok Studio uses DraftJS. The class is often `public-DraftEditor-content` or similar.
      // We look for the `contenteditable` div.
      const editor = document.querySelector('.public-DraftEditor-content') || 
                     document.querySelector('div[contenteditable="true"]') ||
                     document.querySelector('[data-contents="true"]');

      if (editor) {
        // Only inject if empty (or contains default placeholder logic, though hard to detect)
        // Check if we already injected to avoid loops
        if (editor.getAttribute('data-kawayan-injected') === 'true') {
             updateStatus("Caption injected! Ready to post.", '#34d399');
             clearInterval(injectorInterval);
             chrome.storage.local.remove('pendingPost');
             return;
        }

        console.log("Editor found!", editor);
        updateStatus("Editor detected! Injecting caption...", '#60a5fa');

        // Focus and Clear (if needed)
        editor.focus();

        // 3. Inject Text
        try {
          // User requested caption only for TikTok
          const fullText = post.caption;
          
          // Clear existing text (like auto-filled filenames)
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);

          // This simulates a user typing/pasting
          const success = document.execCommand('insertText', false, fullText);
          
          if (success) {
            editor.setAttribute('data-kawayan-injected', 'true');
            updateStatus("✨ Caption Auto-Filled! Click Post to finish.", '#34d399');
            
            // Highlight it visually
            editor.style.outline = "2px solid #10b981";
            setTimeout(() => editor.style.outline = "none", 2000);
            
            clearInterval(injectorInterval);
            // chrome.storage.local.remove('pendingPost'); // Keep it to monitor success
            
            monitorTikTokSuccess(post);
          } else {
            console.warn("execCommand returned false");
            // Retry next tick?
          }
        } catch (e) {
          console.error("Injection failed", e);
          updateStatus("Injection failed. Please copy/paste manually.", '#f87171');
        }
      } else {
        // Still waiting for upload
        if (attempts % 5 === 0) { // Update text occasionally to show life
           updateStatus("Please upload your video file to continue...");
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(injectorInterval);
        updateStatus("Timed out. Reload to try again.", '#f87171');
      }

    }, 1000);
  }
});

function monitorTikTokSuccess(post) {
  console.log("Kawayan: Monitoring for TikTok post success...");
  
  const observer = new MutationObserver((mutations) => {
    const bodyText = document.body.innerText;
    // TikTok success indicators
    if (bodyText.includes("Your video is being processed") || 
        bodyText.includes("Post uploaded") || 
        bodyText.includes("Manage your posts") ||
        window.location.href.includes("post-success")) {
      
      observer.disconnect();
      updateStatus("✅ Post Successful! Saving...", '#34d399');

      const postData = {
        postId: post.id,
        platform: 'tiktok',
        status: 'Published',
        link: window.location.href
      };

      chrome.runtime.sendMessage({ type: 'KAWAYAN_POST_SUCCESS', data: postData });
      chrome.storage.local.remove('pendingPost');

      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'KAWAYAN_CLOSE_TAB' });
      }, 3000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
