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
async function open(q){ const p=await browser.newPage({viewport:{width:640,height:400}}); p.on('pageerror',e=>errors.push(e.message));
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

await test('lift',async()=>{ const r=await page.evaluate(()=>{ const D=ST.debug; D.setTrack('bunny'); D.startLift(); const m1=D.mode; for(let k=0;k<60;k++) D.tick(1/60); const seated=ST.Rider.ik&&ST.Rider.ik.on===false;
    D.endLift(); const m2=D.mode; for(let k=0;k<200;k++) D.tick(1/60); return {lift:m1,seated,after:m2,then:D.mode}; });
  return {ok:r.lift==='lift'&&r.seated&&r.after==='countdown'&&r.then==='play',detail:JSON.stringify(r)}; });

await test('town',async()=>{ const r=await page.evaluate(()=>{ ST.debug.setTrack('bunny'); ST.World.update(0,true); let lodges=0, people=ST.People.regs.length; ST.scene.traverse(o=>{ if(o.isMesh&&o.material&&o.material.map&&o.geometry&&o.geometry.type==='PlaneGeometry') lodges++; }); return {signs:lodges,peopleRegistered:people}; });
  return {ok:r.signs>0&&r.peopleRegistered>0,detail:JSON.stringify(r)+' (resort around the start; the full town is Phase 3)'}; });

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

await browser.close(); server.close();
const failed=results.filter(r=>!r.ok);
console.log(`\n${results.length-failed.length}/${results.length} passed`+(failed.length?' — failed: '+failed.map(r=>r.name).join(', '):''));
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'last-run.json'),JSON.stringify({when:new Date().toISOString(),results},null,1));
process.exit(failed.length?1:0);
