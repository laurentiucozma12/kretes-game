const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const imgKretes = new Image();
const imgWorldTileset = new Image();

const TILE_SIZE = 16;
const TILE_SCALE = 4;
const TILE_DRAW_SIZE = TILE_SIZE * TILE_SCALE;
const FILL_TILE_INDEX = 1;
const EMPTY_TILE_INDEX = -1;
const MOVE_INTERVAL = 0.15;

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

    if (!wasAlreadyPressed && !movementState.isMoving) {
      startMoveByKey(activeDirectionKey);
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
});

function update(deltaTime) {
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
