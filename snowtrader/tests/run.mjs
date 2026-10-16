/* Snow Rush automated checks (Playwright + Chromium).
   Run:   cd snowtrader/tests && npm install && node run.mjs            (all)
          node run.mjs feet,jump                                         (some)
   Env:   CHROME=/path/to/chrome   (optional; otherwise Playwright's own Chromium)
          HEADFUL=1                (watch it)
   It serves the game folder itself, drives the real game loop through ST.debug and checks physics, IK and flow.
   Software rendering (SwiftShader) is slow and is NOT a substitute for testing on a real phone: frame-rate numbers here
   mean nothing; the checks are about behaviour, which does not depend on the frame rate (the physics runs at a fixed step). */
import http from 'http';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {chromium} from 'playwright-core';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(ROOT,u==='/'?'index.html':u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); s.end(); return; }
  s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s); });
await new Promise(r=>server.listen(0,r)); const PORT=server.address().port;

const exe=process.env.CHROME||(fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?'/opt/pw-browsers/chromium-1194/chrome-linux/chrome':undefined);
const browser=await chromium.launch({executablePath:exe,headless:!process.env.HEADFUL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']});
const errors=[];
async function open(q,init){ const p=await browser.newPage({viewport:{width:640,height:400}}); p.on('pageerror',e=>errors.push(e.message)); if(init) await p.addInitScript(init);
  await p.goto(`http://localhost:${PORT}/index.html?q=0&fx=0&nolift=1&${q||''}`); await p.waitForFunction('window.READY',null,{timeout:120000});
  await p.waitForFunction('ST.Rider.current!=="hero"',null,{timeout:240000}).catch(()=>{});
  // shared helpers in the page
  await p.evaluate(()=>{ window.T={
    start(track){ const D=ST.debug; D.setTrack(track||'lab'); D.startRun(); for(let k=0;k<170;k++) D.tick(1/60); return D.mode; },
    hold(n,inp,dt,each){ const D=ST.debug, I=D.input; for(let k=0;k<n;k++){ I.joy.x=inp.x||0; I.joy.y=inp.y||0; I.jump=!!inp.j; I.grab=!!inp.g; D.tick(dt||1/60); if(each) each(k); } I.joy.x=I.joy.y=0; I.jump=I.grab=false; },
    speed(v){ const P=ST.debug.P; P.vx=Math.sin(P.hd)*v; P.vz=-Math.cos(P.hd)*v; },
    S(k){ const s=ST.Rider.S[k]; return s?s.x:NaN; },
    ankleErr(){ const R=ST.Rider, b=R.boardObj; if(!b||!R.bones.FootL) return NaN; const out=[]; [['FootL',-.28],['FootR',.28]].forEach(([n,z])=>{ const want=b.localToWorld(new THREE.Vector3(0,.205,z)); out.push(R.bones[n].getWorldPosition(new THREE.Vector3()).distanceTo(want)); }); return Math.max(...out); }
  }; });
  return p; }

const results=[]; const only=process.argv[2]?process.argv[2].split(','):null;
async function test(name,fn){ if(only&&!only.includes(name)) return; const t0=Date.now(); let ok=false, detail='';
  try{ const r=await fn(); ok=r.ok; detail=r.detail; }catch(e){ detail='EXCEPTION '+e.message.slice(0,300); }
  results.push({name,ok,detail,s:((Date.now()-t0)/1000).toFixed(1)}); console.log((ok?'PASS ':'FAIL ')+name.padEnd(12)+' '+detail); }

const page=await open('');

await test('load',async()=>{ const r=await page.evaluate(()=>({mode:ST.debug.mode,rider:ST.Rider.current,bones:Object.keys(ST.Rider.bones).length,ik:!!ST.Rider.len}));
  return {ok:r.mode==='menu'&&r.bones>=18&&r.ik&&errors.length===0,detail:JSON.stringify(r)+(errors.length?' errors: '+errors.slice(0,2).join(' | '):'')}; });

await test('movement',async()=>{ const r=await page.evaluate(()=>{ T.start('lab'); const P=ST.debug.P, s0=P.s; T.hold(360,{}); return {moved:+(P.s-s0).toFixed(1),kmh:+(P.speed*3.6).toFixed(1),mode:ST.debug.mode}; });
  return {ok:r.moved>20&&r.kmh>15,detail:JSON.stringify(r)}; });

await test('joints',async()=>{ const r=await page.evaluate(()=>{ T.start('lab'); T.speed(11); T.hold(90,{});
    const keys=['kF','kB','fold','hpY','chY','heY','px','lamRel','hF0','hB2'], snap=()=>keys.map(k=>T.S(k));
    const a=snap(); const P=ST.debug.P; T.hold(50,{x:1}); const right=snap(), eR=P.edge; T.hold(70,{x:-1}); const left=snap(), eL=P.edge;
    const moved=keys.map((k,i)=>Math.abs(right[i]-left[i])), distinct=new Set(moved.map(v=>v.toFixed(2))).size;
    return {edgeRight:+(eR*57.3).toFixed(0),edgeLeft:+(eL*57.3).toFixed(0),changed:keys.filter((k,i)=>moved[i]>(k==='px'||k[0]==='h'&&k.length===3?.01:1.5)),distinct}; });
  return {ok:r.edgeRight>15&&r.edgeLeft<-15&&r.changed.length>=7&&r.distinct>=7,detail:JSON.stringify(r)}; });

await test('feet',async()=>{ const r=await page.evaluate(()=>{ T.start('lab'); T.speed(10); let worst=0, worstIK=0, n=0;
    let skating=0;   // skating frames: the rear foot is meant to be out of its binding
    const each=()=>{ const P=ST.debug.P, e=T.ankleErr(), ik=ST.Rider.ik; if(P.skateK>.02){ skating++; return; } if(isFinite(e)){ worst=Math.max(worst,e); n++; } if(ik&&ik.err) worstIK=Math.max(worstIK,ik.err.L||0,ik.err.R||0); };
    T.hold(60,{},0,each); T.hold(50,{x:1},0,each); T.hold(50,{x:-1},0,each); T.hold(30,{y:1},0,each); T.hold(40,{},0,each); T.hold(25,{j:1},0,each); T.hold(80,{x:.7,g:1},0,each); T.hold(120,{},0,each);
    return {frames:n,skatingFramesSkipped:skating,worstMm:+(worst*1000).toFixed(2),worstIkMm:+(worstIK*1000).toFixed(2)}; });
  return {ok:r.frames>300&&r.worstMm<10&&r.worstIkMm<2,detail:JSON.stringify(r)}; });

await test('ground',async()=>{ const r=await page.evaluate(()=>{ T.start('bunny'); const P=ST.debug.P, W=ST.World; let pen=0, flo=0, n=0;
    const each=()=>{ if(!P.grounded||P.fall) return; const g=P.gc, fx=Math.sin(P.hd), fz=-Math.cos(P.hd), y=P.y+(P.vOff||0);   // where the board is drawn
      // the board's base line from tail to nose must not sink into the snow, and must touch it somewhere
      let minGap=1e9; for(let i=-4;i<=4;i++){ const t=i/4*.7, gy=W.groundY(P.x+fx*t,P.z+fz*t), by=y+g.gf*t; minGap=Math.min(minGap,by-gy); }
      pen=Math.max(pen,-minGap); flo=Math.max(flo,minGap); n++; };
    T.hold(900,{},1/60,(k)=>{ ST.debug.input.joy.x=Math.sin(k/50)*.8; each(); });
    return {frames:n,maxPenetrationCm:+(pen*100).toFixed(1),maxFloatCm:+(flo*100).toFixed(1)}; });
  return {ok:r.frames>300&&r.maxPenetrationCm<4&&r.maxFloatCm<6,detail:JSON.stringify(r)}; });

await test('jump',async()=>{ const r=await page.evaluate(()=>{ T.start('lab'); const D=ST.debug, P=D.P, W=ST.World, I=D.input; const r0=W.rampAt(0); let air=0, landed=null, kMax=0, kBefore=0;
    const orig=ST.Physics.step; ST.Physics.step=function(p,c,dt,ev){ orig(p,c,dt,ev); ev.forEach(e=>{ if(e.type==='land'&&e.air>.4&&!landed) landed=e; }); };
    for(let k=0;k<2400&&!landed;k++){ const tx=W.cx(r0.s+r0.L)+r0.u, err=ST.Physics.wrap(Math.atan2(tx-P.x,14)-P.hd); I.joy.x=P.grounded?Math.max(-1,Math.min(1,err*2.5)):0;
      const lip=W.lipNear(P.s,P.x,4,0); I.jump=!!(lip&&lip.d<lip.r.L-1)&&P.grounded; if(P.grounded&&P.s<r0.s) kBefore=T.S('kF'); D.tick(1/60); if(!P.grounded) air=Math.max(air,P.airT); }
    for(let k=0;k<20;k++){ D.tick(1/60); kMax=Math.max(kMax,T.S('kF')); }
    ST.Physics.step=orig; I.jump=false; I.joy.x=0;
    return {air:+air.toFixed(2),landed:landed?landed.out:null,impact:landed?+landed.imp.toFixed(1):null,kneeBefore:+kBefore.toFixed(0),kneeAfterLanding:+kMax.toFixed(0)}; });
  return {ok:r.air>.8&&r.landed&&r.landed!=='fall'&&r.kneeAfterLanding>r.kneeBefore+8,detail:JSON.stringify(r)}; });

await test('fall',async()=>{ const r=await page.evaluate(()=>{ T.start('lab'); T.speed(10); T.hold(30,{}); const P=ST.debug.P; ST.Physics.startFall(P,'test',[]); const seen=new Set(); let k=0;
    for(;k<600&&(P.fall||k<5);k++){ ST.debug.tick(1/60); if(P.fall) seen.add(P.fall.ph); }
    return {phases:[...seen],secondsToRecover:+(k/60).toFixed(1),riding:!P.fall,speed:+(P.speed*3.6).toFixed(1)}; });
  return {ok:['lose','down','slide','getup','recover'].every(p=>r.phases.includes(p))&&r.riding,detail:JSON.stringify(r)}; });

await test('lift',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug, R=ST.Resort; D.setTrack('bunny'); D.startLift(); const m1=D.mode, startD=+(D.P.s-ST.World.T.len).toFixed(1); for(let k=0;k<60;k++) D.tick(1/60); const seated=ST.Rider.ik&&ST.Rider.ik.on===false;
    // the rider's hips on the chair's seat (2.29 m under the rope, between its arms), whichever character is riding
    const ch=R.playerChair; ch.updateMatrixWorld(true); const h=ST.Rider.bones.Hips.getWorldPosition(new THREE.Vector3()), seat=new THREE.Vector3(0,-2.2,0).applyMatrix4(ch.matrixWorld), offSeat=+h.distanceTo(seat).toFixed(2);
    D.endLift(); const m2=D.mode; for(let k=0;k<200;k++) D.tick(1/60); return {lift:m1,startsInVillage:startD,seated,hipsFromSeatM:offSeat,after:m2,then:D.mode}; });
  return {ok:r.lift==='lift'&&r.seated&&r.startsInVillage>30&&r.hipsFromSeatM<.35&&r.after==='countdown'&&r.then==='play',detail:JSON.stringify(r)}; });

