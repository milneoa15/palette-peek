const MAX_CANVAS_EDGE = 600;
const MAX_ITERATIONS = 10;
const SHIFT_THRESHOLD = 2;
const ACCENT_TRACK_LIMIT = 20;
const ACCENT_SAT_THRESHOLD = 0.55;
const ACCENT_DISTANCE_THRESHOLD = 25;
const ACCENT_MIN_PERCENT = 0.004;
const ACCENT_REPLACE_THRESHOLD = 0.01;
const ACCENT_REPLACE_RATIO = 0.85;

export async function extractPalette(imageDataUrl, requestedCount) {
  const maxColors = sanitizeClusterCount(requestedCount);
  const image = await loadImage(imageDataUrl);
  const { context, width, height } = drawToCanvas(image);
  const { data } = context.getImageData(0, 0, width, height);

  const { pixels, accentCandidates } = collectPixels(data);
  if (pixels.length === 0) {
    return [];
  }

  const uniqueColorCount = getUniqueColorCount(pixels);
  const clusterCount = Math.min(maxColors, uniqueColorCount);

  const centroids = runKMeans(pixels, clusterCount);
  const swatches = buildPalette(pixels, centroids).sort((a, b) => b.percentage - a.percentage);
  const paletteWithAccents = ensureAccentCoverage(
    swatches,
    accentCandidates,
    maxColors,
    pixels.length
  );

  return paletteWithAccents
    .sort((a, b) => b.percentage - a.percentage)
    .map((swatch) => ({
      ...swatch,
      hex: rgbToHex(swatch.rgb),
      textColor: getReadableTextColor(swatch.rgb)
    }));
}

function sanitizeClusterCount(count) {
  if (typeof count !== "number" || Number.isNaN(count)) {
    return 10;
  }
  return clamp(Math.round(count), 1, 50);
}

function drawToCanvas(image) {
  const { width, height } = scaleDimensions(image.naturalWidth, image.naturalHeight);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    return { canvas, context, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return { canvas, context, width, height };
}

function scaleDimensions(originalWidth, originalHeight) {
  if (originalWidth <= MAX_CANVAS_EDGE && originalHeight <= MAX_CANVAS_EDGE) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;
  if (aspectRatio >= 1) {
    return {
      width: MAX_CANVAS_EDGE,
      height: Math.max(1, Math.round(MAX_CANVAS_EDGE / aspectRatio))
    };
  }

  return {
    width: Math.max(1, Math.round(MAX_CANVAS_EDGE * aspectRatio)),
    height: MAX_CANVAS_EDGE
  };
}

function collectPixels(data) {
  const pixels = [];
  const accentCandidates = [];

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) {
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    pixels.push([r, g, b]);

    const saturation = getSaturation(r, g, b);
    if (saturation >= ACCENT_SAT_THRESHOLD) {
      trackAccentCandidate(accentCandidates, { r, g, b }, saturation);
    }
  }

  return { pixels, accentCandidates };
}

function runKMeans(pixels, clusterCount) {
  if (clusterCount <= 0) {
    return [];
  }

  let centroids = initializeCentroids(pixels, clusterCount);
  let assignments = new Array(pixels.length).fill(0);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let hasChanged = false;

    for (let i = 0; i < pixels.length; i += 1) {
      const pixel = pixels[i];
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let c = 0; c < centroids.length; c += 1) {
        const dist = distance(pixel, centroids[c]);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestIndex = c;
        }
      }

      if (assignments[i] !== closestIndex) {
        assignments[i] = closestIndex;
        hasChanged = true;
      }
    }

    if (!hasChanged && iteration > 0) {
      break;
    }

    const newCentroids = recomputeCentroids(pixels, assignments, centroids.length);
    const totalShift = centroids.reduce(
      (sum, centroid, index) => sum + distance(centroid, newCentroids[index]),
      0
    );

    centroids = newCentroids;

    if (totalShift < SHIFT_THRESHOLD) {
      break;
    }
  }

  return centroids;
}

function initializeCentroids(pixels, clusterCount) {
  const centroids = [];
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push([...pixels[firstIndex]]);

  while (centroids.length < clusterCount) {
    const distances = [];
    let totalDistance = 0;

    for (let i = 0; i < pixels.length; i += 1) {
      const pixel = pixels[i];
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let c = 0; c < centroids.length; c += 1) {
        const dist = distanceSquared(pixel, centroids[c]);
        if (dist < closestDistance) {
          closestDistance = dist;
        }
      }

      distances[i] = closestDistance;
      totalDistance += closestDistance;
    }

    if (totalDistance === 0) {
      centroids.push([...pixels[Math.floor(Math.random() * pixels.length)]]);
      continue;
    }

    const target = Math.random() * totalDistance;
    let cumulative = 0;
    let chosenIndex = 0;

    for (let i = 0; i < distances.length; i += 1) {
      cumulative += distances[i];
      if (cumulative >= target) {
        chosenIndex = i;
        break;
      }
    }

    centroids.push([...pixels[chosenIndex]]);
  }

  return centroids;
}

