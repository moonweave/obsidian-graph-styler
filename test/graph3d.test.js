'use strict';

// 3D graph (experimental): data extraction, colour-group matching, start positions, and layout invariants.
// The view itself needs WebGL and a running Obsidian; scripts/input-smoke.js and the release checks cover it.

const assert = require('assert');
const Module = require('module');
const path = require('path');

global.window = { localStorage: { getItem: () => '' } };
Object.defineProperty(global, 'navigator', { value: { language: 'en' }, configurable: true });
global.document = { head: { createEl: () => ({ remove() {} }) } };

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'obsidian') {
    return { Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const GraphStyler = require(path.join(__dirname, '..', 'main.js'));
Module._load = originalLoad;
const { graphData3d, colorGroupTest3d, initialPositions3d, forceLayout3d, LAYOUT_WORKER_3D, applyCssFilter, Graph3DView, parseCssColor,
  displayRatio3d, lineMode3d } = GraphStyler;

// A Graph3DView with just enough of Obsidian and the DOM stubbed to drive its pointer handlers and frame().
// draw() and pick() are replaced by recorders; the handlers come from bindInput() through registerDomEvent.
// The view runs in whatever window holds its tab (a popout has its own), so the stub window is only reachable
// through contentEl.win / contentEl.doc; the main-window globals throw if the view touches them.
const mainWindowUse = () => { throw new Error('the 3D view used the main window instead of its own'); };
Object.assign(global.window, { requestAnimationFrame: mainWindowUse, cancelAnimationFrame: mainWindowUse,
  setTimeout: mainWindowUse, clearTimeout: mainWindowUse });
function stubView() {
  const rafs = [];
  const win = {
    devicePixelRatio: 2,
    requestAnimationFrame: (cb) => { rafs.push(cb); return rafs.length; },
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
  };
  const doc = { hidden: false };
  const view = new Graph3DView({}, { settings: { experimental3d: true }, rotate3d: true, rotate3dSpeed: 0.12 });
  view.contentEl = { win, doc };
  const handlers = {};
  const targets = {};
  view.registerDomEvent = (el, type, cb) => { handlers[type] = cb; targets[type] = el; };
  view.canvas = { width: 800, height: 600, clientWidth: 400, clientHeight: 300,
    setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  view.gl = { isContextLost: () => false };
  view.prog = {};
  view.layoutDone = true;
  view.shownDist = view.cam.dist;
  view.fit = { r: 100, max: 120 };
  const calls = { pick: 0, draw: 0, opened: [] };
  view.draw = () => { calls.draw += 1; };
  view.pick = () => { calls.pick += 1; };
  view.openNode = (i) => calls.opened.push(i);
  view.bindInput();
  const pointer = (type, x, y, extra = {}) => handlers[type](Object.assign({
    clientX: x, clientY: y, offsetX: x, offsetY: y, button: 0, pointerId: 1, shiftKey: false,
  }, extra));
  return { view, handlers, targets, calls, rafs, win, doc, pointer };
}

// ---------------------------------------------------------------- hover during a drag
// The scene turns under a still cursor while dragging; re-picking every frame flipped the hover from node to node.
{
  const { view, calls, pointer } = stubView();
  pointer('pointermove', 50, 50);
  assert.deepStrictEqual(view.mouse, [50, 50]);
  pointer('pointerdown', 50, 50);
  pointer('pointermove', 80, 60);
  assert.deepStrictEqual(view.mouse, [80, 60], 'the cursor point stays current during a drag');
  const before = calls.pick;
  view.frame(1000);
  view.frame(1016);
  assert.strictEqual(calls.pick, before, 'no re-pick while dragging');
  pointer('pointerup', 80, 60);
  view.frame(1032);
  assert.strictEqual(calls.pick, before + 1, 'picking resumes when the drag ends');
}

// ---------------------------------------------------------------- cancelled pointers and touch taps
// A pointer the system cancels (touch gesture, lost capture) ends the drag without opening a note; otherwise the
// drag stayed set, Auto-rotate never resumed and the graph kept turning with no button held. A tap opens the note
// under it even with no pointermove before it.
{
  for (const type of ['pointercancel', 'lostpointercapture']) {
    const { view, calls, pointer } = stubView();
    view.hover = 3;
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 52, 50);
    pointer(type, 52, 50);
    assert.strictEqual(view.drag, null, `${type} ends the drag`);
    pointer('pointerup', 52, 50);
    assert.deepStrictEqual(calls.opened, [], `${type} never opens a note`);
    view.lastInput = performance.now() - 10000;
    assert.ok(view.rotationSpeed(performance.now()) > 0, `rotation resumes after ${type}`);
  }
  const { view, calls, pointer } = stubView();
  view.pick = () => { calls.pick += 1; view.hover = view.mouse[0] === 70 ? 7 : -1; };
  pointer('pointerdown', 70, 40, { pointerType: 'touch' });
  assert.deepStrictEqual(view.mouse, [70, 40], 'pointerdown records the point (touch has no hover move)');
  pointer('pointerup', 70, 40, { pointerType: 'touch' });
  assert.deepStrictEqual(calls.opened, [7], 'a tap picks where it lands and opens that note');
}

// ---------------------------------------------------------------- fitting tiny vaults
// A fresh vault has one note. With the fit radius floored at 1 world unit that note filled the canvas as one disc.
{
  const proto = Graph3DView.prototype;
  const nodeShare = (positions) => {
    const n = positions.length / 3;
    const fit = proto.measureFit.call({ data: { n }, pos: Float32Array.from(positions) });
    const cam = { fov: 0.9 };
    const dist = proto.fitDistance.call({ canvas: { clientWidth: 540, clientHeight: 675 }, cam, fit });
    const pxScale = 1350 / (2 * Math.tan(cam.fov / 2));
    return { fit, share: 2.2 * pxScale / dist / 1350 };
  };
  for (const [name, positions] of [['one note', [0, 0, 0]], ['two linked notes', [-12, 0, 0, 12, 0, 0]]]) {
    const { fit, share } = nodeShare(positions);
    assert.ok(fit.r >= 30 && share < 0.06, `${name}: node radius is ${(share * 100).toFixed(1)}% of the canvas height (fit.r ${fit.r})`);
  }
  // a real-sized graph keeps its own fit
  const ring = [];
  for (let i = 0; i < 100; i++) ring.push(Math.cos(i) * 200, Math.sin(i) * 200, 0);
  assert.ok(Math.abs(nodeShare(ring).fit.r - 200) < 1, 'graphs larger than the floor are fitted as before');
}

// ---------------------------------------------------------------- wheel over the "no notes" message
// With no notes there is no layout and no fit radius; every wheel tick threw a TypeError.
{
  const { view, handlers } = stubView();
  view.fit = undefined;
  const dist = view.cam.dist;
  let prevented = false;
  assert.doesNotThrow(() => handlers.wheel({ deltaY: 100, deltaMode: 0, ctrlKey: false, preventDefault: () => { prevented = true; } }));
  assert.deepStrictEqual([view.cam.dist, prevented], [dist, false], 'nothing to zoom, the page scroll is left alone');
  view.fit = { r: 100, max: 120 };
  handlers.wheel({ deltaY: -100, deltaMode: 0, ctrlKey: false, preventDefault: () => { prevented = true; } });
  assert.ok(view.cam.dist < dist && prevented, 'with a graph the wheel zooms');
}

// ---------------------------------------------------------------- CSS colour formats
// Community themes and color-mix() give colours as color(srgb …), oklch(), lab() …; those used to parse as opaque
// black, making nodes, lines or the background disappear.
{
  const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  for (const [css, want] of [
    ['#336699', [0.2, 0.4, 0.6, 1]],
    ['rgb(10, 20, 30)', [10 / 255, 20 / 255, 30 / 255, 1]],
    ['rgba(37,67,92,0.9)', [37 / 255, 67 / 255, 92 / 255, 0.9]],
    ['rgb(10 20 30 / 50%)', [10 / 255, 20 / 255, 30 / 255, 0.5]],
    ['color(srgb 0.5 0.25 1 / 0.5)', [0.5, 0.25, 1, 0.5]],
    ['color(srgb 50% 25% 100%)', [0.5, 0.25, 1, 1]],
  ]) assert.ok(near(parseCssColor(css), want), `${css} -> ${parseCssColor(css)}`);
  // anything else goes through a 1x1 canvas, which converts it to sRGB
  const filled = [];
  let created = 0;
  global.document.createElement = (tag) => {
    assert.strictEqual(tag, 'canvas');
    created += 1;
    const ctx = { clearRect() {}, fillRect() { filled.push(this.fillStyle); }, getImageData: () => ({ data: [51, 102, 153, 255] }) };
    return { getContext: () => ctx };
  };
  assert.ok(near(parseCssColor('oklch(0.6 0.15 250)'), [0.2, 0.4, 0.6, 1]));
  assert.deepStrictEqual(filled, ['oklch(0.6 0.15 250)']);
  parseCssColor('lab(50 40 20)');
  assert.deepStrictEqual([filled, created], [['oklch(0.6 0.15 250)', 'lab(50 40 20)'], 1], 'one canvas, reused');
}

// ---------------------------------------------------------------- WebGL context restore
// After a restore the link-highlight buffer is new and empty; a hover kept from before lit the node but not its
// links. Objects from the lost context must not be deleted on the new one (that only raises GL errors).
{
  const { view } = stubView();
  view.hover = 5;
  view.hi = new Float32Array(8);
  view.hi[5] = 1;
  view.prog = { stale: true };
  view.buf = { stale: true };
  view.vaoLine = {};
  view.vaoNode = {};
  let labelShown = true;
  view.label = { toggleClass: (cls, on) => { labelShown = on; } };
  view.clearMessage = () => {};
  let seen = null;
  view.initGL = () => {
    seen = { prog: view.prog, buf: view.buf, vao: view.vaoLine || view.vaoNode, hover: view.hover, lit: view.hi.reduce((a, b) => a + b, 0) };
    view.prog = {};
  };
  view.restoreGL();
  assert.deepStrictEqual(seen, { prog: null, buf: null, vao: null, hover: -1, lit: 0 });
  assert.strictEqual(labelShown, false);
  assert.ok(view.inputPending, 'redrawn at once, so the hover is picked again under the cursor');
}

// ---------------------------------------------------------------- the view's own window (popouts)
// In a popout the canvas lives in another document. Frames, timers, visibility and pixel ratio must come from that
// window: with the main window's, a minimised main window stopped the popout's graph and DPR was wrong on another display.
{
  const { view, calls, rafs, win, doc } = stubView();
  win.devicePixelRatio = 3;
  view.kick();
  assert.strictEqual(rafs.length, 1, 'frames are requested from the view window');
  view.frame(1000);
  assert.deepStrictEqual([view.canvas.width, view.canvas.height], [1200, 900], 'canvas follows the view window pixel ratio');
  doc.hidden = true;
  const draws = calls.draw;
  view.frame(1100);
  assert.strictEqual(calls.draw, draws, 'a hidden view document does not draw');
  view.touch();
  view.stopLoop();
}
{
  // onOpen wires its listeners and the resize observer to the view's own document and window
  const { view, handlers, targets, win, doc } = stubView();
  const observed = [];
  win.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe(el) { observed.push(el); } disconnect() {} };
  const el = (tag) => ({ tag, remove() {}, getContext: () => ({}) });
  Object.assign(view.contentEl, { empty() {}, addClass() {}, createEl: (tag) => el(tag), createDiv: () => el('div') });
  view.app = { workspace: { on: () => ({}) }, vault: { on: () => ({}) } };
  view.registerEvent = () => {};
  let built = 0;
  view.build = async () => { built += 1; };
  let restored = 0;
  view.restoreGL = () => { restored += 1; };
  view.onOpen().then(() => {
    assert.strictEqual(targets.visibilitychange, doc, 'visibilitychange is watched on the view document');
    assert.deepStrictEqual([observed.length, observed[0] === view.canvas, built], [1, true, 1]);
    // the canvas's restore event goes to restoreGL()
    assert.strictEqual(targets.webglcontextrestored, view.canvas);
    handlers.webglcontextrestored();
    assert.strictEqual(restored, 1);
  });
}

// ---------------------------------------------------------------- click or drag
// A click is a press that never moved 5 px or more from where it started (straight-line distance). The old summed
// |dx|+|dy| turned a 3,3 wobble (4.2 px) into a drag; a drag that comes back to its start is still a drag.
{
  const run = (path) => {
    const { view, calls, pointer } = stubView();
    view.pick = () => { view.hover = 9; };
    pointer('pointerdown', 50, 50);
    for (const [x, y] of path) pointer('pointermove', x, y);
    const [ex, ey] = path.length ? path[path.length - 1] : [50, 50];
    pointer('pointerup', ex, ey);
    return calls.opened.length;
  };
  assert.strictEqual(run([]), 1, 'still press opens');
  assert.strictEqual(run([[53, 53]]), 1, '3,3 wobble (4.2 px) is still a click');
  assert.strictEqual(run([[54, 52]]), 1, '4.5 px is a click');
  assert.strictEqual(run([[55, 50]]), 0, '5 px is a drag');
  assert.strictEqual(run([[80, 50], [60, 50], [51, 50]]), 0, 'a drag that comes back near its start is not a click');
}

// ---------------------------------------------------------------- a tab restored before the link index is complete
// At a cold start 'resolved' fires once per batch while the index fills (37 times for a 38-note vault, measured).
// Rebuilding on the first one left a graph with 1 of 44 links. Rebuild once, when every note is indexed, and never on
// later edits. A tab restored before the layout is ready waits for it (the file list may still be filling).
{
  const { view } = stubView();
  const files = ['a.md', 'b.md', 'c.md'].map((path) => ({ path, basename: path }));
  const resolved = {};
  const listeners = [];
  let ready = false;
  const onReady = [];
  view.app = {
    vault: { getMarkdownFiles: () => files },
    metadataCache: {
      resolvedLinks: resolved,
      on: (name, cb) => { const ref = { name, cb }; listeners.push(ref); return ref; },
      offref: (ref) => { listeners.splice(listeners.indexOf(ref), 1); },
    },
    workspace: { get layoutReady() { return ready; }, onLayoutReady: (cb) => onReady.push(cb) },
  };
  view.registerEvent = () => {};
  view.readStyle = async () => ({});
  view.initGL = () => {};
  view.startLayout = () => {};
  view.clearMessage = () => {};
  view.showMessage = () => {};
  const builds = [];
  const realBuild = view.build.bind(view);
  view.build = async () => { builds.push(Object.keys(resolved).length); return realBuild(); };
  const fire = async () => { for (const ref of listeners.slice()) ref.cb(); await new Promise((r) => setImmediate(r)); };

  (async () => {
    await view.build();
    assert.deepStrictEqual([builds.length, view.data, onReady.length], [1, undefined, 1], 'before layout-ready: waits, builds nothing');
    ready = true;
    onReady[0]();
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(listeners.length, 1, 'index empty: waits for it');
    resolved['a.md'] = { 'b.md': 1 };
    await fire();
    resolved['b.md'] = {};
    await fire();
    assert.deepStrictEqual(builds, [0, 0], 'no rebuild while notes are still being indexed');
    resolved['c.md'] = { 'a.md': 1 };
    await fire();
    assert.deepStrictEqual([builds, listeners.length, view.data.links.length / 2], [[0, 0, 3], 0, 2], 'one rebuild with the whole index');
    resolved['c.md'] = { 'a.md': 1, 'b.md': 1 };
    await fire();
    assert.strictEqual(builds.length, 3, 'a later edit does not rebuild the open graph');
    // a tab opened with the index already complete never listens
    const again = stubView().view;
    again.app = view.app;
    Object.assign(again, { registerEvent() {}, readStyle: view.readStyle, initGL() {}, startLayout() {}, clearMessage() {}, showMessage() {} });
    await again.build();
    assert.strictEqual(listeners.length, 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}

// ---------------------------------------------------------------- node size and link width follow the graph settings
// Every mapping is a ratio to Obsidian's own defaults (1 and 1), so a vault on the defaults draws exactly as before.
{
  assert.strictEqual(displayRatio3d({ nodeSizeMultiplier: 1 }, 'nodeSizeMultiplier'), 1);
  assert.strictEqual(displayRatio3d({}, 'nodeSizeMultiplier'), 1, 'not set = Obsidian default');
  assert.strictEqual(displayRatio3d({ nodeSizeMultiplier: 2.5 }, 'nodeSizeMultiplier'), 2.5);
  assert.strictEqual(displayRatio3d({ lineSizeMultiplier: 40 }, 'lineSizeMultiplier'), 5, 'hand-edited values clamp to the slider range');
  assert.strictEqual(displayRatio3d({ lineSizeMultiplier: 0 }, 'lineSizeMultiplier'), 0.1);
  assert.strictEqual(displayRatio3d({ nodeSizeMultiplier: 'big' }, 'nodeSizeMultiplier'), 1);
  assert.deepStrictEqual(lineMode3d(1), { thick: false, alpha: 1, width: 1 }, 'default: the 1 px lines as before');
  assert.deepStrictEqual(lineMode3d(0.3), { thick: false, alpha: 0.3, width: 1 }, 'thinner = fainter 1 px lines');
  assert.deepStrictEqual(lineMode3d(3), { thick: true, alpha: 1, width: 3 }, 'thicker = 3 px quads');

  // node radii: same sqrt(degree) shape, times the node size ratio; default 1 = the old radii
  const view = new Graph3DView({}, { settings: {} });
  view.data = { n: 3, deg: Uint32Array.from([0, 4, 9]) };
  view.files = [{ path: 'a.md' }, { path: 'b.md' }, { path: 'c.md' }];
  view.style = { groups: [], fill: [1, 1, 1], nodeSize: 1 };
  const old = [0, 4, 9].map((d) => 2.2 + Math.sqrt(d) * 1.1);
  assert.deepStrictEqual(Array.from(view.nodeAttributes().size).map((v) => +v.toFixed(5)), old.map((v) => +v.toFixed(5)));
  view.style.nodeSize = 2;
  assert.deepStrictEqual(Array.from(view.nodeAttributes().size).map((v) => +v.toFixed(5)), old.map((v) => +(v * 2).toFixed(5)));
}
{
  // readStyle takes the ratios from the effective graph options (the core graph plugin's live options)
  const view = new Graph3DView({}, { settings: {}, activePalette: async () => null, readGraphOptions: async () => ({}) });
  const options = { colorGroups: [], nodeSizeMultiplier: 2, lineSizeMultiplier: 3 };
  view.app = { internalPlugins: { plugins: { graph: { instance: { options } } } } };
  global.document.body = { createDiv: () => ({ style: {}, remove() {} }) };
  global.getComputedStyle = () => ({ color: 'rgb(10, 20, 30)', backgroundColor: 'rgb(0, 0, 0)' });
  view.readStyle().then((st) => {
    assert.deepStrictEqual([st.nodeSize, st.lineSize], [2, 3]);
    options.nodeSizeMultiplier = 1;
    delete options.lineSizeMultiplier;
    return view.readStyle();
  }).then((st) => assert.deepStrictEqual([st.nodeSize, st.lineSize], [1, 1], 'defaults → ratio 1'));
}
{
  // the hover radius uses the same sizes as the drawn nodes
  const { view } = stubView();
  delete view.pick;
  view.setHover = (i) => { view.hover = i; };
  view.label = { style: {} };
  view.data = { n: 1, deg: Uint32Array.from([0]) };
  view.pos = new Float32Array([0, 0, 0]);
  view.mvp = Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  view.pxScale = 10;
  view.mouse = [200 + 15, 150];   // node at the canvas centre (400x300 CSS), cursor 15 CSS px = 30 device px away
  view.size = Float32Array.from([2.2]);
  view.pick();
  assert.strictEqual(view.hover, -1, 'small node: 30 px away is a miss');
  view.size = Float32Array.from([4]);
  view.pick();
  assert.strictEqual(view.hover, 0, 'node size x2: the same point now hovers it');
}
{
  // a 2D graph-settings change (graph.json rewritten) reaches an open 3D tab, debounced, without touching the camera
  const { view, win } = stubView();
  const timers = [];
  win.setTimeout = (cb) => { timers.push(cb); return timers.length; };
  const raw = [];
  view.app = { workspace: { on: () => ({}) }, vault: { on: (name, cb) => { raw.push(cb); return {}; } } };
  view.plugin.graphPath = () => '.obsidian/graph.json';
  view.registerEvent = () => {};
  const el = (tag) => ({ tag, remove() {}, getContext: () => ({}) });
  Object.assign(view.contentEl, { empty() {}, addClass() {}, createEl: (tag) => el(tag), createDiv: () => el('div') });
  win.ResizeObserver = class { observe() {} disconnect() {} };
  view.build = async () => {};
  let applied = 0;
  view.applyStyle = async () => { applied += 1; };
  view.onOpen().then(() => {
    const cam = JSON.stringify(view.cam);
    raw.forEach((cb) => cb('.obsidian/workspace.json'));
    assert.strictEqual(timers.length, 0, 'other config files are ignored');
    for (let i = 0; i < 5; i++) raw.forEach((cb) => cb('.obsidian/graph.json'));
    timers[timers.length - 1]();
    assert.deepStrictEqual([applied, JSON.stringify(view.cam)], [1, cam], 'one re-style for a burst of writes, camera untouched');
  });
}
{
  // applyStyle pushes the new sizes to the GPU and to the hover radius
  const { view } = stubView();
  const uploads = [];
  view.gl = { isContextLost: () => false, ARRAY_BUFFER: 1, TEXTURE_2D: 2, RGB: 3, FLOAT: 4,
    bindBuffer() {}, bufferSubData: (t, o, data) => uploads.push(data), bindTexture() {}, texSubImage2D() {} };
  view.buf = { col: {}, size: {} };
  view.tex = { col: {} };
  view.data = { n: 2, deg: Uint32Array.from([1, 1]) };
  view.files = [{ path: 'a.md' }, { path: 'b.md' }];
  view.readStyle = async () => ({ groups: [], fill: [1, 1, 1], nodeSize: 3, lineSize: 1 });
  view.applyStyle().then(() => {
    const want = (2.2 + 1.1) * 3;
    assert.ok(uploads.some((u) => u.length === 2 && Math.abs(u[0] - want) < 1e-5), 'size buffer re-uploaded');
    assert.ok(Math.abs(view.size[0] - want) < 1e-5, 'hover radius follows');
  });
}
{
  // the position texture only feeds thick links: the default 1 px path never uploads it, even while the layout moves
  // nodes; thick links upload it once per layout step, straight from the positions array (full rows, then the rest)
  const { view } = stubView();
  let bound = null;
  const posUploads = [];
  view.gl = new Proxy({}, { get: (t, k) => {
    if (/^[A-Z0-9_]+$/.test(k)) return k;
    if (k === 'bindTexture') return (target, tex) => { bound = tex; };
    if (k === 'texSubImage2D') return (...a) => { if (bound === 'posTex') posUploads.push(a); };
    return () => ({});
  } });
  const prog = { p: {}, u: new Proxy({}, { get: (t, k) => k }) };
  view.prog = { bg: prog, line: prog, thick: prog, halo: prog, core: prog };
  view.buf = {};
  view.tex = { pos: 'posTex', col: 'colTex' };
  view.data = { n: 1500, links: Uint32Array.from([0, 1]) };
  view.pos = new Float32Array(1500 * 3);
  view.userMoved = true;
  view.posTexStale = true;
  view.draw = Graph3DView.prototype.draw;
  view.style = { bg: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], line: [1, 1, 1], light: false, lineSize: 1 };
  for (let i = 0; i < 2; i++) { view.posDirty = true; view.draw(); }
  assert.strictEqual(posUploads.length, 0, 'default width: no position texture uploads');
  view.style.lineSize = 3;
  view.draw();
  assert.strictEqual(posUploads.length, 2, 'thick: one full row of 1024 nodes, then the last 476');
  assert.deepStrictEqual(posUploads.map((a) => [a[4], a[5], a[8] === view.pos, a[9]]), [[1024, 1, true, 0], [476, 1, true, 1024 * 3]]);
  view.draw();
  assert.strictEqual(posUploads.length, 2, 'nodes did not move: no upload');
  view.posDirty = true;
  view.draw();
  assert.strictEqual(posUploads.length, 4, 'next layout step: uploaded again');
}

// ---------------------------------------------------------------- data extraction
{
  const paths = ['A.md', 'B.md', 'C.md', 'D.md'];
  const resolved = {
    'A.md': { 'B.md': 2, 'A.md': 1, 'img.png': 1 },   // self link and attachment are dropped
    'B.md': { 'A.md': 1, 'C.md': 1 },                 // B→A duplicates A→B
    'C.md': { 'gone.md': 1 },                         // target not in the vault
    'X.md': { 'A.md': 1 },                            // source not a listed note
  };
  const d = graphData3d(paths, resolved);
  assert.strictEqual(d.n, 4);
  assert.deepStrictEqual(Array.from(d.links), [0, 1, 1, 2], 'one link per pair, notes only');
  assert.deepStrictEqual(Array.from(d.deg), [1, 2, 1, 0]);
  // neighbour lists agree with the links
  const neighbours = (i) => Array.from(d.adj.slice(d.start[i], d.start[i + 1])).sort();
  assert.deepStrictEqual(neighbours(1), [0, 2]);
  assert.deepStrictEqual(neighbours(3), [], 'orphans stay as nodes without neighbours');
  for (let i = 0; i < d.n; i++) {
    for (let p = d.start[i]; p < d.start[i + 1]; p++) {
      const e = d.adjLink[p];
      const ends = [d.links[e * 2], d.links[e * 2 + 1]];
      assert(ends.includes(i) && ends.includes(d.adj[p]), 'adjLink points at the link joining the pair');
    }
  }
}
{
  const empty = graphData3d([], {});
  assert.strictEqual(empty.n, 0);
  assert.strictEqual(empty.links.length, 0);
  assert.strictEqual(graphData3d(['A.md'], undefined).links.length, 0, 'missing resolvedLinks is an empty graph');
}

// ---------------------------------------------------------------- colour groups (the queries Graph Styler writes)
{
  const folder = colorGroupTest3d('path:"AI tools"');
  assert(folder('AI tools/Agents.md', []));
  assert(folder('ai TOOLS/x.md', []), 'path: is case-insensitive like Obsidian search');
  assert(!folder('Writing/AI.md', []));
  const quoted = colorGroupTest3d('path:"Say \\"hi\\""');
  assert(quoted('Say "hi"/a.md', []), 'escaped quotes from getColorQueries are unescaped');
  const tag = colorGroupTest3d('tag:#paper');
  assert(tag('a.md', ['#paper']));
  assert(tag('a.md', ['#Paper/draft']), 'nested tags match their parent');
  assert(!tag('a.md', ['#papers']), 'a longer tag is a different tag');
  assert(colorGroupTest3d('tag:paper')('a.md', ['#paper']), 'tag: without # also works');
  assert(!colorGroupTest3d('file:foo')('foo.md', []), 'unsupported queries match nothing');
  assert(!colorGroupTest3d('')('a.md', []));
}

// ---------------------------------------------------------------- CSS filter on colours
{
  // CSS clamps after every filter step. Clamping only at the end gives mint R 0.705 and pink G 0.476 instead.
  const neon = 'brightness(1.25) contrast(1.15) saturate(1.5)';
  const mint = applyCssFilter([0xa7 / 255, 0xf3 / 255, 0xd0 / 255], neon);
  assert(Math.abs(mint[0] - 0.814) < 0.005 && mint[1] === 1 && mint[2] === 1, `mint under Neon: ${mint}`);
  const pink = applyCssFilter([0xf4 / 255, 0x72 / 255, 0xb6 / 255], neon);
  assert(pink[0] === 1 && pink[2] === 1 && Math.abs(pink[1] - 0.508) < 0.005, `pink under Neon: ${pink}`);
  assert.deepStrictEqual(applyCssFilter([0.2, 0.4, 0.6], 'none').map((v) => +v.toFixed(6)), [0.2, 0.4, 0.6]);
}

// ---------------------------------------------------------------- start positions
{
  const a = initialPositions3d(['x.md', 'y.md', 'z.md']);
  const b = initialPositions3d(['z.md', 'x.md', 'y.md']);
  assert.deepStrictEqual(Array.from(a.slice(0, 3)), Array.from(b.slice(3, 6)), 'a note starts at the same place whatever the file order');
  assert(Array.from(a).every(Number.isFinite));
}

// ---------------------------------------------------------------- layout invariants
// Four clusters of 60 notes (a hub plus random links inside) and a few links between clusters.
function clustered(seed) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const paths = [];
  const pairs = [];
  for (let c = 0; c < 4; c++) {
    const base = c * 60;
    for (let i = 0; i < 60; i++) {
      paths.push(`c${c}/n${i}.md`);
      if (i) pairs.push(base, base + i);
      if (i > 2) pairs.push(base + i, base + 1 + Math.floor(rand() * (i - 1)));
    }
  }
  for (let c = 1; c < 4; c++) pairs.push(0, c * 60);
  return { paths, links: Uint32Array.from(pairs) };
}

function run(paths, links, params) {
  const layout = forceLayout3d(paths.length, links, initialPositions3d(paths), params);
  let guard = 0;
  while (!layout.done && guard++ < 1000) layout.tick();
  return layout;
}

{
  const { paths, links } = clustered(7);
  const layout = run(paths, links);
  const pos = layout.positions;
  const n = paths.length;
  assert(layout.done && layout.ticks <= 301 && layout.ticks >= 299, `cools in ~300 ticks (${layout.ticks})`);
  assert(Array.from(pos).every(Number.isFinite), 'no NaN or Infinity');
  const mean = [0, 1, 2].map((k) => { let t = 0; for (let i = 0; i < n; i++) t += pos[i * 3 + k]; return t / n; });
  const dist = (i, j) => Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
  const radius = Math.max(...Array.from({ length: n }, (_, i) => Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])));
  assert(Math.hypot(...mean) < radius * 1e-3, 'centred on the origin');
  const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const linkLen = median(Array.from({ length: links.length / 2 }, (_, e) => dist(links[e * 2], links[e * 2 + 1])));
  const sameCluster = [];
  const otherCluster = [];
  for (let i = 0; i < n; i += 7) {
    for (let j = i + 3; j < n; j += 11) (Math.floor(i / 60) === Math.floor(j / 60) ? sameCluster : otherCluster).push(dist(i, j));
  }
  assert(linkLen < median(otherCluster) * 0.5, `linked notes end up close (${linkLen.toFixed(1)} vs ${median(otherCluster).toFixed(1)})`);
  assert(median(sameCluster) < median(otherCluster) * 0.8, 'a folder cluster stays together');

  const again = run(paths, links);
  assert.deepStrictEqual(Array.from(again.positions), Array.from(pos), 'deterministic for the same input');
}

