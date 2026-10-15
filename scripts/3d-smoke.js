#!/usr/bin/env node
'use strict';

// Real 3D runtime smoke test against an isolated Obsidian profile and disposable vault.
// Example: node scripts/3d-smoke.js --port 9227 --vault gsruntime

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return pairs;
}, []));
const port = args.port || '9222';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((target) => target.type === 'page' && (target.url || '').startsWith('app://obsidian.md/index.html')
    && (!args.vault || target.title.includes(` - ${args.vault} - `)));
  if (!page) throw new Error(`no Obsidian window${args.vault ? ` for vault "${args.vault}"` : ''} on port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const request = pending.get(message.id);
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else request.resolve(message);
    }
  };
  const call = (method, params = {}, timeoutMs = 10000) => new Promise((resolve, reject) => {
    id += 1;
    const requestId = id;
    const request = { resolve, reject, timer: null };
    pending.set(id, request);
    request.timer = setTimeout(() => {
      if (pending.has(requestId)) { pending.delete(requestId); reject(new Error(`${method} timed out`)); }
    }, timeoutMs);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async (expression, timeoutMs = 10000) => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
    if (response.result && response.result.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails).slice(0, 500));
    return response.result.result.value;
  };
  return { ws, call, js, title: page.title };
}

async function main() {
  const { ws, call, js, title } = await connect();
  const results = [];
  const record = (name, detail = true) => { assert.ok(detail, name); results.push({ name, ok: true, detail }); };
  const capture = async (name) => {
    if (!args.screens) return;
    const response = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(args.screens, { recursive: true });
    const filename = path.join(args.screens, `${name}.png`);
    fs.writeFileSync(filename, Buffer.from(response.result.data, 'base64'));
    record(`screenshot ${name}`, filename);
  };
  try {
    record('isolated Obsidian window selected', title);
    await call('Page.bringToFront');
    await call('Emulation.setFocusEmulationEnabled', { enabled: true });
    await js(`require('electron').remote.getCurrentWindow().webContents.setBackgroundThrottling(false)`);
    await js(`(async () => {
      const plugin = app.plugins.plugins['graph-styler'];
      if (!plugin) throw new Error('Graph Styler is not enabled in this test vault');
      await plugin.setExperimental3d(true, false);
      await plugin.open3d();
      return true;
    })()`);
    const ready = await js(`(async () => {
      const until = Date.now() + 20000;
      while (Date.now() < until) {
        const plugin = app.plugins.plugins['graph-styler'];
        const view = plugin && plugin.views3d()[0];
        if (view && view.canvas && view.gl && view.data) return { nodes: view.data.n, edges: view.data.links.length / 2 };
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('3D view did not become ready');
    })()`);
    record('WebGL 2 3D view opened', ready);
    console.log('3D view ready');
    assert.ok(ready.nodes > 0, 'test vault graph has visible nodes');

    const center = await js(`(() => {
      const plugin = app.plugins.plugins['graph-styler'];
      const view = plugin.views3d()[0];
      const file = view.files.find((item) => item.type === 'file' && /\\.md$/i.test(item.path));
      return file ? file.path : '';
    })()`);
    assert.ok(center, 'test graph contains a visible Markdown note');
    await js(`app.plugins.plugins['graph-styler'].setGraph3dOptions({ look: 'deep-space', layout: 'orbital', centerPath: ${JSON.stringify(center)} })`);
    const orbital = await js(`(() => {
      const view = app.plugins.plugins['graph-styler'].views3d()[0];
      const index = view.files.findIndex((file) => file.path === ${JSON.stringify(center)});
      return { look: view.graphLook, layout: view.graphLayout, center: view.orbitalCenter, centerPath: view.files[view.orbitalCenter]?.path,
        finite: Array.from(view.pos).every(Number.isFinite), worker: !!view.worker };
    })()`);
    record('Orbital center, finite positions, and static-worker shutdown', orbital);
    console.log('Orbital checked');
    assert.deepStrictEqual([orbital.look, orbital.layout, orbital.centerPath, orbital.worker], ['deep-space', 'orbital', center, false]);
    assert.ok(orbital.finite);
    await capture('orbital-deep-space');

    await js(`app.plugins.plugins['graph-styler'].setGraph3dOptions({ layout: 'globe' })`);
    const globe = await js(`(() => {
      const view = app.plugins.plugins['graph-styler'].views3d()[0];
      const radii = Array.from({ length: view.data.n }, (_, i) => Math.hypot(view.pos[i*3], view.pos[i*3+1], view.pos[i*3+2]));
      const previousLineSize = view.style.lineSize;
      view.draw();
      view.setHover(view.data.deg.indexOf(Math.max(...view.data.deg)));
      view.style.lineSize = 2;
      view.draw();
      const thickGlError = view.gl.getError();
      const highlightVertices = view.hiGlobeThickCount;
      view.style.lineSize = previousLineSize;
      view.setHover(-1);
      view.draw();
      return { layout: view.graphLayout, guides: view.globeGuides.positions.length / 3, arcVertices: view.globeGeometry.positions.length / 3,
        radiusError: Math.max(...radii.map((radius) => Math.abs(radius - 140))), glError: view.gl.getError(), thickGlError, highlightVertices };
    })()`);
    record('Globe guides and geodesic links rendered', globe);
    console.log('Globe shader/draw checked');
    assert.strictEqual(globe.layout, 'globe');
    assert.ok(globe.guides > 0 && globe.arcVertices >= ready.edges * 2);
    assert.ok(globe.radiusError < 1e-3, `globe radius error ${globe.radiusError}`);
    assert.strictEqual(globe.glError, 0, 'WebGL reports no draw error');
    assert.strictEqual(globe.thickGlError, 0, 'thick geodesic shader draws without WebGL errors');
    assert.ok(globe.highlightVertices > 0, 'hover builds the corresponding curved highlight geometry');
    await capture('globe');

    await js(`app.plugins.plugins['graph-styler'].refreshViews()`);
    await js(`app.plugins.plugins['graph-styler'].activateView()`);
    const panel = await js(`(() => {
      const panel = document.querySelector('.graph-styler-panel');
      const group = panel && [...panel.querySelectorAll('details')].find((item) => item.querySelector('summary')?.textContent.includes('3D'));
      if (group) group.open = true;
      const selects = group ? [...group.querySelectorAll('select')] : [];
      return { group: !!group, look: selects[0]?.value, layout: selects[1]?.value,
        center: !!panel?.querySelector('.gs-3d-center'), centerDisabled: panel?.querySelector('.gs-3d-center')?.disabled };
    })()`);
    record('sidebar Look/Layout and search-picker controls exist', panel);
    console.log('sidebar checked');
    assert.ok(panel.group && panel.center && panel.centerDisabled);
    assert.deepStrictEqual([panel.look, panel.layout], ['deep-space', 'globe']);

    await js(`(() => {
      const panel = document.querySelector('.graph-styler-panel');
      const group = [...panel.querySelectorAll('details')].find((item) => item.querySelector('summary')?.textContent.includes('3D'));
      const selects = [...group.querySelectorAll('select')];
      const look = selects[0];
      look.value = 'original'; look.dispatchEvent(new Event('change', { bubbles: true }));
      const layout = selects[1];
      layout.value = 'force'; layout.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(300);
    const force = await js(`(() => { const view = app.plugins.plugins['graph-styler'].views3d()[0]; return { look: view.graphLook, layout: view.graphLayout, worker: !!view.worker, done: view.layoutDone }; })()`);
    record('sidebar selection returns to force layout', force);
    console.log('Force layout checked');
    assert.strictEqual(force.layout, 'force');
    assert.strictEqual(force.look, 'original');
    assert.ok(force.worker || force.done, 'force worker starts and either remains active or finishes the small fixture');
    await capture('original-force');

    const geometry = await js(`(() => { const c = app.plugins.plugins['graph-styler'].views3d()[0].canvas; const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
    const [left, top, width, height] = geometry;
    const x = left + width * 0.5, y = top + height * 0.5;
    const before = await js(`(() => { const v = app.plugins.plugins['graph-styler'].views3d()[0]; return [v.cam.theta, v.cam.dist]; })()`);
    for (const [type, params] of [
      ['mouseMoved', { x, y }],
      ['mouseWheel', { x, y, deltaY: 120, deltaX: 0 }],
      ['mousePressed', { x, y, button: 'left', clickCount: 1 }],
      ['mouseMoved', { x: x + 28, y: y + 12, button: 'left', buttons: 1 }],
      ['mouseReleased', { x: x + 28, y: y + 12, button: 'left', clickCount: 1 }],
    ]) {
      await call('Input.dispatchMouseEvent', { type, ...params });
      console.log(`input ${type}`);
    }
    const after = await js(`(() => { const v = app.plugins.plugins['graph-styler'].views3d()[0]; return [v.cam.theta, v.cam.dist]; })()`);
    record('3D pointer drag rotates and wheel zooms', { before, after });
    console.log('3D pointer input checked');
    assert.notStrictEqual(after[0], before[0], 'drag rotates camera');
    assert.notStrictEqual(after[1], before[1], 'wheel zooms camera');

    if (args.benchmark) {
      const benchmark = await js(`(async () => {
        const plugin = app.plugins.plugins['graph-styler'];
        const view = plugin.views3d()[0];
        const saved = { data: view.data, files: view.files, paths: view.paths, pos: view.pos, forcePos: view.forcePos,
          graphLayout: view.graphLayout, graphLook: view.graphLook, groupIndex: view.groupIndex, hi: view.hi, layoutDone: view.layoutDone };
        const results = [];
        for (const n of [1600, 5000]) {
          const paths = Array.from({ length: n }, (_, i) => 'Bench/' + String(i).padStart(5, '0') + '.md');
          const pairs = [], seen = new Set();
          for (let i = 0; i < n; i++) for (let step = 1; step <= 4; step++) {
            const j = (i + step) % n, a = Math.min(i, j), b = Math.max(i, j), key = a * n + b;
            if (!seen.has(key)) { seen.add(key); pairs.push(a, b); }
          }
          const links = Uint32Array.from(pairs), deg = new Uint32Array(n);
          for (const i of links) deg[i]++;
          const start = new Uint32Array(n + 1);
          for (let i = 0; i < n; i++) start[i + 1] = start[i] + deg[i];
          const next = start.slice(0, n), adj = new Uint32Array(links.length), adjLink = new Uint32Array(links.length);
          for (let edge = 0; edge < links.length / 2; edge++) {
            const a = links[edge * 2], b = links[edge * 2 + 1];
            adj[next[a]] = b; adjLink[next[a]++] = edge; adj[next[b]] = a; adjLink[next[b]++] = edge;
          }
          view.stopLoop(); view.stopLayout();
          view.data = { n, links, deg, start, adj, adjLink };
          view.paths = paths;
          view.files = paths.map((path) => ({ path, basename: path, type: 'file', file: null }));
          view.graphLayout = 'globe'; view.graphLook = 'deep-space';
          view.groupIndex = new Int32Array(n).fill(-1);
          view.hi = new Float32Array(n); view.hover = -1;
          const pos = new Float32Array(n * 3), goldenAngle = Math.PI * (3 - Math.sqrt(5));
          for (let i = 0; i < n; i++) {
            const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * goldenAngle;
            pos.set([140 * r * Math.cos(a), 140 * y, 140 * r * Math.sin(a)], i * 3);
          }
          view.pos = pos; view.forcePos = pos.slice(); view.layoutDone = true; view.posDirty = false;
          view.initGL(); view.fit = view.measureFit(); view.cam.target = [0, 0, 0];
          view.cam.dist = view.shownDist = view.fitDistance(); view.userMoved = false;
          let frames = 0, last = 0; const gaps = [], drawMs = [];
          const originalDraw = view.draw, rotating = plugin.rotate3d;
          view.draw = function() {
            const t = performance.now();
            if (last) gaps.push(t - last);
            last = t;
            originalDraw.call(this);
            this.gl.finish();
            drawMs.push(performance.now() - t); frames++;
          };
          plugin.rotate3d = true;
          view.lastInput = performance.now() - 5000;
          view.nextDraw = 0; view.lastDraw = 0;
          view.kick();
          await new Promise(resolve => setTimeout(resolve, 10000));
          view.stopLoop(); view.draw = originalDraw; plugin.rotate3d = rotating;
          const sorted = gaps.slice().sort((a, b) => a - b), percentile = (values, p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0;
          results.push({ nodes: n, edges: links.length / 2, fps: frames / 10,
            p95FrameMs: percentile(sorted, 0.95), p95DrawMs: percentile(drawMs.slice().sort((a, b) => a - b), 0.95) });
        }
        view.stopLoop(); view.stopLayout();
        Object.assign(view, saved);
        view.initGL(); view.fit = view.measureFit();
        if (view.graphLayout === 'force' && !view.layoutDone) view.startLayout();
        view.kick(true);
        return results;
      })()`, 30000);
      record('10-second Globe frame benchmark', benchmark);
      for (const sample of benchmark) {
        assert.ok(sample.fps >= 30, `${sample.nodes} nodes rendered at ${sample.fps.toFixed(1)} FPS`);
        assert.ok(sample.p95FrameMs <= 50, `${sample.nodes} nodes p95 frame ${sample.p95FrameMs.toFixed(1)} ms`);
      }
    }

    const report = { title, results };
    if (args.report) fs.writeFileSync(args.report, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    ws.close();
  }
}

module.exports = { connect };
if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
