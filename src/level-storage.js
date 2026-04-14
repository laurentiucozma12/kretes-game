const STORAGE_LEVELS_KEY = "kretes_custom_levels_v1";
export const DEFAULT_LEVEL_NAME = "Default";
const HAS_FILE_SYSTEM_ACCESS = "showDirectoryPicker" in window;

let projectDirectoryHandle = null;

export function createLevelFromCurrentState(name, worldMap, player) {
  return {
    name,
    rows: worldMap.length,
    cols: worldMap[0]?.length ?? 0,
    spawn: {
      x: Math.round(player.x),
      y: Math.round(player.y),
    },
    tiles: worldMap.map((row) => [...row]),
  };
}

export function isValidLevelShape(level) {
  if (!level || !Array.isArray(level.tiles)) return false;
  if (!Number.isInteger(level.rows) || !Number.isInteger(level.cols)) {
    return false;
  }
  if (!level.rows || !level.cols) return false;
  if (!level.spawn || typeof level.spawn.x !== "number") return false;
  if (typeof level.spawn.y !== "number") return false;
  if (level.tiles.length !== level.rows) return false;
  return level.tiles.every(
    (row) => Array.isArray(row) && row.length === level.cols,
  );
}

export function normalizeLevelName(rawName) {
  const name = String(rawName ?? "").trim();
  return name || DEFAULT_LEVEL_NAME;
}

export function sanitizeLevelFileName(levelName) {
  return levelName
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export function loadSavedLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_LEVELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((level) => isValidLevelShape(level));
  } catch {
    return [];
  }
}

export function persistSavedLevels(savedLevels) {
  localStorage.setItem(STORAGE_LEVELS_KEY, JSON.stringify(savedLevels));
}

async function ensureProjectDirectoryHandle() {
  if (!HAS_FILE_SYSTEM_ACCESS) return null;
  if (projectDirectoryHandle) return projectDirectoryHandle;

  projectDirectoryHandle = await window.showDirectoryPicker({
    mode: "readwrite",
  });

  return projectDirectoryHandle;
}

export async function saveLevelJsonToLevelsFolder(level) {
  try {
    const response = await fetch("/api/levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(level),
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.ok && result.fileName) {
        return { ok: true, fileName: result.fileName, via: "api" };
      }
    }
  } catch {
    // Ignore network/API errors and continue to browser file API fallback.
  }

  if (!HAS_FILE_SYSTEM_ACCESS) return { ok: false, reason: "unsupported" };

  try {
    const rootDirectory = await ensureProjectDirectoryHandle();
    if (!rootDirectory) return { ok: false, reason: "no-directory" };

    const levelsDirectory = await rootDirectory.getDirectoryHandle("levels", {
      create: true,
    });
    const safeName = sanitizeLevelFileName(level.name) || DEFAULT_LEVEL_NAME;
    const fileHandle = await levelsDirectory.getFileHandle(`${safeName}.json`, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(level, null, 2));
    await writable.close();

    return { ok: true, fileName: `${safeName}.json`, via: "browser-api" };
  } catch (error) {
    return {
      ok: false,
      reason: error && error.name ? error.name : "write-failed",
    };
  }
}

export function hasFileSystemAccess() {
  return HAS_FILE_SYSTEM_ACCESS;
}