await test('town',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug, W=ST.World, V=ST.Village, R=ST.Resort, PP=ST.People; D.setTrack('bunny'); const L=W.T.len;
    // the valley floor: downhill all the way from the finish line to the church, gentle in the village, flat across
    let up=-9, grade=0, prev=null; for(let d=0;d<=190;d++){ const s=L+d, y=W.groundY(W.cx(s),-s); if(prev!==null){ up=Math.max(up,y-prev); if(d>45) grade=Math.max(grade,prev-y); } prev=y; }
    const across=d=>{ const s=L+d; let a=1e9,b=-1e9; for(let u=-40;u<=40;u+=2){ const y=W.groundY(W.cx(s)+u,-s); a=Math.min(a,y); b=Math.max(b,y); } return +(b-a).toFixed(2); };
    let kick=0; W.forRamps(L,L+300,()=>kick++);
    let meshes=0, tris=0; V.group.traverse(o=>{ if(o.isMesh){ meshes++; tris+=o.geometry.index.count/3; } });
    // the lift comes down to loading height: the bullwheel ~3.1 m up, a chair's seat ~1 m over the snow at the load line
    const tw=R.towers(), bw=tw[tw.length-1], cl=R.cablePoint(R.sLoad,-1), seat=cl.y-2.35-W.groundY(cl.x,cl.z);
    const s0=V.Q.served; for(let i=0;i<600;i++) D.tick(1/30);   // 20 s of village life
    return {upPerM:+up.toFixed(3),grade:+grade.toFixed(3),across70:across(70),across140:across(140),kickersPastFinish:kick,meshes,ktris:Math.round(tris/1000),wheelH:+(bw.y-bw.gy).toFixed(2),seatAboveSnow:+seat.toFixed(2),
      people:PP.regs.filter(r=>r.ci==='village').length,full:PP.active.length,standIns:PP.standIns(),sitting:PP.regs.filter(r=>r.anim==='Sit').length,walking:PP.regs.filter(r=>r.anim==='Walk').length,boarded20s:V.Q.served-s0,menuOnSquare:D.P.s>L+60,atlasH:V.atlasH}; });
  const checks={downhill:r.upPerM<0,gentle:r.grade<.06,flat:r.across70<.5&&r.across140<.5,noKickers:r.kickersPastFinish===0,merged:r.meshes>=8&&r.ktris<700,wheel:Math.abs(r.wheelH-3.1)<.05,seat:r.seatAboveSnow>.6&&r.seatAboveSnow<1.3,
    people:r.people>=50,lod:r.full<=14&&r.standIns[0]>0,sitting:r.sitting>=6,walking:r.walking>=5,queue:r.boarded20s>=6,menu:r.menuOnSquare,atlas:r.atlasH<=2048}, bad=Object.keys(checks).filter(k=>!checks[k]);
  return {ok:!bad.length,detail:JSON.stringify(r)+(bad.length?' FAILED: '+bad.join(','):'')}; });

