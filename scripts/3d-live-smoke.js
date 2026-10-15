'use strict';

const assert = require('node:assert/strict');
const { connect } = require('./3d-smoke');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const c = await connect();
  const P = 'app.plugins.plugins["graph-styler"]';
  const V = `${P}.views3d()[0]`;
  const key = async key => {
    for (const type of ['keyDown', 'keyUp']) await c.call('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: key === 'End' ? 35 : 36 });
    await pause(500);
  };
  try {
    assert.match(await c.js('app.vault.adapter.basePath'), /^\/(private\/)?tmp\//);
    await c.js(`(async()=>{await ${P}.open3d();await ${P}.activateView();await ${P}.setGraph3dOptions({layout:'force'});await ${P}.setRotate3d(false);${V}.userMoved=true;})()`);
    await c.js(`(()=>{const el=[...document.querySelectorAll('.graph-styler-panel details')].find(e=>/Customize|커스터마이즈/.test(e.querySelector('summary')?.textContent));el.open=true;window.__gsLiveRanges=el.querySelectorAll('input[type=range]');window.__gsLiveRanges[3].focus();})()`);
    await key('End');
    const far = await c.js(`${V}.style.forces.linkDistance`);
    await key('Home');
    const near = await c.js(`${V}.style.forces.linkDistance`);
    assert(far > near * 10, 'real keyboard slider input updates Force without saving');
    await c.js(`${P}.setGraph3dOptions({layout:'globe'})`);
    await pause(300);
    await c.js(`window.__gsLiveBuffer=${V}.buf; window.__gsLivePos=${V}.pos; window.__gsLiveRanges=document.querySelectorAll('.graph-styler-panel details')[0].querySelectorAll('input[type=range]')`);
    await c.js(`(()=>{const el=[...document.querySelectorAll('.graph-styler-panel details')].find(e=>/Customize|커스터마이즈/.test(e.querySelector('summary')?.textContent));el.open=true;el.querySelectorAll('input[type=range]')[1].focus();})()`);
    await key('End');
    const big = await c.js(`${V}.style.nodeSize`);
    await key('Home');
    const small = await c.js(`${V}.style.nodeSize`);
    assert(big > small * 5);
    assert(await c.js(`${V}.buf===window.__gsLiveBuffer && ${V}.pos===window.__gsLivePos`), 'size preview preserves Globe geometry and GPU buffers');
    await c.js(`(async()=>{const p=${P};await p.setGraph3dOptions({layout:'orbital'});document.querySelector('.gs-3d-center').click();})()`);
    await pause(200);
    await c.call('Input.insertText', { text: 'alpha' });
    await pause(200);
    for (const type of ['keyDown', 'keyUp']) await c.call('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await pause(300);
    assert.equal(await c.js(`${V}.centerPath`), 'alpha.md');
    await c.js(`app.workspace.revealLeaf(app.workspace.getLeavesOfType('graph')[0])`);
    await pause(500);
    await c.js(`(()=>{const v=app.workspace.getLeavesOfType('graph')[0].view;const e=v.engine||v.dataEngine;e.setOptions({search:'file:alpha'});e.render();})()`);
    await pause(1000);
    await c.js(`${P}.open3d()`);
    const point = await c.js(`(()=>{const r=document.querySelector('.gs3d-refresh').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for (const type of ['mousePressed', 'mouseReleased']) await c.call('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    await pause(500);
    assert.deepEqual(await c.js(`${V}.paths`), ['alpha.md'], 'refresh uses current filtered graph');
    console.log(JSON.stringify({force:{far,near},nodeSize:{big,small},center:'alpha.md',refreshNodes:1}));
  } finally {
    await c.js('delete window.__gsLiveBuffer;delete window.__gsLivePos;delete window.__gsLiveRanges');
    c.ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
