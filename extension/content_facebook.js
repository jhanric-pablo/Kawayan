console.log("Kawayan Facebook Injector Active");

chrome.storage.local.get(['pendingPost'], (result) => {
  if (result.pendingPost && result.pendingPost.platform === 'facebook') {
    const post = result.pendingPost;
    
    // Status Box (reused logic basically)
    const box = document.createElement('div');
    box.style.cssText = "position:fixed;bottom:20px;right:20px;background:#1877F2;color:white;padding:15px;border-radius:12px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 15px rgba(0,0,0,0.1);";
    box.innerHTML = `<b>Kawayan AI</b><br/>Waiting for editor...`;
    document.body.appendChild(box);

    const checkInterval = setInterval(() => {
      // Facebook Business Suite / Creator Studio often uses these classes
      // They are dynamic, so looking for 'contenteditable' is safest.
      const editor = document.querySelector('div[contenteditable="true"][role="textbox"]') || 
                     document.querySelector('.notranslate._5rpu') || // Classic FB
                     document.querySelector('div[aria-label="Write a post..."]');

      if (editor) {
        clearInterval(checkInterval);
        box.innerHTML = `<b>Kawayan AI</b><br/>Editor Found! Injecting...`;
        
        editor.focus();
        
        // Construct Full Text (Title + Caption)
        const fullText = (post.title ? `${post.title}\n\n` : '') + post.caption;

        try {
          const success = document.execCommand('insertText', false, fullText);
          if (!success) {
            // Fallback for some React editors
             // This is hacky but often needed for FB
             const dataTransfer = new DataTransfer();
             dataTransfer.setData('text/plain', fullText);
             const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true });
             editor.dispatchEvent(pasteEvent);
          }
          box.innerHTML = `<b>Kawayan AI</b><br/>Done! Click "Publish" below.`;
          
          // DO NOT remove pendingPost yet, we want to monitor for success
          // chrome.storage.local.remove('pendingPost');

          monitorForSuccess(post, box);
        } catch (e) {
          box.innerHTML = `<b>Kawayan AI</b><br/>Injection Failed. Copy/Paste manually.`;
        }
      }
    }, 1000);

    setTimeout(() => clearInterval(checkInterval), 60000);
  }
});

function monitorForSuccess(post, box) {
  console.log("Kawayan: Waiting for user to click Publish...");
  
  let publishClicked = false;

  // 1. Global Click Listener for maximum reliability
  const globalClickListener = (e) => {
    const target = e.target;
    const text = target.innerText || target.textContent || "";
    const isPublishText = /Publish|Post|Share/i.test(text) && text.length < 15;
    
    // Check for the specific classes or text provided by user
    const hasUserClasses = target.classList.contains('x1vvvo52') || target.closest('.x1i10hfl');

    if (isPublishText || hasUserClasses) {
      console.log("Kawayan: Publish click detected via global listener!");
      publishClicked = true;
      box.innerHTML = `<b>Kawayan AI</b><br/>Publishing...`;
      window.removeEventListener('click', globalClickListener, true);
    }
  };
  window.addEventListener('click', globalClickListener, true);

  // 2. Interval-based tracker as backup
  const publishButtonSelectors = [
    'div[aria-label="Publish"]',
    'div[aria-label="Post"]',
    'div[aria-label="Share"]',
    '.x1vvvo52', // The class the user provided
    '.x1i10hfl', 
    'button[type="submit"]'
  ];

  const clickTracker = setInterval(() => {
    publishButtonSelectors.forEach(selector => {
      const btn = document.querySelector(selector);
      if (btn && !btn.hasAttribute('data-kawayan-tracked')) {
        btn.setAttribute('data-kawayan-tracked', 'true');
        btn.addEventListener('click', () => {
          console.log("Kawayan: Publish button clicked via direct listener!");
          publishClicked = true;
          box.innerHTML = `<b>Kawayan AI</b><br/>Publishing...`;
        });
      }
    });

    // If we've been waiting too long without a click, but success text appears,
    // we should trust the success text (maybe user used a keyboard shortcut)
  }, 1000);

  // 3. Monitor for success indicators
  const observer = new MutationObserver((mutations) => {
    const bodyText = document.body.innerText;
    const successIndicators = [
      "Post published",
      "Your post is now live",
      "Successfully published",
      "Post shared",
      "Post Scheduled"
    ];

    const hasSuccess = successIndicators.some(text => bodyText.includes(text));

    // We trigger success if clicked OR if success text appears while we are in this state
    if (hasSuccess && (publishClicked || bodyText.includes("View post"))) {
      clearInterval(clickTracker);
      window.removeEventListener('click', globalClickListener, true);
      handleSuccess(post, box, observer);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Fallback: Check for URL changes
  const urlCheck = setInterval(() => {
    if (publishClicked && !window.location.href.includes('composer')) {
      clearInterval(clickTracker);
      window.removeEventListener('click', globalClickListener, true);
      handleSuccess(post, box, observer);
      clearInterval(urlCheck);
    }
  }, 2000);
}

function handleSuccess(post, box, observer) {
  if (box.getAttribute('data-kawayan-success') === 'true') return;
  box.setAttribute('data-kawayan-success', 'true');

  observer.disconnect();
  box.style.background = "#34d399";
  box.innerHTML = `<b>Kawayan AI</b><br/>✅ Post Successful! Syncing...`;
  
  const postData = {
    postId: post.id,
    platform: 'facebook',
    status: 'Published',
    link: window.location.href
  };

  chrome.runtime.sendMessage({ type: 'KAWAYAN_POST_SUCCESS', data: postData });
  chrome.storage.local.remove('pendingPost');
  
  // Close tab after a short delay
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'KAWAYAN_CLOSE_TAB' });
  }, 3000);
}