await test('tracks',async()=>{ const all=[]; for(const id of ['bunny','bull','bear','ridge','ipo']){ const r=await page.evaluate((id)=>{ const D=ST.debug, W=ST.World, I=D.input, P=D.P; T.start(id); const Tr=D.track(); let t=0;
      while(D.mode==='play'&&t<300){ const s=P.s, u=P.x-W.cx(s); let target=W.cx(s+14), best=1e9;
        // aim for the nearest kicker ahead (in the park: the one in the lane the rider is in), and do what the speed hint on screen
        // says: brake when the speed left at the lip would carry the rider past the landing (the same estimate as main.js jumpHint)
        let ramp=null; W.forRamps(s,s+60,r=>{ if(r.s>s-2&&r.s<s+60&&Math.abs(r.u-u)<best){ best=Math.abs(r.u-u); target=W.cx(r.s+r.L)+r.u; ramp=r; } });
        let brake=false; if(ramp&&P.grounded){ const d=ramp.s+ramp.L-s, w=W.jumpWindow(ramp); if(d>8&&d<75&&w.hi){ const vl=Math.sqrt(Math.max(0,P.speed*P.speed+2*9.81*(Tr.slope*d-(ramp.Hm+ramp.h))*.85)); brake=vl>w.hi+.5; } }
        I.joy.y=brake?1:0;
        const err=ST.Physics.wrap(Math.atan2(target-P.x,14)-P.hd); I.joy.x=P.grounded?Math.max(-1,Math.min(1,err*2.5)):0; const lip=W.lipNear(s,P.x,4,0); I.jump=!!(lip&&lip.d<lip.r.L-1)&&P.grounded;
        D.tick(1/30); t+=1/30; }
      I.joy.x=I.joy.y=0; I.jump=false; return {id,finished:D.mode==='finish'||D.mode==='end',time:+t.toFixed(0),par:Tr.par,wipes:P.wipes,why:(P.wipeLog||[]).join(' ')}; },id); all.push(r); }
  return {ok:all.every(r=>r.finished&&r.wipes<=3),detail:JSON.stringify(all)}; });

