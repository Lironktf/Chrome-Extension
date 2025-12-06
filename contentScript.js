/**
 * Content Script for Page Position Bookmarks Chrome Extension
 * 
 * This script runs in the context of web pages and handles scroll position
 * tracking, scroll commands, and user notifications. It acts as a bridge
 * between the webpage and the extension's background script.
 * 
 * @fileoverview Content script for scroll position management
 * @author Page Position Bookmarks Extension
 * @version 1.0.0
 */

/**
 * Current scroll position tracker
 * @type {number}
 * @description Tracks the current vertical scroll position in pixels
 */
let currentScrollPosition = 0;

/**
 * Check if we're viewing a PDF
 * @type {boolean}
 * @description True if the current page is a PDF document
 */
let isPDF = false;

/**
 * Current main scrollable element (if different from window)
 * @type {HTMLElement|null}
 */
let mainScrollElement = null;

/**
 * Detect if we're on a PDF page
 * @returns {boolean} True if PDF is detected
 */
function detectPDF() {
  // Check for PDF viewer elements (including Chrome's PDF viewer)
  const pdfViewer = document.querySelector('embed[type="application/pdf"]') ||
                   document.querySelector('embed[type="application/x-google-chrome-pdf"]') ||
                   document.querySelector('object[type="application/pdf"]') ||
                   document.querySelector('#plugin') ||
                   document.querySelector('iframe[src*="pdf"]');

  // Check URL for PDF indicators
  const urlIsPDF = window.location.href.includes('.pdf') ||
                   window.location.href.includes('application/pdf');

  // Check for PDF.js viewer
  const hasPDFJS = window.PDFViewerApplication ||
                   document.querySelector('.pdfViewer') ||
                   document.querySelector('#viewer');

  return !!(pdfViewer || urlIsPDF || hasPDFJS);
}

/**
 * Find the main scrollable element on the page
 * Auto-detects custom scroll containers used by modern SPAs
 * @returns {HTMLElement|null} The main scrollable element, or null if using window scroll
 */
function findMainScrollableElement() {
  // First check if window itself is scrollable and has scroll
  const windowScrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
  const windowScrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
  const windowClientHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  // If window has significant scroll position, it's likely the main scroller
  if (windowScrollY > 50 && windowScrollHeight > windowClientHeight) {
    return null; // null indicates use window scroll
  }

  // Find all potentially scrollable elements
  const allElements = document.querySelectorAll('*');
  const scrollableElements = [];

  for (const element of allElements) {
    // Skip if not an element node or not visible
    if (element.nodeType !== 1) continue;

    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;

    // Check if element has scrollable overflow
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      const scrollTop = element.scrollTop;

      // Only consider elements that have scrollable content
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
    return null; // Use window scroll
  }

  // Score each scrollable element
  for (const item of scrollableElements) {
    let score = 0;

    // Prefer elements with larger scrollable area (max 100 points)
    score += Math.min(100, (item.scrollableArea / 100));

    // Prefer elements currently being scrolled (max 200 points)
    if (item.scrollTop > 0) {
      score += Math.min(200, (item.scrollTop / 10));
    }

    // Prefer larger elements (max 100 points)
    score += Math.min(100, (item.area / 10000));

    // Prefer elements that take up significant viewport (max 50 points)
    const viewportArea = window.innerWidth * window.innerHeight;
    const viewportPercentage = (item.area / viewportArea) * 100;
    score += Math.min(50, viewportPercentage);

    item.score = score;
  }

  // Sort by score (highest first)
  scrollableElements.sort((a, b) => b.score - a.score);

  // Return the highest scoring element if it has a meaningful score
  if (scrollableElements[0].score > 50) {
    return scrollableElements[0].element;
  }

  return null; // Use window scroll
}

/**
 * Update scroll position with PDF-aware and custom element detection
 * @returns {number} Current scroll position
 */
