# TabCur - Advanced Tab Manager for Chrome

TabCur is an advanced tab management Chrome extension that helps you organize and navigate your tabs efficiently. It provides automatic and manual tab grouping, quick navigation between tabs, and a clean interface to manage your browsing sessions.

## Features

- **Automatic Tab Grouping**: Automatically groups tabs based on their domains
- **Custom Tab Groups**: Create and manage custom tab groups with specific keywords
- **Multi-Window Support**: Maintain separate tab groups across different windows
- **Recent Tabs**: Quick access to your recently visited tabs
- **Previous Tab Navigation**: Easily navigate to previously visited tabs
- **Theme Support**: Light, dark, and system theme options
- **Customizable Settings**: Configure grouping behavior and appearance

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/tabcur.git
cd tabcur
```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project directory

## Development

### Project Structure
```
tabcur/
├── background.js     # Background service worker
├── popup.js         # Popup UI interactions
├── popup.html       # Popup HTML structure
├── manifest.json    # Extension manifest
└── icons/          # Extension icons
```

### Local Development

1. Make your changes to the source files
2. Reload the extension in Chrome's extensions page
3. For background script changes, click the "Update" button in extensions page

## License

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without the express written permission of Nadav Lichter.

Copyright (c) 2024 Nadav Lichter. All rights reserved. 