await test('lowfps',async()=>{ const r=await page.evaluate(()=>{ const run=(dt)=>{ T.start('lab'); const P=ST.debug.P; let nan=false, under=0; const n=Math.round(14/dt);
      for(let k=0;k<n;k++){ const t=k*dt; ST.debug.input.joy.x=Math.sin(t*1.3)*.9; ST.debug.tick(dt); if(!isFinite(P.x+P.y+P.z)) nan=true; if(P.grounded) under=Math.max(under,ST.World.groundY(P.x,P.z)-P.y-(P.gc.gap||0)); }
      ST.debug.input.joy.x=0; return {x:P.x,z:P.z,nan,under}; };
    const a=run(1/144), b=run(1/30), c=run(1/12);
    return {d30:+Math.hypot(a.x-b.x,a.z-b.z).toFixed(2),d12:+Math.hypot(a.x-c.x,a.z-c.z).toFixed(2),nan:a.nan||b.nan||c.nan,underCm:+(Math.max(a.under,b.under,c.under)*100).toFixed(1)}; });
  return {ok:!r.nan&&r.d30<1.5&&r.d12<3&&r.underCm<3,detail:JSON.stringify(r)+' (same inputs at 144, 30 and 12 fps)'}; });

/* the touch buttons (the default on phones), driven with pointer events like a finger: hold ▶ to carve, a thumb on the middle of
   the strip brakes, JUMP loads and pops; in the air the buttons become SPIN / GRAB / FLIP, a short SPIN is finished by the spin
   assist to a half turn, and the rider lands it clean */
await test('touch',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug, W=ST.World, P=D.P, ctl=D.ctl; T.start('lab');
    const ptr=(el,type,fx,id)=>{ const b=el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(type,{pointerId:id||7,bubbles:true,cancelable:true,clientX:b.left+b.width*(fx==null?.5:fx),clientY:b.top+b.height*.5,pointerType:'touch'})); };
    const st=document.getElementById('steer'), bJ=document.getElementById('btnJump'), bG=document.getElementById('btnGrab'), bF=document.getElementById('btnFlip');
    const out={}; T.speed(9);
    ptr(st,'pointerdown',.95); for(let k=0;k<50;k++) D.tick(1/60); out.steerHeld=+ctl.steer.toFixed(2); out.edgeDeg=Math.round(P.edge*57.3);
    ptr(st,'pointermove',.5); for(let k=0;k<40;k++) D.tick(1/60); out.brakeMiddle=ctl.brake; out.brakeK=+P.brakeK.toFixed(2); ptr(st,'pointerup',.5); for(let k=0;k<60;k++) D.tick(1/60);
    // to the lab kicker, then load and pop at its lip, and spin in the air with the SPIN button
    const r0=W.rampAt(0), evs=[]; const orig=ST.Physics.step; ST.Physics.step=function(p,c,dt,ev){ orig(p,c,dt,ev); ev.forEach(e=>evs.push(e)); };
    P.x=W.cx(r0.s-40)+r0.u; P.z=-(r0.s-40); P.hd=Math.atan2(W.dcx(r0.s-40),1); ST.Physics.contact(P.x,P.z,P.hd,P.gc); P.y=P.gc.yC; P.vy=0; P.vyT=null; P.fresh=true; T.speed(13);
    let jumped=false, air=false, spun=false, airClass=false, grabbed=false, flipped=false, k=0;
    for(;k<900;k++){ const lip=W.lipNear(P.s,P.x,4,0);
      if(!jumped&&lip&&lip.d<lip.r.L-2.5&&P.grounded){ ptr(bJ,'pointerdown'); jumped=1; }
      if(jumped===1&&lip&&lip.d>lip.r.L-1&&P.grounded){ ptr(bJ,'pointerup'); jumped=2; }
      D.tick(1/60);
      if(!P.grounded&&P.airT>.15&&!air){ air=true; airClass=document.getElementById('hud').classList.contains('air'); ptr(bJ,'pointerdown',.5,8); }
      if(air&&!spun&&P.airT>.42){ spun=true; out.spinOn=ctl.spin; ptr(bJ,'pointerup',.5,8); ptr(bG,'pointerdown',.5,9); }
      if(spun&&!grabbed&&P.airT>.6){ grabbed=P.grabbed; ptr(bG,'pointerup',.5,9); ptr(bF,'pointerdown',.5,10); }
      if(grabbed&&!flipped&&P.airT>.66){ flipped=P.wfl>0; ptr(bF,'pointerup',.5,10); }
      if(air&&P.grounded) break; }
    ST.Physics.step=orig;
    const take=evs.find(e=>e.type==='takeoff'), land=evs.filter(e=>e.type==='land').pop();
    return Object.assign(out,{popped:!!(take&&take.pop),airButtons:airClass,grabbed,flip:flipped,landing:land?{out:land.out,half:land.half,deg:Math.round(land.spin*57.3),air:+land.air.toFixed(2),yawErr:+land.yawErr.toFixed(2),grabs:land.grabs}:null}); });
  // the brief flip press only starts a flip; what matters here is that every button did its job and the spin landed square
  const L=r.landing; return {ok:r.steerHeld>.9&&r.edgeDeg>12&&r.brakeMiddle&&r.brakeK>.5&&r.popped&&r.airButtons&&r.spinOn&&r.grabbed&&r.flip&&L&&Math.abs(L.half)>=1&&L.yawErr<.2,detail:JSON.stringify(r)}; });

