// Throwaway spatial study: one constellation concept, three camera viewpoints. No vault or persistence.
const $ = s => document.querySelector(s);
const canvas = $('#space');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) { $('#failure').hidden = false; throw Error('WebGL2 unavailable'); }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const groups = [
  { name:'연구', center:[-62,-13,45], radius:[35,28,38], color:[.65,.79,.86], hub:'연결을 이해하는 방법', topics:['실험 설계','관찰과 증거','논문 읽기','가설 검토','결과 해석','다음 질문'] },
  { name:'제품', center:[27,38,-20], radius:[31,27,30], color:[.76,.71,.83], hub:'사용자가 머무는 경험', topics:['탐색 경험','작은 인터랙션','제품 방향','출시 기록','사용성 관찰','디자인 원칙'] },
  { name:'아이디어', center:[75,-10,37], radius:[29,24,29], color:[.78,.76,.65], hub:'아직 이름 없는 생각', topics:['새로운 연결','비유와 모형','다른 가능성','프로토타입','대화의 조각','아이디어 스케치'] },
  { name:'운영', center:[5,-48,-48], radius:[28,24,30], color:[.59,.74,.69], hub:'오래 유지되는 시스템', topics:['자동화 흐름','작업 정리','복구 절차','운영 기록','검수 기준','협업 방식'] },
  { name:'기록', center:[-48,26,-86], radius:[27,24,32], color:[.71,.75,.82], hub:'시간 속에 남은 맥락', topics:['지난 결정','주간 회고','변화의 이유','작업 메모','배운 점','이어갈 일'] },
];
let seed=78312;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const nodes=[], edges=[], used=new Set();
function edge(a,b){const key=[Math.min(a,b),Math.max(a,b)].join(':');if(a!==b&&!used.has(key)){used.add(key);edges.push([a,b]);}}
for(let g=0;g<groups.length;g++){
  const group=groups[g],base=nodes.length;
  for(let i=0;i<48;i++){
    const z=rand()*2-1,a=rand()*Math.PI*2,r=i===0?0:Math.cbrt(rand())*.95,s=Math.sqrt(1-z*z);
    const p=group.center.map((c,k)=>c+[s*Math.cos(a),z,s*Math.sin(a)][k]*group.radius[k]*r);
    nodes.push({p,g,title:i===0?group.hub:group.topics[(i-1)%6]+' '+(Math.floor((i-1)/6)+1),size:i===0?4.5:1.5+rand()*.9});
  }
  for(let i=1;i<48;i++){
    const n=base+i;
    const near=Array.from({length:i},(_,j)=>base+j).sort((a,b)=>distance(nodes[n].p,nodes[a].p)-distance(nodes[n].p,nodes[b].p));
    edge(n,near[0]);if(i>3&&rand()>.27)edge(n,near[1]);if(i%5===0)edge(n,base);
  }
}
[[0,48],[48,96],[0,192],[48,144],[96,144],[192,144],[20,69],[82,117],[15,205],[126,161],[175,224]].forEach(([a,b])=>edge(a,b));
function distance(a,b){return Math.hypot(...a.map((v,i)=>v-b[i]));}
const adjacent=nodes.map(()=>new Set());for(const[a,b]of edges){adjacent[a].add(b);adjacent[b].add(a);}
const vertex=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aColor;in float aSize;
uniform mat4 uMatrix;uniform vec3 uEye;uniform float uDpr;uniform float uHeight;uniform bool uPoints;
out vec3 vColor;out float vFog;
void main(){vec4 p=uMatrix*vec4(aPosition,1.);gl_Position=p;vColor=aColor;vFog=clamp(1.-distance(aPosition,uEye)/850.,.35,1.);gl_PointSize=uPoints?clamp(aSize*uHeight*1.7/p.w,2.2*uDpr,12.*uDpr):1.;}`;
const fragment=`#version 300 es
precision highp float;in vec3 vColor;in float vFog;uniform bool uPoints;out vec4 outColor;
void main(){if(!uPoints){outColor=vec4(vColor,vFog*.48);return;}vec2 p=(gl_PointCoord-.5)*2.;float r=dot(p,p);if(r>1.)discard;float z=sqrt(1.-r);float light=.38+.62*max(0.,dot(normalize(vec3(p.x,-p.y,z)),normalize(vec3(-.4,.6,1.))));float alpha=smoothstep(1.,.72,r);outColor=vec4(vColor*(light+.2)*vFog,alpha);}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const uniforms=Object.fromEntries(['uMatrix','uEye','uDpr','uHeight','uPoints'].map(n=>[n,gl.getUniformLocation(program,n)]));
function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);return b;}
const pointData=new Float32Array(nodes.length*7),lineData=new Float32Array(edges.length*14);
const pointBuffer=buffer(pointData),lineBuffer=buffer(lineData);
function bind(b){gl.bindBuffer(gl.ARRAY_BUFFER,b);for(const[name,n,offset]of[['aPosition',3,0],['aColor',3,12],['aSize',1,24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,28,offset);}}
let selected=-1,hover=-1;
function upload(){
  const active=selected>=0?selected:hover;
  function color(i){const n=nodes[i],c=groups[n.g].color;return active<0?c:active===i?[1,.88,.64]:adjacent[active].has(i)?c.map(v=>Math.min(1,v*1.2)):c.map(v=>v*.35);}
  nodes.forEach((n,i)=>pointData.set([...n.p,...color(i),n.size*(active===i?1.45:1)],i*7));
  edges.forEach(([a,b],e)=>{const hi=a===active||b===active,sameGroup=nodes[a].g===nodes[b].g;const factor=active<0?(sameGroup?.42:.16):hi?.95:.065;[a,b].forEach((i,j)=>lineData.set([...nodes[i].p,...groups[nodes[i].g].color.map(v=>v*factor),1],e*14+j*7));});
  gl.bindBuffer(gl.ARRAY_BUFFER,pointBuffer);gl.bufferData(gl.ARRAY_BUFFER,pointData,gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,lineData,gl.DYNAMIC_DRAW);
}
upload();
// Column-major perspective and camera matrices; all nodes retain their actual XYZ coordinates.
const normalize=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function multiply(a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function matrix(eye,target,aspect){
  const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
  const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  const f=1/Math.tan(Math.PI*48/360),near=.5,far=1500;
  return multiply(new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view);
}
const presets={overview:{theta:.31,phi:.17,dist:305,target:[0,0,0]},side:{theta:1.65,phi:.15,dist:295,target:[0,0,0]},inside:{theta:-.42,phi:.13,dist:128,target:[0,4,-24]}};
let camera={...presets.overview,target:[0,0,0]},goal={...camera,target:[...camera.target]},matrixNow,eyeNow,drag=null,tour=false,tourStart=0,lastTime=0,lastInput=0,fpsFrames=0,fpsStart=performance.now(),fps=0;
const labelEls=groups.map(g=>{const e=document.createElement('div');e.className='cluster-label';e.innerHTML=`${g.name}<em>48개의 샘플 노트</em>`;$('#labels').append(e);return e;});
function project(p){const m=matrixNow,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:(1+(m[0]*x+m[4]*y+m[8]*z+m[12])/w)*innerWidth/2,y:(1-(m[1]*x+m[5]*y+m[9]*z+m[13])/w)*innerHeight/2,w};}
function render(now){
  const dt=Math.min(.05,(now-lastTime)/1000||0);lastTime=now;
  if(tour){const t=(now-tourStart)/1000;const period=18;const a=(t%period)/period;goal={theta:.31+Math.sin(a*Math.PI*2)*.8,phi:.17+Math.sin(a*Math.PI*2)*.12,dist:305-185*Math.sin(a*Math.PI)**2,target:[0,4*Math.sin(a*Math.PI),-24*Math.sin(a*Math.PI)]};}
  else if($('#rotate').checked&&!drag&&now-lastInput>1800)goal.theta+=dt*.075;
  const k=1-Math.exp(-dt*7);for(const prop of['theta','phi','dist'])camera[prop]+=(goal[prop]-camera[prop])*k;camera.target=camera.target.map((v,i)=>v+(goal.target[i]-v)*k);
  const dpr=Math.min(2,devicePixelRatio),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=camera;eyeNow=c.target.map((v,i)=>v+[Math.sin(c.theta)*Math.cos(c.phi),Math.sin(c.phi),Math.cos(c.theta)*Math.cos(c.phi)][i]*c.dist);
  matrixNow=matrix(eyeNow,c.target,w/h);gl.viewport(0,0,w,h);gl.clearColor(.026,.039,.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.uMatrix,false,matrixNow);gl.uniform3fv(uniforms.uEye,eyeNow);gl.uniform1f(uniforms.uDpr,dpr);gl.uniform1f(uniforms.uHeight,h*.5);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.uniform1i(uniforms.uPoints,0);bind(lineBuffer);gl.drawArrays(gl.LINES,0,edges.length*2);
  gl.depthMask(true);gl.uniform1i(uniforms.uPoints,1);bind(pointBuffer);gl.drawArrays(gl.POINTS,0,nodes.length);
  groups.forEach((g,i)=>{const p=project(g.center.map((v,k)=>v+(k===1?g.radius[1]+8:0)));const e=labelEls[i];e.style.left=p.x+'px';e.style.top=p.y+'px';e.style.opacity=p.w>30&&p.x>70&&p.x<innerWidth-70&&p.y>190&&p.y<innerHeight-170&&selected<0?'.7':'0';});
  fpsFrames++;if(now-fpsStart>1000){fps=fpsFrames*1000/(now-fpsStart);fpsFrames=0;fpsStart=now;}
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
function stopTour(){tour=false;$('#tour').textContent='공간 이동 재생';}
function touch(){lastInput=performance.now();stopTour();}
function pick(x,y){let best=-1,dist=11,depth=Infinity;nodes.forEach((n,i)=>{const p=project(n.p),d=Math.hypot(p.x-x,p.y-y);if(p.w>.5&&d<dist&&(d<dist-2||p.w<depth)){dist=d;depth=p.w;best=i;}});return best;}
canvas.addEventListener('pointerdown',e=>{touch();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};});
canvas.addEventListener('pointermove',e=>{if(!matrixNow)return;if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;goal.theta-=dx*.005;goal.phi=Math.max(-1.2,Math.min(1.2,goal.phi+dy*.004));drag.moved||=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;drag.x=e.clientX;drag.y=e.clientY;lastInput=performance.now();}else{const n=pick(e.clientX,e.clientY);if(n!==hover){hover=n;upload();canvas.style.cursor=n>=0?'pointer':'grab';}}});
canvas.addEventListener('pointerup',e=>{const click=drag&&!drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click){const n=pick(e.clientX,e.clientY);if(n>=0)focus(n);}});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('pointerleave',()=>{if(!drag&&hover!==-1){hover=-1;upload();}});
canvas.addEventListener('wheel',e=>{e.preventDefault();touch();goal.dist=Math.min(620,Math.max(36,goal.dist*Math.exp(e.deltaY*.0015)));},{passive:false});
function focus(n){touch();selected=n;hover=-1;upload();goal.target=[...nodes[n].p];goal.dist=85;$('#detail').hidden=false;$('#category').textContent=groups[nodes[n].g].name+' / 샘플 노트';$('#note-title').textContent=nodes[n].title;$('#note-detail').textContent=`직접 연결된 노트 ${adjacent[n].size}개를 밝게 표시했습니다. 드래그하면 이 노트 주변의 깊이를 살펴볼 수 있습니다.`;$('#hint').textContent='선택한 노트가 중심입니다. Esc를 누르면 전체로 돌아갑니다.';}
function setView(key){touch();selected=-1;hover=-1;upload();$('#detail').hidden=true;goal={...presets[key],target:[...presets[key].target]};document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));const url=new URL(location.href);url.searchParams.set('view',key);history.replaceState(null,'',url);$('#hint').textContent=key==='inside'?'노드 무리 사이로 진입했습니다. 천천히 드래그해 주변을 보세요.':'가까운 노드와 먼 노드가 다르게 움직이는지 확인해 보세요.';}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#reset').onclick=()=>setView('overview');$('#unfocus').onclick=()=>setView('overview');
$('#tour').onclick=()=>{if(tour){stopTour();return;}selected=-1;hover=-1;upload();$('#detail').hidden=true;$('#rotate').checked=false;tour=true;tourStart=performance.now();$('#tour').textContent='이동 멈추기';};
$('#rotate').onchange=()=>{stopTour();lastInput=performance.now();};
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,[contenteditable=true]'))return;if(e.key==='Escape')setView('overview');if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const keys=Object.keys(presets),index=keys.indexOf(new URL(location.href).searchParams.get('view')||'overview');setView(keys[(index+(e.key==='ArrowRight'?1:2))%3]);}});
const initial=new URL(location.href).searchParams.get('view');if(presets[initial]){setView(initial);camera={...goal,target:[...goal.target]};}
// Read-only inspection surface for the prototype's rendering and input smoke checks.
window.constellation={get state(){return {nodes:nodes.length,edges:edges.length,selected,hover,tour,camera:JSON.parse(JSON.stringify(camera)),goal:JSON.parse(JSON.stringify(goal)),fps,glError:gl.getError(),webgl:gl.getParameter(gl.VERSION)};},projectNode:i=>project(nodes[i].p),node:i=>({position:[...nodes[i].p],title:nodes[i].title}),groups:groups.map(g=>({name:g.name,center:[...g.center]}))};
