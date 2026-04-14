const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = 5173;
const ROOT_DIR = __dirname;
const LEVELS_DIR = path.join(ROOT_DIR, "levels");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function sendJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function sanitizeLevelFileName(levelName) {
  return (
    String(levelName || "default")
      .toLowerCase()
      .replace(/[^a-z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "default"
  );
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
      const total = chunks.reduce((sum, item) => sum + item.length, 0);
      if (total > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function isValidLevelShape(level) {
  if (!level || typeof level !== "object") return false;
  if (!Array.isArray(level.tiles)) return false;
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

async function handleSaveLevel(req, res) {
  try {
    const rawBody = await readBody(req);
    const level = JSON.parse(rawBody);

    if (!isValidLevelShape(level)) {
      sendJson(res, 400, { ok: false, error: "Invalid level format" });
      return;
    }

    const safeName = sanitizeLevelFileName(level.name);
    const fileName = `${safeName}.json`;

    await fsp.mkdir(LEVELS_DIR, { recursive: true });
    const filePath = path.join(LEVELS_DIR, fileName);
    await fsp.writeFile(
      filePath,
      JSON.stringify({ ...level, name: safeName }, null, 2),
      "utf8",
    );

    sendJson(res, 200, { ok: true, fileName });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "Could not save level file" });
  }
}

function resolveSafePath(requestPath) {
  const normalizedPath = path
    .normalize(requestPath)
    .replace(/^([.][.][/\\])+/, "");
  const fullPath = path.join(ROOT_DIR, normalizedPath);
  if (!fullPath.startsWith(ROOT_DIR)) return null;
  return fullPath;
}

function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = resolveSafePath(cleanPath);

  if (!fullPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(fullPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
    });

    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const currentUrl = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "POST" && currentUrl.pathname === "/api/levels") {
    await handleSaveLevel(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, currentUrl.pathname);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