/* the park: ride onto the box and the rail in the test lab (no input once lined up, apart from keeping the line) */
async function rideJib(name,u,v){ return page.evaluate(([name,u,v])=>{ const D=ST.debug, W=ST.World, P=D.P, I=D.input; T.start('lab');
    const r=ST.Park.rails.find(q=>q.name===name), s0=r.sA-14; P.x=W.cx(s0)+u; P.z=-s0; P.hd=Math.atan2(W.dcx(s0),1); ST.Physics.contact(P.x,P.z,P.hd,P.gc); P.y=P.gc.h; T.speed(v);
    const evs=[]; const orig=ST.Physics.step; ST.Physics.step=function(p,c,dt,ev){ orig(p,c,dt,ev); ev.forEach(e=>evs.push(Object.assign({t:+p.t.toFixed(2)},e))); };
    let snapCm=0, onTopCm=0, n=0, k=0, fallAfter=false;
    for(;k<420;k++){ const s=P.s, err=(W.cx(s)+u)-P.x; I.joy.x=P.grind?0:Math.max(-1,Math.min(1,err*1.5)); D.tick(1/60);
      if(P.grind){ const at=ST.Park.at(r,P.grind.t).p; if(P.grind.time>.12) onTopCm=Math.max(onTopCm,Math.abs(P.y-at.y)*100); n++; }
      if(P.fall) fallAfter=true; }
    ST.Physics.step=orig; I.joy.x=0;
    const st=evs.find(e=>e.type==='grindStart'), en=evs.find(e=>e.type==='grindEnd');
    return {start:st?st.style+' '+st.name:null,secondsOnJib:en?+en.time.toFixed(2):null,fellOff:en?en.fell:null,fallAfter,framesOnJib:n,baseOffTopAfter120msCm:+onTopCm.toFixed(1)}; },[name,u,v]); }
await test('grind',async()=>{ const box=await rideJib('RIDE-ON BOX',-8,7), rail=await rideJib('RAIL',8,7.5);
  const ok=j=>j.start&&j.secondsOnJib>.5&&j.fellOff===false&&!j.fallAfter&&j.baseOffTopAfter120msCm<2;
  return {ok:ok(box)&&ok(rail),detail:JSON.stringify({box,rail})}; });

/* a butter: grab + stick forward presses the nose, steering spins the board on it; let go after half a turn */
await test('butter',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug, P=D.P, R=ST.Rider; T.start('lab'); T.speed(8); T.hold(30,{});
    const evs=[]; const orig=ST.Physics.step; ST.Physics.step=function(p,c,dt,ev){ orig(p,c,dt,ev); ev.forEach(e=>evs.push(e)); };
    let footDrop=0; T.hold(20,{y:-1,g:1},0,()=>{ const a=R.bones.FootL.getWorldPosition(new THREE.Vector3()).y, b=R.bones.FootR.getWorldPosition(new THREE.Vector3()).y; footDrop=Math.max(footDrop,b-a); });
    T.hold(59,{y:-1,g:1,x:1}); T.hold(60,{}); ST.Physics.step=orig;
    const b=evs.find(e=>e.type==='butter'); return {butter:b?{half:b.half,deg:Math.round(b.spin*57.3),clean:b.clean,s:+b.time.toFixed(2)}:null,frontFootLowerCm:+(footDrop*100).toFixed(1),fell:!!P.fall,sw:P.sw}; });
  return {ok:!!r.butter&&Math.abs(r.butter.half)===1&&r.butter.clean&&r.frontFootLowerCm>5&&!r.fell,detail:JSON.stringify(r)}; });

/* the halfpipe: ride across the flat into a wall with no input; the rider must go up it, leave the lip going up, come back down
   into the pipe onto the wall and ride away, and the walls must never add energy (speed along the snow plus height) */
