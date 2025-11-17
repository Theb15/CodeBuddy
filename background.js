// Background service worker for Code Buddy

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Code Buddy installed successfully!');
    
    // Open settings page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
  } else if (details.reason === 'update') {
    console.log('Code Buddy updated to version:', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get(['apiProvider', 'groqKey', 'geminiKey'], (result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Inject content script if not already injected
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).catch((error) => {
    console.error('Failed to inject content script:', error);
  });
});
