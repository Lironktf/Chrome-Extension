// Popup script for Page Position Bookmarks extension

let currentTab = null;
let bookmarks = [];

// Define functions first before they're used
function jumpToBookmark(bookmarkId) {
  console.log('=== JUMP FUNCTION CALLED ===');
  console.log('Jumping to bookmark:', bookmarkId);
  console.log('Available bookmarks:', bookmarks);
  console.log('Current tab:', currentTab);
  
  const bookmark = bookmarks.find(b => b.id === bookmarkId);
  if (!bookmark) {
    console.error('Bookmark not found:', bookmarkId);
    showError('Bookmark not found');
    return;
  }

  console.log('Found bookmark:', bookmark);

  // Try injection first, then fallback to content script
  scrollToPositionViaInjection(currentTab.id, bookmark.scrollPosition)
    .then(() => {
      console.log('Scroll injection successful');
      showSuccess(`Jumped to "${bookmark.name}"`);
      setTimeout(() => window.close(), 1000);
    })
    .catch((injectionError) => {
      console.warn('Injection failed, trying content script:', injectionError);
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'scrollToPosition',
        scrollPosition: bookmark.scrollPosition
      })
      .then(() => {
        console.log('Content script scroll successful');
        showSuccess(`Jumped to "${bookmark.name}"`);
        setTimeout(() => window.close(), 1000);
      })
      .catch((contentError) => {
        console.error('Both injection and content script failed:', contentError);
        showError('Failed to jump to bookmark');
      });
    });
}

function deleteBookmark(bookmarkId) {
  console.log('=== DELETE FUNCTION CALLED ===');
  console.log('Deleting bookmark:', bookmarkId);
  console.log('Available bookmarks:', bookmarks);
  
  if (!confirm('Are you sure you want to delete this bookmark?')) {
    console.log('Delete cancelled by user');
    return;
  }

  chrome.runtime.sendMessage({
    action: 'deleteBookmark',
    bookmarkId: bookmarkId,
    url: currentTab?.url
  })
  .then((response) => {
    console.log('Delete response:', response);
    loadBookmarks().then(() => {
      showSuccess('Bookmark deleted successfully!');
    });
  })
  .catch((error) => {
    console.error('Error deleting bookmark:', error);
    showError('Failed to delete bookmark');
  });
}

// Make functions globally available
window.jumpToBookmark = jumpToBookmark;
window.deleteBookmark = deleteBookmark;

// Add console testing functions
window.testScroll = function(position) {
  console.log('Testing scroll to position:', position);
  scrollToPositionViaInjection(currentTab.id, position)
    .then(() => console.log('Scroll test successful'))
    .catch(err => console.error('Scroll test failed:', err));
};

// Direct scroll function for console testing
window.scrollToPosition = function(position) {
  console.log('Direct scroll to position:', position);
  chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: (pos) => {
      window.scrollTo({ top: pos, behavior: 'smooth' });
      console.log('Scrolled to:', pos);
    },
    args: [position]
  }).then(() => console.log('Direct scroll successful'))
    .catch(err => console.error('Direct scroll failed:', err));
};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
  setupEventListeners();
});

// Initialize popup
async function initializePopup() {
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (!currentTab) {
      showError('No active tab found');
      return;
    }

    console.log('Current tab:', currentTab.url);

    // Load bookmarks for current page
    await loadBookmarks();
    
    // Get current scroll position
    await getCurrentScrollPosition();
    
    // Show a helpful message if we can't get scroll position
    setTimeout(() => {
      const saveBtn = document.getElementById('saveBookmarkBtn');
      if (saveBtn && saveBtn.textContent.includes('Save Position (0px)')) {
        console.log('Content script may not be loaded, but extension will still work');
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize popup');
  }
}

// Setup event listeners
function setupEventListeners() {
  const saveBtn = document.getElementById('saveBookmarkBtn');
  const nameInput = document.getElementById('bookmarkName');
  
  saveBtn.addEventListener('click', saveCurrentPosition);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveCurrentPosition();
    }
  });

  // Add event delegation for bookmark buttons
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-jump')) {
      const button = e.target.closest('.btn-jump');
      const bookmarkId = button.getAttribute('data-bookmark-id');
      console.log('Jump button clicked for:', bookmarkId);
      jumpToBookmark(bookmarkId);
    }
    
    if (e.target.closest('.btn-delete')) {
      const button = e.target.closest('.btn-delete');
      const bookmarkId = button.getAttribute('data-bookmark-id');
      console.log('Delete button clicked for:', bookmarkId);
      deleteBookmark(bookmarkId);
    }
  });
}

