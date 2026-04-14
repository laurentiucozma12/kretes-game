const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const levelNameInput = document.getElementById("levelName");
const levelSelect = document.getElementById("levelSelect");
const newLevelBtn = document.getElementById("newLevelBtn");
const saveLevelBtn = document.getElementById("saveLevelBtn");
const loadLevelBtn = document.getElementById("loadLevelBtn");
const playBtn = document.getElementById("playBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const editorStatus = document.getElementById("editorStatus");

const imgKretes = new Image();
const imgWorldTileset = new Image();

const TILE_SIZE = 16;
const TILE_SCALE = 4;
const TILE_DRAW_SIZE = TILE_SIZE * TILE_SCALE;
const FILL_TILE_INDEX = 1;
const EMPTY_TILE_INDEX = -1;
const MOVE_INTERVAL = 0.15;
const STORAGE_LEVELS_KEY = "kretes_custom_levels_v1";
const DEFAULT_LEVEL_NAME = "default";
const HAS_FILE_SYSTEM_ACCESS = "showDirectoryPicker" in window;

const BRUSHES = {
  fill: FILL_TILE_INDEX,
  empty: EMPTY_TILE_INDEX,
};

const pressedKeys = new Set();
let activeDirectionKey = null;
const movementState = {
  isMoving: false,
  startX: 0,
  startY: 0,
  targetX: 0,
  targetY: 0,
  elapsed: 0,
};

let isEditorMode = false;
let isSpawnPlacementArmed = false;
let activeBrush = BRUSHES.fill;
let projectDirectoryHandle = null;

function createFilledWorldMap(tileIndex = FILL_TILE_INDEX) {
  const columns = Math.ceil(canvas.width / TILE_DRAW_SIZE);
  const rows = Math.ceil(canvas.height / TILE_DRAW_SIZE);

  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => tileIndex),
  );
}

let worldMap = createFilledWorldMap();

let savedLevels = loadSavedLevels();

const player = {
  x: 0,
  y: 0,
  width: 64,
  height: 64,
};

