# Palette Peek

A Chrome extension that extracts dominant colors from any webpage and allows you to copy hex codes with a single click.

![Palette Peek](example%20(1).png)

## Features

- **🎨 Automatic Color Extraction** - Analyzes the current page and shows you the dominant colors with their percentages
- **📋 One-Click Copy** - Click any color swatch to instantly copy the hex code to your clipboard
- **⚙️ Customizable Palette Size** - Choose how many colors to extract (3-50) in the options page
- **🔄 Refresh Button** - Re-analyze the page to get updated colors
- **✨ Clean Interface** - Simple, visual display showing each color's hex code and percentage of the page
- **🔒 Privacy-Focused** - All processing happens locally in your browser; no data is collected or sent anywhere

## Installation

### From Chrome Web Store

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/palette-peek/jmgoliggkghalheoakfboofgfanbphdh)

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/palette-peek/jmgoliggkghalheoakfboofgfanbphdh)

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/milneoa15/palette-peek.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. The Palette Peek icon should now appear in your browser toolbar

## Usage

1. **Navigate** to any webpage you want to analyze
2. **Click** the Palette Peek extension icon in your browser toolbar
3. **View** the extracted color palette with hex codes and percentages
4. **Click** any color swatch to copy its hex code to your clipboard
5. **Customize** the number of colors extracted by clicking "Options" in the extension popup

## Project Structure

```
transcript_extension/
├── assets/              # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/               # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/             # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── scripts/             # Background and content scripts
│   ├── background.js
│   └── extractColors.js
├── styles/              # Shared styles
│   └── shared.css
├── manifest.json        # Extension manifest
└── package.json         # Node.js dependencies
```

## How It Works

1. When you click the extension icon, a content script is injected into the current page
2. The script scans all visible elements and extracts their background and text colors
3. Colors are quantized and grouped to find the dominant colors
4. The popup displays the results with percentages showing how prevalent each color is
5. Clicking a color copies its hex code to your clipboard

## Development

### Prerequisites

- Node.js (for running Prettier)
- Google Chrome or Chromium-based browser

### Setup

```bash
# Install dependencies
npm install

# Format code (if needed)
npx prettier --write .
```

### Testing

1. Make your changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Palette Peek extension card
4. Test the changes on various websites

## Technologies Used

- **Manifest V3** - Latest Chrome extension platform
- **Vanilla JavaScript** - No frameworks, pure JS
- **Chrome APIs** - `scripting`, `storage`, `activeTab`, `tabs`
- **CSS3** - Modern styling with custom properties

## Privacy

Palette Peek processes everything locally in your browser. The extension:
- ✅ Does NOT collect any personal data
- ✅ Does NOT track your browsing history
- ✅ Does NOT send data to external servers
- ✅ Only accesses page colors when you explicitly click the extension icon

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Author

Created with ❤️ for web designers and developers who love colors!

## Acknowledgments

- Thanks to the open-source community for inspiration
- Built with Chrome Extension Manifest V3 best practices

---

**Note:** If you encounter any issues or have suggestions, please open an issue on GitHub!
