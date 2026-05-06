let currentTab = null;
let bookmarks = [];

async function jumpToBookmark(bookmarkId) {
  const bookmark = bookmarks.find(b => b.id === bookmarkId);
  if (!bookmark) {
    return;
  }

  try {
    await scrollToPositionViaInjection(currentTab.id, bookmark.scrollPosition);
  } catch (injectionError) {
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'scrollToPosition',
        scrollPosition: bookmark.scrollPosition
      });
    } catch (contentError) {
      showError(injectionError.message || contentError.message || 'Unable to jump to bookmark.');
    }
  }
}

function deleteBookmark(bookmarkId) {
  chrome.runtime.sendMessage({
    action: 'deleteBookmark',
    bookmarkId: bookmarkId,
    url: currentTab?.url
  })
  .then(() => {
    loadBookmarks();
  })
  .catch(() => {});
}

window.jumpToBookmark = jumpToBookmark;
window.deleteBookmark = deleteBookmark;

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
});

async function initializePopup() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];

    if (!currentTab) {
      return;
    }

    if (currentTab.url.startsWith('chrome://') ||
        currentTab.url.startsWith('chrome-extension://') ||
        currentTab.url.startsWith('moz-extension://') ||
        currentTab.url.startsWith('edge://') ||
        currentTab.url.startsWith('about:')) {
      showError('This extension is not available on browser internal pages.');
      return;
    }

    await loadBookmarks();
    await getCurrentScrollPosition();
  } catch (error) {
    showError('Unable to initialize the extension popup.');
  }
}

function setupEventListeners() {
  const saveBtn = document.getElementById('saveBookmarkBtn');
  const nameInput = document.getElementById('bookmarkName');

  saveBtn.addEventListener('click', saveCurrentPosition);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveCurrentPosition();
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-jump')) {
      const button = e.target.closest('.btn-jump');
      const bookmarkId = button.getAttribute('data-bookmark-id');
      jumpToBookmark(bookmarkId);
    }

    if (e.target.closest('.btn-delete')) {
      const button = e.target.closest('.btn-delete');
      const bookmarkId = button.getAttribute('data-bookmark-id');
      deleteBookmark(bookmarkId);
    }
  });
}

async function getCurrentScrollPosition() {
  try {
    if (!currentTab || !currentTab.id) {
      return;
    }

    const scrollPosition = await getScrollViaInjection(currentTab.id);
    updateScrollPositionDisplay(scrollPosition);
  } catch (error) {
    updateScrollPositionDisplay(0);
  }
}

function updateScrollPositionDisplay(scrollPosition) {
  const saveBtn = document.getElementById('saveBookmarkBtn');
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  `;
  saveBtn.title = `Save bookmark at ${Math.round(scrollPosition)}px`;
}

function normalizeBookmarkName(name) {
  return name.trim().toLocaleLowerCase();
}

async function saveCurrentPosition() {
  try {
    const nameInput = document.getElementById('bookmarkName');
    const bookmarkName = nameInput.value.trim();

    if (!bookmarkName) {
      showError('Enter a bookmark name.');
      nameInput.focus();
      return;
    }

    if (!currentTab || !currentTab.id) {
      showError('No active tab found.');
      return;
    }

    const hasDuplicateName = bookmarks.some(
      (bookmark) => normalizeBookmarkName(bookmark.name) === normalizeBookmarkName(bookmarkName)
    );
    if (hasDuplicateName) {
      showError('A bookmark with this name already exists on this page.');
      nameInput.focus();
      return;
    }

    const scrollPosition = await getScrollViaInjection(currentTab.id);

    const saveResponse = await chrome.runtime.sendMessage({
      action: 'saveBookmark',
      data: {
        name: bookmarkName,
        scrollPosition: scrollPosition,
        url: currentTab.url
      },
      tabId: currentTab.id
    });

    if (saveResponse && saveResponse.success) {
      nameInput.value = '';
      await loadBookmarks();
    } else {
      showError(saveResponse?.error || 'Unable to save bookmark.');
    }
  } catch (error) {
    showError('Unable to save bookmark.');
  }
}

async function loadBookmarks() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getBookmarks',
      url: currentTab?.url
    });

    if (response && response.bookmarks) {
      bookmarks = response.bookmarks;
      renderBookmarks();
    }
  } catch (error) {
    showError('Unable to load bookmarks.');
  }
}

function renderBookmarks() {
  const bookmarksList = document.getElementById('bookmarksList');
  const bookmarkCount = document.getElementById('bookmarkCount');

  bookmarkCount.textContent = bookmarks.length;

  if (bookmarks.length === 0) {
    bookmarksList.innerHTML = `
      <div class="no-bookmarks">
        <div class="no-bookmarks-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p>No bookmarks saved yet</p>
        <p class="hint">Scroll to a position and save it as a bookmark</p>
      </div>
    `;
    return;
  }

  const sortedBookmarks = [...bookmarks].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  bookmarksList.innerHTML = sortedBookmarks.map(bookmark => `
    <div class="bookmark-item" data-id="${bookmark.id}">
      <div class="bookmark-info">
        <div class="bookmark-name">${escapeHtml(bookmark.name)}</div>
        <div class="bookmark-position">${Math.round(bookmark.scrollPosition)}px</div>
        <div class="bookmark-time">${formatDate(bookmark.timestamp)}</div>
      </div>
      <div class="bookmark-actions">
        <button class="btn-small btn-jump" data-bookmark-id="${bookmark.id}" title="Jump to this position">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        </button>
        <button class="btn-small btn-delete" data-bookmark-id="${bookmark.id}" title="Delete bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

async function getScrollViaInjection(tabId) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function findMainScrollableElement() {
          const windowScrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
          const windowScrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
          const windowClientHeight = window.innerHeight || document.documentElement.clientHeight || 0;

          if (windowScrollY > 50 && windowScrollHeight > windowClientHeight) {
            return null;
          }

          const allElements = document.querySelectorAll('*');
          const scrollableElements = [];

          for (const element of allElements) {
            if (element.nodeType !== 1) continue;

            const style = window.getComputedStyle(element);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;

            if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
              const scrollHeight = element.scrollHeight;
              const clientHeight = element.clientHeight;
              const scrollTop = element.scrollTop;

              if (scrollHeight > clientHeight) {
                const scrollableArea = scrollHeight - clientHeight;
                const rect = element.getBoundingClientRect();

                scrollableElements.push({
                  element: element,
                  scrollHeight: scrollHeight,
                  clientHeight: clientHeight,
                  scrollTop: scrollTop,
                  scrollableArea: scrollableArea,
                  width: rect.width,
                  height: rect.height,
                  area: rect.width * rect.height,
                  score: 0
                });
              }
            }
          }

          if (scrollableElements.length === 0) {
            return null;
          }

          for (const item of scrollableElements) {
            let score = 0;

            score += Math.min(100, (item.scrollableArea / 100));

            if (item.scrollTop > 0) {
              score += Math.min(200, (item.scrollTop / 10));
            }

            score += Math.min(100, (item.area / 10000));

            const viewportArea = window.innerWidth * window.innerHeight;
            const viewportPercentage = (item.area / viewportArea) * 100;
            score += Math.min(50, viewportPercentage);

            item.score = score;
          }

          scrollableElements.sort((a, b) => b.score - a.score);

          if (scrollableElements[0].score > 50) {
            return scrollableElements[0].element;
          }

          return null;
        }

        const scrollElement = findMainScrollableElement();

        if (scrollElement) {
          return scrollElement.scrollTop || 0;
        }

        return window.pageYOffset ||
               window.scrollY ||
               document.documentElement.scrollTop ||
               document.body.scrollTop || 0;
      }
    });

    return typeof result === 'number' ? result : 0;
  } catch (e) {
    if (e.message && e.message.includes('Cannot access a chrome:// URL')) {
      return 0;
    }
    return 0;
  }
}