function createLevelFromCurrentState(name) {
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

function isValidLevelShape(level) {
  if (!level || !Array.isArray(level.tiles)) return false;
  if (!Number.isInteger(level.rows) || !Number.isInteger(level.cols))
    return false;
  if (!level.rows || !level.cols) return false;
  if (!level.spawn || typeof level.spawn.x !== "number") return false;
  if (typeof level.spawn.y !== "number") return false;
  if (level.tiles.length !== level.rows) return false;
  return level.tiles.every(
    (row) => Array.isArray(row) && row.length === level.cols,
  );
}

function normalizeLevelName(rawName) {
  const name = String(rawName ?? "").trim();
  return name || DEFAULT_LEVEL_NAME;
}

function sanitizeLevelFileName(levelName) {
  return levelName
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function loadSavedLevels() {
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

function persistSavedLevels() {
  localStorage.setItem(STORAGE_LEVELS_KEY, JSON.stringify(savedLevels));
}

function refreshSavedLevelsSelect() {
  levelSelect.innerHTML = "";

  if (savedLevels.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "No saved levels";
    emptyOption.value = "";
    levelSelect.appendChild(emptyOption);
    levelSelect.disabled = true;
    return;
  }

  levelSelect.disabled = false;
  for (const level of savedLevels) {
    const option = document.createElement("option");
    option.value = level.name;
    option.textContent = level.name;
    levelSelect.appendChild(option);
  }

  levelSelect.value = savedLevels[0].name;
}

function setEditorStatus(text) {
  editorStatus.textContent = text;
}

function clampPlayerToBounds() {
  player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  player.y = Math.max(0, Math.min(player.y, canvas.height - player.height));
}

function applyLevel(level) {
  if (!isValidLevelShape(level)) return false;

  worldMap = level.tiles.map((row) => [...row]);
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  clampPlayerToBounds();
  movementState.isMoving = false;
  movementState.elapsed = 0;

  return true;
}

function getSelectedLevel() {
  const selectedName = levelSelect.value;
  return savedLevels.find((level) => level.name === selectedName) ?? null;
}

async function ensureProjectDirectoryHandle() {
  if (!HAS_FILE_SYSTEM_ACCESS) return null;
  if (projectDirectoryHandle) return projectDirectoryHandle;

  projectDirectoryHandle = await window.showDirectoryPicker({
    mode: "readwrite",
  });

  return projectDirectoryHandle;
}

async function saveLevelJsonToLevelsFolder(level) {
  // Preferred path: local API writes directly to project /levels folder.
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

async function saveCurrentLevel() {
  const name = normalizeLevelName(levelNameInput.value);
  const level = createLevelFromCurrentState(name);
  const existingIndex = savedLevels.findIndex((item) => item.name === name);

  if (existingIndex >= 0) {
    savedLevels[existingIndex] = level;
  } else {
    savedLevels.push(level);
  }

  persistSavedLevels();
  refreshSavedLevelsSelect();
  levelSelect.value = name;

  const fileResult = await saveLevelJsonToLevelsFolder(level);
  if (fileResult.ok) {
    if (fileResult.via === "api") {
      setEditorStatus(
        `Saved on disk: ${name} -> levels/${fileResult.fileName}`,
      );
      return;
    }

    setEditorStatus(
      `Saved via browser access: ${name} -> levels/${fileResult.fileName}`,
    );
    return;
  }

  if (fileResult.reason === "AbortError") {
    setEditorStatus(`Saved local only: ${name} (folder access canceled)`);
    return;
  }

  if (!HAS_FILE_SYSTEM_ACCESS) {
    setEditorStatus(
      `Saved local only: ${name} (browser has no file access API)`,
    );
    return;
  }

  setEditorStatus(`Saved local only: ${name} (file write failed)`);
}

function createNewLevel() {
  worldMap = createFilledWorldMap(FILL_TILE_INDEX);
  player.x = 0;
  player.y = 0;
  movementState.isMoving = false;
  digTerrainAtPlayer();
  setEditorStatus("New level created");
}

function toggleEditorMode(forceMode) {
  isEditorMode = typeof forceMode === "boolean" ? forceMode : !isEditorMode;
  isSpawnPlacementArmed = false;
  setEditorStatus(`Mode: ${isEditorMode ? "Edit" : "Play"}`);
}

function getCanvasTilePositionFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  const col = Math.floor(canvasX / TILE_DRAW_SIZE);
  const row = Math.floor(canvasY / TILE_DRAW_SIZE);
  return { row, col };
}

function paintTileAt(row, col, tileIndex) {
  if (row < 0 || row >= worldMap.length) return;
  if (col < 0 || col >= worldMap[row].length) return;
  worldMap[row][col] = tileIndex;
}

function drawEditorGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += TILE_DRAW_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += TILE_DRAW_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function isMovementKey(key) {
  return [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d",
  ].includes(key);
}

function getLatestPressedMovementKey() {
  const keys = Array.from(pressedKeys);
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

function isTypingInFormControl(target) {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("input, textarea, select") !== null ||
    target.closest("[contenteditable='true']") !== null
  );
}

window.addEventListener("keydown", (event) => {
  if (isTypingInFormControl(event.target)) return;

  const key = event.key.toLowerCase();

  if (key === "e") {
    event.preventDefault();
    toggleEditorMode();
    return;
  }

  if (isEditorMode && key === "p") {
    isSpawnPlacementArmed = true;
    setEditorStatus("Click to set spawn position");
    return;
  }

  if (isEditorMode && key === "1") {
    activeBrush = BRUSHES.fill;
    setEditorStatus(`Brush: Fill (tile ${FILL_TILE_INDEX})`);
    return;
  }

  if (isEditorMode && key === "2") {
    activeBrush = BRUSHES.empty;
    setEditorStatus("Brush: Empty");
    return;
  }

  if (isEditorMode) return;

  if (isMovementKey(key)) {
    event.preventDefault();
    const wasAlreadyPressed = pressedKeys.has(key);
    pressedKeys.add(key);
    activeDirectionKey = key;

    if (!wasAlreadyPressed && !movementState.isMoving) {
      startMoveByKey(activeDirectionKey);
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (isEditorMode) return;

  const key = event.key.toLowerCase();
  if (!isMovementKey(key)) return;

  pressedKeys.delete(key);

  if (key === activeDirectionKey) {
    activeDirectionKey = getLatestPressedMovementKey();
  }
});

function update(deltaTime) {
  if (isEditorMode) return;

  if (movementState.isMoving) {
    movementState.elapsed += deltaTime;
    const progress = Math.min(movementState.elapsed / MOVE_INTERVAL, 1);

    player.x =
      movementState.startX +
      (movementState.targetX - movementState.startX) * progress;
    player.y =
      movementState.startY +
      (movementState.targetY - movementState.startY) * progress;

    if (progress >= 1) {
      player.x = movementState.targetX;
      player.y = movementState.targetY;
      movementState.isMoving = false;
      movementState.elapsed = 0;
      digTerrainAtPlayer();
    }
  }

  if (!movementState.isMoving && activeDirectionKey) {
    startMoveByKey(activeDirectionKey);
  }
}

function getDirectionFromKey(key) {
  let dx = 0;
  let dy = 0;

  if (key === "arrowup" || key === "w") dy = -1;
  else if (key === "arrowdown" || key === "s") dy = 1;
  else if (key === "arrowleft" || key === "a") dx = -1;
  else if (key === "arrowright" || key === "d") dx = 1;

  return { dx, dy };
}

function startMoveByKey(key) {
  const { dx, dy } = getDirectionFromKey(key);
  if (dx === 0 && dy === 0) return;

  const startX = player.x;
  const startY = player.y;

  const nextX = startX + dx * TILE_DRAW_SIZE;
  const nextY = startY + dy * TILE_DRAW_SIZE;

  const clampedX = Math.max(0, Math.min(nextX, canvas.width - player.width));
  const clampedY = Math.max(0, Math.min(nextY, canvas.height - player.height));

  if (clampedX === startX && clampedY === startY) return;

  movementState.isMoving = true;
  movementState.startX = startX;
  movementState.startY = startY;
  movementState.targetX = clampedX;
  movementState.targetY = clampedY;
  movementState.elapsed = 0;
}

function digTerrainAtPlayer() {
  const startCol = Math.floor(player.x / TILE_DRAW_SIZE);
  const endCol = Math.floor((player.x + player.width - 1) / TILE_DRAW_SIZE);
  const startRow = Math.floor(player.y / TILE_DRAW_SIZE);
  const endRow = Math.floor((player.y + player.height - 1) / TILE_DRAW_SIZE);

  for (let row = startRow; row <= endRow; row++) {
    if (row < 0 || row >= worldMap.length) continue;

    for (let col = startCol; col <= endCol; col++) {
      if (col < 0 || col >= worldMap[row].length) continue;
      worldMap[row][col] = EMPTY_TILE_INDEX;
    }
  }
}

function drawTileByIndex(tileIndex, x, y, size = TILE_DRAW_SIZE) {
  if (tileIndex < 0) return;

  const sheetColumns = imgWorldTileset.width / TILE_SIZE;
  const tileX = (tileIndex % sheetColumns) * TILE_SIZE;
  const tileY = Math.floor(tileIndex / sheetColumns) * TILE_SIZE;

  ctx.drawImage(
    imgWorldTileset,
    tileX,
    tileY,
    TILE_SIZE,
    TILE_SIZE,
    x,
    y,
    size,
    size,
  );
}

function renderWorld() {
  for (let row = 0; row < worldMap.length; row++) {
    for (let col = 0; col < worldMap[row].length; col++) {
      const tileIndex = worldMap[row][col];
      const x = col * TILE_DRAW_SIZE;
      const y = row * TILE_DRAW_SIZE;
      drawTileByIndex(tileIndex, x, y);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderWorld();

  if (isEditorMode) {
    drawEditorGrid();
  }

  ctx.drawImage(imgKretes, player.x, player.y, player.width, player.height);
}

let lastTime = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(deltaTime);
  render();

  requestAnimationFrame(gameLoop);
}

let loadedAssets = 0;
const totalAssets = 2;

function onAssetLoaded() {
  loadedAssets += 1;
  if (loadedAssets === totalAssets) {
    const defaultLevel = savedLevels.find(
      (level) => level.name === DEFAULT_LEVEL_NAME,
    );
    if (defaultLevel) {
      applyLevel(defaultLevel);
      levelNameInput.value = defaultLevel.name;
    } else {
      digTerrainAtPlayer();
      levelNameInput.value = DEFAULT_LEVEL_NAME;
    }

    refreshSavedLevelsSelect();
    setEditorStatus("Mode: Play");

    requestAnimationFrame(gameLoop);
  }
}

canvas.addEventListener("contextmenu", (event) => {
  if (isEditorMode) {
    event.preventDefault();
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (!isEditorMode) return;

  const { row, col } = getCanvasTilePositionFromEvent(event);

  if (isSpawnPlacementArmed) {
    player.x = col * TILE_DRAW_SIZE;
    player.y = row * TILE_DRAW_SIZE;
    clampPlayerToBounds();
    isSpawnPlacementArmed = false;
    setEditorStatus("Spawn updated");
    return;
  }

  const tile = event.button === 2 ? BRUSHES.empty : activeBrush;
  paintTileAt(row, col, tile);
});

newLevelBtn.addEventListener("click", () => {
  toggleEditorMode(true);
  createNewLevel();
});

saveLevelBtn.addEventListener("click", async () => {
  await saveCurrentLevel();
});

loadLevelBtn.addEventListener("click", () => {
  const selectedLevel = getSelectedLevel();
  if (!selectedLevel) {
    setEditorStatus("No level selected");
    return;
  }

  applyLevel(selectedLevel);
  levelNameInput.value = selectedLevel.name;
  setEditorStatus(`Loaded: ${selectedLevel.name}`);
});

playBtn.addEventListener("click", () => {
  toggleEditorMode(false);
});

exportBtn.addEventListener("click", async () => {
  const level = createLevelFromCurrentState(
    normalizeLevelName(levelNameInput.value),
  );
  const json = JSON.stringify(level);

  try {
    await navigator.clipboard.writeText(json);
    setEditorStatus("Level JSON copied to clipboard");
  } catch {
    setEditorStatus("Clipboard blocked. Use browser permissions.");
  }
});

importBtn.addEventListener("click", () => {
  const json = window.prompt("Paste level JSON");
  if (!json) return;

  try {
    const level = JSON.parse(json);
    if (!isValidLevelShape(level)) {
      setEditorStatus("Invalid level format");
      return;
    }

    const name = normalizeLevelName(level.name);
    level.name = name;
    const existingIndex = savedLevels.findIndex((item) => item.name === name);
    if (existingIndex >= 0) {
      savedLevels[existingIndex] = level;
    } else {
      savedLevels.push(level);
    }

    persistSavedLevels();
    refreshSavedLevelsSelect();
    levelSelect.value = name;
    levelNameInput.value = name;
    applyLevel(level);
    setEditorStatus(`Imported: ${name}`);
  } catch {
    setEditorStatus("Could not parse JSON");
  }
});

levelSelect.addEventListener("change", () => {
  const selectedLevel = getSelectedLevel();
  if (selectedLevel) {
    levelNameInput.value = selectedLevel.name;
  }
});

imgKretes.addEventListener("load", onAssetLoaded);
imgWorldTileset.addEventListener("load", onAssetLoaded);

imgKretes.src = "assets/kretes/64x64.png";
imgWorldTileset.src =
  "assets/brackeys_platformer_assets/sprites/world_tileset.png";