// Get current scroll position from content script
async function getCurrentScrollPosition() {
  try {
    // Check if we can access the tab
    if (!currentTab || !currentTab.id) {
      console.error('No valid tab found');
      return;
    }

    // Try to get scroll position via injection first (more reliable)
    const scrollPosition = await getScrollViaInjection(currentTab.id);
    updateScrollPositionDisplay(scrollPosition);
    
  } catch (error) {
    console.error('Error getting scroll position:', error);
    // Fallback: show default button text
    updateScrollPositionDisplay(0);
  }
}

// Update scroll position display
function updateScrollPositionDisplay(scrollPosition) {
  const saveBtn = document.getElementById('saveBookmarkBtn');
  saveBtn.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
    <span>Save Current Position</span>
  `;
}

// Save current position as bookmark
async function saveCurrentPosition() {
  try {
    const nameInput = document.getElementById('bookmarkName');
    const bookmarkName = nameInput.value.trim();
    
    if (!bookmarkName) {
      showError('Please enter a bookmark name');
      nameInput.focus();
      return;
    }

    if (!currentTab || !currentTab.id) {
      showError('No active tab found');
      return;
    }

    // Get current scroll position using injection (most reliable method)
    const scrollPosition = await getScrollViaInjection(currentTab.id);

    // Save bookmark
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
      // Clear input and reload bookmarks
      nameInput.value = '';
      await loadBookmarks();
      
      // Show success message
      showSuccess('Bookmark saved successfully!');
    } else {
      showError('Failed to save bookmark - no response from background script');
    }
    
  } catch (error) {
    console.error('Error saving bookmark:', error);
    showError(`Failed to save bookmark: ${error.message}`);
  }
}

// Load bookmarks for current page
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
    console.error('Error loading bookmarks:', error);
    showError('Failed to load bookmarks');
  }
}

// Render bookmarks list
function renderBookmarks() {
  const bookmarksList = document.getElementById('bookmarksList');
  const bookmarkCount = document.getElementById('bookmarkCount');
  
  // Update bookmark count
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

  // Sort bookmarks by scroll position
  const sortedBookmarks = [...bookmarks].sort((a, b) => a.scrollPosition - b.scrollPosition);

  bookmarksList.innerHTML = sortedBookmarks.map(bookmark => `
    <div class="bookmark-item" data-id="${bookmark.id}">
      <div class="bookmark-info">
        <div class="bookmark-name">${escapeHtml(bookmark.name)}</div>
        <div class="bookmark-position">Position: ${Math.round(bookmark.scrollPosition)}px</div>
        <div class="bookmark-time">${formatDate(bookmark.timestamp)}</div>
      </div>
      <div class="bookmark-actions">
        <button class="btn btn-small btn-jump" data-bookmark-id="${bookmark.id}" title="Jump to this position">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        </button>
        <button class="btn btn-small btn-delete" data-bookmark-id="${bookmark.id}" title="Delete bookmark">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}


// Utility functions
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

function showSuccess(message) {
  showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
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


// Get scroll position by injecting a script (most reliable method)
async function getScrollViaInjection(tabId) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try multiple methods to get scroll position
        const scrollY = window.pageYOffset || 
                       document.documentElement.scrollTop || 
                       document.body.scrollTop || 
                       0;
        console.log('Injected script found scroll position:', scrollY);
        return scrollY;
      }
    });
    const position = typeof result === 'number' ? result : 0;
    console.log('Retrieved scroll position:', position);
    return position;
  } catch (e) {
    console.warn('Script injection failed:', e);
    return 0;
  }
}

// Scroll to position using injection
async function scrollToPositionViaInjection(tabId, scrollPosition) {
  try {
    console.log('Attempting to scroll to position:', scrollPosition);
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (pos) => {
        console.log('Injected script received position:', pos);
        
        // Try multiple scroll methods for better compatibility
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
        
        // Verify the scroll worked
        setTimeout(() => {
          const currentPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          console.log('Current scroll position after jump:', currentPos);
        }, 500);
      },
      args: [scrollPosition]
    });
    
    console.log('Scroll command executed successfully');
  } catch (e) {
    console.error('Scroll injection failed:', e);
    throw e;
  }
}
