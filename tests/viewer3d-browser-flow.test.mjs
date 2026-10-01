import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, "tests", ".runtime");
const profileDir = path.join(runtimeRoot, `chrome-viewer3d-${Date.now()}`);
const chromePath = findChrome();

if (!chromePath) {
  console.log("viewer 3D browser flow tests skipped: Chrome not found");
  process.exit(0);
}

fs.mkdirSync(profileDir, { recursive: true });

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.setHeader("Content-Type", contentType(filePath));
    response.end(data);
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const appUrl = `http://127.0.0.1:${port}/index.html`;

let chrome;
try {
  let endpoint;
  try {
    endpoint = await launchChrome(appUrl);
  } catch (error) {
    if (error.code === "EPERM") {
      console.log("viewer 3D browser flow tests skipped: Chrome launch blocked by sandbox");
      process.exit(0);
    }
    throw error;
  }
  const targets = await getJson(`http://127.0.0.1:${endpoint.port}/json`);
  const pageTarget = targets.find((target) => target.type === "page");
  assert.ok(pageTarget?.webSocketDebuggerUrl, "Chrome page target is available");
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await waitFor(cdp, "document.readyState === 'complete'");
  await cdp.send("Runtime.evaluate", {
    expression: `
      localStorage.setItem("bricklayer-mobile-project-v1", JSON.stringify({
        format: "bricklayers-v1",
        name: "DOM Flow",
        size: { x: 3, y: 2 },
        palette: { A: "#F4C400", G: "#808080", M: "#9B5A2E" },
        revision: 1,
        references: [],
        reference_image: { data_url: "", visible: true, x: 16, y: 16, scale: 1, opacity: 100, block_opacity: 100 },
        construction_layout: null,
        layers: [{ z: 0, matrix: ["AG.", "MM."] }]
      }));
      location.reload();
    `
  });
  await waitFor(cdp, "document.readyState === 'complete' && document.getElementById('quickOpen3dBtn')");
  await cdp.send("Runtime.evaluate", { expression: `document.getElementById("quickOpen3dBtn").click()` });
  await waitFor(cdp, `document.getElementById("viewer3dDialog").open === true`);
  await waitFor(cdp, `document.querySelector("#viewer3dCanvasWrap canvas") !== null`);

  const before = await evalValue(cdp, `({
    buttonExists: !!document.getElementById("viewer3dRecolorToggle"),
    pressed: document.getElementById("viewer3dRecolorToggle")?.getAttribute("aria-pressed"),
    panelHidden: document.getElementById("viewer3dRecolorPanel")?.hidden
  })`);
  assert.deepEqual(before, { buttonExists: true, pressed: "false", panelHidden: true });

  await cdp.send("Runtime.evaluate", { expression: `document.getElementById("viewer3dRecolorToggle").click()` });
  await waitFor(cdp, `document.getElementById("viewer3dRecolorPanel").hidden === false`);
  const active = await evalValue(cdp, `({
    text: document.getElementById("viewer3dRecolorToggle").textContent.trim(),
    pressed: document.getElementById("viewer3dRecolorToggle").getAttribute("aria-pressed"),
    panelHidden: document.getElementById("viewer3dRecolorPanel").hidden,
    connectedVisible: !!document.getElementById("viewer3dModeConnected").offsetParent,
    applyVisible: !!document.getElementById("viewer3dApplyColor").offsetParent
  })`);
  assert.deepEqual(active, {
    text: "Recolorando",
    pressed: "true",
    panelHidden: false,
    connectedVisible: true,
    applyVisible: true
  });

  await cdp.send("Runtime.evaluate", { expression: `document.getElementById("viewer3dExitRecolor").click()` });
  await waitFor(cdp, `document.getElementById("viewer3dRecolorPanel").hidden === true`);
  const inactive = await evalValue(cdp, `({
    text: document.getElementById("viewer3dRecolorToggle").textContent.trim(),
    pressed: document.getElementById("viewer3dRecolorToggle").getAttribute("aria-pressed"),
    panelHidden: document.getElementById("viewer3dRecolorPanel").hidden
  })`);
  assert.deepEqual(inactive, { text: "Recolorar", pressed: "false", panelHidden: true });

  cdp.close();
  console.log("viewer 3D browser flow tests OK");
} finally {
  if (chrome && !chrome.killed) {
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.close();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome can keep profile lock files briefly on Windows; the next run uses a unique folder.
  }
}

function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function launchChrome(url) {
  return new Promise((resolve, reject) => {
    chrome = spawn(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      url
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const timer = setTimeout(() => reject(new Error("Chrome did not expose a debugging endpoint")), 15000);
    chrome.stderr.on("data", (chunk) => {
      const match = String(chunk).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve({ port: Number(match[1]) });
      }
    });
    chrome.on("error", reject);
    chrome.on("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Chrome exited with code ${code}`));
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          socket.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((messageResolve, messageReject) => {
            pending.set(messageId, { resolve: messageResolve, reject: messageReject });
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener("error", reject);
  });
}

async function waitFor(cdp, expression, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evalValue(cdp, expression);
    if (value) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function evalValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result.value;
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
