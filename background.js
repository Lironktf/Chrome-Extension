// Background script for Page Position Bookmarks extension

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'saveBookmark') {
    console.log('Saving bookmark:', request.data);
    const tabId = request.tabId || sender?.tab?.id;
    saveBookmark(request.data, tabId);
    sendResponse({ success: true });
  } else if (request.action === 'getBookmarks') {
    const url = request.url || sender?.tab?.url;
    console.log('Getting bookmarks for URL:', url);
    getBookmarks(url).then(bookmarks => {
      console.log('Retrieved bookmarks:', bookmarks);
      sendResponse({ bookmarks });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'deleteBookmark') {
    const url = request.url || sender?.tab?.url;
    console.log('Deleting bookmark:', request.bookmarkId, 'for URL:', url);
    deleteBookmark(request.bookmarkId, url);
    sendResponse({ success: true });
  } else if (request.action === 'jumpToBookmark') {
    console.log('Jumping to bookmark position:', request.scrollPosition);
    jumpToBookmark(request.scrollPosition, sender.tab.id);
    sendResponse({ success: true });
  }
});

// Save bookmark to storage
async function saveBookmark(bookmarkData, tabId) {
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    
    // Create a unique key for this URL
    const urlKey = new URL(bookmarkData.url).origin + new URL(bookmarkData.url).pathname;
    
    if (!bookmarks[urlKey]) {
      bookmarks[urlKey] = [];
    }
    
    // Add new bookmark
    const bookmark = {
      id: Date.now().toString(),
      name: bookmarkData.name || `Bookmark ${bookmarks[urlKey].length + 1}`,
      scrollPosition: bookmarkData.scrollPosition,
      url: bookmarkData.url,
      timestamp: new Date().toISOString()
    };
    
    bookmarks[urlKey].push(bookmark);
    
    await chrome.storage.local.set({ bookmarks });
    
    // Notify content script to update UI
    chrome.tabs.sendMessage(tabId, {
      action: 'bookmarkSaved',
      bookmark: bookmark
    });
  } catch (error) {
    console.error('Error saving bookmark:', error);
  }
}

// Get bookmarks for a specific URL
async function getBookmarks(url) {
  try {
    if (!url) {
      console.warn('getBookmarks called without a URL');
      return [];
    }
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = new URL(url).origin + new URL(url).pathname;
    return bookmarks[urlKey] || [];
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return [];
  }
}

// Delete a bookmark
async function deleteBookmark(bookmarkId, url) {
  try {
    if (!url) {
      console.warn('deleteBookmark called without a URL');
      return;
    }
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = new URL(url).origin + new URL(url).pathname;
    
    if (bookmarks[urlKey]) {
      bookmarks[urlKey] = bookmarks[urlKey].filter(bookmark => bookmark.id !== bookmarkId);
      await chrome.storage.local.set({ bookmarks });
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
}

// Jump to a specific scroll position
function jumpToBookmark(scrollPosition, tabId) {
  chrome.tabs.sendMessage(tabId, {
    action: 'scrollToPosition',
    scrollPosition: scrollPosition
  });
}