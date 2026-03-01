const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const imgKretes = new Image();

const player = {
  x: 10,
  y: 10,
  width: 64,
  height: 64,
  speed: 300,
};

const pressedKeys = new Set();

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

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (isMovementKey(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (isMovementKey(key)) {
    pressedKeys.delete(key);
  }
});

function update(deltaTime) {
  let dx = 0;
  let dy = 0;

  if (pressedKeys.has("arrowup") || pressedKeys.has("w")) dy -= 1;
  if (pressedKeys.has("arrowdown") || pressedKeys.has("s")) dy += 1;
  if (pressedKeys.has("arrowleft") || pressedKeys.has("a")) dx -= 1;
  if (pressedKeys.has("arrowright") || pressedKeys.has("d")) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;

    player.x += dx * player.speed * deltaTime;
    player.y += dy * player.speed * deltaTime;
  }

  player.x = Math.max(0, Math.min(player.x, canvas.width - player.width));
  player.y = Math.max(0, Math.min(player.y, canvas.height - player.height));
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

imgKretes.addEventListener("load", () => {
  requestAnimationFrame(gameLoop);
});

imgKretes.src = "assets/kretes/64x64.png";
