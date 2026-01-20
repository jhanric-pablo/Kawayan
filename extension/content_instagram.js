console.log("Kawayan Instagram Injector Active");

chrome.storage.local.get(['pendingPost'], (result) => {
  if (result.pendingPost && result.pendingPost.platform === 'instagram') {
    const post = result.pendingPost;
    
    const box = document.createElement('div');
    box.style.cssText = "position:fixed;bottom:20px;right:20px;background:#E1306C;color:white;padding:15px;border-radius:12px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 15px rgba(0,0,0,0.1);";
    box.innerHTML = `<b>Kawayan AI</b><br/>Click (+) Create to start...`;
    document.body.appendChild(box);

    const checkInterval = setInterval(() => {
      // Instagram Web Create Modal
      // We look for the caption area which appears AFTER selecting an image/filter
      const editor = document.querySelector('div[contenteditable="true"][aria-label="Write a caption..."]') || 
                     document.querySelector('textarea[aria-label="Write a caption..."]');

      if (editor) {
        // Only inject if empty
        if (editor.innerText.trim() === '') {
             clearInterval(checkInterval);
             box.innerHTML = `<b>Kawayan AI</b><br/>Injecting Caption...`;
             
             editor.focus();
             // User requested caption only for Instagram
             const fullText = post.caption;
             document.execCommand('insertText', false, fullText);
             
             box.innerHTML = `<b>Kawayan AI</b><br/>Caption Filled! Click Share.`;
             // chrome.storage.local.remove('pendingPost');

             monitorInstaSuccess(post, box);
        }
      }
    }, 1000);

    setTimeout(() => clearInterval(checkInterval), 120000); // Wait longer for Insta (user workflow is slower)
  }
});

function monitorInstaSuccess(post, box) {
  const observer = new MutationObserver((mutations) => {
    const bodyText = document.body.innerText;
    if (bodyText.includes("Your post has been shared") || bodyText.includes("Post shared")) {
      observer.disconnect();
      box.style.background = "#34d399";
      box.innerHTML = `<b>Kawayan AI</b><br/>✅ Shared! Saving...`;

      const postData = {
        postId: post.id,
        platform: 'instagram',
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
