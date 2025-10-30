const STORAGE_KEYS = {
  MAX_COLORS: "MAX_COLORS"
};

const DEFAULT_MAX_COLORS = 10;
const REQUEST_TIMEOUT = 5000;

const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const retryButton = document.getElementById("retry-button");
const refreshButton = document.getElementById("refresh-button");
const optionsButton = document.getElementById("options-button");
const paletteSection = document.getElementById("palette-section");
const toast = document.getElementById("toast");

document.addEventListener("DOMContentLoaded", init);

function init() {
  retryButton.addEventListener("click", () => runExtraction());
  refreshButton.addEventListener("click", () => runExtraction({ force: true }));
  optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  paletteSection.addEventListener("click", handleSwatchClick);

  runExtraction();
}

async function runExtraction({ force = false } = {}) {
  showLoading();
  try {
    const maxColors = await getMaxColors();
    const response = await requestPalette({ maxColors, force });

    if (response.type !== "EXTRACT_SUCCESS" || !Array.isArray(response.palette)) {
      throw new Error("Unexpected response from Palette Peek.");
    }

    renderPalette(response.palette);
  } catch (error) {
    showError(error?.message || "We could not build a palette on this page.");
  }
}

async function getMaxColors() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.MAX_COLORS);
  const value = stored[STORAGE_KEYS.MAX_COLORS];
  if (typeof value === "number" && !Number.isNaN(value)) {
    return clamp(Math.round(value), 3, 50);
  }
  return DEFAULT_MAX_COLORS;
}

function requestPalette({ maxColors, force }) {
  return withTimeout(
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "EXTRACT_COLORS",
          payload: { maxColors, force }
        },
        (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!response) {
            reject(new Error("Palette Peek did not respond. Try refreshing."));
            return;
          }
          if (response.type === "EXTRACT_ERROR") {
            reject(new Error(response?.error?.message || "Extraction failed."));
            return;
          }
          resolve(response);
        }
      );
    }),
    REQUEST_TIMEOUT,
    "The request timed out. Try again on this page."
  );
}

function renderPalette(palette) {
  const fragment = document.createDocumentFragment();

  const primaryColor = palette[0]?.hex ?? "#38BDF8";
  document.documentElement.style.setProperty("--accent", primaryColor);

  palette.forEach((entry) => {
    const swatch = document.createElement("article");
    swatch.className = "swatch";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch__button";
    button.dataset.hex = entry.hex;
    button.title = `Copy ${entry.hex}`;

    const preview = document.createElement("div");
    preview.className = "swatch__preview";
    preview.style.background = entry.hex;
    preview.style.color = entry.textColor;

    const hexLabel = document.createElement("span");
    hexLabel.className = "swatch__label";
    hexLabel.textContent = entry.hex;

    const percentageLabel = document.createElement("span");
    percentageLabel.className = "swatch__percentage";
    percentageLabel.textContent = formatPercentage(entry.percentage);

    preview.append(hexLabel, percentageLabel);
    button.append(preview);
    button.setAttribute("aria-label", `Copy ${entry.hex}, ${percentageLabel.textContent}`);

    swatch.append(button);
    fragment.append(swatch);
  });

  paletteSection.replaceChildren(fragment);
  showPalette();
}

function formatPercentage(value) {
  const percentage = Math.round(value * 100);
  if (percentage === 0 && value > 0) {
    return "<1%";
  }
  return `${percentage}%`;
}

async function handleSwatchClick(event) {
  const target = event.target.closest(".swatch__button");
  if (!target) {
    return;
  }

  const hex = target.dataset.hex;
  if (!hex) {
    return;
  }

  try {
    await navigator.clipboard.writeText(hex);
    showToast(`Copied ${hex}`);
  } catch (_error) {
    showToast("Clipboard access denied");
  }
}

function showLoading() {
  loadingState.hidden = false;
  errorState.hidden = true;
  paletteSection.classList.add("is-hidden");
}

function showError(message) {
  errorMessage.textContent = message;
  loadingState.hidden = true;
  errorState.hidden = false;
  paletteSection.classList.add("is-hidden");
}

function showPalette() {
  loadingState.hidden = true;
  errorState.hidden = true;
  paletteSection.classList.remove("is-hidden");
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    showToast.timeoutId = window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 1800);
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
  return Promise.race([
    promise.finally(() => {
      clearTimeout(timeoutId);
    }),
    timeout
  ]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
