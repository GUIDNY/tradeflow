/* Snow Rush: all sound is synthesised (no files): wind that follows speed, carve hiss, the scrape of a skid, coin chimes,
   landing thump, grinds and spins, the chairlift (cable hum, the clack of each tower's sheaves), the village (a crowd's
   murmur that cheers at the finish, the church bell), and a small synthwave loop. Starts on the first touch (browsers
   require it). */
(function(ST){
  let ctx=null,master,wind,windF,windG,carveG,musicG,muted=false,noiseBuf,musicOn=false,step=0,next=0,timer=null;
  const A={};
  function noise(){ const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  A.init=function(){ if(ctx) { if(ctx.state==='suspended') ctx.resume(); return; }
    try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    master=ctx.createGain(); master.gain.value=muted?0:.9; master.connect(ctx.destination);
    noiseBuf=noise();
    wind=ctx.createBufferSource(); wind.buffer=noiseBuf; wind.loop=true; windF=ctx.createBiquadFilter(); windF.type='bandpass'; windF.frequency.value=500; windF.Q.value=.6; windG=ctx.createGain(); windG.gain.value=0; wind.connect(windF); windF.connect(windG); windG.connect(master); wind.start();
    const c=ctx.createBufferSource(); c.buffer=noiseBuf; c.loop=true; const cf=ctx.createBiquadFilter(); cf.type='highpass'; cf.frequency.value=2600; carveG=ctx.createGain(); carveG.gain.value=0; c.connect(cf); cf.connect(carveG); carveG.connect(master); c.start();
    musicG=ctx.createGain(); musicG.gain.value=.0; musicG.connect(master);
    // a jib under the board: noise through a narrow band (a steel rail rings, a plastic box hisses lower and duller)
    const gs=ctx.createBufferSource(); gs.buffer=noiseBuf; gs.loop=true; grindF=ctx.createBiquadFilter(); grindF.type='bandpass'; grindF.frequency.value=3200; grindF.Q.value=6;
    grindG=ctx.createGain(); grindG.gain.value=0; gs.connect(grindF); grindF.connect(grindG); grindG.connect(master); gs.start();
    // a skid: gritty mid-band noise, its grain shaken by a fast random flutter
    { const sk=ctx.createBufferSource(); sk.buffer=noiseBuf; sk.loop=true; skidF=ctx.createBiquadFilter(); skidF.type='bandpass'; skidF.frequency.value=1500; skidF.Q.value=.9; skidG=ctx.createGain(); skidG.gain.value=0; sk.connect(skidF); skidF.connect(skidG); skidG.connect(master); sk.start(); }
    // the village: babble is noise through four formant-like bands, each swelling on its own slow rhythm
    crowdG=ctx.createGain(); crowdG.gain.value=0; crowdG.connect(master);
    [[420,1.4,.27],[780,2.2,.41],[1250,3,.23],[2300,4,.33]].forEach(([f,q,r],i)=>{ const src=ctx.createBufferSource(); src.buffer=noiseBuf; src.loop=true; src.loopStart=i*.37; const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f; bp.Q.value=q;
      const g=ctx.createGain(); g.gain.value=.5; const lfo=ctx.createOscillator(), lg=ctx.createGain(); lfo.frequency.value=r; lg.gain.value=.35; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src.connect(bp); bp.connect(g); g.connect(crowdG); src.start(0,i*.37); crowdBands.push(bp); });
    // the lift: a low two-note drone for the cable and the wheels in the stations
    humG=ctx.createGain(); humG.gain.value=0; const hl=ctx.createBiquadFilter(); hl.type='lowpass'; hl.frequency.value=260; hl.connect(humG); humG.connect(master);
    [55,58.5,110].forEach((f,i)=>{ const o=ctx.createOscillator(); o.type=i<2?'sawtooth':'sine'; o.frequency.value=f; const g=ctx.createGain(); g.gain.value=i<2?.5:.25; o.connect(g); g.connect(hl); o.start(); });
  };
  let skidF=null, skidG=null, crowdG=null, humG=null; const crowdBands=[];
  /* the village crowd (0..1); cheer() swells it and brightens it for a few seconds */
  let cheerT=0;
  A.crowd=function(level){ if(!ctx||!crowdG) return; const t=ctx.currentTime, k=Math.max(0,Math.min(1,level))*(1+(cheerT>t?1.8:0)); crowdG.gain.setTargetAtTime(k*.14,t,.4);
    crowdBands.forEach((b,i)=>b.frequency.setTargetAtTime([420,780,1250,2300][i]*(cheerT>t?1.35:1),t,.3)); };
  A.cheer=function(){ if(!ctx) return; cheerT=ctx.currentTime+3.2; const t=ctx.currentTime; [0,.35,.9].forEach((d,i)=>tone(880+i*110,t+d,.5,'triangle',.02)); };
  /* the chairlift: hum (0..1) and the clack-clack of a chair's grip running over a tower's sheave train */
  A.liftHum=function(level){ if(!ctx||!humG) return; humG.gain.setTargetAtTime(Math.max(0,Math.min(1,level))*.06,ctx.currentTime,.3); };
  A.liftClack=function(v){ if(!ctx) return; const t=ctx.currentTime, k=v==null?1:v; [0,.075,.15,.23].forEach((d,i)=>{ noiseHit(t+d,.05,.07*k*(i%2?.7:1),2200); tone(130-i*6,t+d,.07,'sine',.05*k); }); };
  /* the church bell: inharmonic partials, the hum note longest */
  A.bell=function(n){ if(!ctx) return; const t=ctx.currentTime, f=196; for(let s=0;s<(n||3);s++){ const t0=t+s*2.6; [[.5,4.2,.06],[1,3.4,.09],[1.19,2.6,.05],[1.5,2.2,.04],[2,1.8,.04],[2.52,1.2,.03],[3.01,.9,.02]].forEach(([m,dur,v])=>tone(f*m,t0,dur,'sine',v)); } };
  let grindF=null, grindG=null, spinF=null, spinG=null;
  /* a spin: air rushing past, swelling twice a turn (each time the body faces into the wind) and rising with the rate */
  A.spin=function(rate,phase){ if(!ctx) return; if(!spinG){ const s2=ctx.createBufferSource(); s2.buffer=noiseBuf; s2.loop=true; spinF=ctx.createBiquadFilter(); spinF.type='bandpass'; spinF.Q.value=1.1; spinG=ctx.createGain(); spinG.gain.value=0; s2.connect(spinF); spinF.connect(spinG); spinG.connect(master); s2.start(); }
    const t=ctx.currentTime, k=Math.min(1,Math.abs(rate)/8.4); spinG.gain.setTargetAtTime(k*(.04+.14*Math.pow(Math.abs(Math.sin(phase)),2)),t,.02); spinF.frequency.setTargetAtTime(500+k*1300,t,.05); };
  A.grind=function(level,kind){ if(!ctx||!grindG) return; const t=ctx.currentTime, rail=kind==='rail';
    grindG.gain.setTargetAtTime(level*(rail?.32:.22),t,.03); if(level>0){ grindF.frequency.setTargetAtTime(rail?2600+level*1400:700+level*500,t,.05); grindF.Q.setTargetAtTime(rail?7:1.4,t,.05); } };
  /* for checks: the master output's RMS and peak right now */
  A.probe=function(){ if(!ctx) return null; const an=ctx.createAnalyser(); an.fftSize=4096; master.connect(an); const b=new Float32Array(an.fftSize);
    return ()=>{ an.getFloatTimeDomainData(b); let s=0, pk=0; for(let i=0;i<b.length;i++){ s+=b[i]*b[i]; pk=Math.max(pk,Math.abs(b[i])); } return {rms:+Math.sqrt(s/b.length).toFixed(4),peak:+pk.toFixed(3),state:ctx.state}; }; };
  A.setMuted=function(m){ muted=m; if(master) master.gain.setTargetAtTime(m?0:.9,ctx.currentTime,.05); };
  A.isMuted=()=>muted;
  A.update=function(speed,carve,air,skid){ if(!ctx) return; const t=ctx.currentTime, k=Math.min(speed/36,1);
    windG.gain.setTargetAtTime(.02+k*k*.5*(air?1.25:1),t,.12); windF.frequency.setTargetAtTime(280+k*1900+(air?500:0),t,.15);
    carveG.gain.setTargetAtTime(air?0:Math.min(1,carve)*k*.16,t,.08);
    if(skidG){ const sk=air?0:Math.min(1,skid||0)*Math.min(1,speed/10); skidG.gain.setTargetAtTime(sk*.2*(.75+Math.random()*.5),t,.03); skidF.frequency.setTargetAtTime(1100+sk*900+Math.random()*300,t,.05); } };
  function env(g,t,a,d,v){ g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+a); g.gain.exponentialRampToValueAtTime(.0008,t+a+d); }
  function tone(f,t,dur,type,vol,dest,slide){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(slide,t+dur); env(g,t,.005,dur,vol); o.connect(g); g.connect(dest||master); o.start(t); o.stop(t+dur+.05); }
  A.coin=function(pitch){ if(!ctx) return; const t=ctx.currentTime, f=880*Math.pow(1.0595,pitch||0); tone(f,t,.18,'square',.07); tone(f*1.5,t+.07,.3,'square',.07); };
  A.green=function(){ if(!ctx) return; const t=ctx.currentTime; [523,659,784,1047].forEach((f,i)=>tone(f,t+i*.06,.35,'triangle',.12)); };
  A.red=function(){ if(!ctx) return; const t=ctx.currentTime; tone(220,t,.4,'sawtooth',.14,null,70); noiseHit(t,.25,.2,500); };
  function noiseHit(t,dur,vol,freq){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq; const g=ctx.createGain(); env(g,t,.005,dur,vol); s.connect(f); f.connect(g); g.connect(master); s.start(t,Math.random()); s.stop(t+dur+.05); }
  A.land=function(p){ if(!ctx) return; const t=ctx.currentTime; noiseHit(t,.25,.3*Math.min(1,p),700); tone(90,t,.2,'sine',.4*Math.min(1,p),null,45); };
  A.jump=function(){ if(!ctx) return; const t=ctx.currentTime; noiseHit(t,.3,.12,1800); };
  A.trick=function(n){ if(!ctx) return; const t=ctx.currentTime; for(let i=0;i<3;i++) tone(660*Math.pow(1.122,i*2+n),t+i*.05,.25,'triangle',.1); };
  A.wipe=function(){ if(!ctx) return; const t=ctx.currentTime; noiseHit(t,.8,.55,900); tone(130,t,.7,'sawtooth',.2,null,40); };
  A.win=function(){ if(!ctx) return; const t=ctx.currentTime; [523,659,784,1047,1319].forEach((f,i)=>tone(f,t+i*.11,.6,'square',.09)); };
  /* synthwave loop: Am F C G */
  const CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]], mtof=n=>440*Math.pow(2,(n-69)/12);
  function sched(){ if(!ctx||!musicOn) return; while(next<ctx.currentTime+.25){ const bar=Math.floor(step/16)%4, s=step%16, ch=CH[bar], t=next;
      if(s%4===0){ const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(40,t+.14); env(g,t,.003,.2,.5); o.connect(g); g.connect(musicG); o.start(t); o.stop(t+.25); }
      if(s%2===0){ const sr=ctx.createBufferSource(); sr.buffer=noiseBuf; const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7000; const g=ctx.createGain(); env(g,t,.002,s%4===2?.09:.03,.12); sr.connect(f); f.connect(g); g.connect(musicG); sr.start(t,Math.random()); sr.stop(t+.12); }
      { const f=mtof(ch[0]-24+(s%8===6?12:0)); tone(f,t,.2,'sawtooth',.16,musicG); }
      { const n=ch[(s*3)%3 ]+12*(1+(s>>2)%2); tone(mtof(n),t,.12,'square',.05,musicG); }
      if(s===0){ ch.forEach(n=>tone(mtof(n),t,1.9,'sawtooth',.035,musicG)); }
      next+=60/118/4; step++; } }
  A.music=function(on){ if(!ctx) return; if(on&&!musicOn){ musicOn=true; next=ctx.currentTime+.05; step=0; timer=setInterval(sched,60); musicG.gain.setTargetAtTime(.5,ctx.currentTime,.4); }
    else if(!on&&musicOn){ musicOn=false; clearInterval(timer); musicG.gain.setTargetAtTime(0,ctx.currentTime,.2); } };
  ST.Audio=A;
})(window.ST);
