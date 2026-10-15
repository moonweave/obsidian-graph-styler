#!/usr/bin/env node
'use strict';

// Extended real-input/lifecycle QA. Both the vault and Electron profile must be disposable directories in /tmp.
// node scripts/3d-interaction-smoke.js --port 9234 --vault vault --report /tmp/qa.json --screens /tmp/qa-screens
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connect } = require('./3d-smoke');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
  return pairs;
}, []));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const P = `app.plugins.plugins['graph-styler']`;
const V = `${P}.views3d()[0]`;
const GROUP = `document.querySelector('.gs-3d-center').closest('details')`;

async function main() {
  const { ws, call, js, title } = await connect();
  const results = [], errors = [];
  const previousHandler = ws.onmessage;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    previousHandler(event);
  };
  const record = (name, detail = true) => { results.push({ name, ok: true, detail }); console.log(`PASS ${name}`); };
  const wait = async (expression, predicate, label) => {
    const until = Date.now() + 10000;
    let value;
    while (Date.now() < until) {
      value = await js(expression);
      if (predicate(value)) return value;
      await sleep(50);
    }
    throw new Error(`${label}: ${JSON.stringify(value)}`);
  };
  const press = async (key, code, keyCode, modifiers = 0) => {
    for (const type of ['keyDown', 'keyUp']) await call('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, modifiers });
  };
  const mouse = (type, x, y, extra = {}) => call('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const click = async (x, y, extra = {}) => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, { button: 'left', clickCount: 1, ...extra });
    await mouse('mouseReleased', x, y, { button: 'left', clickCount: 1, ...extra });
  };
  const clickElement = async expression => {
    await sleep(350);
    await js(`(${expression}).scrollIntoView({block:'center',behavior:'instant'})`);
    await sleep(350);
    const point = await js(`(() => { const e = ${expression}; const r=e.getBoundingClientRect(); if(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)!==e)throw Error('control is obscured'); return [r.x+r.width/2,r.y+r.height/2]; })()`);
    await click(...point);
  };
  const select = async (index, option) => {
    await js(`(() => { const e=${GROUP}.querySelectorAll('select')[${index}]; e.selectedIndex=${option}; e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  };
  const openCenterPicker = async () => {
    await clickElement("document.querySelector('.gs-3d-center')");
    await wait("document.querySelector('.modal-container .prompt-input') !== null", Boolean, 'center picker opens');
  };
  const chooseCenter = async path => {
    await openCenterPicker();
    await call('Input.insertText', { text: path });
    await wait("document.querySelectorAll('.modal-container .suggestion-item').length", n => n > 0, 'center search results');
    await press('Enter', 'Enter', 13);
    await wait(`${P}.settings.orbitalCenterPath`, selected => selected === path, 'center selection saved');
  };
  const cancelCenterSearch = async query => {
    await openCenterPicker();
    await call('Input.insertText', { text: query });
    await sleep(100);
    await press('Escape', 'Escape', 27);
    await wait("document.querySelector('.modal-container') === null", Boolean, 'center search cancelled');
  };
  const geometry = () => js(`(() => {const c=${V}.canvas,r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===c};})()`);
  const capture = async name => {
    if (!args.screens) return;
    await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const response = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(args.screens, { recursive: true });
    fs.writeFileSync(path.join(args.screens, `${name}.png`), Buffer.from(response.result.data, 'base64'));
  };
  const reopen = async () => {
    await js(`(async()=>{const p=${P};await p.setExperimental3d(false,false);await p.setExperimental3d(true,false);await p.open3d();})()`);
    await wait(`!!${V}?.data`, Boolean, '3D rebuild');
  };
  let baselineOptions;
  const filter = async (search, count) => {
    await js(`(async()=>{const p=${P};const o=Object.assign({},${JSON.stringify(baselineOptions)},{search:${JSON.stringify(search)},showOrphans:true,hideUnresolved:true});p.syncCoreGraphOptions(o);await p.reloadGraph(o,false,true);})()`);
    await js(`app.workspace.revealLeaf(app.workspace.getLeavesOfType('graph')[0]); true`);
    await wait(`app.workspace.getLeavesOfType('graph')[0]?.view.renderer?.nodes.length`, n => n === count, `filter ${search}`);
    await reopen();
  };
  try {
    const environment = await js(`({vault:app.vault.adapter.basePath,profile:require('electron').remote.app.getPath('userData')})`);
    const temporaryRoots = [os.tmpdir(), '/tmp'].map(root => fs.realpathSync(root) + path.sep);
    for (const location of Object.values(environment)) assert.ok(temporaryRoots.some(root => fs.realpathSync(location).startsWith(root)), 'QA refuses a real vault or user profile');
    record('isolated profile and vault verified', environment);
    await call('Runtime.enable'); errors.length = 0;
    await call('Page.bringToFront');
    await call('Emulation.setFocusEmulationEnabled', { enabled: true });
    await call('Emulation.setDeviceMetricsOverride', { width: 1100, height: 850, deviceScaleFactor: 1, mobile: false });
    assert.strictEqual(await js(`document.querySelectorAll('.modal-container').length`), 0, 'no modal may intercept real input');
    await js(`(async()=>{const p=${P};await p.setExperimental3d(true,false);await p.open3d();await p.setRotate3d(false);app.workspace.leftSplit.collapse();await p.activateView();})()`);
    baselineOptions = await js(`${P}.readGraphOptions()`);
    await js(`${GROUP}.open=true`);
    for (const [lookIndex, look] of ['original', 'deep-space'].entries()) {
      await select(0, lookIndex);
      for (const [layoutIndex, layout] of ['force', 'orbital', 'globe'].entries()) {
        await select(1, layoutIndex);
        const state = await wait(`(()=>{const v=${V};return {look:v.graphLook,layout:v.graphLayout,geometry:!!v.globeGeometry,worker:!!v.worker,gl:v.gl.getError()};})()`,
          s => s.look === look && s.layout === layout, 'selector change');
        assert.strictEqual(state.geometry, layout === 'globe', 'curved geometry must not leak into Orbital');
        assert.strictEqual(state.gl, 0);
        if (layout !== 'force') assert.strictEqual(state.worker, false);
        record(`selector change: ${look}/${layout}`, state);
      }
    }
    await select(1, 1);
    const center = await js(`${V}.files.filter(f=>f.type==='file'&&f.file&&/\.md$/i.test(f.path))[0].path`);
    await chooseCenter(center);
    assert.deepStrictEqual(await js(`(()=>{const v=${V};return [v.centerPath,Array.from(v.pos.slice(v.orbitalCenter*3,v.orbitalCenter*3+3))];})()`), [center, [0, 0, 0]]);
    await cancelCenterSearch('__missing_graph_styler_qa__.md');
    assert.strictEqual(await js(`${P}.settings.orbitalCenterPath`), center, 'cancelling an unmatched search preserves the saved center');
    await clickElement("document.querySelector('.gs-center-controls button:nth-of-type(2)')");
    assert.strictEqual(await js(`${V}.centerPath`), '');
    await chooseCenter(center);
    record('center picker: search, explicit selection, cancelled unmatched search, and automatic center');
    await capture('orbital-controls');

    await js(`app.workspace.rightSplit.collapse()`);
    await sleep(150);
    let point = await geometry();
    assert.ok(point.hit && point.w > 100 && point.h > 100, 'actual canvas receives pointer input');
    for (const [button, modifiers] of [['right', 0], ['left', 8]]) {
      const before = await js(`${V}.cam.target.slice()`);
      await mouse('mousePressed', point.x, point.y, { button, clickCount: 1, modifiers });
      await mouse('mouseMoved', point.x + 32, point.y + 18, { button, buttons: button === 'right' ? 2 : 1, modifiers });
      await mouse('mouseReleased', point.x + 32, point.y + 18, { button, clickCount: 1, modifiers });
      assert.notDeepStrictEqual(await js(`${V}.cam.target`), before);
      assert.strictEqual(await js(`!!${V}.drag`), false);
      record(button === 'right' ? 'right-drag pans' : 'Shift-drag pans');
    }
    const zoomBefore = await js(`${V}.cam.dist`);
    await mouse('mouseWheel', point.x, point.y, { deltaY: -30, deltaX: 0, modifiers: 2 });
    await wait(`${V}.cam.dist`, n => n < zoomBefore, 'trackpad pinch');
    for (const deltaY of [-100000, 100000]) {
      await mouse('mouseWheel', point.x, point.y, { deltaY, deltaX: 0 });
      const zoom = await wait(`(()=>{const v=${V};return {distance:v.cam.dist,min:v.fit.r*.05,max:v.fit.r*12};})()`,
        s => s.distance === (deltaY < 0 ? s.min : s.max), 'zoom clamp');
      assert.ok(Number.isFinite(zoom.distance));
    }
    record('trackpad pinch and both zoom limits');
    await js(`${P}.setGraph3dOptions({layout:'globe'})`);
    await sleep(150);
    const node = await js(`(()=>{const v=${V},c=v.canvas,r=c.getBoundingClientRect(),d=c.width/c.clientWidth;return v.files.map((f,i)=>({i,path:f.path,type:f.type,point:v.project(i),degree:v.data.deg[i],file:!!f.file})).filter(f=>f.file&&f.type==='file'&&f.degree>0&&f.point[0]>25*d&&f.point[0]<(r.width-25)*d&&f.point[1]>25*d&&f.point[1]<(r.height-25)*d).sort((a,b)=>b.degree-a.degree).map(f=>({i:f.i,path:f.path,degree:f.degree,x:r.x+f.point[0]/d,y:r.y+f.point[1]/d}))[0];})()`);
    assert.ok(node);
    await mouse('mouseMoved', node.x, node.y);
    await wait(`${V}.hover`, n => n === node.i, 'real pointer hover');
    const hover = await js(`(()=>{const v=${V};return {label:v.label.textContent,links:v.hiCount,segments:v.hiGlobeThickCount,gl:v.gl.getError()};})()`);
    assert.strictEqual(hover.links, node.degree * 2);
    assert.ok(hover.label && hover.segments > 0); assert.strictEqual(hover.gl, 0);
    record('real hover highlights the node and its curved links', hover);
    await capture('globe-hover');
    await click(node.x, node.y);
    await wait(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path===${JSON.stringify(node.path)})`, Boolean, 'node opens exact note');
    assert.strictEqual(await js(`${P}.views3d().length`), 1, 'opening a note keeps the 3D tab');
    record('real node click opens the exact note and keeps 3D');
    await js(`${P}.open3d()`);
    await sleep(500);
    const tabsBefore = await js(`app.workspace.getLeavesOfType('markdown').length`);
    const reopenedNode = await js(`(()=>{const v=${V},r=v.canvas.getBoundingClientRect(),d=v.canvas.width/v.canvas.clientWidth,p=v.project(${node.i});return [r.x+p[0]/d,r.y+p[1]/d];})()`);
    await click(...reopenedNode, { modifiers: 4 });
    await wait(`app.workspace.getLeavesOfType('markdown').length`, n => n > tabsBefore, 'Cmd-click opens another note tab');
    record('Cmd-click opens a separate note tab');
    await js(`${P}.open3d()`);

    await js(`${P}.activateView(); ${GROUP}.open=true`);
    const rotationBox = `${GROUP}.querySelectorAll('input[type=checkbox]')[1]`;
    await clickElement(rotationBox);
    await wait(`${P}.rotate3d`, Boolean, 'rotation toggle');
    await js(`${GROUP}.querySelector('input[type=range]').focus()`);
    await press('End', 'End', 35);
    assert.strictEqual(await js(`${P}.rotate3dSpeed`), 0.6);
    await sleep(3400);
    const theta = await js(`${V}.cam.theta`);
    await sleep(300);
    assert.ok((await js(`${V}.cam.theta`)) > theta);
    point = await geometry();
    await mouse('mouseWheel', point.x, point.y, { deltaY: 1, deltaX: 0 });
    const paused = await js(`${V}.cam.theta`);
    await sleep(200);
    assert.ok(Math.abs((await js(`${V}.cam.theta`)) - paused) < 0.002);
    await sleep(3400);
    assert.ok((await js(`${V}.cam.theta`)) > paused);
    await clickElement(rotationBox);
    await wait(`${P}.rotate3d`, on => !on, 'rotation off');
    record('auto-rotate, speed slider, interaction pause and idle resume');

    await js(`app.workspace.rightSplit.collapse()`);
    for (const layout of ['force', 'orbital', 'globe']) {
      await js(`${P}.setGraph3dOptions({layout:${JSON.stringify(layout)}})`);
      await js(`(()=>{const v=${V};window.__gsQaContext=v.gl.getExtension('WEBGL_lose_context');if(!window.__gsQaContext)throw Error('context-loss extension unavailable');window.__gsQaContext.loseContext();})()`);
      await wait(`(()=>{const v=${V};return {lost:v.gl.isContextLost(),message:!!v.message,worker:!!v.worker};})()`, s => s.lost && s.message && !s.worker, 'context-loss cleanup');
      await sleep(200);
      await js(`window.__gsQaContext.restoreContext()`);
      await wait(`(()=>{const v=${V};return {ready:!v.gl.isContextLost()&&v.glData===v.data&&!v.message,error:v.gl.getError()};})()`, s => s.ready && s.error === 0, 'context restore');
      record(`WebGL loss and restore: ${layout}`);
    }
    await js(`delete window.__gsQaContext`);
    for (const deviceScaleFactor of [1, 2]) {
      await call('Emulation.setDeviceMetricsOverride', { width: 900 + deviceScaleFactor, height: 700, deviceScaleFactor, mobile: false });
      await wait(`(()=>{const c=${V}.canvas;return {actual:c.width,expected:Math.round(c.clientWidth*devicePixelRatio),dpr:devicePixelRatio};})()`, s => s.dpr === deviceScaleFactor && s.actual === s.expected, 'canvas resize/DPR');
      record(`resize and DPR ${deviceScaleFactor}`);
    }
    await call('Emulation.clearDeviceMetricsOverride');

    await js(`${P}.activateView(); ${GROUP}.open=true; window.__gsQaClosed=${V}; true`);
    await clickElement(`document.querySelector('.gs-3d-switch')`);
    await wait(`${P}.views3d().length`, n => n === 0, '3D checkbox closes tab');
    const cleanup = await js(`(()=>{const v=window.__gsQaClosed;return {disposed:v.disposed,canvas:v.canvas,gl:v.gl,worker:v.worker,raf:v.raf,command:app.commands.commands['graph-styler:open-3d-graph'].checkCallback(true)};})()`);
    assert.deepStrictEqual(cleanup, { disposed: true, canvas: null, gl: null, worker: null, raf: 0, command: false });
    record('3D off: tab, worker, RAF, GPU and command cleanup', cleanup);
    await js(`delete window.__gsQaClosed`);
    for (let i = 0; i < 5; i++) {
      await js(`(async()=>{const p=${P};await p.setExperimental3d(true,false);await Promise.all([p.open3d(),p.open3d(),p.open3d()]);})()`);
      assert.strictEqual(await js(`${P}.views3d().length`), 1);
      await js(`${P}.setExperimental3d(false,false)`);
    }
    record('five enable/open/disable cycles and concurrent opens');
    await js(`${P}.setGraph3dOptions({look:'deep-space',layout:'orbital',centerPath:${JSON.stringify(center)}})`);
    await js(`(async()=>{await app.plugins.disablePlugin('graph-styler');await app.plugins.enablePlugin('graph-styler');})()`);
    assert.deepStrictEqual(await js(`(()=>{const s=${P}.settings;return [s.graph3dLook,s.graph3dLayout,s.orbitalCenterPath];})()`), ['deep-space', 'orbital', center]);
    record('Look, Layout and center survive plugin reload');

    await filter('path:Keep', 3);
    assert.deepStrictEqual((await js(`${V}.files.map(f=>f.path)`)).sort(), ['Keep/Alpha.md', 'Keep/Beta.md', 'Keep/Orphan.md']);
    record('3D mirrors the filtered 2D graph');
    await filter('path:"00 Company/Company.md"', 1);
    const tiny = await js(`(()=>{const v=${V},dpr=v.canvas.width/Math.max(1,v.canvas.clientWidth);return {nodes:v.data.n,fit:v.fit.r,maxNode:Math.max(...v.size)*v.pxScale/(v.shownDist*dpr)};})()`);
    assert.strictEqual(tiny.nodes, 1); assert.ok(tiny.fit >= 30 && tiny.maxNode < 32);
    record('one-note graph remains a small node', tiny);
    await filter('path:__missing_graph_styler_qa__', 0);
    assert.deepStrictEqual(await js(`(()=>{const v=${V};return [v.data.n,!!v.message,!!v.worker];})()`), [0, true, false]);
    point = await geometry();
    await mouse('mouseWheel', point.x, point.y, { deltaY: 120, deltaX: 0 });
    record('empty graph message and wheel input');
    await js(`(async()=>{const p=${P};p.syncCoreGraphOptions(${JSON.stringify(baselineOptions)});await p.reloadGraph(${JSON.stringify(baselineOptions)},false,true);})()`);
    await js(`app.workspace.revealLeaf(app.workspace.getLeavesOfType('graph')[0]); true`);
    await wait(`app.workspace.getLeavesOfType('graph')[0]?.view.renderer?.nodes.length`, n => n > 3, 'restore source graph');
    await reopen();
    await js(`${P}.setGraph3dOptions({look:'deep-space',layout:'globe',centerPath:''}); app.workspace.rightSplit.collapse()`);
    await capture('globe-final');
    assert.deepStrictEqual(errors, [], 'no uncaught JavaScript exceptions or console errors during the run');
    record('no runtime exceptions or console errors');
    const report = { title, checkedAt: new Date().toISOString(), results };
    if (args.report) fs.writeFileSync(args.report, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await call('Emulation.clearDeviceMetricsOverride').catch(() => {});
    ws.close();
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
