/**
 * Background Script for Page Position Bookmarks Chrome Extension
 * 
 * This script serves as the central communication hub and data storage manager
 * for the Page Position Bookmarks extension. It handles all bookmark operations
 * including saving, retrieving, deleting, and managing scroll position data.
 * 
 * @fileoverview Background service worker for Chrome extension
 * @author Page Position Bookmarks Extension
 * @version 1.0.0
 */

/**
 * Message listener for handling communication between popup, content scripts, and background
 * 
 * This listener processes all incoming messages from the extension's components and
 * routes them to the appropriate handler functions. It supports the following actions:
 * - saveBookmark: Save a new bookmark with scroll position data
 * - getBookmarks: Retrieve all bookmarks for a specific URL
 * - deleteBookmark: Remove a bookmark by ID
 * - jumpToBookmark: Scroll to a specific bookmark position
 * 
 * @param {Object} request - The message object containing action and data
 * @param {string} request.action - The action to perform (saveBookmark, getBookmarks, etc.)
 * @param {Object} request.data - Data payload for the action
 * @param {string} request.bookmarkId - ID of bookmark to delete
 * @param {number} request.scrollPosition - Scroll position to jump to
 * @param {Object} sender - Information about the sender (tab, frame, etc.)
 * @param {Object} sender.tab - Tab information if message came from a tab
 * @param {Function} sendResponse - Callback function to send response back
 * @returns {boolean|undefined} Returns true for async operations to keep channel open
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  // Handle bookmark saving
  if (request.action === 'saveBookmark') {
    console.log('Saving bookmark:', request.data);
    const tabId = request.tabId || sender?.tab?.id;
    saveBookmark(request.data, tabId).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  } 
  // Handle bookmark retrieval
  else if (request.action === 'getBookmarks') {
    const url = request.url || sender?.tab?.url;
    console.log('Getting bookmarks for URL:', url);
    getBookmarks(url).then(bookmarks => {
      console.log('Retrieved bookmarks:', bookmarks);
      sendResponse({ bookmarks });
    });
    return true; // Keep message channel open for async response
  } 
  // Handle bookmark deletion
  else if (request.action === 'deleteBookmark') {
    const url = request.url || sender?.tab?.url;
    console.log('Deleting bookmark:', request.bookmarkId, 'for URL:', url);
    deleteBookmark(request.bookmarkId, url).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  } 
  // Handle jumping to bookmark position
  else if (request.action === 'jumpToBookmark') {
    console.log('Jumping to bookmark position:', request.scrollPosition);
    jumpToBookmark(request.scrollPosition, sender.tab.id);
    sendResponse({ success: true });
  }
});

/**
 * Save a bookmark to Chrome's local storage
 * 
 * This function creates a new bookmark entry with a unique ID, timestamp,
 * and all relevant data, then stores it in Chrome's local storage using
 * a URL-based key structure for organization.
 * 
 * @param {Object} bookmarkData - The bookmark data to save
 * @param {string} bookmarkData.name - User-defined name for the bookmark
 * @param {number} bookmarkData.scrollPosition - Pixel position from top of page
 * @param {string} bookmarkData.url - URL of the page where bookmark was created
 * @param {number} tabId - ID of the tab where bookmark was created
 * @returns {Promise<void>} Promise that resolves when bookmark is saved
 * 
 * @example
 * // Save a bookmark
 * await saveBookmark({
 *   name: "Important Section",
 *   scrollPosition: 1500,
 *   url: "https://example.com/article"
 * }, 123);
 */
async function saveBookmark(bookmarkData, tabId) {
  try {
    // Retrieve existing bookmarks from storage
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    
    // Create a unique key for this URL (origin + pathname)
    // This ensures bookmarks are organized by page
    const urlKey = new URL(bookmarkData.url).origin + new URL(bookmarkData.url).pathname;
    
    // Initialize bookmark array for this URL if it doesn't exist
    if (!bookmarks[urlKey]) {
      bookmarks[urlKey] = [];
    }
    
    // Create new bookmark object with unique ID and timestamp
    const bookmark = {
      id: Date.now().toString(), // Unique timestamp-based ID
      name: bookmarkData.name || `Bookmark ${bookmarks[urlKey].length + 1}`, // Default name if none provided
      scrollPosition: bookmarkData.scrollPosition, // Pixel position from top
      url: bookmarkData.url, // Full URL of the page
      timestamp: new Date().toISOString() // ISO timestamp for sorting
    };
    
    // Add bookmark to the array for this URL
    bookmarks[urlKey].push(bookmark);
    
    // Save updated bookmarks back to storage
    await chrome.storage.local.set({ bookmarks });
    
    // Notify content script to show success notification
    chrome.tabs.sendMessage(tabId, {
      action: 'bookmarkSaved',
      bookmark: bookmark
    });
  } catch (error) {
    console.error('Error saving bookmark:', error);
  }
}

/**
 * Retrieve all bookmarks for a specific URL
 * 
 * This function fetches all saved bookmarks for a given URL from Chrome's
 * local storage. It uses the same URL key structure as saveBookmark to
 * ensure consistency.
 * 
 * @param {string} url - The URL to get bookmarks for
 * @returns {Promise<Array>} Promise that resolves to array of bookmark objects
 * 
 * @example
 * // Get bookmarks for a specific page
 * const bookmarks = await getBookmarks("https://example.com/article");
 * console.log(bookmarks); // [{ id: "123", name: "Section 1", ... }, ...]
 */
async function getBookmarks(url) {
  try {
    // Validate URL parameter
    if (!url) {
      console.warn('getBookmarks called without a URL');
      return [];
    }
    
    // Retrieve bookmarks from storage
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    
    // Create URL key and return bookmarks for this URL
    const urlKey = new URL(url).origin + new URL(url).pathname;
    return bookmarks[urlKey] || [];
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return [];
  }
}

/**
 * Delete a bookmark by ID
 * 
 * This function removes a specific bookmark from storage by filtering out
 * the bookmark with the matching ID from the URL's bookmark array.
 * 
 * @param {string} bookmarkId - The unique ID of the bookmark to delete
 * @param {string} url - The URL where the bookmark exists
 * @returns {Promise<void>} Promise that resolves when bookmark is deleted
 * 
 * @example
 * // Delete a bookmark
 * await deleteBookmark("1234567890", "https://example.com/article");
 */
async function deleteBookmark(bookmarkId, url) {
  try {
    // Validate URL parameter
    if (!url) {
      console.warn('deleteBookmark called without a URL');
      return;
    }
    
    // Retrieve bookmarks from storage
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = new URL(url).origin + new URL(url).pathname;
    
    // Filter out the bookmark with matching ID
    if (bookmarks[urlKey]) {
      bookmarks[urlKey] = bookmarks[urlKey].filter(bookmark => bookmark.id !== bookmarkId);
      
      // Save updated bookmarks back to storage
      await chrome.storage.local.set({ bookmarks });
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
}

/**
 * Send scroll command to content script
 * 
 * This function sends a message to the content script in the specified tab
 * to scroll to a specific position. It's used when jumping to bookmarks.
 * 
 * @param {number} scrollPosition - The pixel position to scroll to
 * @param {number} tabId - The ID of the tab to scroll
 * 
 * @example
 * // Scroll to position 1500px
 * jumpToBookmark(1500, 123);
 */
function jumpToBookmark(scrollPosition, tabId) {
  chrome.tabs.sendMessage(tabId, {
    action: 'scrollToPosition',
    scrollPosition: scrollPosition
  });
}