await test('pipe',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug, W=ST.World, P=D.P; T.start('lab'); const pp=ST.Park.pipes[0], s0=pp.s0+30;
    P.x=W.cx(s0)+pp.uc-3; P.z=-s0; const along=Math.atan2(W.dcx(s0),1), a=along+.85; P.hd=a; ST.Physics.contact(P.x,P.z,P.hd,P.gc); P.y=P.gc.h; P.vx=Math.sin(a)*15; P.vz=-Math.cos(a)*15; P.vy=0; P.fresh=true;
    const floor=W.groundY(W.cx(s0)+pp.uc,-s0), sw0=P.sw; let top=-9, Emax=-1e9, E0=null, landed=null, airT=0, gain=0;
    const evs=[]; const orig=ST.Physics.step; ST.Physics.step=function(p,c,dt,ev){ orig(p,c,dt,ev); ev.forEach(e=>{ if(e.type==='land'&&!landed&&e.air>.3) landed=e; });
      const v3=p.grounded?Math.hypot(p.vx,p.vz,p.vyT==null?p.vy:p.vyT):Math.hypot(p.vx,p.vy,p.vz), E=.5*v3*v3+9.81*p.y; if(E0===null) E0=E; gain=Math.max(gain,E-E0); E0=Math.min(E0,E); };
    for(let k=0;k<300&&!landed;k++){ D.tick(1/60); const fl=W.groundY(W.cx(P.s)+pp.uc,P.z); top=Math.max(top,P.y-fl); if(!P.grounded) airT=Math.max(airT,P.airT); }
    for(let k=0;k<40;k++) D.tick(1/60);
    ST.Physics.step=orig;
    return {heightAboveFloorM:+top.toFixed(2),wallH:pp.H,air:+airT.toFixed(2),landing:landed?landed.out:null,impact:landed?+landed.imp.toFixed(1):null,ridingAfter:P.grounded&&P.speed>3,fell:!!P.fall,maxEnergyGainJkg:+gain.toFixed(2)}; });
  return {ok:r.heightAboveFloorM>r.wallH+.3&&r.landing==='clean'&&!r.fell&&r.ridingAfter&&r.maxEnergyGainJkg<1.5,detail:JSON.stringify(r)}; });

/* the town (the home screen): the rider walks about the village on its own model (Mixamo's clips retargeted, the board put away),
   runs, stays on the snow and out of the buildings, takes the lift from the queue, and walks on from where a run ended; the
   rider can be changed in the town. And the real buttons of the pause menu and the results screen work (they once did not). */
