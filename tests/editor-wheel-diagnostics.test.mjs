import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(root, "tests", ".runtime");
const profileDir = path.join(runtimeRoot, `chrome-editor-wheel-${Date.now()}`);
const chromePath = findChrome();

if (!chromePath) {
  console.log("editor wheel diagnostics skipped: Chrome not found");
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
  const endpoint = await launchChrome(appUrl);
  const targets = await getJson(`http://127.0.0.1:${endpoint.port}/json`);
  const pageTarget = targets.find((target) => target.type === "page");
  assert.ok(pageTarget?.webSocketDebuggerUrl, "Chrome page target is available");
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: projectStorageScript() });
  await cdp.send("Page.navigate", { url: `${appUrl}?wheel=${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete' && document.getElementById('sizeX')?.value === '33' && document.getElementById('sizeY')?.value === '18' && document.getElementById('matrixGrid')?.children.length > 600");

  const setup = await evalValue(cdp, `(() => {
    document.getElementById("gridZoom").value = "60";
    document.getElementById("gridZoom").dispatchEvent(new Event("input", { bubbles: true }));
    if (document.getElementById("editorModeBtn").textContent.trim() !== "NAVEGAR") {
      document.getElementById("editorModeBtn").click();
    }
    const scroller = document.getElementById("gridScroller");
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
    const rect = scroller.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + 80, rect.top + 80);
    const names = new Map([
      [window, "window"],
      [document, "document"],
      [document.querySelector(".workspace"), "workspace"],
      [document.querySelector(".editor-area"), "editor-area"],
      [document.querySelector(".editor-center"), "editor-center"],
      [document.querySelector(".grid-wrap"), "grid-wrap"],
      [document.getElementById("gridScroller"), "grid-scroller"],
      [document.getElementById("gridScrollContent"), "gridScrollContent"],
      [document.getElementById("matrixGrid"), "matrix-grid"],
      [target?.closest(".cell"), "cell"]
    ]);
    window.__wheelLog = [];
    const phaseName = (phase) => phase === 1 ? "capture" : phase === 2 ? "target" : phase === 3 ? "bubble" : String(phase);
    const describe = (node) => {
      if (node === window) return "window";
      if (node === document) return "document";
      if (!node) return "null";
      return node.id ? "#" + node.id : node.className ? "." + String(node.className).replace(/\\s+/g, ".") : node.tagName;
    };
    const watched = [...new Set([...names.keys()].filter(Boolean))];
    watched.forEach((node) => {
      const label = names.get(node) || describe(node);
      node.addEventListener("wheel", (event) => {
        window.__wheelLog.push({
          label,
          listener: "capture",
          target: describe(event.target),
          currentTarget: label,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          defaultPrevented: event.defaultPrevented,
          eventPhase: event.eventPhase,
          phaseName: phaseName(event.eventPhase),
          scrollTop: scroller.scrollTop
        });
      }, { capture: true, passive: false });
      node.addEventListener("wheel", (event) => {
        window.__wheelLog.push({
          label,
          listener: "bubble",
          target: describe(event.target),
          currentTarget: label,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          defaultPrevented: event.defaultPrevented,
          eventPhase: event.eventPhase,
          phaseName: phaseName(event.eventPhase),
          scrollTop: scroller.scrollTop
        });
      }, { capture: false, passive: false });
    });
    const chain = [];
    for (let node = target; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      chain.push({
        node: describe(node),
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        scrollTop: node.scrollTop,
        overflowY: cs.overflowY,
        pointerEvents: cs.pointerEvents,
        touchAction: cs.touchAction
      });
    }
    return {
      point: { x: Math.floor(rect.left + 80), y: Math.floor(rect.top + 80) },
      target: describe(target),
      cell: describe(target?.closest(".cell")),
      scroller: {
        clientHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
        scrollTop: scroller.scrollTop,
        overflowY: getComputedStyle(scroller).overflowY
      },
      chain
    };
  })()`);

  const before = await visualState(cdp);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: setup.point.x,
    y: setup.point.y,
    deltaX: 0,
    deltaY: 240,
    modifiers: 0,
    pointerType: "mouse"
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const after = await visualState(cdp);
  const synthetic = await evalValue(cdp, `new Promise((resolve) => {
    const scroller = document.getElementById("gridScroller");
    const cell = document.elementFromPoint(${setup.point.x}, ${setup.point.y});
    scroller.scrollTop = 0;
    const first = document.querySelector(".cell[data-x='0'][data-y='0']");
    const beforeTop = first.getBoundingClientRect().top;
    cell.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 180, deltaX: 0 }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resolve({
        scrollTop: scroller.scrollTop,
        beforeTop,
        afterTop: first.getBoundingClientRect().top
      });
    }));
  })`);
  const log = await evalValue(cdp, "window.__wheelLog");

  console.log(`EDITOR_WHEEL_SETUP ${JSON.stringify(setup)}`);
  console.log(`EDITOR_WHEEL_LOG ${JSON.stringify(log)}`);
  console.log(`EDITOR_WHEEL_VISUAL ${JSON.stringify({ before, after, synthetic })}`);

  assert.equal(setup.target.includes("cell") || setup.cell.includes("cell"), true);
  assert.ok(after.scrollTop > before.scrollTop, "real mouse wheel scrolls the grid");
  assert.ok(after.firstTop < before.firstTop, "real mouse wheel moves the matrix visually");
  assert.ok(synthetic.scrollTop > 0, "fallback WheelEvent scrolls the grid");
  assert.ok(synthetic.afterTop < synthetic.beforeTop, "fallback WheelEvent moves the matrix visually");
  cdp.close();
  console.log("editor wheel diagnostics OK");
} finally {
  if (chrome && !chrome.killed) {
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.close();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Chrome may keep profile locks briefly.
  }
}

async function visualState(cdp) {
  return evalValue(cdp, `(() => {
    const scroller = document.getElementById("gridScroller");
    const first = document.querySelector(".cell[data-x='0'][data-y='0']");
    const visible = document.elementFromPoint(scroller.getBoundingClientRect().left + 80, scroller.getBoundingClientRect().top + 80);
    return {
      scrollTop: scroller.scrollTop,
      scrollLeft: scroller.scrollLeft,
      firstTop: first.getBoundingClientRect().top,
      visibleTarget: visible?.id ? "#" + visible.id : visible?.className ? "." + String(visible.className).replace(/\\s+/g, ".") : visible?.tagName
    };
  })()`);
}

function projectStorageScript() {
  return `
      localStorage.setItem("bricklayer-mobile-project-v1", JSON.stringify({
        format: "bricklayers-v1",
        name: "7299 wheel repro",
        size: { x: 33, y: 18 },
        palette: { A: "#F4C400", N: "#111111", R: "#D62828", B: "#F2F2F2", C: "#27C2D1", M: "#9B5A2E", P: "#D9A074", G: "#808080", V: "#009B55", L: "#7B3FB2", U: "#1E63D6", S: "#F05AA6", O: "#F47C20", I: "#B884F4", Q: "#C9914B" },
        revision: 1,
        references: [],
        reference_image: { data_url: "", x: 16, y: 16, scale: 1, opacity: 100, block_opacity: 100 },
        construction_layout: null,
        layers: [{ z: 0, matrix: Array.from({ length: 18 }, () => "A".repeat(33)) }]
      }));
    `;
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
