chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveBookmark') {
    const tabId = request.tabId || sender?.tab?.id;
    saveBookmark(request.data, tabId).then((response) => {
      sendResponse(response);
    });
    return true;
  } else if (request.action === 'getBookmarks') {
    const url = request.url || sender?.tab?.url;
    getBookmarks(url).then(bookmarks => {
      sendResponse({ bookmarks });
    });
    return true;
  } else if (request.action === 'deleteBookmark') {
    const url = request.url || sender?.tab?.url;
    deleteBookmark(request.bookmarkId, url).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'jumpToBookmark') {
    jumpToBookmark(request.scrollPosition, sender.tab.id);
    sendResponse({ success: true });
  }
});

function getUrlKey(url) {
  const parsedUrl = new URL(url);
  return `${parsedUrl.origin}${parsedUrl.pathname}`;
}

function normalizeBookmarkName(name) {
  return name.trim().toLocaleLowerCase();
}

async function saveBookmark(bookmarkData, tabId) {
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = getUrlKey(bookmarkData.url);

    if (!bookmarks[urlKey]) {
      bookmarks[urlKey] = [];
    }

    const normalizedName = normalizeBookmarkName(
      bookmarkData.name || `Bookmark ${bookmarks[urlKey].length + 1}`
    );
    const hasDuplicateName = bookmarks[urlKey].some(
      (bookmark) => normalizeBookmarkName(bookmark.name) === normalizedName
    );

    if (hasDuplicateName) {
      return {
        success: false,
        error: 'A bookmark with this name already exists on this page.'
      };
    }

    const bookmark = {
      id: Date.now().toString(),
      name: bookmarkData.name || `Bookmark ${bookmarks[urlKey].length + 1}`,
      scrollPosition: bookmarkData.scrollPosition,
      url: bookmarkData.url,
      timestamp: new Date().toISOString()
    };

    bookmarks[urlKey].push(bookmark);
    await chrome.storage.local.set({ bookmarks });

    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'bookmarkSaved',
        bookmark
      }).catch(() => {});
    }

    return { success: true, bookmark };
  } catch (error) {
    return { success: false, error: 'Unable to save bookmark.' };
  }
}

async function getBookmarks(url) {
  try {
    if (!url) {
      return [];
    }

    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = getUrlKey(url);
    return bookmarks[urlKey] || [];
  } catch (error) {
    return [];
  }
}

async function deleteBookmark(bookmarkId, url) {
  try {
    if (!url) {
      return;
    }

    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || {};
    const urlKey = getUrlKey(url);

    if (bookmarks[urlKey]) {
      bookmarks[urlKey] = bookmarks[urlKey].filter(bookmark => bookmark.id !== bookmarkId);
      await chrome.storage.local.set({ bookmarks });
    }
  } catch (error) {}
}

function jumpToBookmark(scrollPosition, tabId) {
  chrome.tabs.sendMessage(tabId, {
    action: 'scrollToPosition',
    scrollPosition: scrollPosition
  });
}
