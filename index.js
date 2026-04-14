import {
  BRUSHES,
  FILL_TILE_INDEX,
  createFilledWorldMap,
  clampPlayerToBounds,
  digTerrainAtPlayer,
  isMovementKey,
  getLatestPressedMovementKey,
  startMoveByKey,
  updateMovement,
  renderWorld,
  drawEditorGrid,
  getCanvasTilePositionFromEvent,
  isTypingInFormControl,
  TILE_DRAW_SIZE,
} from "./src/game-utils.js";
import {
  DEFAULT_LEVEL_NAME,
  createLevelFromCurrentState,
  isValidLevelShape,
  normalizeLevelName,
  loadSavedLevels,
  persistSavedLevels,
  saveLevelJsonToLevelsFolder,
  hasFileSystemAccess,
} from "./src/level-storage.js";

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
let worldMap = createFilledWorldMap(canvas);
let savedLevels = loadSavedLevels();

const player = {
  x: 0,
  y: 0,
  width: 64,
  height: 64,
};

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

function applyLevel(level) {
  if (!isValidLevelShape(level)) return false;

  worldMap = level.tiles.map((row) => [...row]);
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  clampPlayerToBounds(player, canvas);
  movementState.isMoving = false;
  movementState.elapsed = 0;

  return true;
}

function getSelectedLevel() {
  const selectedName = levelSelect.value;
  return savedLevels.find((level) => level.name === selectedName) ?? null;
}

async function saveCurrentLevel() {
  const name = normalizeLevelName(levelNameInput.value);
  const level = createLevelFromCurrentState(name, worldMap, player);
  const existingIndex = savedLevels.findIndex((item) => item.name === name);

  if (existingIndex >= 0) {
    savedLevels[existingIndex] = level;
  } else {
    savedLevels.push(level);
  }

  persistSavedLevels(savedLevels);
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

  if (!hasFileSystemAccess()) {
    setEditorStatus(
      `Saved local only: ${name} (browser has no file access API)`,
    );
    return;
  }

  setEditorStatus(`Saved local only: ${name} (file write failed)`);
}

function createNewLevel() {
  worldMap = createFilledWorldMap(canvas, FILL_TILE_INDEX);
  player.x = 0;
  player.y = 0;
  movementState.isMoving = false;
  digTerrainAtPlayer(player, worldMap);
  setEditorStatus("New level created");
}

function toggleEditorMode(forceMode) {
  isEditorMode = typeof forceMode === "boolean" ? forceMode : !isEditorMode;
  isSpawnPlacementArmed = false;
  setEditorStatus(`Mode: ${isEditorMode ? "Edit" : "Play"}`);
}

function paintTileAt(row, col, tileIndex) {
  if (row < 0 || row >= worldMap.length) return;
  if (col < 0 || col >= worldMap[row].length) return;
  worldMap[row][col] = tileIndex;
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
      startMoveByKey(activeDirectionKey, player, movementState, canvas);
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (isEditorMode) return;

  const key = event.key.toLowerCase();
  if (!isMovementKey(key)) return;

  pressedKeys.delete(key);

  if (key === activeDirectionKey) {
    activeDirectionKey = getLatestPressedMovementKey(pressedKeys);
  }
});

function update(deltaTime) {
  if (isEditorMode) return;

  const reachedTile = updateMovement(deltaTime, player, movementState);
  if (reachedTile) {
    digTerrainAtPlayer(player, worldMap);
  }

  if (!movementState.isMoving && activeDirectionKey) {
    startMoveByKey(activeDirectionKey, player, movementState, canvas);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderWorld(ctx, imgWorldTileset, worldMap);

  if (isEditorMode) {
    drawEditorGrid(ctx, canvas);
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
  if (loadedAssets !== totalAssets) return;

  const defaultLevel = savedLevels.find(
    (level) => level.name === DEFAULT_LEVEL_NAME,
  );
  if (defaultLevel) {
    applyLevel(defaultLevel);
    levelNameInput.value = defaultLevel.name;
  } else {
    digTerrainAtPlayer(player, worldMap);
    levelNameInput.value = DEFAULT_LEVEL_NAME;
  }

  refreshSavedLevelsSelect();
  setEditorStatus("Mode: Play");
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener("contextmenu", (event) => {
  if (isEditorMode) event.preventDefault();
});

canvas.addEventListener("pointerdown", (event) => {
  if (!isEditorMode) return;

  const { row, col } = getCanvasTilePositionFromEvent(event, canvas);

  if (isSpawnPlacementArmed) {
    player.x = col * TILE_DRAW_SIZE;
    player.y = row * TILE_DRAW_SIZE;
    clampPlayerToBounds(player, canvas);
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
    worldMap,
    player,
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

    persistSavedLevels(savedLevels);
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
