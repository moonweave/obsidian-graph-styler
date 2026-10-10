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
const { graphData3d, colorGroupTest3d, initialPositions3d, forceLayout3d, LAYOUT_WORKER_3D, applyCssFilter, Graph3DView, parseCssColor } = GraphStyler;

// A Graph3DView with just enough of Obsidian and the DOM stubbed to drive its pointer handlers and frame().
// draw() and pick() are replaced by recorders; the handlers come from bindInput() through registerDomEvent.
function stubView() {
  const rafs = [];
  const win = {
    devicePixelRatio: 2,
    requestAnimationFrame: (cb) => { rafs.push(cb); return rafs.length; },
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
  };
  Object.assign(global.window, win);
  const view = new Graph3DView({}, { settings: { experimental3d: true }, rotate3d: true, rotate3dSpeed: 0.12 });
  const handlers = {};
  view.registerDomEvent = (el, type, cb) => { handlers[type] = cb; };
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
  return { view, handlers, calls, rafs, win, pointer };
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
