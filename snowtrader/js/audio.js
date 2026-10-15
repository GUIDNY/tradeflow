/* Snow Trader: all sound is synthesised (no files): wind that follows speed, carve hiss, coin chimes, landing thump,
   and a small synthwave loop. Starts on the first touch (browsers require it). */
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
  };
  A.setMuted=function(m){ muted=m; if(master) master.gain.setTargetAtTime(m?0:.9,ctx.currentTime,.05); };
  A.isMuted=()=>muted;
  A.update=function(speed,carve,air){ if(!ctx) return; const t=ctx.currentTime, k=Math.min(speed/36,1);
    windG.gain.setTargetAtTime(.02+k*k*.5*(air?1.25:1),t,.12); windF.frequency.setTargetAtTime(280+k*1900+(air?500:0),t,.15);
    carveG.gain.setTargetAtTime(air?0:Math.min(1,carve)*k*.16,t,.08); };
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
