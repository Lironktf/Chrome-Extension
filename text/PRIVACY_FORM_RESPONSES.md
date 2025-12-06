# Chrome Web Store Privacy Form Responses

## Single Purpose Description
**Save Location on a Website** (26/1000 characters)

The extension allows users to save and jump to specific scroll positions on web pages. Users can bookmark their current scroll position with a custom name and instantly return to that exact location later. This is useful for reading long articles, documentation, research papers, and any lengthy web content where users need to quickly navigate between different sections.

## Permission Justifications

### Storage Permission
**Justification (0/1000 characters):**
The extension requires the "storage" permission to save bookmark data locally on the user's device. This includes bookmark names, scroll positions, URLs, and timestamps. All data is stored locally using chrome.storage.local and is never transmitted to external servers. This permission is essential for the core functionality of saving and retrieving bookmarks across browser sessions.

### Tabs Permission
**Justification (0/1000 characters):**
The extension requires the "tabs" permission to communicate with the active tab and retrieve the current tab's URL and ID. This is necessary to:
1. Get the current tab's URL to associate bookmarks with specific pages
2. Send messages to the content script in the active tab to get scroll position
3. Execute scroll commands to jump to saved positions
4. Ensure bookmarks are only shown for the current page

### ActiveTab Permission
**Justification (0/1000 characters):**
The extension requires the "activeTab" permission to access the current tab's scroll position and execute scroll commands. This permission allows the extension to:
1. Read the current scroll position when saving bookmarks
2. Scroll to specific positions when jumping to bookmarks
3. Inject scripts to interact with the page's scroll functionality
4. Access tab information needed for bookmark management

### Scripting Permission
**Justification (0/1000 characters):**
The extension requires the "scripting" permission to inject JavaScript code into web pages to:
1. Read the current scroll position (window.pageYOffset, document.documentElement.scrollTop)
2. Execute scroll commands (window.scrollTo) to jump to saved positions
3. Provide reliable scroll position detection across different websites
4. Ensure compatibility with various page structures and PDF viewers

### Host Permission (<all_urls>)
**Justification (0/1000 characters):**
The extension requires host permission for all URLs ("<all_urls>") because:
1. Users need to save bookmarks on any website they visit
2. The extension must work on all domains to fulfill its core purpose
3. Scroll position detection requires access to the page's DOM and scroll properties
4. The extension doesn't collect or transmit any data - all bookmarks are stored locally
5. This broad permission is necessary for the extension's single, focused purpose of saving scroll positions on any webpage

## Data Collection Statement
This extension handles user data including bookmark names, scroll positions, URLs, and timestamps. All data is stored locally on the user's device using Chrome's local storage API and is never transmitted to external servers. No analytics, tracking, or external data transmission occurs.

## Privacy Policy
A privacy policy is required because the extension handles user data (bookmark names, scroll positions, URLs, timestamps). The privacy policy is available at: [Your Privacy Policy URL]

**Key Points:**
- All data stored locally only
- No external data transmission
- No third-party sharing
- User has full control over their data
- Data can be deleted at any time
