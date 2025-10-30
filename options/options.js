const STORAGE_KEYS = {
  MAX_COLORS: "MAX_COLORS"
};

const DEFAULT_MAX_COLORS = 10;
const MIN_COLORS = 3;
const MAX_COLORS = 50;

const rangeField = document.getElementById("color-range");
const numberField = document.getElementById("color-input");
const statusLabel = document.getElementById("save-status");

document.addEventListener("DOMContentLoaded", init);

let isSyncing = false;

async function init() {
  document.documentElement.style.setProperty("--accent", "#38BDF8");

  const stored = await chrome.storage.sync.get(STORAGE_KEYS.MAX_COLORS);
  const value = clampValue(stored[STORAGE_KEYS.MAX_COLORS]);
  applyValue(value);

  rangeField.addEventListener("input", (event) => {
    applyValue(Number.parseInt(event.target.value, 10));
  });

  rangeField.addEventListener("change", (event) => {
    persistValue(Number.parseInt(event.target.value, 10));
  });

  numberField.addEventListener("input", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    applyValue(value);
  });

  numberField.addEventListener("change", (event) => {
    persistValue(Number.parseInt(event.target.value, 10));
  });
}

function applyValue(value) {
  const clamped = clampValue(value);
  if (isSyncing) {
    return;
  }

  isSyncing = true;
  rangeField.value = String(clamped);
  numberField.value = String(clamped);
  isSyncing = false;
}

async function persistValue(value) {
  const clamped = clampValue(value);
  applyValue(clamped);
  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.MAX_COLORS]: clamped });
    showStatus(`Saved ${clamped} colors`);
  } catch (error) {
    showStatus("Unable to save settings");
    console.error(error);
  }
}

function showStatus(message) {
  statusLabel.hidden = false;
  statusLabel.textContent = message;
  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    statusLabel.hidden = true;
  }, 1400);
}

function clampValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_MAX_COLORS;
  }
  return Math.min(Math.max(Math.round(value), MIN_COLORS), MAX_COLORS);
}