function recomputeCentroids(pixels, assignments, clusterCount) {
  const sums = Array.from({ length: clusterCount }, () => [0, 0, 0, 0]);

  for (let i = 0; i < pixels.length; i += 1) {
    const cluster = assignments[i];
    const pixel = pixels[i];
    const sum = sums[cluster];
    sum[0] += pixel[0];
    sum[1] += pixel[1];
    sum[2] += pixel[2];
    sum[3] += 1;
  }

  return sums.map((sum, index) => {
    if (sum[3] === 0) {
      return [...pixels[index % pixels.length]];
    }
    return [
      Math.round(sum[0] / sum[3]),
      Math.round(sum[1] / sum[3]),
      Math.round(sum[2] / sum[3])
    ];
  });
}

function buildPalette(pixels, centroids) {
  const counts = centroids.map(() => 0);
  const assignments = new Array(pixels.length);

  for (let i = 0; i < pixels.length; i += 1) {
    const pixel = pixels[i];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let c = 0; c < centroids.length; c += 1) {
      const dist = distance(pixel, centroids[c]);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = c;
      }
    }

    assignments[i] = closestIndex;
    counts[closestIndex] += 1;
  }

  const total = pixels.length;

  return centroids.reduce((accumulator, rgb, index) => {
    const count = counts[index];
    if (count === 0) {
      return accumulator;
    }
    accumulator.push({
      rgb: {
        r: rgb[0],
        g: rgb[1],
        b: rgb[2]
      },
      percentage: count / total
    });
    return accumulator;
  }, []);
}

function ensureAccentCoverage(palette, accentCandidates, maxColors, totalPixels) {
  if (!accentCandidates.length) {
    return palette;
  }

  const result = [...palette].sort((a, b) => b.percentage - a.percentage);
  const sortedAccents = [...accentCandidates].sort((a, b) => b.score - a.score);

  for (const candidate of sortedAccents) {
    const percentage = candidate.count / totalPixels;
    if (percentage < ACCENT_MIN_PERCENT) {
      continue;
    }

    const represented = result.some(
      (entry) => distanceRgb(entry.rgb, candidate.rgb) <= ACCENT_DISTANCE_THRESHOLD
    );
    if (represented) {
      continue;
    }

    const accentEntry = {
      rgb: candidate.rgb,
      percentage
    };

    if (result.length < maxColors) {
      result.push(accentEntry);
      result.sort((a, b) => b.percentage - a.percentage);
      continue;
    }

    const smallest = result[result.length - 1];
    if (
      smallest.percentage <= ACCENT_REPLACE_THRESHOLD ||
      percentage >= smallest.percentage * ACCENT_REPLACE_RATIO
    ) {
      result[result.length - 1] = accentEntry;
      result.sort((a, b) => b.percentage - a.percentage);
    }
  }

  if (result.length > maxColors) {
    result.length = maxColors;
  }

  return result;
}

function distance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function distanceSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function distanceRgb(a, b) {
  return distance([a.r, a.g, a.b], [b.r, b.g, b.b]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rgbToHex({ r, g, b }) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function getReadableTextColor({ r, g, b }) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1B1B1B" : "#FFFFFF";
}

function getSaturation(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  if (max === min) {
    return 0;
  }
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function getUniqueColorCount(pixels) {
  const seen = new Set();
  for (const [r, g, b] of pixels) {
    seen.add(`${r},${g},${b}`);
  }
  return seen.size;
}

function trackAccentCandidate(candidates, rgb, saturation) {
  let existing = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (distanceRgb(candidate.rgb, rgb) <= ACCENT_DISTANCE_THRESHOLD) {
      existing = candidate;
      break;
    }
  }

  if (existing) {
    existing.count += 1;
    if (saturation > existing.saturation) {
      existing.saturation = saturation;
    }
    existing.score = existing.saturation * existing.count;
    return;
  }

  candidates.push({
    rgb,
    count: 1,
    saturation,
    score: saturation
  });

  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > ACCENT_TRACK_LIMIT) {
    candidates.length = ACCENT_TRACK_LIMIT;
  }
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load screenshot for analysis."));
    image.src = url;
  });
}
