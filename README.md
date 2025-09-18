# Page Position Bookmarks - Chrome Extension

A Chrome web extension that allows you to save and jump to specific scroll positions on any webpage. Perfect for long documents, PDFs, articles, or any page where you want to quickly return to specific sections.

## Features

- 📍 **Save Current Position**: Click the extension icon and save your current scroll position with a custom name
- 🚀 **Quick Jump**: Instantly jump back to any saved position with a single click
- 📚 **Multiple Bookmarks**: Save multiple bookmarks per page for different sections
- 🗑️ **Easy Management**: Delete bookmarks you no longer need
- 💾 **Persistent Storage**: Bookmarks are saved locally and persist across browser sessions
- 🎨 **Beautiful UI**: Modern, intuitive interface with smooth animations
- 📱 **Responsive Design**: Works great on different screen sizes

## How to Use

### Installing the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this project folder
4. The extension will appear in your Chrome toolbar

### Using Bookmarks

1. **Navigate to any webpage** where you want to save positions
2. **Scroll to the position** you want to bookmark
3. **Click the extension icon** in your Chrome toolbar
4. **Enter a name** for your bookmark (e.g., "Introduction", "Chapter 3", "Important Section")
5. **Click "Save Current Position"**
6. **Scroll elsewhere** on the page
7. **Click the extension icon again** to see your saved bookmarks
8. **Click the play button** next to any bookmark to jump back to that position

### Managing Bookmarks

- **Jump to Position**: Click the green play button (▶️) next to any bookmark
- **Delete Bookmark**: Click the red delete button (🗑️) next to any bookmark
- **View Details**: Each bookmark shows its name, scroll position, and creation time

## File Structure

```
WebExtension/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── contentScript.js       # Content script for page interaction
├── popup.js              # Popup UI logic
├── UI.html               # Popup HTML interface
├── style.css             # Styling for the popup
├── assets/               # Extension icons and images
│   ├── ext-icon.png
│   ├── bookmark.png
│   ├── play.png
│   ├── delete.png
│   └── save.png
└── README.md             # This file
```

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension manifest format
- **Content Scripts**: Injected into all web pages to track scroll position
- **Background Service Worker**: Handles storage and communication between components
- **Chrome Storage API**: Stores bookmarks locally using chrome.storage.local
- **Message Passing**: Secure communication between popup, content script, and background

### Permissions

- `storage`: To save and retrieve bookmarks
- `tabs`: To communicate with active tabs
- `activeTab`: To access the current tab's scroll position

### Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Other Chromium-based browsers (Edge, Brave, etc.)

## Development

### Prerequisites

- Chrome browser with developer mode enabled
- Basic understanding of Chrome extension development

### Local Development

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder
5. Make changes to the code
6. Click the refresh button on the extension card to reload

### Testing

1. Load the extension in developer mode
2. Visit any webpage (try a long article or documentation)
3. Scroll to different positions and save bookmarks
4. Test jumping between bookmarks
5. Test deleting bookmarks
6. Refresh the page and verify bookmarks persist

## Use Cases

- **Long Articles**: Save positions for different sections
- **Documentation**: Bookmark important sections for quick reference
- **PDFs**: Save positions in online PDF viewers
- **Research**: Mark important findings in research papers
- **Tutorials**: Save progress points in step-by-step guides
- **Code Reviews**: Mark specific lines or sections in code reviews

## Troubleshooting

### Extension Not Working
- Make sure the extension is enabled in `chrome://extensions/`
- Check the browser console for any error messages
- Try refreshing the extension by clicking the refresh button

### Bookmarks Not Saving
- Ensure you're on a valid webpage (not chrome:// pages)
- Check that the page has finished loading completely
- Try refreshing the page and attempting again

### Can't Jump to Bookmarks
- Make sure the page hasn't changed significantly since saving
- Some dynamic pages may not work well with position bookmarks
- Try refreshing the page and then jumping to bookmarks

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension!

## License

This project is open source and available under the MIT License.
