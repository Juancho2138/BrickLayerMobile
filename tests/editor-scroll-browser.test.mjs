import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, "tests", ".runtime");
const profileDir = path.join(runtimeRoot, `chrome-editor-scroll-${Date.now()}`);
const chromePath = findChrome();

if (!chromePath) {
  console.log("editor scroll browser tests skipped: Chrome not found");
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
      console.log("editor scroll browser tests skipped: Chrome launch blocked by sandbox");
      process.exit(0);
    }
    throw error;
  }

  const targets = await getJson(`http://127.0.0.1:${endpoint.port}/json`);
  const pageTarget = targets.find((target) => target.type === "page");
  assert.ok(pageTarget?.webSocketDebuggerUrl, "Chrome page target is available");
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const runtimeErrors = [];
  cdp.on("Runtime.exceptionThrown", (event) => {
    runtimeErrors.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "Runtime exception");
  });
  await waitFor(cdp, "document.readyState === 'complete'");
  await installLargeProject(cdp, 33, 18);
  await cdp.send("Page.navigate", { url: `${appUrl}?scroll=33x18-${Date.now()}` });
  try {
    await waitFor(cdp, "document.readyState === 'complete' && document.getElementById('sizeX')?.value === '33' && document.getElementById('sizeY')?.value === '18' && document.getElementById('matrixGrid')?.children.length > 600");
  } catch (error) {
    const domState = await evalValue(cdp, `({
      readyState: document.readyState,
      url: location.href,
      hasGrid: !!document.getElementById("matrixGrid"),
      childCount: document.getElementById("matrixGrid")?.children.length || 0,
      bodyText: document.body?.innerText?.slice(0, 300) || ""
    })`);
    console.error("EDITOR_SCROLL_LOAD_STATE", JSON.stringify({ domState, runtimeErrors }, null, 2));
    throw error;
  }

  const measured33x18 = [];
  for (const cellSize of [28, 34, 45, 60]) {
    const metrics = await measureScroll(cdp, cellSize);
    measured33x18.push(metrics);
    assert.ok(metrics.scrollWidth > metrics.clientWidth, `33x18 ${cellSize}px creates horizontal overflow`);
    assert.ok(metrics.scrollHeight > metrics.clientHeight, `33x18 ${cellSize}px creates vertical overflow`);
    assert.ok(metrics.after100.scrollLeft > 0, `33x18 ${cellSize}px scrollLeft can be set`);
    assert.ok(metrics.after100.scrollTop > 0, `33x18 ${cellSize}px scrollTop can be set`);
    assert.equal(metrics.maxSet.lastCellVisible, true, `33x18 ${cellSize}px bottom-right cell is reachable`);
  }
  console.log(`EDITOR_SCROLL_33X18 ${JSON.stringify(measured33x18)}`);

  const wheel = await wheelScroll(cdp);
  console.log(`EDITOR_SCROLL_WHEEL ${JSON.stringify(wheel)}`);
  assert.ok(wheel.after > wheel.before, "mouse wheel scrolls vertically");
  assert.ok(wheel.afterMatrixTop < wheel.beforeMatrixTop, "mouse wheel visually moves the matrix upward");

  const navigatePan = await navigateTouchPan(cdp);
  console.log(`EDITOR_SCROLL_NAVIGATE_TOUCH ${JSON.stringify(navigatePan)}`);
  assert.ok(navigatePan.after > navigatePan.before, "navigate mode touch pan scrolls vertically");

  const fit = await fitZoomMetrics(cdp);
  console.log(`EDITOR_SCROLL_FIT ${JSON.stringify(fit)}`);
  assert.ok(fit.scrollWidth <= fit.clientWidth + 2, "fit zoom removes horizontal overflow");
  assert.ok(fit.scrollHeight <= fit.clientHeight + 2, "fit zoom removes vertical overflow");

  const afterManual = await measureScroll(cdp, 60);
  console.log(`EDITOR_SCROLL_AFTER_FIT_MANUAL ${JSON.stringify(afterManual)}`);
  assert.ok(afterManual.scrollWidth > afterManual.clientWidth, "manual zoom restores horizontal overflow");
  assert.ok(afterManual.scrollHeight > afterManual.clientHeight, "manual zoom restores vertical overflow");

  await installLargeProject(cdp, 60, 45);
  await cdp.send("Page.navigate", { url: `${appUrl}?scroll=60x45-${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete' && document.getElementById('sizeX')?.value === '60' && document.getElementById('sizeY')?.value === '45' && document.getElementById('matrixGrid')?.children.length > 2700");
  const huge = await measureScroll(cdp, 45);
  console.log(`EDITOR_SCROLL_HUGE ${JSON.stringify(huge)}`);
  assert.ok(huge.scrollWidth > huge.clientWidth, "huge matrix has horizontal overflow");
  assert.ok(huge.scrollHeight > huge.clientHeight, "huge matrix has vertical overflow");
  assert.equal(huge.maxSet.lastCellVisible, true, "huge matrix bottom-right cell is reachable");

  cdp.close();
  console.log("editor scroll browser tests OK");
} finally {
  if (chrome && !chrome.killed) {
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.close();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome may keep profile lock files briefly.
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

async function installLargeProject(cdp, x, y) {
  await cdp.send("Runtime.evaluate", {
    expression: `
      localStorage.setItem("bricklayer-mobile-project-v1", JSON.stringify({
        format: "bricklayers-v1",
        name: "Scroll ${x}x${y}",
        size: { x: ${x}, y: ${y} },
        palette: { A: "#F4C400", N: "#111111", R: "#D62828", B: "#F2F2F2", C: "#27C2D1", M: "#9B5A2E", P: "#D9A074", G: "#808080", V: "#009B55", L: "#7B3FB2", U: "#1E63D6", S: "#F05AA6", O: "#F47C20", I: "#B884F4", Q: "#C9914B" },
        revision: 1,
        references: [],
        reference_image: { data_url: "", x: 16, y: 16, scale: 1, opacity: 100, block_opacity: 100 },
        construction_layout: null,
        layers: [{ z: 0, matrix: Array.from({ length: ${y} }, () => "A".repeat(${x})) }]
      }));
    `
  });
}

async function measureScroll(cdp, cellSize) {
  await cdp.send("Runtime.evaluate", {
    expression: `
      document.getElementById("gridZoom").max = "60";
      document.getElementById("gridZoom").value = "${cellSize}";
      document.getElementById("gridZoom").dispatchEvent(new Event("input", { bubbles: true }));
    `
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const serialized = await evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const matrix = document.getElementById("matrixGrid");
    const computed = getComputedStyle(scroller);
    const matrixComputed = getComputedStyle(matrix);
    const rect = matrix.getBoundingClientRect();
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
    const initial = { scrollTop: scroller.scrollTop, scrollLeft: scroller.scrollLeft };
    scroller.scrollTop = 100;
    scroller.scrollLeft = 100;
    const after100 = { scrollTop: scroller.scrollTop, scrollLeft: scroller.scrollLeft };
    scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const last = matrix.querySelector(".cell[data-x='" + (Number(getComputedStyle(matrix).getPropertyValue("--x")) - 1) + "'][data-y='" + (Number(getComputedStyle(matrix).getPropertyValue("--y")) - 1) + "']");
    const scrollRect = scroller.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return JSON.stringify({
      cellSize: ${cellSize},
      clientWidth: scroller.clientWidth,
      clientHeight: scroller.clientHeight,
      scrollWidth: scroller.scrollWidth,
      scrollHeight: scroller.scrollHeight,
      initial,
      after100,
      matrixRectWidth: rect.width,
      matrixRectHeight: rect.height,
      computed: {
        width: computed.width,
        height: computed.height,
        overflow: computed.overflow,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY
      },
      matrixComputed: {
        width: matrixComputed.width,
        height: matrixComputed.height,
        transform: matrixComputed.transform,
        zoom: matrixComputed.zoom,
        marginLeft: matrixComputed.marginLeft,
        marginTop: matrixComputed.marginTop
      },
      maxSet: {
        scrollTop: scroller.scrollTop,
        scrollLeft: scroller.scrollLeft,
        lastCellVisible: lastRect.left >= scrollRect.left && lastRect.right <= scrollRect.right && lastRect.top >= scrollRect.top && lastRect.bottom <= scrollRect.bottom
      }
    });
  })()`);
  return JSON.parse(serialized);
}

