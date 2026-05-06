let currentScrollPosition = 0;
let mainScrollElement = null;
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

function updateScrollPosition() {
  mainScrollElement = findMainScrollableElement();

  if (mainScrollElement) {
    currentScrollPosition = mainScrollElement.scrollTop || 0;
  } else {
    currentScrollPosition = window.pageYOffset ||
                           window.scrollY ||
                           document.documentElement.scrollTop ||
                           document.body.scrollTop || 0;
  }

  return currentScrollPosition;
}

let previousScrollElement = null;

function setupScrollListeners() {
  updateScrollPosition();

  if (previousScrollElement && previousScrollElement !== mainScrollElement) {
    previousScrollElement.removeEventListener('scroll', updateScrollPosition);
    previousScrollElement.removeEventListener('wheel', updateScrollPosition);
    previousScrollElement.removeEventListener('touchmove', updateScrollPosition);
  }

  if (mainScrollElement && mainScrollElement !== window && mainScrollElement !== previousScrollElement) {
    mainScrollElement.addEventListener('scroll', updateScrollPosition, { passive: true });
    mainScrollElement.addEventListener('wheel', updateScrollPosition, { passive: true });
    mainScrollElement.addEventListener('touchmove', updateScrollPosition, { passive: true });
    previousScrollElement = mainScrollElement;
  }
}

window.addEventListener('scroll', updateScrollPosition, { passive: true });
window.addEventListener('wheel', updateScrollPosition, { passive: true });
window.addEventListener('touchmove', updateScrollPosition, { passive: true });

setupScrollListeners();

setTimeout(() => {
  setupScrollListeners();
}, 1000);

let observerTimeout = null;
const observer = new MutationObserver(() => {
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrollToPosition') {
    scrollToPosition(request.scrollPosition);
    sendResponse({ success: true });
  } else if (request.action === 'getCurrentPosition') {
    sendResponse({ scrollPosition: currentScrollPosition });
  } else if (request.action === 'bookmarkSaved') {
    showNotification('Bookmark saved!');
  }

  return true;
});

function scrollToPosition(scrollPosition) {
  const scrollElement = findMainScrollableElement();

  if (scrollElement) {
    scrollElement.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  } else {
    window.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  }
}

function showNotification(message) {
  const existingNotification = document.getElementById('bookmark-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

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

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

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

updateScrollPosition();
setTimeout(() => {
  updateScrollPosition();
}, 500);
