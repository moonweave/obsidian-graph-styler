#!/usr/bin/env node
'use strict';

// Pointer-input smoke test for the graph view in a running Obsidian, driven over the DevTools protocol.
// Not part of `node test/graph-styler.test.js` (it needs a real Obsidian); run it by hand before a release.
//
// Start a separate Obsidian with its own user-data-dir and a test vault (never your real profile):
//   open -n -a Obsidian --args --user-data-dir=/tmp/gs-smoke/udd --remote-debugging-port=9222
// open a graph view, optionally a note's local graph, then:
//   node scripts/input-smoke.js --port 9222 --vault <vault folder name> [--leaf graph|localgraph] [--preset aurora]
//
// It sends real input (Input.dispatchMouseEvent: wheel, ctrl+wheel as a trackpad pinch, small trackpad
// deltas, drag, hover, node drag, double-click, right-click, click) at the graph pane and exits 1 if any
// check fails. 0.2.0–0.3.0 fail the first check with a preset applied: the glow-filtered iframe sat on top
// of Obsidian's input overlay, so the hit test returned IFRAME and nothing below it moved.

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return pairs;
}, []));
const port = args.port || '9222';
const leafType = args.leaf || 'graph';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page' && (t.url || '').startsWith('app://obsidian.md/index.html')
    && (!args.vault || t.title.includes(` - ${args.vault} - `)));
  if (!page) throw new Error(`no Obsidian window${args.vault ? ` for vault "${args.vault}"` : ''} on port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const call = (method, params = {}) => new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result.result.value;
  };
  return { ws, call, js, title: page.title };
}

const LEAF = `app.workspace.getLeavesOfType('${leafType}')[0]`;
const STATE = `(() => { const r = ${LEAF}.view.renderer; return { scale: r.scale, panX: r.panX, panY: r.panY }; })()`;
// Puts the given node in the middle of the pane and returns its screen point and graph position.
const CENTRE_ON = (id) => `(async () => { const leaf = ${LEAF}; const r = leaf.view.renderer; const rect = leaf.view.contentEl.getBoundingClientRect();
  const W = r.px.renderer.width; const H = r.px.renderer.height; const dpr = W / rect.width;
  const hub = r.nodes.find((n) => n.id === ${JSON.stringify(id)});
  r.setPan(W / 2 - hub.x * r.scale, H / 2 - hub.y * r.scale); r.changed();
  await new Promise((x) => setTimeout(x, 500));
  return { x: rect.x + (hub.x * r.scale + r.panX) / dpr, y: rect.y + (hub.y * r.scale + r.panY) / dpr, nx: hub.x, ny: hub.y }; })()`;
// A point in the pane at least 40 px from every node.
const EMPTY = `(() => { const leaf = ${LEAF}; const r = leaf.view.renderer; const rect = leaf.view.contentEl.getBoundingClientRect();
  const dpr = r.px.renderer.width / rect.width;
  const pts = r.nodes.map((n) => ({ x: rect.x + (n.x * r.scale + r.panX) / dpr, y: rect.y + (n.y * r.scale + r.panY) / dpr }));
  for (let gy = 0.12; gy < 0.92; gy += 0.04) for (let gx = 0.12; gx < 0.92; gx += 0.04) {
    const p = { x: rect.x + rect.width * gx, y: rect.y + rect.height * gy };
    if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 40)) return p;
  }
  return { x: rect.x + rect.width * 0.12, y: rect.y + rect.height * 0.88 }; })()`;

(async () => {
  const { ws, call, js, title } = await connect();
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
  const mouse = (type, x, y, extra = {}) => call('Input.dispatchMouseEvent', { type, x, y, ...extra });

  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await js(`require('electron').remote.getCurrentWindow().webContents.setBackgroundThrottling(false)`);
  if (args.preset) {
    await js(`app.commands.executeCommandById('graph-styler:apply-${args.preset}')`);
    await sleep(2500);
  }
  if (!(await js(`!!${LEAF}`))) throw new Error(`no ${leafType} leaf is open`);
  // Pane geometry and the most-linked node.
  const geo = await js(`(async () => {
    const leaf = ${LEAF}; app.workspace.revealLeaf(leaf);
    document.querySelectorAll('.graph-controls').forEach((c) => { if (!c.classList.contains('is-close')) c.querySelector('.mod-close').click(); });
    document.querySelectorAll('.notice').forEach((n) => n.remove());
    const r = leaf.view.renderer;
    const rect = leaf.view.contentEl.getBoundingClientRect();
    if (r.scale > 1.5 || r.scale < 0.2) { r.targetScale = 0.6; r.setScale(0.6); }
    r.setPan(r.px.renderer.width / 2, r.px.renderer.height / 2);
    r.changed();
    await new Promise((x) => setTimeout(x, 1200));
    const hub = r.nodes.slice().sort((a, b) => b.weight - a.weight)[0];
    return { rect: [rect.x, rect.y, rect.width, rect.height], hub: { id: hub.id } };
  })()`);
  const [rx, ry, rw, rh] = geo.rect;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const state = () => js(STATE);
  const moved = (a, b, key) => Math.abs(a[key] - b[key]) > 1e-3;

  const hit = await js(`(() => { const e = document.elementFromPoint(${cx}, ${cy}); return e ? e.tagName : null; })()`);
  check('hit test at pane centre is not the iframe', hit !== 'IFRAME', hit);

  let s0 = await state();
  for (let i = 0; i < 3; i++) { await mouse('mouseWheel', cx, cy, { deltaX: 0, deltaY: -120 }); await sleep(60); }
  await sleep(900);
  let s1 = await state();
  check('mouse wheel zooms', s1.scale > s0.scale * 1.05, `${s0.scale.toFixed(3)} -> ${s1.scale.toFixed(3)}`);
  for (let i = 0; i < 3; i++) { await mouse('mouseWheel', cx, cy, { deltaX: 0, deltaY: 120 }); await sleep(60); }
  await sleep(900);

  s0 = await state();
  for (let i = 0; i < 40; i++) { await mouse('mouseWheel', cx, cy, { deltaX: 0, deltaY: -1.2 }); await sleep(16); }
  await sleep(900);
  s1 = await state();
  check('trackpad two-finger scroll (small deltas) zooms', s1.scale > s0.scale, `${s0.scale.toFixed(4)} -> ${s1.scale.toFixed(4)}`);

  s0 = await state();
  for (let i = 0; i < 30; i++) { await mouse('mouseWheel', cx, cy, { deltaX: 0, deltaY: -4, modifiers: 2 }); await sleep(16); }
  await sleep(900);
  s1 = await state();
  check('trackpad pinch (ctrl+wheel) zooms', s1.scale > s0.scale, `${s0.scale.toFixed(4)} -> ${s1.scale.toFixed(4)}`);
  for (let i = 0; i < 30; i++) { await mouse('mouseWheel', cx, cy, { deltaX: 0, deltaY: 4, modifiers: 2 }); await sleep(16); }
  await sleep(900);

  // Node checks centre the most-linked node first, so it is on screen whatever the zoom is.
  const fresh = await js(CENTRE_ON(geo.hub.id));
  s0 = await state();
  for (let i = 0; i < 2; i++) { await mouse('mouseWheel', fresh.x, fresh.y, { deltaX: 0, deltaY: -120 }); await sleep(60); }
  await sleep(900);
  s1 = await state();
  check('wheel over a node zooms', moved(s0, s1, 'scale'), `${s0.scale.toFixed(3)} -> ${s1.scale.toFixed(3)}`);
  for (let i = 0; i < 2; i++) { await mouse('mouseWheel', fresh.x, fresh.y, { deltaX: 0, deltaY: 120 }); await sleep(60); }
  await sleep(900);

  const empty = await js(EMPTY);
  s0 = await state();
  await mouse('mousePressed', empty.x, empty.y, { button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', empty.x + 8 * i, empty.y + 5 * i, { button: 'left', buttons: 1 }); await sleep(20); }
  await mouse('mouseReleased', empty.x + 80, empty.y + 50, { button: 'left', clickCount: 1 });
  await sleep(700);
  s1 = await state();
  check('drag on the background pans', moved(s0, s1, 'panX') || moved(s0, s1, 'panY'), `pan ${Math.round(s0.panX)},${Math.round(s0.panY)} -> ${Math.round(s1.panX)},${Math.round(s1.panY)}`);

  const hubNow = await js(CENTRE_ON(geo.hub.id));
  for (let i = 0; i < 6; i++) { await mouse('mouseMoved', hubNow.x - 18 + 3 * i, hubNow.y); await sleep(40); }
  await sleep(500);
  const hovered = await js(`(() => { const r = ${LEAF}.view.renderer; const h = r.getHighlightNode && r.getHighlightNode(); return h ? h.id : null; })()`);
  check('hovering a node highlights it', hovered === geo.hub.id, hovered);

  await mouse('mousePressed', hubNow.x, hubNow.y, { button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', hubNow.x + 6 * i, hubNow.y + 4 * i, { button: 'left', buttons: 1 }); await sleep(25); }
  await sleep(200);
  const during = await js(`(() => { const hub = ${LEAF}.view.renderer.nodes.find((n) => n.id === ${JSON.stringify(geo.hub.id)}); return { nx: hub.x, ny: hub.y }; })()`);
  await mouse('mouseReleased', hubNow.x + 60, hubNow.y + 40, { button: 'left', clickCount: 1 });
  await sleep(600);
  check('dragging a node moves it', Math.hypot(during.nx - hubNow.nx, during.ny - hubNow.ny) > 5,
    `${Math.round(hubNow.nx)},${Math.round(hubNow.ny)} -> ${Math.round(during.nx)},${Math.round(during.ny)}`);

  // The node menu can be native (no DOM), so listen for Obsidian's file-menu event as well as the DOM events.
  await js(`(() => { window.__gsSmoke = []; const el = ${LEAF}.view.contentEl;
    for (const t of ['dblclick', 'contextmenu']) el.addEventListener(t, (e) => window.__gsSmoke.push(t + ':' + e.target.tagName), { capture: true, once: true });
    const ref = app.workspace.on('file-menu', (menu, file, source) => { window.__gsSmoke.push('file-menu:' + source); app.workspace.offref(ref); }); })()`);
  const spot = await js(EMPTY);
  await mouse('mousePressed', spot.x, spot.y, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', spot.x, spot.y, { button: 'left', clickCount: 1 });
  await mouse('mousePressed', spot.x, spot.y, { button: 'left', clickCount: 2 });
  await mouse('mouseReleased', spot.x, spot.y, { button: 'left', clickCount: 2 });
  await sleep(400);
  const hubAgain = await js(CENTRE_ON(geo.hub.id));
  await mouse('mouseMoved', hubAgain.x, hubAgain.y);
  await sleep(200);
  await mouse('mousePressed', hubAgain.x, hubAgain.y, { button: 'right', buttons: 2, clickCount: 1 });
  await mouse('mouseReleased', hubAgain.x, hubAgain.y, { button: 'right', clickCount: 1 });
  await sleep(700);
  const events = await js('window.__gsSmoke');
  check('double-click reaches the input overlay', events.includes('dblclick:CANVAS'), events.join(' '));
  check('right-click on a node opens its file menu', events.some((e) => e.startsWith('file-menu:')), events.join(' '));
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(400);

  await js(`app.workspace.revealLeaf(${LEAF})`);
  await sleep(500);
  const hubLast = await js(CENTRE_ON(geo.hub.id));
  const before = await js(`(() => { const f = app.workspace.getActiveFile(); return f ? f.path : null; })()`);
  await mouse('mouseMoved', hubLast.x, hubLast.y);
  await sleep(200);
  await mouse('mousePressed', hubLast.x, hubLast.y, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', hubLast.x, hubLast.y, { button: 'left', clickCount: 1 });
  await sleep(1500);
  const opened = await js(`(() => { const f = app.workspace.getActiveFile(); return f ? f.path : null; })()`);
  check('clicking a node opens the note', opened === geo.hub.id, `${before} -> ${opened}`);
  // The click may open the note in the graph's own tab; put a graph view back so the script can run again.
  await js(`(async () => { if (!${LEAF}) { app.commands.executeCommandById('${leafType === 'graph' ? 'graph:open' : 'graph:open-local'}'); await new Promise((x) => setTimeout(x, 3000)); } })()`);

  ws.close();
  const failed = results.filter((r) => !r.ok);
  if (args.json) console.log(JSON.stringify({ title, leaf: leafType, preset: args.preset || null, results }));
  else {
    console.log(`${title} — ${leafType}${args.preset ? `, preset ${args.preset}` : ''}`);
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
    console.log(failed.length ? `${failed.length} check(s) failed` : 'all checks passed');
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e.message || e); process.exit(2); });
