export const TILE_SIZE = 16;
export const TILE_SCALE = 4;
export const TILE_DRAW_SIZE = TILE_SIZE * TILE_SCALE;
export const FILL_TILE_INDEX = 1;
export const EMPTY_TILE_INDEX = -1;
export const MOVE_INTERVAL = 0.15;

export const BRUSHES = {
  fill: FILL_TILE_INDEX,
  empty: EMPTY_TILE_INDEX,
};

export function createFilledWorldMap(canvas, tileIndex = FILL_TILE_INDEX) {
  const columns = Math.ceil(canvas.width / TILE_DRAW_SIZE);
  const rows = Math.ceil(canvas.height / TILE_DRAW_SIZE);

  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => tileIndex),
  );
}

export function clampPlayerToBounds(player, canvas) {
  player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  player.y = Math.max(0, Math.min(player.y, canvas.height - player.height));
}

export function digTerrainAtPlayer(player, worldMap) {
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

export function isMovementKey(key) {
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

export function getLatestPressedMovementKey(pressedKeys) {
  const keys = Array.from(pressedKeys);
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function getDirectionFromKey(key) {
  let dx = 0;
  let dy = 0;

  if (key === "arrowup" || key === "w") dy = -1;
  else if (key === "arrowdown" || key === "s") dy = 1;
  else if (key === "arrowleft" || key === "a") dx = -1;
  else if (key === "arrowright" || key === "d") dx = 1;

  return { dx, dy };
}

export function startMoveByKey(key, player, movementState, canvas) {
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

export function updateMovement(deltaTime, player, movementState) {
  if (!movementState.isMoving) return false;

  movementState.elapsed += deltaTime;
  const progress = Math.min(movementState.elapsed / MOVE_INTERVAL, 1);

  player.x =
    movementState.startX +
    (movementState.targetX - movementState.startX) * progress;
  player.y =
    movementState.startY +
    (movementState.targetY - movementState.startY) * progress;

  if (progress < 1) return false;

  player.x = movementState.targetX;
  player.y = movementState.targetY;
  movementState.isMoving = false;
  movementState.elapsed = 0;
  return true;
}

export function drawTileByIndex(
  ctx,
  imgWorldTileset,
  tileIndex,
  x,
  y,
  size = TILE_DRAW_SIZE,
) {
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

export function renderWorld(ctx, imgWorldTileset, worldMap) {
  for (let row = 0; row < worldMap.length; row++) {
    for (let col = 0; col < worldMap[row].length; col++) {
      const tileIndex = worldMap[row][col];
      const x = col * TILE_DRAW_SIZE;
      const y = row * TILE_DRAW_SIZE;
      drawTileByIndex(ctx, imgWorldTileset, tileIndex, x, y);
    }
  }
}

export function drawEditorGrid(ctx, canvas) {
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

export function getCanvasTilePositionFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  const col = Math.floor(canvasX / TILE_DRAW_SIZE);
  const row = Math.floor(canvasY / TILE_DRAW_SIZE);
  return { row, col };
}

export function isTypingInFormControl(target) {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("input, textarea, select") !== null ||
    target.closest("[contenteditable='true']") !== null
  );
}