function updateScrollPosition() {
  isPDF = detectPDF();

  if (isPDF) {
    // Try PDF-specific methods
    // Method 1: PDF.js viewer
    if (window.PDFViewerApplication && window.PDFViewerApplication.page !== undefined) {
      const page = window.PDFViewerApplication.page;
      const viewer = document.querySelector('.pdfViewer');
      if (viewer) {
        const scrollTop = viewer.scrollTop || 0;
        mainScrollElement = viewer;
        // Combine page number and scroll position for more accurate positioning
        currentScrollPosition = (page - 1) * 10000 + scrollTop;
        return currentScrollPosition;
      }
    }

    // Method 2: Chrome's PDF embed (application/x-google-chrome-pdf)
    // Chrome PDFs scroll the body/window, not the embed itself
    const chromePdfEmbed = document.querySelector('embed[type="application/x-google-chrome-pdf"]');
    if (chromePdfEmbed) {
      // For Chrome PDFs, use body/window scroll
      const scroll = document.body.scrollTop ||
                    document.documentElement.scrollTop ||
                    window.pageYOffset ||
                    window.scrollY || 0;
      if (scroll > 0 || document.body.scrollHeight > window.innerHeight) {
        currentScrollPosition = scroll;
        return currentScrollPosition;
      }
    }

    // Method 3: Other PDF embed/object scroll
    const pdfEmbed = document.querySelector('embed[type="application/pdf"]') ||
                    document.querySelector('object[type="application/pdf"]');
    if (pdfEmbed) {
      try {
        // Try to access PDF viewer's scroll if accessible
        const pdfDoc = pdfEmbed.contentDocument || pdfEmbed.contentWindow?.document;
        if (pdfDoc) {
          const scroll = pdfDoc.documentElement.scrollTop ||
                       pdfDoc.body.scrollTop ||
                       pdfDoc.defaultView?.pageYOffset || 0;
          if (scroll > 0) {
            currentScrollPosition = scroll;
            return currentScrollPosition;
          }
        }
      } catch (e) {
        // Cross-origin access denied, fall through to regular methods
      }
    }

    // Method 4: Check for PDF viewer container
    const viewerContainer = document.querySelector('#viewer') ||
                           document.querySelector('.pdfViewer') ||
                           document.querySelector('#plugin');
    if (viewerContainer) {
      const scroll = viewerContainer.scrollTop ||
                    window.pageYOffset ||
                    document.documentElement.scrollTop || 0;
      mainScrollElement = viewerContainer;
      currentScrollPosition = scroll;
      return currentScrollPosition;
    }
  }

  // Auto-detect main scrollable element (for SPAs like Claude, ChatGPT, etc.)
  mainScrollElement = findMainScrollableElement();

  if (mainScrollElement) {
    // Use the detected custom scroll element
    currentScrollPosition = mainScrollElement.scrollTop || 0;
  } else {
    // Use regular window scroll methods
    currentScrollPosition = window.pageYOffset ||
                           window.scrollY ||
                           document.documentElement.scrollTop ||
                           document.body.scrollTop || 0;
  }

  return currentScrollPosition;
}

/**
 * Scroll event listener for real-time position tracking
 *
 * This listener continuously updates the currentScrollPosition variable
 * as the user scrolls, ensuring we always have the most recent position
 * when saving bookmarks. Enhanced for PDF support and custom scroll containers.
 *
 * @event scroll
 * @listens window
 */

// Track previous scroll element to remove old listeners
let previousScrollElement = null;

// Setup scroll event listeners on the appropriate element
function setupScrollListeners() {
  // First update to detect the scroll element
  updateScrollPosition();

  // Remove listeners from previous custom element if it changed
  if (previousScrollElement && previousScrollElement !== mainScrollElement) {
    previousScrollElement.removeEventListener('scroll', updateScrollPosition);
    previousScrollElement.removeEventListener('wheel', updateScrollPosition);
    previousScrollElement.removeEventListener('touchmove', updateScrollPosition);
  }

  // Add listeners to window (only once - using once flag won't work, but we check above)
  // These are safe to call multiple times as they won't duplicate

  // If a custom scroll element is detected, add listeners to it
  if (mainScrollElement && mainScrollElement !== window && mainScrollElement !== previousScrollElement) {
    mainScrollElement.addEventListener('scroll', updateScrollPosition, { passive: true });
    mainScrollElement.addEventListener('wheel', updateScrollPosition, { passive: true });
    mainScrollElement.addEventListener('touchmove', updateScrollPosition, { passive: true });
    previousScrollElement = mainScrollElement;
  }
}

// Add window listeners (once)
window.addEventListener('scroll', updateScrollPosition, { passive: true });
window.addEventListener('wheel', updateScrollPosition, { passive: true });
window.addEventListener('touchmove', updateScrollPosition, { passive: true });

// Initial setup
setupScrollListeners();

// Re-setup listeners after a delay (for dynamically loaded content)
setTimeout(() => {
  setupScrollListeners();
}, 1000);

// Use a debounced observer to avoid excessive re-detection
let observerTimeout = null;
const observer = new MutationObserver(() => {
  // Debounce the re-detection to avoid excessive calls
  if (observerTimeout) return;

  observerTimeout = setTimeout(() => {
    const newScrollElement = findMainScrollableElement();
    if (newScrollElement !== mainScrollElement) {
      mainScrollElement = newScrollElement;
      setupScrollListeners();
    }
    observerTimeout = null;
  }, 500);
});

