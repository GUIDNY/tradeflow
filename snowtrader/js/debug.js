/* Snow Rush: developer mode, on with ?debug=1.
   A panel with the engine numbers (FPS, frame time, draw calls, triangles, memory), the physics (speed, contact, edge and body
   angles, slip, state), the IK (how far each foot is from its binding, how stretched each limb is) and the main joint angles.
   Keys: K skeleton, I IK targets, H hide the HUD, C camera, R restart. Buttons run short test manoeuvres. */
(function(ST){
  if(!/[?&]debug=1/.test(location.search)) return;
  const R=ST.Rider, renderer=ST.renderer, info=renderer.info, DEG=180/Math.PI;
  const box=document.createElement('div'); box.id='dbg';
  box.style.cssText='position:fixed;left:8px;top:96px;z-index:60;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#d8f3ff;background:rgba(6,10,20,.78);padding:8px 10px;border-radius:8px;white-space:pre;pointer-events:none;direction:ltr;text-align:left;max-width:46vw;max-height:70vh;overflow:hidden';
  document.body.appendChild(box);
  const bar=document.createElement('div'); bar.style.cssText='position:fixed;left:8px;bottom:8px;z-index:61;display:flex;flex-wrap:wrap;gap:4px;direction:ltr;max-width:60vw';
  document.body.appendChild(bar);

  // ---- frame timing and render cost (render is wrapped so every pass of the composer is counted) ----
  info.autoReset=false; let frames=[], last=performance.now(), renderMs=0, calls=0, tris=0;
  const orig=ST.render; ST.render=function(){ info.reset(); const t0=performance.now(); orig(); renderMs=renderMs*.9+(performance.now()-t0)*.1; calls=info.render.calls; tris=info.render.triangles; };
  function tickT(now){ requestAnimationFrame(tickT); frames.push(now-last); last=now; if(frames.length>120) frames.shift(); }
  requestAnimationFrame(tickT);

  // ---- skeleton and IK markers ----
  let skel=null, skelOn=false, ikOn=false; const marks=[];
  const mk=c=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshBasicMaterial({color:c,depthTest:false,transparent:true})); m.renderOrder=999; m.visible=false; ST.scene.add(m); return m; };
  for(let i=0;i<4;i++) marks.push(mk(i<2?0xff2244:0x22ddff));
  function toggleSkel(){ skelOn=!skelOn; if(skel){ ST.scene.remove(skel); skel=null; } if(skelOn&&R.model){ skel=new THREE.SkeletonHelper(R.model); skel.material.depthTest=false; skel.material.linewidth=2; skel.renderOrder=998; ST.scene.add(skel); skel.userData.model=R.model; } }
  addEventListener('keydown',e=>{ if(e.code==='KeyK') toggleSkel(); if(e.code==='KeyI'){ ikOn=!ikOn; marks.forEach(m=>m.visible=false); } });

  // ---- test manoeuvres: drive the input for a while ----
  const I=ST.debug.input; let queue=[], qT=0;
  function run(steps){ queue=steps.map(s=>Object.assign({},s)); qT=0; }
  function pump(dt){ if(!queue.length) return; const s=queue[0]; I.joy.x=s.x||0; I.joy.y=s.y||0; I.jump=!!s.j; I.grab=!!s.g; qT+=dt; if(qT>=s.t){ qT=0; queue.shift(); if(!queue.length){ I.joy.x=I.joy.y=0; I.jump=I.grab=false; } } }
  const tests={'◀ carve':[{x:-1,t:1.1}],'carve ▶':[{x:1,t:1.1}],'S-turns':[{x:1,t:.9},{x:-1,t:.9},{x:1,t:.9},{x:-1,t:.9}],'tuck':[{y:-1,t:1.5}],'brake':[{y:1,t:1.4}],
    'ollie':[{j:1,t:.35},{t:.1}],'360 indy':[{j:1,t:.4},{t:.05},{x:1,g:1,t:.7},{x:1,t:.3}],'tail grab':[{j:1,t:.4},{t:.05},{y:.6,g:1,t:.15},{g:1,t:.6}],
    'nose press':[{y:-1,g:1,t:1.2}],'tail press':[{y:1,g:1,t:1.2}],'butter 180':[{y:-1,g:1,t:.25},{y:-1,g:1,x:1,t:.98},{t:.2}],'fall':[{t:.01,fn:()=>ST.Physics.startFall(ST.debug.P,'test',[])}],'switch':[{t:.01,fn:()=>{ ST.debug.P.sw=!ST.debug.P.sw; }}],'cam':[{t:.01,fn:()=>ST.debug.cycleCam()}],'skeleton':[{t:.01,fn:toggleSkel}],'IK pts':[{t:.01,fn:()=>{ ikOn=!ikOn; }}]};
  Object.keys(tests).forEach(n=>{ const b=document.createElement('button'); b.textContent=n; b.style.cssText='font:12px system-ui;padding:6px 8px;border-radius:7px;border:1px solid #58c;background:#0d1a33;color:#dff;opacity:.9';
    b.onclick=()=>{ const st=tests[n]; st.forEach(s=>s.fn&&s.fn()); run(st.filter(s=>!s.fn)); }; bar.appendChild(b); });

  // ---- the panel ----
  let n=0, lt=performance.now();
  const f1=v=>(v>=0?' ':'')+v.toFixed(1), d0=v=>(v>=0?' ':'')+Math.round(v*DEG), pad=(s,k)=>String(s).padEnd(k);
  function update(){
    requestAnimationFrame(update); const now=performance.now(), dt=Math.min(.1,(now-lt)/1000); lt=now; pump(dt);
    if(skelOn&&skel&&skel.userData.model!==R.model){ toggleSkel(); toggleSkel(); }
    if(ikOn&&R.ik&&R.ik.targets){ R.ik.targets.forEach((t,i)=>{ marks[i].position.copy(t); marks[i].visible=true; }); if(R.ik.handPts) R.ik.handPts.forEach((t,i)=>{ if(marks[2+i]){ marks[2+i].position.copy(t); marks[2+i].visible=true; } }); }
    if(++n%6) return;
    const P=ST.debug.P, g=P.gc||{}, fs=frames.slice().sort((a,b)=>a-b), med=fs[fs.length>>1]||16, worst=fs[fs.length-1]||16, mem=performance.memory?(performance.memory.usedJSHeapSize/1048576).toFixed(0)+' MB':'n/a';
    const S=R.S||{}, sv=k=>S[k]?S[k].x.toFixed(0):'-', ik=R.ik||{}, er=ik.err||{}, rc=ik.reach||{};
    const clear=g.yC!==undefined?(P.y+(P.vOff||0)-g.h):0;   // the drawn board's base over its supports
    box.textContent=
`FPS ${(1000/med).toFixed(0)}  frame ${med.toFixed(1)} ms (worst ${worst.toFixed(0)})  render ${renderMs.toFixed(1)} ms
draw calls ${calls}  triangles ${(tris/1000).toFixed(0)}k  geo ${info.memory.geometries} tex ${info.memory.textures}  heap ${mem}
quality ${ST.Q.lv} px ${renderer.getPixelRatio().toFixed(2)} fx ${ST.GFX.on?'on':'off'}  camera ${ST.debug.camMode}
— physics (120 Hz fixed step) —
mode ${ST.debug.mode}  state: ${R.state||'-'}
speed ${(P.speed*3.6).toFixed(1)} km/h (3D ${((P.speed3||0)*3.6).toFixed(1)})  ${P.grounded?'GROUNDED':'AIRBORNE '+(P.airT||0).toFixed(2)+'s'}  ${P.sw?'SWITCH':'regular'}
board heading ${d0(P.hd)}°  travel ${d0(P.vh||0)}°  slip ${d0(P.slip||0)}°  yaw rate ${f1(P.om||0)} r/s
edge angle ${d0(P.edge||0)}°  body lean ${d0(P.body||0)}°  angulation ${d0((P.edge||0)-(P.body||0))}°  fore/aft ${d0(P.fa||0)}°
ground pitch ${d0(g.pitch||0)}° roll ${d0(g.roll||0)}°  board-snow gap ${(clear*100).toFixed(1)} cm  dip ${((g.gap||0)*100).toFixed(1)} cm
skid ${(P.skid||0).toFixed(2)} brake ${(P.brakeK||0).toFixed(2)} charge ${(P.charge||0).toFixed(2)} tuck ${(P.tuck||0).toFixed(2)} skate ${(P.skateK||0).toFixed(2)}${P.fall?'  FALL '+P.fall.ph+' '+P.fall.t.toFixed(2):''}
${P.grind?'jib: '+P.grind.style+' on '+P.grind.r.name+'  '+P.grind.time.toFixed(2)+' s  speed '+P.grind.v.toFixed(1)+' m/s  balance '+P.grind.bal.toFixed(2)+'  press '+P.grind.press.toFixed(2):P.butter?'butter: '+(P.butter.phys>0?'nose':'tail')+'  turned '+Math.round(P.butter.spin*DEG)+'°  '+P.butter.t.toFixed(2)+' s':'jib: -'}  ${P.wallAir?'(pipe air)':''}
— IK —
${ik.on?'ON':'off'}  ${ik.state||''}
foot error L ${er.L!==undefined?(er.L*1000).toFixed(1):'-'} mm  R ${er.R!==undefined?(er.R*1000).toFixed(1):'-'} mm   leg reach L ${rc.L!==undefined?rc.L.toFixed(2):'-'} R ${rc.R!==undefined?rc.R.toFixed(2):'-'}
arm reach L ${rc.armL!==undefined?rc.armL:'-'} R ${rc.armR!==undefined?rc.armR:'-'}  hand error cm ${JSON.stringify(ik.hands||{})}
— joints (deg) —
knee front ${sv('kF')} back ${sv('kB')}  fold ${sv('fold')}  pelvis x ${S.px?(S.px.x*100).toFixed(0):'-'} cm z ${S.pz?(S.pz.x*100).toFixed(0):'-'} cm
hips pitch ${sv('hpP')} yaw ${sv('hpY')}  abdomen ${sv('abP')}/${sv('abY')}  torso ${sv('toP')}/${sv('toY')}  chest ${sv('chP')}/${sv('chY')}
neck ${sv('neP')}/${sv('neY')}  head ${sv('heP')}/${sv('heY')}  ankle F ${sv('anL')} B ${sv('anR')}  lean ${sv('lamRel')}
keys: K skeleton · I IK targets · H HUD · C camera · R restart`;
  }
  requestAnimationFrame(update);
})(window.ST);
