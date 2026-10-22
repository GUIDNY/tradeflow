/* Surf Rush: the beach's game flow. The home screen is the beach town, walked in (the shared walker, js/walk.js); from the kite
   school the rider goes out on the water for a three-minute kitesurf session (js/kite.js), from the surf school at the west end
   for three minutes of wave surfing (js/surf.js), and comes back to the sand. */
(function(ST){
  const {clamp,damp,lerp,$,fmt}=ST; const {scene,camera,Rider,Audio}=ST; const Cst=ST.Coast, BT=ST.BeachTown, K=ST.Kite, KS=ST.Kite.S, SF=ST.Surf, SS=ST.Surf.S, PI=Math.PI;
  /* ---------- save ---------- */
  const KEY='surfrush.v1';
  let save={rider:-1,muted:false,ctl:'buttons',runs:0,best:0,sbest:0,wallet:0,kite:0,ctlSeen:0,sctlSeen:0,walked:0};
  try{ Object.assign(save,JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
  const persist=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(save)); }catch(e){} };
  if(window.RushWallet) RushWallet.bind(save);   // one wallet for both worlds (js/wallet.js): save.wallet reads and writes it
  const SUMMER={jackets:[0xffffff,0xff6b6b,0x4cc9f0,0xffd166,0x80ed99,0xf4acb7,0x1d3557,0xf77f00,0x9d4edd],pants:[0xd4b483,0xf1f1f1,0x3d5a80,0x1d3557,0x6b705c,0xe9c46a],
    hats:[0x2b1b10,0x111111,0xc9a26b,0x6b3a1f,0x3a2a1a,0xe0c080,0x1a1a1a,0x5a3820,0x8a5a30],noHat:true,hands:0xd9a07a,feet:0x6b4a2f};
  let mode='load', tAcc=0, last=performance.now(), gullT=4;
  const input={k:{},grab:false,jump:false};
  const el={hud:$('#hud'),menu:$('#menu'),score:$('#moneyN'),scoreD:$('#moneyD'),spd:$('#spdN'),prog:$('#progBar'),progTxt:$('#progTxt'),combo:$('#combo'),comboX:$('#comboX'),comboBar:$('#comboBar'),
    toast:$('#toast'),big:$('#big'),sub:$('#subtitle'),tip:$('#tip'),flash:$('#flash'),end:$('#end'),pause:$('#pausemenu'),wind:$('#windArrow'),windTxt:$('#windTxt'),jumpH:$('#jumpH')};
  function toast(main,small,bad){ el.toast.className=bad?'bad':''; el.toast.innerHTML=main+(small?'<small>'+small+'</small>':''); void el.toast.offsetWidth; el.toast.classList.add('show'); }
  function bigText(t,cls){ el.big.textContent=t; el.big.className=cls||''; void el.big.offsetWidth; el.big.classList.add('show'); }
  let subT=0; function subtitle(t,ms){ el.sub.textContent=t; el.sub.style.opacity=1; subT=ms||2600; }
  let flashK=0; function flash(c,k){ el.flash.style.background=c; flashK=k; }

  /* ---------- the town: walking ---------- */
  const town=ST.makeWalker({walk:1.25,run:3.6});
  town.setPlace({ground:(x,z)=>Math.max(Cst.groundY(x,z),-.3),out:(p,r)=>BT.out(p,r),inside:(x,z,pad)=>BT.inside(x,z,pad),bounds:p=>BT.bounds(p)});
  town.bindTouch($('#tzone'),$('#tjoy'),$('#tjoy i'),()=>{ Audio.init(); if(town.sheet){ closeSheets(); return true; } return false; });
  function townPlace(at){ town.put(at); town.near=false; $('#tLift').hidden=true; }
  function townUpdate(dt){ town.step(dt,{u:input.k.u,d:input.k.d,l:input.k.l,r:input.k.r,run:input.grab}); if(ST.Crowd) ST.Crowd.setPlayer(town.x,town.z,Math.sin(town.hd)*town.vEff,Math.cos(town.hd)*town.vEff,true);   // the people see the player and give way
    // at the water by the kite school or the surf school, the way out is offered
    const L=BT.spots.launch, U=BT.spots.surf, near=L&&Math.hypot(town.x-L.x,town.z-L.z)<9?'kite':U&&Math.hypot(town.x-U.x,town.z-U.z)<10?'surf':false;
    if(near!==town.near){ town.near=near; const b=$('#tLift'); b.hidden=!near; if(near) b.textContent=near==='surf'?'🏄 יוצאים לגלים':'🪁 יוצאים למים'; }
    if(town.moved>6&&!save.walked){ save.walked=1; persist(); $('#tHint').hidden=true; }
    Rider.walkFrame(dt,{x:town.x,y:town.y,z:town.z,hd:town.hd,speed:town.vEff,wave:town.wave>0&&town.v<.2}); }
  function townNote(t){ let n=document.getElementById('mnote'); if(!n){ n=document.createElement('div'); n.id='mnote'; document.body.appendChild(n); } n.textContent=t; n.className='show'; clearTimeout(townNote.h); townNote.h=setTimeout(()=>n.className='',4200); }
  function openSheet(id){ closeSheets(); town.sheet=id; $('#sheet-'+id).hidden=false; document.body.classList.add('sheet-open'); if(id==='char') town.wave=0; }
  function closeSheets(){ town.sheet=null; document.querySelectorAll('.sheet').forEach(x=>x.hidden=true); document.body.classList.remove('sheet-open'); }
  $('#tChar').onclick=()=>town.sheet==='char'?closeSheets():openSheet('char');
  $('#tSet').onclick=()=>town.sheet==='set'?closeSheets():openSheet('set');
  /* flights: a ticket to the ski village (js/wallet.js, flight.html) */
  function renderFly(){ const W=window.RushWallet; if(!W) return; $('#tkPrice').textContent=fmt(W.TICKET); $('#tkBal').textContent=fmt(W.coins); const ok=W.coins>=W.TICKET;
    $('#flyBtn').disabled=!ok; $('#flyBtn').textContent=ok?'לקנות כרטיס ולטוס ✈️':'אין מספיק מטבעות';
    $('#tkNote').textContent=ok?'הכרטיס יורד מהארנק, והטיסה יוצאת מיד':'חסרים לכם '+fmt(W.TICKET-W.coins)+' 🪙 · סשן אחד בגלים או בקייט מספיק בדרך כלל'; }
  $('#tFly').onclick=()=>{ if(town.sheet==='fly') closeSheets(); else { openSheet('fly'); renderFly(); } };
  $('#flyBtn').onclick=()=>{ const W=window.RushWallet; if(W&&W.fly('beach','snow')){ Audio.coin&&Audio.coin(4); } else renderFly(); };
  document.querySelectorAll('.sheet .sx').forEach(b=>b.onclick=closeSheets);
  $('#tWorld').onclick=()=>{ location.href='./'; };   // the opening menu: the snow or the beach
  const setMute=m=>{ save.muted=m; Audio.setMuted(m); $('#tMute').textContent=$('#mute').textContent=m?'🔇':'🔊'; persist(); };
  $('#tMute').onclick=()=>setMute(!save.muted); $('#mute').onclick=()=>setMute(!save.muted);
  // the surf camera: from the channel (the default) or behind the surfer
  const camNames={channel:'מהערוץ',follow:'מאחור'};
  const setCam=m=>{ SF.camMode(m); save.scam=m; persist(); $('#camBtn').title='מצלמה: '+camNames[m]; };
  const camCycle=()=>{ const L=SF.camModes, m=L[(L.indexOf(SF.camMode())+1)%L.length]; setCam(m); subtitle('מצלמה: '+camNames[m],1200); };
  $('#camBtn').onclick=camCycle; if(save.scam) SF.camMode(save.scam);
  /* the riders: the hero and the village guests (the Meshy rider is in ski kit: not on the beach) */
  const choices=()=>Rider.choices.filter(n=>n!=='meshy_rider');
  function renderRiders(){ const row=$('#riderRow'), list=choices(); row.innerHTML=list.map((n,i)=>'<button data-n="'+n+'" class="'+(Rider.current===n?'sel':'')+'">'+(i+1)+'</button>').join('');
    row.querySelectorAll('button').forEach(b=>b.onclick=async()=>{ const n=b.dataset.n; if(Rider.current===n) return; const st=$('#riderState'); st.textContent='טוענים…'; Rider.root.visible=false;
      try{ await Rider.swap(n); applyLook(); await Rider.walkPrep(); if(mode==='menu'){ Rider.walkSet(true); town.wave=2.4; } save.rider=Rider.choices.indexOf(n); persist(); }catch(e){ console.warn(e); st.textContent='שגיאה'; setTimeout(()=>st.textContent='',1500); }
      Rider.root.visible=true; st.textContent=''; renderRiders(); }); }
  // on the sand: a light top and trousers; in the water: a black wetsuit with coloured panels (turquoise surfing, orange kiting), barefoot
  const LOOKS={town:{jacket:0x00b4d8,pants:0x1d3557,helmet:0x111111,accent:0xffffff,top2:0x1a1c22,barefoot:false,wetsuit:false},
    surf:{jacket:0x15171c,pants:0x15171c,helmet:0x111111,accent:0x22c7d6,top2:0x22c7d6,barefoot:true,wetsuit:true},
    kite:{jacket:0x15171c,pants:0x15171c,helmet:0x111111,accent:0xff7a1a,top2:0xff7a1a,barefoot:true,wetsuit:true}};
  function applyLook(kind){ Rider.setLook(LOOKS[kind||(mode==='surf'||mode==='kite'||mode==='end'||mode==='pause'?sport:'town')]||LOOKS.town); }
  /* the kites: four canopies */
  function renderKites(){ const row=$('#kiteRow'); row.innerHTML=K.KITES.map((k,i)=>{ const c=n=>'#'+n.toString(16).padStart(6,'0');
      return '<button data-k="'+i+'" class="kite'+(i===save.kite?' sel':'')+'" style="--a:'+c(k.a)+';--b:'+c(k.b)+';--c:'+c(k.c)+'"><i></i><span>'+k.name+'</span></button>'; }).join('');
    row.querySelectorAll('button').forEach(b=>b.onclick=()=>{ save.kite=+b.dataset.k; persist(); if(K.kiteMesh) K.build(K.KITES[save.kite]); renderKites(); }); }

  /* ---------- on the water: the controls ----------
     Left thumb: ◀ ▶ steer the board (carve across the wind, up into it or down toward the kite); both together (or a thumb in the
     middle) push the bar out: less power, slower. Right thumb: JUMP (hold to load the edge, let go: the kite goes up and the rider
     pops) and POWER (the kite is worked up and down for more speed). In the air they become SPIN and GRAB, and ROLL (a back roll)
     appears. Keys: arrows / A D steer (in the air: spin), ↑ power, ↓ less power (in the air: back roll), Space jump, Shift grab. */
  const tb={side:new Map(),l:false,r:false,both:false,steer:0,spin:false,power:false,flip:false,lastDir:1};
  const stEl=$('#steer'), bL=$('#btnL'), bR=$('#btnR'), bJ=$('#btnJump'), bG=$('#btnGrab'), bF=$('#btnFlip');
  const airborne=()=>mode==='kite'&&KS.air&&KS.airT>.06||mode==='surf'&&SS.air&&SS.airT>.06;
  function stSide(e){ const r=stEl.getBoundingClientRect(), mid=r.left+r.width/2; return e.clientX<mid-20?'l':e.clientX>mid+20?'r':'b'; }
  function stSync(){ let l=false,r=false; tb.side.forEach(v=>{ if(v==='l'||v==='b') l=true; if(v==='r'||v==='b') r=true; }); tb.l=l; tb.r=r; tb.both=l&&r;
    bL.classList.toggle('on',l); bR.classList.toggle('on',r); stEl.classList.toggle('both',tb.both); }
  stEl.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); try{ stEl.setPointerCapture(e.pointerId); }catch(_){} tb.side.set(e.pointerId,stSide(e)); stSync(); });
  stEl.addEventListener('pointermove',e=>{ if(tb.side.has(e.pointerId)){ tb.side.set(e.pointerId,stSide(e)); stSync(); } });
  const stUp=e=>{ if(tb.side.delete(e.pointerId)) stSync(); }; stEl.addEventListener('pointerup',stUp); stEl.addEventListener('pointercancel',stUp);
  function hold(btn,down,up){ const ids=new Set();
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); ids.add(e.pointerId); try{ btn.setPointerCapture(e.pointerId); }catch(_){} btn.classList.add('on'); if(ids.size===1) down(); });
    const end=e=>{ if(ids.delete(e.pointerId)&&!ids.size){ btn.classList.remove('on'); up(); } }; btn.addEventListener('pointerup',end); btn.addEventListener('pointercancel',end); }
  // a press keeps the meaning it had when it began (holding JUMP off the water does not become a spin)
  let jCtx=null, gCtx=null;
  hold(bJ,()=>{ jCtx=airborne()?'spin':'jump'; if(jCtx==='spin') tb.spin=true; else input.jump=true; },()=>{ input.jump=false; tb.spin=false; jCtx=null; });
  hold(bG,()=>{ gCtx=airborne()?'grab':'power'; if(gCtx==='grab') input.grab=true; else tb.power=true; },()=>{ input.grab=false; tb.power=false; gCtx=null; });
  hold(bF,()=>{ tb.flip=true; },()=>{ tb.flip=false; });
  const FIXED=1/120, ctl={steer:0,power:false,depow:false,jump:false,spin:false,spinDir:1,grab:false,flip:false};
  function readControls(){ const air=KS.air, kx=(input.k.r?1:0)-(input.k.l?1:0);
    // the strip eases in (a hold carves harder the longer it is held) and lets go faster than it bites
    const tgt=tb.both?0:tb.r?1:tb.l?-1:0; tb.steer=damp(tb.steer,tgt,tgt?7:12,FIXED);
    ctl.steer=clamp(kx+tb.steer,-1,1); ctl.depow=!air&&(tb.both||!!input.k.d); ctl.power=!air&&!ctl.depow&&(tb.power||!!input.k.u||input.grab);
    ctl.jump=!!input.jump;
    if(!air&&Math.abs(ctl.steer)>.3) tb.lastDir=Math.sign(ctl.steer);
    ctl.spin=air&&(tb.spin||kx!==0); ctl.spinDir=kx?Math.sign(kx):tb.r&&!tb.l?1:tb.l&&!tb.r?-1:tb.lastDir;
    ctl.flip=air&&(tb.flip||!!input.k.d); ctl.grab=air&&input.grab; return ctl; }
  /* surfing: ◀ ▶ steer (paddle the board round lying down, carve standing, spin in the air); the left button paddles lying
     down and pumps standing (in the air: grab); the big one stands up when the wave has the board, ollies off the lip standing
     (in the air: spin). Keys: arrows steer, ↑ paddle / pump, Space stand up / ollie, Shift grab. */
  const sctl={steer:0,paddle:false,pop:false,pump:false,stall:false,spin:false,spinDir:1,grab:false};
  function surfControls(){ const air=SS.air, kx=(input.k.r?1:0)-(input.k.l?1:0), prone=SS.ph==='wait'||SS.ph==='paddle';
    const tgt=tb.both?0:tb.r?1:tb.l?-1:0; tb.steer=damp(tb.steer,tgt,tgt?7:12,FIXED);
    sctl.steer=clamp(kx+tb.steer,-1,1); sctl.paddle=prone&&(tb.power||!!input.k.u); sctl.pump=!prone&&!air&&(tb.power||!!input.k.u); sctl.stall=!prone&&!air&&(tb.both||!!input.k.d); sctl.pop=!!input.jump;
    if(!air&&Math.abs(sctl.steer)>.3) tb.lastDir=Math.sign(sctl.steer);
    sctl.spin=air&&(tb.spin||kx!==0); sctl.spinDir=kx?Math.sign(kx):tb.r&&!tb.l?1:tb.l&&!tb.r?-1:tb.lastDir; sctl.grab=air&&input.grab; return sctl; }

  /* ---------- the session: three minutes on the water, scored by the tricks landed ---------- */
  const sess={len:180,t:0,score:0,shown:0,combo:0,comboT:0,tricks:0,best:null,maxH:0,maxV:0,buoys:0,crashes:0,jumps:0,ups:0,showH:0,lastH:0};
  let board=null, acc=0;
  const mult=()=>Math.min(5,1+Math.floor(sess.combo*.5+.001));
  function addScore(v,label){ sess.score+=v; el.scoreD.textContent='+'+fmt(v)+' '+label; el.scoreD.style.opacity=1; clearTimeout(addScore.h); addScore.h=setTimeout(()=>el.scoreD.style.opacity=0,1100); }
  function score(name,pts,sketchy){ if(sketchy){ pts*=.5; name+=' · SKETCHY'; }
    sess.combo++; sess.comboT=7; const m=mult(), gain=Math.round(pts*m); sess.tricks++; if(!sess.best||gain>sess.best.gain) sess.best={name,gain};
    addScore(gain,'x'+m); toast(name,'+'+fmt(gain)+(m>1?'  ·  x'+m:''),sketchy); Audio.trick(Math.min(sess.combo,6)); }
  function onLand(e){ Audio.land(clamp(e.imp/9,.1,.7)); Audio.splash(clamp(e.imp/6,.3,1.2)); K.splash(KS.x,KS.y,KS.z,Math.round(10+e.imp*4),clamp(e.imp/6,.3,1.2));
    sess.lastH=e.h; sess.showH=1.6; sess.maxH=Math.max(sess.maxH,e.h);
    if(!e.clean||e.air<.55) return;
    const parts=[]; let pts=40+e.h*e.h*14+e.air*70;   // the height counts most, and it grows fast
    if(e.turns){ parts.push(e.turns*360+''); pts+=e.turns*260*(1+(e.turns-1)*.5); }
    if(e.rolls){ parts.push(e.rolls>1?e.rolls+'× BACKROLL':'BACKROLL'); pts+=e.rolls*420*(1+(e.rolls-1)*.6); }
    if(e.grabT>.25&&e.grabs.length){ parts.push(e.grabs.join(' + ')+' GRAB'); pts+=Math.min(e.grabT,2.5)*120+(e.grabs.length-1)*140; }
    let name=parts.join(' + ')||(e.h>=5?'BIG AIR':'AIR'); name+=' · '+e.h.toFixed(1)+'M';   // the trick line is Latin (left to right): metres as M
    score(name,pts,e.sketchy); if(e.h>=6) flash('#fff6c0',.35); }
  const WHY={sideways:'נחיתה בצד',rotation:'סיבוב לא גמור','too hard':'נחיתה קשה מדי','off the line':'הלוח לא בכיוון',shallow:'רדוד מדי — רכבו החוצה לים'};
  function onEvent(e){
    if(e.type==='land') onLand(e);
    else if(e.type==='jump'){ sess.jumps++; Audio.jump(); Audio.splash(.5); K.splash(KS.x,KS.y,KS.z,14,.6); }
    else if(e.type==='crash'){ sess.crashes++; sess.combo=0; sess.comboT=0; Audio.wipe(); Audio.splash(1.3); bigText(e.why==='shallow'?'רדוד!':'WIPEOUT','wasted'); flash('#ffffff',.4); K.splash(KS.x,KS.y,KS.z,46,1.3); subtitle(WHY[e.why]||'',2600); }
    else if(e.type==='up'){ sess.ups++; if(sess.ups===1) subtitle(sess.firstTip,4200); }
    else if(e.type==='buoy'){ sess.buoys++; score('BUOY '+sess.buoys,180,false); Audio.coin(2); }
  }
  // the physics at a fixed 120 Hz; the sea's clock runs with it (the board rides the surface of the same instant)
  function runPhysics(dt){ acc+=dt; let n=0; while(acc>=FIXED&&n<12){ acc-=FIXED; n++; Cst.time+=FIXED; K.step(FIXED,readControls()); for(const e of K.events) onEvent(e); K.events.length=0; } if(n>=12) acc=0; }
  function startSession(){ closeSheets(); Audio.init(); $('#controls').hidden=true;
    if(!board) board=K.makeKiteboard();
    Rider.walkSet(false); Rider.setBoardObj(board); Rider.setStance(.56); applyLook('kite'); Rider.root.visible=true; K.build(K.KITES[save.kite]||K.KITES[0]);
    const L=BT.spots.launch, x=L.x-8; K.reset({x,z:Cst.shoreZ(x)-26,side:1}); K.show(true); K.camReset(); K.events.length=0;
    Object.assign(sess,{t:0,score:0,shown:0,combo:0,comboT:0,tricks:0,best:null,maxH:0,maxV:0,buoys:0,crashes:0,jumps:0,ups:0,showH:0,lastH:0}); acc=0;
    sess.firstTip=touch()?'◀ ▶ היגוי · שתיהן = פחות כוח · החזיקו קפיצה ושחררו · כוח = מהר יותר':'← → היגוי · ↑ כוח · ↓ פחות כוח · רווח: החזיקו ושחררו לקפיצה';
    sport='kite'; document.body.classList.remove('surfing'); $('#steer .hint').textContent='שתיהן = פחות כוח'; SF.show(false); el.wind.textContent='➤'; el.windTxt.textContent=K.WIND.knots+' קשר'; $('#cue').className='';
    { const g=bG.querySelector('.g'), j=bJ.querySelector('.g'); if(g) g.textContent='כוח'; if(j) j.textContent='קפיצה'; }
    mode='kite'; el.menu.hidden=true; el.end.hidden=true; el.pause.hidden=true; el.hud.hidden=false; tb.side.clear(); stSync(); input.jump=input.grab=false; tb.spin=tb.power=tb.flip=false;
    subtitle('הקייט עולה… מחכים למשיכה',2400); last=performance.now(); }
  let sport='kite';
  function endSession(){ mode='end'; el.hud.hidden=true; $('#cue').className='';
    const total=Math.round(sess.score), surfing=sport==='surf', stars=1+(total>=(surfing?1800:2500)?1:0)+(total>=(surfing?5000:7000)?1:0), record=total>(surfing?save.sbest:save.best);
    save.wallet+=total; save.runs++; if(surfing) save.sbest=Math.max(save.sbest,total); else save.best=Math.max(save.best,total); persist(); $('#walletN').textContent=fmt(save.wallet);
    $('#endTitle').textContent=stars===3?'סשן אגדי':stars===2?'סשן מעולה':surfing?'סשן ראשון בגלים':'סשן ראשון בים';
    $('#stars').innerHTML=[1,2,3].map(i=>'<span class="'+(i<=stars?'':'off')+'">★</span>').join('');
    const rows=surfing?[['גלים שנתפסו',surf.rides],['הגלישה הטובה',surf.bestRide?fmt(surf.bestRide):'—'],['הגלישה הארוכה',surf.longest.toFixed(1)+' שנ׳'],['תמרונים',sess.tricks],['מהירות שיא',Math.round(sess.maxV*3.6)+' קמ״ש'],['נפילות',sess.crashes]]
      :[['טריקים',sess.tricks],['הטריק הטוב',sess.best?sess.best.name+' · '+fmt(sess.best.gain):'—'],['הקפיצה הגבוהה',sess.maxH.toFixed(1)+' מ׳'],['מהירות שיא',Math.round(sess.maxV*3.6)+' קמ״ש'],['מצופים',sess.buoys],['נפילות',sess.crashes]];
    $('#endRows').innerHTML=rows.map(r=>'<div><span>'+r[0]+'</span><span>'+r[1]+'</span></div>').join('');
    $('#endTotal').textContent=fmt(total)+(record&&total>0?' ★':''); if(window.RushWallet) $('#endPurse').textContent=RushWallet.note(total,'beach'); el.end.hidden=false; }
  /* back on the sand: walk out of the water at the school of the sport */
  function toBeach(){ mode='menu'; el.hud.hidden=true; el.end.hidden=true; el.pause.hidden=true; $('#controls').hidden=true; el.menu.hidden=false; $('#cue').className=''; document.body.classList.remove('surfing');
    K.show(false); SF.show(false); Rider.walkSet(true); applyLook('town'); Rider.root.visible=true; const L=sport==='surf'?BT.spots.surf:BT.spots.launch; townPlace({x:L.x,z:L.z+2,hd:0}); }
  let pausedFrom=null;
  function togglePause(){ if(mode==='kite'||mode==='surf'){ pausedFrom=mode; mode='pause'; el.pause.hidden=false; Audio.water(0,0,true); Audio.update(0,0,false,0); Audio.spin(0,0); }
    else if(mode==='pause'){ mode=pausedFrom||'kite'; el.pause.hidden=true; last=performance.now(); } }
  const again=()=>sport==='surf'?startSurf():startSession();
  $('#playBtn').onclick=()=>{ if(!save.ctlSeen) showControls(startSession,'kite'); else startSession(); };
  $('#surfBtn').onclick=()=>{ if(!save.sctlSeen) showControls(startSurf,'surf'); else startSurf(); };
  $('#tLift').onclick=()=>town.near==='surf'?$('#surfBtn').onclick():$('#playBtn').onclick();
  $('#againBtn').onclick=again; $('#menuBtn').onclick=toBeach; $('#pause').onclick=togglePause;
  $('#resumeBtn').onclick=togglePause; $('#restartBtn').onclick=again; $('#quitBtn').onclick=toBeach;

  /* ---------- wave surfing: three minutes at the surf spot ----------
     The surfer waits lying on the board just outside the break, at the next wave's peak (a few seconds before it comes); paddles
     as it arrives; stands up when it has the board; rides it. A ride scores its turns (a bottom turn: from down the face to up it,
     low; a top turn or a snap: back down from high on it), a cutback (back toward the breaking part), airs off the lip, the time
     in the barrel, and itself (seconds on the wave) if it ends clean. When it ends (or the surfer is knocked off) the surfer is
     back out at the lineup for the next wave. */
  const surf={rides:0,bestRide:0,longest:0,ride:null,back:0,turn:null,tubeT:0,cut:0,nextT:0,waveH:0,lastPh:''};
  let surfBoard=null;
  function lineup(){ const S=Cst.SURF, t=Cst.time;   // just outside where the next wave breaks (bigger waves further out); its crest 16 m out from the surfer: time to paddle
    const at=i=>{ const H=S.H[((i%8)+8)%8], off=S.breakOff(H)+8; return {H,off,lead:(S.off0-(off+16))/S.c}; };
    let i=Math.floor(t/S.period)-1, L=at(i); while(i*S.period+L.lead<t+4) L=at(++i);
    const off=L.off, lead=L.lead, px=S.peak+((i*37)%21+21)%21-10, x=px+8;
    const sd=10/170*Math.cos(x/170)+4/53*Math.cos(x/53+1.3), nl=Math.hypot(sd,1);
    SF.reset({x,z:Cst.shoreZ(x)-off,h:Math.atan2(-sd/nl+.25/nl,1/nl)}); surf.nextT=i*S.period+lead; surf.waveH=S.H[((i%8)+8)%8]; surf.ride=null; surf.turn=null; surf.cutS=null; surf.tubeT=0; }
  function startSurf(){ closeSheets(); Audio.init(); $('#controls').hidden=true; sport='surf'; document.body.classList.add('surfing'); $('#steer .hint').textContent='שתיהן = האטה';
    if(!surfBoard){ surfBoard=SF.makeBoard(SF.BOARDS[1].col); } SF.placeBoard(surfBoard);
    Rider.walkSet(false); Rider.setBoardObj(surfBoard); Rider.setStance(.64); applyLook('surf'); Rider.root.visible=true; SF.build(); SF.show(true); K.show(false);
    Object.assign(sess,{t:0,score:0,shown:0,combo:0,comboT:0,tricks:0,best:null,maxH:0,maxV:0,buoys:0,crashes:0,jumps:0,ups:0,showH:0,lastH:0}); Object.assign(surf,{rides:0,bestRide:0,longest:0,back:0}); acc=0;
    lineup(); SF.camReset(); SF.events.length=0;
    mode='surf'; el.menu.hidden=true; el.end.hidden=true; el.pause.hidden=true; el.hud.hidden=false; tb.side.clear(); stSync(); input.jump=input.grab=false; tb.spin=tb.power=tb.flip=false;
    subtitle(touch()?'כשהגל מגיע: החזיקו חתירה · כשהוא מרים אתכם: קום!':'כשהגל מגיע: החזיקו ↑ לחתירה · כשהוא מרים אתכם: רווח לקום',4200); last=performance.now(); }
  // the board's angle to the line (+ = up the face), for the turns
  function lineAngle(){ const x=SS.x, sd=10/170*Math.cos(x/170)+4/53*Math.cos(x/53+1.3), nl=Math.hypot(sd,1), fx=Math.sin(SS.h), fz=Math.cos(SS.h);
    return Math.atan2(-(fx*-sd/nl+fz/nl),fx/nl+fz*sd/nl)*Cst.SURF.dir; }
  function surfTurns(dt){ if(SS.ph!=='ride'||!surf.ride) return; const th=lineAngle(), f=SS.f, v=SS.speed, R=surf.ride; R.t+=dt;
    // a bottom turn: from pointing down the face to pointing up it, quickly, low on the face; a top turn (a snap if it is sharp)
    // the other way round, high on it. The clock of each starts when the board last pointed the other way.
    const T=surf.turn||(surf.turn={down:-9,up:-9,armed:''}), now=R.t;
    if(th<-.2) T.down=now; if(th>.2) T.up=now;
    if(th>.35&&T.armed!=='up'){ if(now-T.down<1.3&&f<.6&&v>3.5) score('BOTTOM TURN',90+v*14,false); T.armed='up'; }
    else if(th<-.45&&T.armed!=='down'){ if(now-T.up<1.2&&f>.45&&v>3) score(now-T.up<.5?'SNAP':'TOP TURN',(now-T.up<.5?170:120)+v*12,false); T.armed='down'; }
    // a cutback: riding down the line, round to ride back toward the breaking part for a moment, then round again
    const c=Math.cos(th), C2=surf.cutS||(surf.cutS={st:'',t:0});
    if(C2.st===''){ if(c>.5&&v>3.5){ C2.t+=dt; if(C2.t>.8){ C2.st='line'; C2.t=0; } } else C2.t=0; }
    else if(C2.st==='line'){ if(c<-.3&&v>3){ C2.t+=dt; if(C2.t>.35){ C2.st='back'; C2.t=0; } } else C2.t=0; }
    else if(C2.st==='back'){ C2.t+=dt; if(c>.3){ score('CUTBACK',260+v*10,false); C2.st='line'; C2.t=0; } else if(C2.t>3){ C2.st=''; C2.t=0; } }
    // the barrel
    if(SS.tube>.9) surf.tubeT+=dt; else if(surf.tubeT>.5){ score('BARREL · '+surf.tubeT.toFixed(1)+'S',220+surf.tubeT*260,false); surf.tubeT=0; } else surf.tubeT=0; }
  function rideOver(clean){ const R=surf.ride; if(!R) return; surf.ride=null; surf.longest=Math.max(surf.longest,R.t);
    if(clean&&R.t>1.5) score('RIDE · '+R.t.toFixed(1)+'S',R.t*45+Math.max(0,R.along)*2,false);
    const gained=sess.score-R.s0; surf.bestRide=Math.max(surf.bestRide,Math.round(gained)); }
  const SWHY={whitewater:'הקצף תפס אתכם',lip:'השפה נשברה עליכם',pearl:'האף נתקע במים',sideways:'נחיתה בצד','too hard':'נחיתה קשה מדי','off the line':'הלוח לא בכיוון','caught inside':'הגל עבר עליכם'};
  function onSurf(e){
    if(e.type==='pop'){ Audio.splash(.4); }
    else if(e.type==='ride'){ surf.rides++; surf.ride={t:0,s0:sess.score,x0:SS.x,along:0}; Audio.jump(); }
    else if(e.type==='air'){ sess.jumps++; Audio.jump(); Audio.splash(.6); SF.splash(SS.x,SS.y,SS.z,18,.7); }
    else if(e.type==='land'){ Audio.land(clamp(e.imp/8,.1,.7)); Audio.splash(clamp(e.imp/5,.3,1.1)); SF.splash(SS.x,SS.y,SS.z,Math.round(12+e.imp*4),clamp(e.imp/5,.3,1.1)); sess.lastH=e.h; sess.showH=1.4; sess.maxH=Math.max(sess.maxH,e.h);
      if(e.clean&&e.air>.3){ const parts=['AIR']; let pts=150+e.h*e.h*40+e.air*90; if(e.turns){ parts.push(e.turns*360+''); pts+=e.turns*320; } if(e.grabs.length){ parts.push(e.grabs.join(' + ')+' GRAB'); pts+=e.grabs.length*120; } score(parts.join(' ')+' · '+e.h.toFixed(1)+'M',pts,false); } }
    else if(e.type==='wipe'){ sess.crashes++; sess.combo=0; sess.comboT=0; if(surf.ride){ surf.ride.along=(SS.x-surf.ride.x0)*Cst.SURF.dir; rideOver(false); } Audio.wipe(); Audio.splash(1.3); bigText('WIPEOUT','wasted'); flash('#ffffff',.35); SF.splash(SS.x,SS.y,SS.z,50,1.4); subtitle(SWHY[e.why]||'',2400); surf.back=2.6; }
    else if(e.type==='end'){ if(surf.ride){ surf.ride.along=(SS.x-surf.ride.x0)*Cst.SURF.dir; rideOver(true); } subtitle(e.why==='kick'?'יציאה נקייה מהגל':e.why==='over'?'הגל עבר מתחתיכם':'הגל נגמר',2000); surf.back=1.8; }
  }
  function runSurf(dt){ Cst.surfFocus=SS.ph==='ride'||SS.ph==='air'||SS.ph==='pop'||SS.ph==='wipe'?SS.waveI:-1; acc+=dt; let n=0; while(acc>=FIXED&&n<12){ acc-=FIXED; n++; Cst.time+=FIXED; SF.step(FIXED,surfControls()); for(const e of SF.events) onSurf(e); SF.events.length=0; surfTurns(FIXED); } if(n>=12) acc=0;
    // a wave missed (it went under the board while lying down): the next one; after a ride, back out to the lineup
    if((SS.ph==='wait'||SS.ph==='paddle')&&Cst.time>surf.nextT+6) lineup();
    if(surf.back>0){ surf.back-=dt; if(surf.back<=0){ flash('#e8fbff',.6); lineup(); SF.camReset(); } } }
  /* the surf's own HUD: the next wave's height and how soon, the cues to paddle and to stand up, the buttons' names */
  function surfHud(dt){ const prone=SS.ph==='wait'||SS.ph==='paddle', soon=surf.nextT-Cst.time, sw=SS.face;
    el.windTxt.textContent=surf.waveH.toFixed(1)+' מ׳'; el.wind.textContent='🌊'; el.wind.style.transform='';
    const cue=$('#cue'); let txt='', go=false;
    if(prone&&sw&&SS.speed>SF.C.popMin&&sw.u>-sw.Lf){ txt='קום!'; go=true; }
    else if(prone&&soon<2.2&&soon>-3&&SS.ph!=='paddle'){ txt='חתירה!'; go=true; }
    else if(prone&&soon>2.2&&soon<12){ txt='הגל הבא · '+Math.ceil(soon); }
    cue.textContent=txt; cue.className=(txt?'on':'')+(go?' go':'');
    const g=bG.querySelector('.g'), j=bJ.querySelector('.g'); if(g) g.textContent=prone?'חתירה':'פמפום'; if(j) j.textContent=prone?'קום':'קפיצה'; }
  /* the controls screen: keyboard and touch side by side */
  const CTL_KEYS=[[['←','→'],'היגוי','לכיוון העפיפון = במורד הרוח · נגדו = נגד הרוח'],[['↑'],'כוח: מניעים את הקייט','מהר יותר'],[['↓'],'פחות כוח','לאט יותר'],[['רווח'],'החזיקו לטעינה, שחררו לקפיצה','הקייט עולה והרוכב מתנתק מהמים'],
    [['←','→'],'באוויר: סיבוב 360'],[['↓'],'באוויר: בקרול'],[['Shift'],'באוויר: תפיסה','לחיצה נוספת = תפיסה אחרת'],[['P'],'הפסקה']];
  const CTL_BTN=[[['◀','▶'],'היגוי','החזיקו = פנייה חדה יותר'],[['◀ ▶'],'שתיהן יחד = פחות כוח'],[['קפיצה'],'החזיקו לטעינה, שחררו לקפיצה'],[['כוח'],'מניעים את הקייט: מהר יותר'],
    [['סיבוב'],'באוויר, במקום קפיצה','◀ ▶ בוחרים את הכיוון'],[['תפיסה'],'באוויר, במקום כוח','לחיצה נוספת = תפיסה אחרת'],[['בקרול'],'מופיע באוויר'],[['❚❚'],'הפסקה']];
  const SCTL_KEYS=[[['↑'],'שוכבים: חתירה','כשהגל מגיע מאחור'],[['רווח'],'כשהגל מרים את הגלשן: קום!'],[['←','→'],'היגוי','במורד הגל = מהירות · למעלה = לאט יותר'],[['↑'],'עומדים: פמפום','עוד מהירות על הקיר'],[['↓'],'עומדים: האטה','לתת לצינור לתפוס אתכם'],
    [['רווח'],'עומדים: קפיצה מהשפה'],[['←','→'],'באוויר: סיבוב'],[['Shift'],'באוויר: תפיסה'],[['C'],'מצלמה: מהערוץ / מאחור'],[['P'],'הפסקה']];
  const SCTL_BTN=[[['חתירה'],'החזיקו כשהגל מגיע'],[['קום'],'כשהגל מרים אתכם'],[['◀','▶'],'היגוי','למטה בקיר = מהירות · למעלה = לאט'],[['פמפום'],'החזיקו לעוד מהירות'],[['◀ ▶'],'שתיהן יחד = האטה','לתת לצינור לתפוס אתכם'],
    [['קפיצה'],'ליד השפה: אוויר'],[['סיבוב'],'באוויר, ◀ ▶ בוחרים כיוון'],[['תפיסה'],'באוויר'],[['🎥'],'מצלמה: מהערוץ / מאחור'],[['❚❚'],'הפסקה']];
  let ctlThen=null, ctlFor='kite';
  function showControls(then,which){ ctlFor=which||sport; const sf=ctlFor==='surf', row=(r,b)=>'<div class="r"><span>'+r[1]+(r[2]?'<span class="air">'+r[2]+'</span>':'')+'</span><span class="k">'+r[0].map(k=>'<kbd'+(b?' class="b"':'')+'>'+k+'</kbd>').join('')+'</span></div>';
    $('#ctlKeys .list').innerHTML=(sf?SCTL_KEYS:CTL_KEYS).map(r=>row(r,false)).join(''); $('#ctlTouch .list').innerHTML=(sf?SCTL_BTN:CTL_BTN).map(r=>row(r,true)).join('');
    $('#ctlOk').textContent=then?(sf?'הבנתי · לגלים':'הבנתי · למים'):'סגירה'; ctlThen=then||null; $('#controls').hidden=false; }
  $('#ctlOk').onclick=()=>{ $('#controls').hidden=true; if(ctlFor==='surf'){ if(!save.sctlSeen){ save.sctlSeen=1; persist(); } } else if(!save.ctlSeen){ save.ctlSeen=1; persist(); } const t=ctlThen; ctlThen=null; if(t) t(); };
  $('#helpBtn').onclick=()=>showControls(); $('#helpBtn2').onclick=()=>showControls();
  $('#howtoTxt').innerHTML=['◀ ▶ היגוי · שתיהן = פחות כוח','קפיצה: החזיקו ושחררו · כוח: מהר יותר','באוויר: סיבוב · תפיסה · בקרול','⌨️ חיצים · רווח · Shift · P הפסקה'].map(t=>'<span>'+t+'</span>').join('');
  $('#ctlBtn').hidden=true;
  const touch=()=>document.body.classList.contains('touch');
  if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

  /* ---------- keys ---------- */
  const KEYMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d'};
  addEventListener('keydown',e=>{ if(e.repeat) return; Audio.init(); const k=KEYMAP[e.code]; if(k){ input.k[k]=true; e.preventDefault(); }
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=true; if(e.code==='Space'){ input.jump=true; e.preventDefault(); }
    if((e.code==='Escape'||e.code==='KeyP')&&(mode==='kite'||mode==='surf'||mode==='pause')){ togglePause(); return; }
    if(mode==='menu'){ if(e.code==='Enter'&&$('#controls').hidden) $('#playBtn').onclick(); if(e.code==='KeyC') town.sheet==='char'?closeSheets():openSheet('char'); if(e.code==='Escape') closeSheets(); }
    if((mode==='kite'||mode==='surf')&&e.code==='KeyR') again(); if(mode==='surf'&&(e.code==='KeyC'||e.code==='KeyV')) camCycle(); if(e.code==='KeyH') document.body.classList.toggle('hud-hidden'); });
  addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) input.k[k]=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=false; if(e.code==='Space') input.jump=false; });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&(mode==='kite'||mode==='surf')) togglePause(); });
  addEventListener('blur',()=>{ input.k={}; input.grab=input.jump=false; tb.side.clear(); stSync(); tb.spin=tb.power=tb.flip=false; if(mode==='kite'||mode==='surf') togglePause(); });

  /* ---------- the HUD on the water ---------- */
  const _f=new THREE.Vector3();
  function hud(dt){ sess.shown+=(sess.score-sess.shown)*Math.min(1,dt*7); el.score.textContent=fmt(sess.shown);
    const A=sport==='surf'?SS:KS; el.spd.textContent=Math.round(A.speed*3.6);
    const left=Math.max(0,sess.len-sess.t), s=Math.ceil(left); if(s!==el.progTxt._v){ el.progTxt._v=s; el.progTxt.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
    el.prog.style.width=(left/sess.len*100)+'%';
    // the wind's direction on the screen (the arrow points where it blows); surfing: the waves instead
    if(sport==='surf') surfHud(dt); else { camera.getWorldDirection(_f); const fl=Math.hypot(_f.x,_f.z)||1, fx=_f.x/fl, fz=_f.z/fl, D=K.D, dx=D.x*-fz+D.z*fx, dy=D.x*fx+D.z*fz;
      el.wind.style.transform='rotate('+(Math.atan2(-dy,dx)*180/PI).toFixed(1)+'deg)'; }
    // the height of a jump while it lasts, then the best of it for a moment
    if(A.air&&A.jump){ Cst.water(A.x,A.z,null,_hw); const h=Math.max(0,A.y-Math.max(_hw.y,A.jump.y0)); el.jumpH.textContent=h.toFixed(1)+' מ׳'; el.jumpH.classList.add('on'); el.jumpH.classList.toggle('big',h>5); }
    else if(sess.showH>0){ sess.showH-=dt; el.jumpH.textContent=sess.lastH.toFixed(1)+' מ׳'; if(sess.showH<=0) el.jumpH.classList.remove('on','big'); }
    else el.jumpH.classList.remove('on','big');
    const m=mult(); el.combo.hidden=sess.combo<1; if(sess.combo>0){ el.comboX.textContent='x'+m; el.comboBar.style.transform='scaleX('+clamp(sess.comboT/7,0,1)+')'; }
    el.hud.classList.toggle('air',airborne());
    if(sport==='kite'&&KS.far>.5&&!el.tip._far){ el.tip.textContent='רחוק מדי — חזרו לכיוון החוף'; el.tip.hidden=false; el.tip._far=1; } else if(KS.far<.1&&el.tip._far){ el.tip.hidden=true; el.tip._far=0; }
    if(subT>0){ subT-=dt*1000; if(subT<=0) el.sub.style.opacity=0; }
    if(flashK>0){ flashK=Math.max(0,flashK-dt*1.8); el.flash.style.opacity=flashK; } }
  const _hw={};

  /* ---------- loop ---------- */
  function tick(dt){ tAcc+=dt;
    if(mode==='pause') return;
    if(ST.Crowd&&(mode!=='menu'||!Rider.walking)) ST.Crowd.player.on=false;   // off the sand: nobody to give way to
    if(mode==='menu'){ if(Rider.walking) townUpdate(dt); town.cam(camera,dt,{show:town.sheet==='char',sheet:!!town.sheet});
      // the beach's sound: the surf (louder toward the waterline), the promenade's murmur, a breeze, gulls now and then
      const d=Cst.inland(town.x,town.z); Audio.sea(clamp(1-(d-4)/90,.22,1),dt); Audio.crowd(clamp((d-20)/40,0,1)*.6); Audio.update(6,0,false,0); Audio.water(0,0,true);
      gullT-=dt; if(gullT<=0){ gullT=7+Math.random()*16; Audio.gull(); } }
    else if(mode==='kite'||mode==='end'&&sport==='kite'){
      if(mode==='kite'){ sess.t+=dt; if(sess.comboT>0){ sess.comboT-=dt; if(sess.comboT<=0) sess.combo=0; } }
      runPhysics(dt); sess.maxV=Math.max(sess.maxV,KS.speed); K.visuals(dt,Rider); K.camera(dt); hud(dt);
      Audio.update(Math.max(10,KS.speed*1.6),0,KS.air,0); Audio.water(KS.fall?0:KS.speed,KS.edge,KS.air); Audio.sea(.4,dt); Audio.crowd(0); Audio.spin(KS.air?KS.wsp:0,KS.spin||0);
      if(mode==='kite'&&sess.t>=sess.len&&!KS.air&&!KS.fall) endSession(); }
    else if(mode==='surf'||mode==='end'&&sport==='surf'){
      if(mode==='surf'){ sess.t+=dt; if(sess.comboT>0&&!surf.ride){ sess.comboT-=dt; if(sess.comboT<=0) sess.combo=0; } }   // the combo holds through a ride
      runSurf(dt); sess.maxV=Math.max(sess.maxV,SS.ph==='ride'?SS.speed:0); SF.visuals(dt,Rider); SF.camera(dt); hud(dt);
      const riding=SS.ph==='ride'; Audio.update(riding?SS.speed*2:4,0,SS.air,0); Audio.water(riding?SS.speed*1.4:SS.ph==='paddle'?3:0,Math.abs(SS.edge)*1.5,SS.air); Audio.sea(.85,dt); Audio.crowd(0); Audio.spin(SS.air?SS.wsp:0,SS.spin||0);
      if(mode==='surf'&&sess.t>=sess.len&&SS.ph!=='ride'&&SS.ph!=='air'&&SS.ph!=='pop') endSession(); }
    ST.People.update(dt,camera.position.x,camera.position.z); K.aiUpdate(dt);
    const A=sport==='surf'?SS:KS; Cst.update(mode==='kite'||mode==='surf'||mode==='end'?0:dt,mode==='menu'?{x:town.x,y:town.y,z:town.z}:{x:A.x,y:A.y,z:A.z}); }
  function loop(now){ requestAnimationFrame(loop); const raw=(now-last)/1000, dt=Math.min(.1,raw); last=now; ST.qTick(raw,now); tick(dt); ST.render(); }
  /* ---------- boot ---------- */
  async function boot(){ const bar=$('#loadbar'), txt=$('#loadtxt'); const set=(p,t)=>{ bar.style.width=p+'%'; if(t) txt.textContent=t; };
    set(10,'בונים את החוף…'); ST.onResize(); ST.qApply(ST.Q.lv); Cst.build(); await ST.Assets.preload();
    set(30,'מקימים את העיירה…'); await BT.build(); ST.People.setPalette(SUMMER); BT.populate();
    set(55,'מתלבשים לים…'); Rider.noGear=true; try{ await Rider.load(false); }catch(e){ console.error('rider',e); txt.textContent='שגיאה בטעינת הרוכב'; return; }
    const want=Rider.choices[save.rider]; if(want&&want!=='hero'&&want!=='meshy_rider'){ try{ await Rider.preload(want); await Rider.swap(want); }catch(e){ console.warn('rider',e); } }
    applyLook(); try{ await Rider.walkPrep(); }catch(e){ console.warn('walk',e); }
    K.aiBuild(5); SF.build();
    set(90,'מורחים קרם הגנה…'); ST.People.preload(5); setMute(!!save.muted); el.windTxt.textContent=K.WIND.knots+' קשר';
    const S=BT.spots.start; townPlace({x:S.x,z:S.z,hd:PI}); mode='menu'; el.menu.hidden=false; Rider.walkSet(true); Rider.root.visible=true; renderRiders(); renderKites(); $('#walletN').textContent=fmt(save.wallet);
    if(!save.walked) $('#tHint').hidden=false;
    set(100); await new Promise(r=>setTimeout(r,200)); $('#loading').remove();
    if(new URLSearchParams(location.search).get('arrive')){ townNote('✈️ נחתתם! ברוכים הבאים לחוף תל אביב ☀️'); history.replaceState(null,'',location.pathname); }
    const q=new URLSearchParams(location.search); if(q.get('auto')==='1'){ save.ctlSeen=1; startSession(); } else if(q.get('auto')==='surf'){ save.sctlSeen=1; startSurf(); }
    window.READY=true; requestAnimationFrame(loop); }
  ST.debug={town,townPlace,get mode(){ return mode; },setMode:m=>mode=m,tick,input,save,sess,startSession,endSession,toBeach,togglePause,ctl,readControls,tb,runPhysics,startSurf,surf,lineup,sctl,surfControls,get sport(){ return sport; }};
  boot();
})(window.ST);
