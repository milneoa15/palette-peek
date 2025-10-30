const DEFAULT_MAX_COLORS = 10;
const MIN_COLORS = 3;
const MAX_COLORS = 50;
const STORAGE_KEYS = {
  MAX_COLORS: "MAX_COLORS"
};

const paletteCache = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.MAX_COLORS);
  if (stored[STORAGE_KEYS.MAX_COLORS] == null) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.MAX_COLORS]: DEFAULT_MAX_COLORS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "EXTRACT_COLORS") {
    const shouldForce = Boolean(message.payload?.force);
    handleExtractColors(message.payload?.maxColors, shouldForce)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({
          type: "EXTRACT_ERROR",
          error: normalizeError(error)
        })
      );
    return true;
  }

  if (message.type === "GET_MAX_COLORS") {
    getMaxColors(message.payload?.fallback)
      .then((maxColors) =>
        sendResponse({
          type: "GET_MAX_COLORS_SUCCESS",
          maxColors
        })
      )
      .catch((error) =>
        sendResponse({
          type: "EXTRACT_ERROR",
          error: normalizeError(error)
        })
      );
    return true;
  }

  return undefined;
});

async function handleExtractColors(requestedMax, force = false) {
  const maxColors = await getMaxColors(requestedMax);
  const tab = await getActiveTab();

  if (!tab || tab.id == null || tab.windowId == null) {
    throw new Error("Could not determine the active tab.");
  }

  if (isDisallowedUrl(tab.url)) {
    throw new Error("Palette Peek cannot access this page. Try a different site.");
  }

  const cacheKey = `${tab.id}:${maxColors}`;
  const cached = paletteCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.timestamp < 5000) {
    return {
      type: "EXTRACT_SUCCESS",
      palette: cached.palette,
      meta: { cached: true }
    };
  }

  let screenshotUrl;
  try {
    screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (error) {
    throw new Error("Unable to capture the current tab. Make sure the tab is visible.");
  }

  let scriptResults;
  try {
    scriptResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [screenshotUrl, maxColors],
      func: async (imageDataUrl, count) => {
        const module = await import(chrome.runtime.getURL("scripts/extractColors.js"));
        return module.extractPalette(imageDataUrl, count);
      }
    });
  } catch (error) {
    throw new Error("Palette extraction failed to run on this page.");
  }

  const [firstResult] = scriptResults || [];
  if (!firstResult || !Array.isArray(firstResult.result)) {
    throw new Error("Palette extraction returned no results.");
  }

  const palette = firstResult.result;
  paletteCache.set(cacheKey, { palette, timestamp: Date.now() });

  return {
    type: "EXTRACT_SUCCESS",
    palette,
    meta: { cached: false }
  };
}

async function getMaxColors(requestedMax) {
  const fallback = clamp(
    typeof requestedMax === "number" ? Math.round(requestedMax) : DEFAULT_MAX_COLORS,
    MIN_COLORS,
    MAX_COLORS
  );

  const stored = await chrome.storage.sync.get(STORAGE_KEYS.MAX_COLORS);
  const storedValue = stored[STORAGE_KEYS.MAX_COLORS];

  if (typeof storedValue === "number" && !Number.isNaN(storedValue)) {
    return clamp(Math.round(storedValue), MIN_COLORS, MAX_COLORS);
  }

  return fallback;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isDisallowedUrl(url) {
  if (!url) {
    return true;
  }
  return /^chrome:|^chrome-extension:|^chrome-native:|^devtools:/.test(url);
}

function normalizeError(error) {
  if (!error) {
    return {
      message: "Something went wrong."
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return {
    message: error.message || "Something went wrong."
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
