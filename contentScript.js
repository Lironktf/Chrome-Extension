// Content script for Page Position Bookmarks extension

// Track current scroll position
let currentScrollPosition = 0;

// Update scroll position as user scrolls
window.addEventListener('scroll', () => {
  let scroll = this.scrollY;
  currentScrollPosition = scroll;
});

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'scrollToPosition') {
    scrollToPosition(request.scrollPosition);
    sendResponse({ success: true });
  } else if (request.action === 'getCurrentPosition') {
    console.log('Sending scroll position:', currentScrollPosition);
    sendResponse({ scrollPosition: currentScrollPosition });
  } else if (request.action === 'bookmarkSaved') {
    // Show a brief notification that bookmark was saved
    showNotification('Bookmark saved!');
  }
  
  // Always return true to indicate we will send a response asynchronously
  return true;
});

// Scroll to a specific position
function scrollToPosition(scrollPosition) {
  window.scrollTo({
    top: scrollPosition,
    behavior: 'smooth'
  });
}

// Show a temporary notification
function showNotification(message) {
  // Remove any existing notification
  const existingNotification = document.getElementById('bookmark-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'bookmark-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 3000);
}

// Initialize scroll position
currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