async function scrollToPositionViaInjection(tabId, scrollPosition) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (pos) => {
        function findMainScrollableElement() {
          const windowScrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
          const windowScrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
          const windowClientHeight = window.innerHeight || document.documentElement.clientHeight || 0;

          if (windowScrollY > 50 && windowScrollHeight > windowClientHeight) {
            return null;
          }

          const allElements = document.querySelectorAll('*');
          const scrollableElements = [];

          for (const element of allElements) {
            if (element.nodeType !== 1) continue;

            const style = window.getComputedStyle(element);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;

            if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
              const scrollHeight = element.scrollHeight;
              const clientHeight = element.clientHeight;
              const scrollTop = element.scrollTop;

              if (scrollHeight > clientHeight) {
                const scrollableArea = scrollHeight - clientHeight;
                const rect = element.getBoundingClientRect();

                scrollableElements.push({
                  element: element,
                  scrollHeight: scrollHeight,
                  clientHeight: clientHeight,
                  scrollTop: scrollTop,
                  scrollableArea: scrollableArea,
                  width: rect.width,
                  height: rect.height,
                  area: rect.width * rect.height,
                  score: 0
                });
              }
            }
          }

          if (scrollableElements.length === 0) {
            return null;
          }

          for (const item of scrollableElements) {
            let score = 0;

            score += Math.min(100, (item.scrollableArea / 100));

            if (item.scrollTop > 0) {
              score += Math.min(200, (item.scrollTop / 10));
            }

            score += Math.min(100, (item.area / 10000));

            const viewportArea = window.innerWidth * window.innerHeight;
            const viewportPercentage = (item.area / viewportArea) * 100;
            score += Math.min(50, viewportPercentage);

            item.score = score;
          }

          scrollableElements.sort((a, b) => b.score - a.score);

          if (scrollableElements[0].score > 50) {
            return scrollableElements[0].element;
          }

          return null;
        }

        const scrollElement = findMainScrollableElement();

        if (scrollElement) {
          scrollElement.scrollTo({
            top: pos,
            behavior: 'smooth'
          });
        } else {
          if (window.scrollTo) {
            window.scrollTo({
              top: pos,
              behavior: 'smooth'
            });
          } else if (document.documentElement.scrollTop !== undefined) {
            document.documentElement.scrollTop = pos;
          } else if (document.body.scrollTop !== undefined) {
            document.body.scrollTop = pos;
          }
        }
      },
      args: [scrollPosition]
    });
  } catch (e) {
    if (e.message && e.message.includes('Cannot access a chrome:// URL')) {
      throw new Error('Cannot scroll on restricted pages like chrome:// URLs');
    }
    throw e;
  }
}
