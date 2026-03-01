const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const imgKretes = new Image();
const imgWorldTileset = new Image();

const TILE_SIZE = 16;
const TILE_SCALE = 4;
const TILE_DRAW_SIZE = TILE_SIZE * TILE_SCALE;
const FILL_TILE_INDEX = 1;
const EMPTY_TILE_INDEX = -1;
const MOVE_INTERVAL = 0.12;

const pressedKeys = new Set();
let activeDirectionKey = null;
let moveAccumulator = 0;

function createFilledWorldMap(tileIndex = FILL_TILE_INDEX) {
  const columns = Math.ceil(canvas.width / TILE_DRAW_SIZE);
  const rows = Math.ceil(canvas.height / TILE_DRAW_SIZE);

  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => tileIndex),
  );
}

const worldMap = createFilledWorldMap();

const player = {
  x: 0,
  y: 0,
  width: 64,
  height: 64,
};

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

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (isMovementKey(key)) {
    event.preventDefault();
    const wasAlreadyPressed = pressedKeys.has(key);
    pressedKeys.add(key);
    activeDirectionKey = key;

    if (!wasAlreadyPressed) {
      movePlayerByKey(activeDirectionKey);
      moveAccumulator = 0;
    }
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (!isMovementKey(key)) return;

  pressedKeys.delete(key);

  if (key === activeDirectionKey) {
    activeDirectionKey = getLatestPressedMovementKey();
  }

  if (!activeDirectionKey) {
    moveAccumulator = 0;
  }
});

function update(deltaTime) {
  if (!activeDirectionKey) return;

  moveAccumulator += deltaTime;

  while (moveAccumulator >= MOVE_INTERVAL) {
    movePlayerByKey(activeDirectionKey);
    moveAccumulator -= MOVE_INTERVAL;
  }
}

function movePlayerByKey(key) {
  let dx = 0;
  let dy = 0;

  if (key === "arrowup" || key === "w") dy = -1;
  else if (key === "arrowdown" || key === "s") dy = 1;
  else if (key === "arrowleft" || key === "a") dx = -1;
  else if (key === "arrowright" || key === "d") dx = 1;

  const nextX = player.x + dx * TILE_DRAW_SIZE;
  const nextY = player.y + dy * TILE_DRAW_SIZE;

  player.x = Math.max(0, Math.min(nextX, canvas.width - player.width));
  player.y = Math.max(0, Math.min(nextY, canvas.height - player.height));

  if (dx !== 0 || dy !== 0) {
    digTerrainAtPlayer();
  }
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
    digTerrainAtPlayer();
    requestAnimationFrame(gameLoop);
  }
}

imgKretes.addEventListener("load", onAssetLoaded);
imgWorldTileset.addEventListener("load", onAssetLoaded);

imgKretes.src = "assets/kretes/64x64.png";
imgWorldTileset.src =
  "assets/brackeys_platformer_assets/sprites/world_tileset.png";