{
  // Disconnected notes are held by the weak centre pull instead of drifting away for ever.
  const paths = Array.from({ length: 50 }, (_, i) => `o${i}.md`);
  const layout = run(paths, new Uint32Array(0));
  const pos = layout.positions;
  const far = Math.max(...Array.from({ length: 50 }, (_, i) => Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])));
  // with the pull: ~130; without it they spread to ~380
  assert(Number.isFinite(far) && far < 250, `orphans stay close (${far.toFixed(0)})`);
}

{
  // Every note on the same spot (worst case for the octree) and a single note: no NaN, no endless subdivision.
  const pos = new Float32Array(30 * 3);
  const links = Uint32Array.from([0, 1, 1, 2, 2, 3]);
  const layout = forceLayout3d(30, links, pos);
  for (let i = 0; i < 40; i++) layout.tick();
  assert(Array.from(layout.positions).every(Number.isFinite), 'coincident start positions stay finite');
  const one = forceLayout3d(1, new Uint32Array(0), new Float32Array([5, 5, 5]));
  one.tick();
  assert(Array.from(one.positions).every((v) => v === 0), 'a single note sits at the centre');
  const none = forceLayout3d(0, new Uint32Array(0), new Float32Array(0));
  none.tick();
  assert(none.done, 'an empty graph is done at once');
}

// ---------------------------------------------------------------- the worker source runs on its own
(async () => {
  const messages = [];
  const self = { postMessage: (msg) => messages.push(msg) };
  // eslint-disable-next-line no-new-func
  new Function('self', LAYOUT_WORKER_3D)(self);
  const { paths, links } = clustered(3);
  self.onmessage({ data: { n: paths.length, links, pos: initialPositions3d(paths) } });
  for (let i = 0; i < 400 && !(messages.length && messages[messages.length - 1].done); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  const last = messages[messages.length - 1];
  assert(last && last.done, 'the worker reports done');
  assert(messages.length > 1, 'positions arrive in steps, so the view can draw the layout settling');
  assert.strictEqual(last.pos.length, paths.length * 3);
  assert.deepStrictEqual(Array.from(last.pos), Array.from(run(paths, links).positions), 'the worker computes the same layout');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