await test('walk',async()=>{ const r=await page.evaluate(async()=>{ const D=ST.debug, R=ST.Rider, V=ST.Village, W=ST.World, I=D.input, t=D.town; D.setTrack('bunny'); D.toMenu();
    for(let i=0;i<40&&!R.walking;i++) await new Promise(f=>setTimeout(f,100));
    const out={walking:R.walking,boardHidden:!R.boardObj.visible}; const feet=()=>{ const g=W.groundY(t.x,t.z); return Math.min(R.bones.FootL.getWorldPosition(new THREE.Vector3()).y,R.bones.FootR.getWorldPosition(new THREE.Vector3()).y)-g-.09; };
    const x0=t.x, z0=t.z; let worst=0, inside=0; I.k.u=true; for(let i=0;i<90;i++){ D.townTick(1/30); if(i>20) worst=Math.max(worst,Math.abs(feet())); if(V.inside(t.x,t.z,-.05)) inside++; } I.k.u=false;
    out.walked=+Math.hypot(t.x-x0,t.z-z0).toFixed(2); out.walkAnim=R.model.userData.walk.cur; out.walkTs=+R.model.userData.walk.acts.Walk.timeScale.toFixed(2);
    I.k.u=true; I.grab=true; for(let i=0;i<60;i++){ D.townTick(1/30); if(V.inside(t.x,t.z,-.05)) inside++; } I.k.u=false; I.grab=false; out.runV=+t.vEff.toFixed(2); out.runAnim=R.model.userData.walk.cur;
    for(let i=0;i<40;i++) D.townTick(1/30); out.stopAnim=R.model.userData.walk.cur; out.feetCm=+(worst*100).toFixed(1);
    // a wall: walk at the café for 4 s, never into it
    const b=V.blds.find(x=>x.d===101), s=V.L+b.d+b.hd+2.5; D.townPlace({x:W.cx(s)+b.u,z:-s,hd:0}); t.camYaw=Math.PI; for(let i=0;i<5;i++) D.townTick(1/30);
    I.k.u=true; let into=0, minGap=9; for(let i=0;i<120;i++){ D.townTick(1/30); const d=-t.z-V.L; minGap=Math.min(minGap,d-(b.d+b.hd)); if(V.inside(t.x,t.z,-.05)) into++; } I.k.u=false; out.cafeGapM=+minGap.toFixed(2); out.insideFrames=inside+into;
    // the lift: offered at the queue
    const q=V.queuePath[V.queuePath.length-1], sq=V.L+q.d+1.5; D.townPlace({x:W.cx(sq)+q.u,z:-sq,hd:0}); for(let i=0;i<5;i++) D.townTick(1/30); out.liftOffered=!document.getElementById('tLift').hidden;
    return out; });
  // the rider sheet: another rider, which walks too; then a run from the town, the results, and back to the town
  const s2=await page.evaluate(async()=>{ const D=ST.debug, R=ST.Rider; D.openSheet('char'); const btns=[...document.querySelectorAll('#riderRow button')], cur=btns.findIndex(b=>b.classList.contains('sel')), pick=btns[cur===1?2:1];
    pick.click(); for(let i=0;i<120&&!(R.walking&&R.model.userData.walk&&R.root.visible&&R.current===R.choices[+pick.dataset.i]);i++) await new Promise(f=>setTimeout(f,100));
    const out={orig:R.choices[cur],swapped:R.current,walkingAfterSwap:R.walking&&!!R.model.userData.walk,visible:R.root.visible}; D.closeSheets(); for(let i=0;i<30;i++) D.townTick(1/30);
    btns[cur].click(); for(let i=0;i<120&&!(R.current===R.choices[cur]&&R.walking&&R.root.visible);i++) await new Promise(f=>setTimeout(f,100)); out.backTo=R.current; return out; });
  const mode=()=>page.evaluate(()=>ST.debug.mode);
  await page.evaluate(()=>{ window._sawCtl=localStorage.getItem('snowtrader.v1'); }); await page.click('#playBtn',{force:true}); if(await page.evaluate(()=>!document.getElementById('controls').hidden)) await page.click('#ctlOk');
  const b={afterPlay:await mode(),boardBack:await page.evaluate(()=>ST.Rider.boardObj.visible&&!ST.Rider.walking)};
  await page.evaluate(()=>{ for(let i=0;i<120;i++) ST.debug.tick(1/30); }); await page.click('#pause',{force:true}); b.pause=await mode(); await page.click('#resumeBtn'); b.resume=await mode();
  await page.evaluate(()=>{ const D=ST.debug, P=D.P, T=D.track(), W=ST.World; P.s=T.len-20; P.z=-P.s; P.x=W.cx(P.s); P.y=W.groundY(P.x,P.z)+.05; for(let i=0;i<1400&&D.mode!=='end';i++) D.tick(1/30); });
  await page.waitForTimeout(2600); b.results=await mode(); await page.click('#menuBtn');
  for(let i=0;i<40&&!(await page.evaluate(()=>ST.Rider.walking));i++) await page.waitForTimeout(100);
  const back=await page.evaluate(()=>{ const D=ST.debug, t=D.town; return {mode:D.mode,walking:ST.Rider.walking,pastFinishM:+(-t.z-D.track().len).toFixed(1),liftBtnHidden:document.getElementById('tLift').hidden}; });
  const all={...r,...s2,...b,back}, checks={walking:r.walking&&r.boardHidden,walks:r.walked>2.5&&r.walkAnim==='Walk',runs:r.runV>3.2&&r.runAnim==='Run',stops:r.stopAnim==='Idle',feetOnSnow:r.feetCm<4,
    wall:r.insideFrames===0&&r.cafeGapM>.2,lift:r.liftOffered,riderSwap:s2.walkingAfterSwap&&s2.visible&&s2.swapped!==s2.orig&&s2.backTo===s2.orig,play:b.afterPlay==='countdown'&&b.boardBack,pauseButtons:b.pause==='pause'&&b.resume==='play',
    results:b.results==='end',backToTown:back.mode==='menu'&&back.walking&&back.pastFinishM>5&&back.liftBtnHidden}, bad=Object.keys(checks).filter(k=>!checks[k]);
  return {ok:!bad.length,detail:JSON.stringify(all)+(bad.length?' FAILED: '+bad.join(','):'')}; });

/* the asset replacement layer (js/assets.js): the Mixamo crowd retargets as before (no rest fix), the Meshy model works as a
   village guest (arms fixed to Mixamo's rest, walks like a Mixamo guest, stands on its own spot), and every slot takes a listed
   model: stand-ins from tests/fixtures (a helmet, goggles and mitts on the rider, the Meshy body as a garment on itself, a
   tree, the café and the lodges as a house, the benches) land where the generator would have built */
