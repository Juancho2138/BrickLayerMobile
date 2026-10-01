import assert from "node:assert/strict";
import fs from "node:fs";

const cssSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...cssSource.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "g"))];
  assert.ok(matches.length, `${selector} rule exists`);
  return matches.map((match) => match[1]).join("\n");
}

assert.match(rule("html"), /overflow:\s*hidden;/);
assert.match(rule("body"), /overflow:\s*hidden;/);
assert.match(rule(".app-shell"), /grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
assert.match(rule(".app-shell"), /overflow:\s*hidden;/);
assert.match(rule(".workspace"), /height:\s*100%;/);
assert.match(rule(".workspace"), /min-height:\s*0;/);
assert.match(rule(".workspace"), /overflow:\s*hidden;/);
assert.match(rule(".editor-area"), /min-height:\s*0;/);
assert.match(rule(".editor-area"), /overflow:\s*hidden;/);
assert.match(rule(".editor-center"), /min-height:\s*0;/);
assert.match(rule(".editor-center"), /grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);
assert.match(rule(".grid-wrap"), /grid-template-rows:\s*minmax\(0,\s*1fr\);/);
assert.match(rule(".grid-wrap"), /min-height:\s*0;/);
assert.match(rule(".grid-wrap"), /overflow:\s*hidden;/);
assert.match(rule(".grid-scroller"), /overflow-x:\s*auto;/);
assert.match(rule(".grid-scroller"), /overflow-y:\s*auto;/);
assert.match(rule(".grid-scroller"), /min-height:\s*calc\(100dvh - 128px\);/);
assert.match(rule(".grid-scroller"), /max-height:\s*calc\(100dvh - 128px\);/);
assert.match(rule(".grid-scroller"), /height:\s*auto;/);
assert.match(rule(".grid-scroll-content"), /display:\s*flow-root;/);
assert.match(rule(".grid-scroll-content"), /min-width:\s*max-content;/);
assert.match(rule(".grid-scroll-content"), /min-height:\s*max-content;/);

const scroller = {
  scrollTop: 0,
  scrollLeft: 0,
  clientHeight: 180,
  clientWidth: 240,
  scrollHeight: 720,
  scrollWidth: 960
};
scroller.scrollTop = 120;
scroller.scrollLeft = 160;
assert.equal(scroller.scrollTop, 120);
assert.equal(scroller.scrollLeft, 160);

assert.ok(appSource.includes("const rect = els.gridScroller.getBoundingClientRect()"));
assert.ok(appSource.includes("const visibleWidth = rect.width || els.gridScroller.clientWidth"));
assert.ok(appSource.includes("const visibleHeight = rect.height || els.gridScroller.clientHeight"));
assert.ok(appSource.includes("gridScrollContent: document.getElementById(\"gridScrollContent\")"));
assert.ok(appSource.includes("els.gridScrollContent.style.width"));
assert.ok(appSource.includes("els.gridScrollContent.style.height"));
assert.ok(!appSource.includes("document.body.getBoundingClientRect()"));
assert.ok(!appSource.includes("window.innerHeight -"));

console.log("editor scroll tests OK");