async function wheelScroll(cdp) {
  const point = await evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const matrix = document.getElementById("matrixGrid");
    const rect = scroller.getBoundingClientRect();
    scroller.scrollTop = 0;
    return {
      x: Math.floor(rect.left + 20),
      y: Math.floor(rect.top + 20),
      before: scroller.scrollTop,
      beforeMatrixTop: matrix.getBoundingClientRect().top
    };
  })()`);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: point.x,
    y: point.y,
    xDistance: 0,
    yDistance: -240
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const afterState = await evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const matrix = document.getElementById("matrixGrid");
    return {
      after: scroller.scrollTop,
      afterMatrixTop: matrix.getBoundingClientRect().top
    };
  })()`);
  return { before: point.before, after: afterState.after, beforeMatrixTop: point.beforeMatrixTop, afterMatrixTop: afterState.afterMatrixTop };
}

async function navigateTouchPan(cdp) {
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Runtime.evaluate", {
    expression: `
      if (document.getElementById("editorModeBtn").textContent.trim() !== "NAVEGAR") {
        document.getElementById("editorModeBtn").click();
      }
      document.getElementById("gridScroller").scrollTop = 0;
    `
  });
  const point = await evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const rect = scroller.getBoundingClientRect();
    return { x: Math.floor(rect.left + rect.width / 2), y: Math.floor(rect.top + rect.height / 2), before: scroller.scrollTop };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }]
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x, y: point.y - 140 }]
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: []
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const after = await evalValue(cdp, `document.getElementById("gridScroller").scrollTop`);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  return { before: point.before, after };
}

async function fitZoomMetrics(cdp) {
  await cdp.send("Runtime.evaluate", { expression: `document.getElementById("fitZoomBtn").click()` });
  await new Promise((resolve) => setTimeout(resolve, 250));
  return evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const matrix = document.getElementById("matrixGrid");
    const content = document.getElementById("gridScrollContent");
    const rect = matrix.getBoundingClientRect();
    const matrixComputed = getComputedStyle(matrix);
    return {
      zoom: document.getElementById("gridZoom").value,
      clientWidth: scroller.clientWidth,
      clientHeight: scroller.clientHeight,
      scrollWidth: scroller.scrollWidth,
      scrollHeight: scroller.scrollHeight,
      contentWidth: content.offsetWidth,
      contentHeight: content.offsetHeight,
      matrixRectWidth: rect.width,
      matrixRectHeight: rect.height,
      marginLeft: matrixComputed.marginLeft,
      marginTop: matrixComputed.marginTop,
      marginBottom: matrixComputed.marginBottom
    };
  })()`);
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
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method && listeners.has(message.method)) {
      listeners.get(message.method).forEach((listener) => listener(message.params));
    }
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, method } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${method}: ${message.error.message}`));
    else resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          socket.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((messageResolve, messageReject) => {
            pending.set(messageId, { resolve: messageResolve, reject: messageReject, method });
          });
        },
        close() {
          socket.close();
        },
        on(method, listener) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(listener);
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
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