// Start observing when DOM is ready
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * Message listener for communication with background script and popup
 * 
 * This listener handles incoming messages from the extension's other components
 * and executes the appropriate actions. It supports the following actions:
 * - scrollToPosition: Scroll to a specific position
 * - getCurrentPosition: Return the current scroll position
 * - bookmarkSaved: Show a success notification
 * 
 * @param {Object} request - The message object containing action and data
 * @param {string} request.action - The action to perform
 * @param {number} request.scrollPosition - Position to scroll to (for scrollToPosition)
 * @param {Object} sender - Information about the sender
 * @param {Function} sendResponse - Callback function to send response back
 * @returns {boolean} Always returns true to indicate async response handling
 * 
 * @example
 * // Message format for scrolling
 * chrome.runtime.sendMessage({
 *   action: 'scrollToPosition',
 *   scrollPosition: 1500
 * });
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  // Handle scroll to position command
  if (request.action === 'scrollToPosition') {
    scrollToPosition(request.scrollPosition);
    sendResponse({ success: true });
  } 
  // Handle get current position request
  else if (request.action === 'getCurrentPosition') {
    console.log('Sending scroll position:', currentScrollPosition);
    sendResponse({ scrollPosition: currentScrollPosition });
  } 
  // Handle bookmark saved notification
  else if (request.action === 'bookmarkSaved') {
    // Show a brief notification that bookmark was saved
    showNotification('Bookmark saved!');
  }
  
  // Always return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Scroll to a specific position on the page
 *
 * This function smoothly scrolls the page to the specified position using
 * the browser's native scrollTo method with smooth behavior. Enhanced for PDF
 * support and custom scrollable elements.
 *
 * @param {number} scrollPosition - The pixel position to scroll to from the top
 *
 * @example
 * // Scroll to 1500 pixels from top
 * scrollToPosition(1500);
 */
function scrollToPosition(scrollPosition) {
  isPDF = detectPDF();

  if (isPDF) {
    // Try PDF-specific scrolling methods
    // Method 1: PDF.js viewer
    if (window.PDFViewerApplication && window.PDFViewerApplication.page !== undefined) {
      const viewer = document.querySelector('.pdfViewer') || document.querySelector('#viewer');
      if (viewer) {
        // Extract page number if using combined position
        const pageNum = Math.floor(scrollPosition / 10000) + 1;
        const pageScroll = scrollPosition % 10000;

        // Navigate to page if needed
        if (window.PDFViewerApplication.page !== pageNum) {
          window.PDFViewerApplication.page = pageNum;
        }

        // Scroll within the page
        setTimeout(() => {
          viewer.scrollTop = pageScroll;
        }, 100);
        return;
      }
    }

    // Method 2: Chrome's PDF embed (application/x-google-chrome-pdf)
    // Chrome PDFs scroll the body/window, not the embed itself
    const chromePdfEmbed = document.querySelector('embed[type="application/x-google-chrome-pdf"]');
    if (chromePdfEmbed) {
      // For Chrome PDFs, scroll the window
      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
      return;
    }

    // Method 3: Other PDF embed/object scroll
    const pdfEmbed = document.querySelector('embed[type="application/pdf"]') ||
                    document.querySelector('object[type="application/pdf"]');
    if (pdfEmbed) {
      try {
        const pdfDoc = pdfEmbed.contentDocument || pdfEmbed.contentWindow?.document;
        if (pdfDoc) {
          pdfDoc.documentElement.scrollTop = scrollPosition;
          return;
        }
      } catch (e) {
        // Cross-origin access denied, fall through to regular methods
      }
    }

    // Method 4: PDF viewer container
    const viewerContainer = document.querySelector('#viewer') ||
                           document.querySelector('.pdfViewer') ||
                           document.querySelector('#plugin');
    if (viewerContainer) {
      viewerContainer.scrollTop = scrollPosition;
      return;
    }
  }

  // Auto-detect main scrollable element (for SPAs like Claude, ChatGPT, etc.)
  const scrollElement = findMainScrollableElement();

  if (scrollElement) {
    // Use the detected custom scroll element
    scrollElement.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  } else {
    // Regular page scrolling
    window.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  }
}

/**
 * Show a temporary notification to the user
 * 
 * This function creates and displays a temporary notification element
 * on the page to provide user feedback. The notification automatically
 * disappears after 3 seconds with a smooth animation.
 * 
 * @param {string} message - The message to display in the notification
 * 
 * @example
 * // Show a success notification
 * showNotification('Bookmark saved!');
 */
function showNotification(message) {
  // Remove any existing notification to prevent duplicates
  const existingNotification = document.getElementById('bookmark-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'bookmark-notification';
  notification.textContent = message;
  
  // Apply inline styles for immediate visibility
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

  // Add CSS animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Append notification to page
  document.body.appendChild(notification);

  // Auto-remove notification after 3 seconds with fade-out animation
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

/**
 * Initialize scroll position on script load
 * 
 * This ensures we have the current scroll position available immediately
 * when the content script loads, rather than waiting for the first scroll event.
 * Enhanced for PDF support with detection and initial position update.
 */
// Initial PDF detection and scroll position update
updateScrollPosition();

// Re-check for PDFs after a short delay (PDF.js might load asynchronously)
setTimeout(() => {
  updateScrollPosition();
}, 500);

// Monitor for PDF.js loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateScrollPosition, 1000);
  });
}