await test('assets',async()=>{ const g=await page.evaluate(async()=>{ const PP=ST.People, out={crowd:PP.names.length,crowdFix:0};
    for(const n of PP.names){ const T=await PP.template(n); out.crowdFix+=T.armFix.length; }
    const M=await PP.template('meshy_rider'), C=await PP.template('Ch02'); out.meshyFix=M.armFix.length;
    const cyc=T=>{ const m=THREE.SkeletonUtils.clone(T.scene); m.scale.multiplyScalar(T.k); m.position.set(T.x0,T.y,T.z0); const g=new THREE.Group(); g.add(m); const B={}; m.traverse(o=>{ if(o.isBone) B[o.name]=o; });
      const P=k=>B[T.map[k]].getWorldPosition(new THREE.Vector3()), mx=new THREE.AnimationMixer(m); mx.clipAction(T.clips.Walk).play(); let fz0=9, fz1=-9, low=9, wx=0, hx=0;
      for(let i=0;i<16;i++){ mx.setTime(T.clips.Walk.duration*i/16); g.updateMatrixWorld(true); const h=P('Hips'), f=P('FootL'); fz0=Math.min(fz0,f.z-h.z); fz1=Math.max(fz1,f.z-h.z); low=Math.min(low,f.y,P('FootR').y); wx+=Math.abs(P('WristL').x-h.x)/16; hx=Math.max(hx,Math.hypot(h.x,h.z)); }
      return {swing:fz1-fz0,low,wx,hx}; };
    const a=cyc(M), b=cyc(C); out.meshy={swing:+a.swing.toFixed(2),footLow:+a.low.toFixed(2),wristOut:+a.wx.toFixed(2),hipsOff:+a.hx.toFixed(2)}; out.ch02={swing:+b.swing.toFixed(2),wristOut:+b.wx.toFixed(2)}; return out; });
  const p2=await open('',()=>{ const F='tests/fixtures/'; window.ST_ASSETS_EXTRA={characters:{meshy_rider:{parts:['assets/chars/meshy_rider.glb']}},
    gear:{helmet:{url:F+'helmet.glb',tint:true},goggles:{url:F+'goggles.glb'},mitts:{url:F+'mitt.glb'}},
    world:{trees:{spruce:{near:F+'tree.glb',far:F+'tree_far.glb'}},buildings:{cafe:{url:F+'house.glb',fit:'footprint'},lodge:{url:F+'house.glb',fit:'footprint'}},props:{bench:{url:F+'bench.glb'}}}}; });
  const s=await p2.evaluate(async()=>{ const R=ST.Rider, W=ST.World, V=ST.Village, out={};
    const parts=[]; R.model.traverse(o=>{ if(o.userData.part) parts.push(o); }); let base=null; R.model.traverse(o=>{ if(o.isSkinnedMesh&&!o.userData.part&&!base) base=o; });
    let worst=-1; if(parts.length&&base){ worst=0; R.model.updateMatrixWorld(true); const a=new THREE.Vector3(), c=new THREE.Vector3(); for(let i=0;i<base.geometry.attributes.position.count;i+=997){ base.boneTransform(i,a); parts[0].boneTransform(i,c); worst=Math.max(worst,a.applyMatrix4(base.matrixWorld).distanceTo(c.applyMatrix4(parts[0].matrixWorld))); } }
    out.part={n:parts.length,worstMm:+(worst*1000).toFixed(1)};
    await R.swap('hero'); let gm=0; R.gear.traverse(o=>{ if(o.userData.gearModel) gm++; }); out.gear={models:gm,mittsOnWrists:(R.glovePieces||[]).slice(-2).filter(o=>o.parent&&/^Wrist/.test(o.parent.name)).length};
    const TR=W.TREE.spruce; let near=0; ST.scene.traverse(o=>{ if(o.isInstancedMesh&&o.geometry===TR.near) near+=o.count; }); out.trees={model:!!TR.model,near,firBuilt:!W.TREE.fir.model};
    const cafe=V.blds.find(b=>b.d===101), cs=V.L+101, cw={x:W.cx(cs)+cafe.u,z:-cs}; let cafeD=null, benches=0; const m=new THREE.Matrix4(), v=new THREE.Vector3();
    V.group.traverse(o=>{ if(!o.isInstancedMesh||!o.userData.model) return; if(o.count===1&&cafeD===null){ o.getMatrixAt(0,m); v.setFromMatrixPosition(m); cafeD=Math.hypot(v.x-cw.x,v.z-cw.z); } if(o.count===4) benches=4; });
    out.village={cafeOffM:cafeD==null?null:+cafeD.toFixed(2),benches,glowMats:V.modelMats.length};
    const st=ST.Resort.sites(ST.debug.track()).find(t=>t.k!=='station'); W.update(st.s,true); let lodge=0; ST.scene.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh&&o.userData.model&&o.userData.dyn) lodge++; }); out.lodgeMeshes=lodge;
    return out; });
  await p2.close();
  const r={...g,...s}, checks={crowdAsBefore:r.crowd===9&&r.crowdFix===0,meshyArms:r.meshyFix===6,meshyWalks:r.meshy.swing>.4&&Math.abs(r.meshy.swing-r.ch02.swing)<.2&&Math.abs(r.meshy.wristOut-r.ch02.wristOut)<.06,
    meshyGrounded:r.meshy.footLow>.05&&r.meshy.footLow<.2,meshyInPlace:r.meshy.hipsOff<.3,part:r.part.n===1&&r.part.worstMm<1,gear:r.gear.models>=2&&r.gear.mittsOnWrists===2,trees:r.trees.model&&r.trees.near>0&&r.trees.firBuilt,
    cafe:r.village.cafeOffM!==null&&r.village.cafeOffM<.5,benches:r.village.benches===4,glow:r.village.glowMats>=1,lodges:r.lodgeMeshes>=3,noErrors:errors.length===0}, bad=Object.keys(checks).filter(k=>!checks[k]);
  return {ok:!bad.length,detail:JSON.stringify(r)+(bad.length?' FAILED: '+bad.join(','):'')}; });

await browser.close(); server.close();
const failed=results.filter(r=>!r.ok);
console.log(`\n${results.length-failed.length}/${results.length} passed`+(failed.length?' — failed: '+failed.map(r=>r.name).join(', '):''));
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'last-run.json'),JSON.stringify({when:new Date().toISOString(),results},null,1));
process.exit(failed.length?1:0);
