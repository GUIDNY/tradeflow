/* Snow Trader: the ski resort around the run. Lodge and huts on cut terraces, a chairlift (pylons, cable, moving
   chairs with riders), orange safety netting, trail-marker poles, snow cannons with plumes and ambient skiers.
   Static pieces are built per chunk (World.buildChunk calls Resort.chunk); moving pieces live in Resort.update. */
(function(ST){
  const {clamp,lerp,smooth,hash2}=ST; const {scene}=ST;
  const PI=Math.PI;
  let T=null, liftSide=1, lodgeSide=-1, LEN=0;
  const R={}; const chunkGeos={}, chunkPlumes={};

  /* ---------- materials & textures ---------- */
  const M={
    wood:new THREE.MeshStandardMaterial({color:0x9b6a3c,roughness:.85}), woodD:new THREE.MeshStandardMaterial({color:0x5b3a22,roughness:.85}),
    stone:new THREE.MeshStandardMaterial({color:0x8d9097,roughness:.95}), snowRoof:new THREE.MeshStandardMaterial({color:0xf7faff,roughness:.9}),
    roof:new THREE.MeshStandardMaterial({color:0x3c2f2c,roughness:.8}), metal:new THREE.MeshStandardMaterial({color:0x454c58,metalness:.7,roughness:.4}),
    steel:new THREE.MeshStandardMaterial({color:0x1c2027,metalness:.6,roughness:.5}), concrete:new THREE.MeshStandardMaterial({color:0xb7bbc2,roughness:.9}),
    win:new THREE.MeshStandardMaterial({color:0xffe2a8,emissive:0xffc477,emissiveIntensity:1.5,roughness:.4}),
    red:new THREE.MeshStandardMaterial({color:0xd8322f,roughness:.6}), orange:new THREE.MeshStandardMaterial({color:0xff7a1a,roughness:.6}),
    cable:new THREE.MeshStandardMaterial({color:0x14171c,metalness:.5,roughness:.5}), pole:new THREE.MeshStandardMaterial({color:0xc9a76a,roughness:.8})};
  function box(w,h,d,m,x,y,z,p,cast){ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); if(cast!==false) o.castShadow=true; o.receiveShadow=true; p&&p.add(o); return o; }
  function cyl(rt,rb,h,m,x,y,z,p,seg){ const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||10),m); o.position.set(x,y,z); o.castShadow=true; p&&p.add(o); return o; }
  function canvasTex(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }
  const netTex=(()=>{ const t=canvasTex(64,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='#ff7418'; g.lineWidth=5; g.beginPath(); g.moveTo(0,0); g.lineTo(w,h); g.moveTo(w,0); g.lineTo(0,h); g.moveTo(-4,h/2); g.lineTo(w/2,h+4); g.moveTo(w/2,-4); g.lineTo(w+4,h/2); g.stroke(); }); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; })();
  const netMat=new THREE.MeshBasicMaterial({map:netTex,transparent:true,alphaTest:.35,side:THREE.DoubleSide,fog:true});
  const plumeTex=canvasTex(128,128,(g,w,h)=>{ const gr=g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(.5,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const signCache={};
  function signTex(diff){ if(signCache[diff]) return signCache[diff]; return signCache[diff]=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); const col={green:'#16b85f',blue:'#2f79ff',red:'#e8283f',black:'#12141a',park:'#d63bff'}[diff]||'#999'; g.fillStyle=col; g.strokeStyle='#fff'; g.lineWidth=0;
      const c=64; if(diff==='green'){ g.beginPath(); g.arc(c,c,48,0,PI*2); g.fill(); } else if(diff==='blue'){ g.fillRect(18,18,92,92); } else if(diff==='red'||diff==='park'){ g.beginPath(); g.moveTo(c,8); g.lineTo(120,c); g.lineTo(c,120); g.lineTo(8,c); g.closePath(); g.fill(); }
      else { [[36,64],[92,64]].forEach(([x,y])=>{ g.beginPath(); g.moveTo(x,y-34); g.lineTo(x+30,y); g.lineTo(x,y+34); g.lineTo(x-30,y); g.closePath(); g.fill(); }); } }); }

  /* ---------- setup per track ---------- */
  R.setTrack=function(tr){ if(ST.People) ST.People.reset(); for(const k in topCache) delete topCache[k]; T=tr; LEN=tr.len; const i=ST.TRACKS.indexOf(tr); liftSide=i%2===0?1:-1; lodgeSide=-liftSide; for(const k in chunkGeos) delete chunkGeos[k]; for(const k in chunkPlumes) delete chunkPlumes[k]; npcInit(); };
  const hw=s=>ST.World.halfW(s);
  const liftU=s=>liftSide*(hw(s)+19);
  R.liftU=liftU; R.lodgeSide=()=>lodgeSide;
  R.sites=function(tr){ const i=ST.TRACKS.indexOf(tr), ls=i%2===0?1:-1, ld=-ls; const L=tr.len, W=s=>tr.halfW+3.5*Math.sin(s*.011+1);
    return [{s:26,u:ld*(W(26)+21),r:16},{s:L*.5,u:ld*(W(L*.5)+17),r:9},{s:L-8,u:ld*(W(L-8)+16),r:9},{s:-34,u:ls*(W(-34)+19),r:8},{s:L+34,u:ls*(W(L+34)+19),r:8},{s:L*.27,u:ld*(W(L*.27)+17),r:10},{s:L*.74,u:ld*(W(L*.74)+17),r:10}]; };
  R.blocked=function(s,u){ if(!T) return false; const lu=liftU(s); if(s>-40&&s<LEN+44&&Math.abs(u-lu)<8) return true;
    const sites=R.sites(T); for(const t of sites){ const du=u-t.u, ds=s-t.s; if(du*du+ds*ds<(t.r+6)*(t.r+6)) return true; } return false; };

  /* ---------- buildings ---------- */
  function signBoard(text,sub,w,h){ return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({toneMapped:false,map:canvasTex(512,Math.round(512*h/w),(g,W,H)=>{
      g.fillStyle='#1b1512'; g.fillRect(0,0,W,H); g.strokeStyle='#ffb020'; g.lineWidth=8; g.strokeRect(8,8,W-16,H-16); g.textAlign='center'; g.fillStyle='#fff'; g.font='900 '+Math.round(H*.4)+'px "Arial Black",Impact,sans-serif'; g.fillText(text,W/2,H*.52);
      g.fillStyle='#ffc83a'; g.font='800 '+Math.round(H*.2)+'px "Arial Black",sans-serif'; g.fillText(sub,W/2,H*.82); })})); }
  function chalet(sc,label,sub){
    const g=new THREE.Group(), w=20,d=11;
    box(w+2,10,d+1,M.stone,0,-3,0,g);                                   // foundation down into the terrace
    box(w-2,5,d-1.4,M.wood,0,4.5,0,g);                                  // timber storey
    box(w-1.2,.5,d-.6,M.woodD,0,2.1,0,g);
    // gable roof: two snow-covered slabs
    const ang=.52, half=(d+1.8)/2/Math.cos(ang);
    [-1,1].forEach(sd=>{ const slab=box(w+1.6,.55,half*1.02,M.roof,0,0,0,null); const sn=box(w+1.9,.45,half*1.02,M.snowRoof,0,.45,0,null);
      const gr=new THREE.Group(); gr.add(slab,sn); gr.position.set(0,9.1,sd*(half*Math.cos(ang)*.5)); gr.rotation.x=sd*ang; g.add(gr); });
    const tri=new THREE.Shape(); tri.moveTo(-(d-1.4)/2-.2,0); tri.lineTo((d-1.4)/2+.2,0); tri.lineTo(0,3.6); [-1,1].forEach(sd=>{ const gm=new THREE.Mesh(new THREE.ExtrudeGeometry(tri,{depth:.4,bevelEnabled:false}),M.wood); gm.rotation.y=PI/2; gm.position.set(sd*(w-2)/2,7,0); g.add(gm); });
    box(1.8,4.5,1.8,M.stone,-6,10.5,-1,g); box(2.3,.5,2.3,M.snowRoof,-6,12.9,-1,g);
    // windows and door on the front (+Z)
    for(let i=-3;i<=3;i++){ if(i===0) continue; const fz=(d-1.4)/2+.03; box(1.5,1.9,.12,M.win,i*2.5,4.6,fz,g,false); box(1.8,.18,.2,M.woodD,i*2.5,3.55,fz+.05,g,false); box(1.8,.18,.2,M.woodD,i*2.5,5.65,fz+.05,g,false); }
    box(2.6,3.5,.2,M.woodD,0,3.75,(d-1.4)/2+.06,g,false);
    // porch with posts
    box(w-4,.35,3.4,M.roof,0,6.3,(d-1.4)/2+1.5,g); box(w-3.6,.3,3.6,M.snowRoof,0,6.6,(d-1.4)/2+1.5,g); for(let i=-4;i<=4;i+=2) cyl(.16,.16,4.4,M.woodD,i*2.1,4,(d-1.4)/2+3,g,6);
    box(w-3,.3,3.4,M.woodD,0,2.05,(d-1.4)/2+1.5,g);
    const sb=signBoard(label,sub,6.8,2.2); sb.position.set(0,7.9,(d-1.4)/2+3.1); g.add(sb);
    // lamp posts with warm lights (emissive heads)
    [-1,1].forEach(sd=>{ cyl(.08,.1,3.2,M.steel,sd*(w/2+1),3.5,(d-1.4)/2+3,g,6); const lh=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),M.win); lh.position.set(sd*(w/2+1),5.2,(d-1.4)/2+3); g.add(lh); });
    // ski rack with skis
    for(let i=0;i<7;i++){ const sk=box(.1,.02,2.6,[M.red,M.orange,M.steel][i%3],-w/2+1.6+i*.5,3.1,(d-1.4)/2+3.4,g,false); sk.rotation.x=-.18; }
    g.scale.setScalar(sc); return g; }
  function station(){ const g=new THREE.Group(); box(7,5,7,M.concrete,0,1.5,0,g); box(8,.5,8,M.red,0,4.4,0,g); box(8.4,.3,8.4,M.snowRoof,0,4.75,0,g); cyl(1.6,1.6,.5,M.steel,0,6.6,0,g,16).rotation.x=PI/2; box(.5,4,.5,M.steel,0,5.2,0,g); return g; }

  /* ---------- people, terraces (cafés) ---------- */
  const PJ=[0xff3d6e,0x2f8bff,0xffc83a,0x16e08a,0xff7a1a,0xb04bff,0x22d3ee,0xf5f5f5,0xe11d48,0x1f2937];
  const bodyGS=new THREE.BoxGeometry(.46,.7,.3), headGS=new THREE.SphereGeometry(.15,10,8), legGS=new THREE.BoxGeometry(.38,.7,.24);
  const matLeg=new THREE.MeshStandardMaterial({color:0x1d2433,roughness:.8}), matSkin=new THREE.MeshStandardMaterial({color:0xe3ad88,roughness:.6});
  const jackMats=PJ.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.7}));
  function person(g,x,y,z,ry,k,sit){ const p=new THREE.Group(); const lg=new THREE.Mesh(legGS,matLeg); const bd=new THREE.Mesh(bodyGS,jackMats[k%jackMats.length]); const hd=new THREE.Mesh(headGS,hash2(k,3)<.4?jackMats[(k+3)%jackMats.length]:matSkin);
    if(sit){ lg.scale.set(1,.55,1.2); lg.position.set(0,.45,.2); bd.position.set(0,.95,0); hd.position.set(0,1.5,0); } else { lg.position.set(0,.35,0); bd.position.set(0,1.05,0); hd.position.set(0,1.62,0); }
    [lg,bd,hd].forEach(m=>{ m.castShadow=true; p.add(m); }); p.position.set(x,y,z); p.rotation.y=ry; g.add(p); return p; }
  function terrace(n,seed){
    const g=new THREE.Group(); const cols=[0xd8322f,0xf5f5f5,0xffa21a,0x2f79ff];
    box(Math.max(8,n*3.2),.25,8.5,M.woodD,0,.1,5.2,g,false);            // wooden deck
    for(let i=0;i<n;i++){ const x=(i-(n-1)/2)*3.4, z=5.4+((i%2)?1.2:-.8);
      cyl(.65,.65,.08,M.concrete,x,1.05,z,g,12); cyl(.07,.07,1,M.steel,x,.55,z,g,6);
      cyl(.04,.04,2.6,M.steel,x,2.1,z,g,5); const para=new THREE.Mesh(new THREE.ConeGeometry(1.7,.55,10),new THREE.MeshStandardMaterial({color:cols[(i+seed)%cols.length],roughness:.7})); para.position.set(x,3.4,z); para.castShadow=true; g.add(para);
      const sn=new THREE.Mesh(new THREE.ConeGeometry(1.3,.22,10),M.snowRoof); sn.position.set(x,3.62,z); g.add(sn);
      [[-1,0],[1,0]].forEach(([dx],j)=>{ box(.5,.08,.5,M.pole,x+dx*1.1,.62,z,g,false); box(.5,.6,.08,M.pole,x+dx*1.1,.95,z+(j?.2:-.2),g,false);  }); }
    // patio heaters + string lights
    [-1,1].forEach(sd=>{ const x=sd*(Math.max(8,n*3.2)/2-.4); cyl(.07,.07,2.6,M.steel,x,1.5,8.6,g,6); const hd=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),M.win); hd.position.set(x,2.9,8.6); g.add(hd); });
    for(let i=0;i<=10;i++){ const t=i/10, x=lerp(-Math.max(8,n*3.2)/2,Math.max(8,n*3.2)/2,t), y=4.6-Math.sin(t*PI)*.5; const b=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),M.win); b.position.set(x,y,8.6); g.add(b); }
    return g; }
  function crowd(n,seed){ const g=new THREE.Group(); for(let i=0;i<n;i++){ const row=i%3, col=Math.floor(i/3); const p=person(g,-3+col*1.1+(hash2(i,seed)-.5)*.4,1.5,2.5+row*1.3,PI,seed*9+i,false);
      const bd=box(.3,.04,1.5,jackMats[(i+2)%jackMats.length],.38,.9,0,p,false); bd.rotation.x=.1; } 
    for(let i=0;i<8;i++) cyl(.04,.04,1.1,M.orange,-4+i*1.2,2.0,1.6,g,5); return g; }


  /* real guests (Mixamo characters, spawned near the player by ST.People) around a building, in the building's own frame */
  function guests(ci,i,o){ const P=ST.People; if(!P) return; const rot=o.rotation.y, c=Math.cos(rot), sn=Math.sin(rot);
    const W=(lx,lz)=>[o.position.x+lx*c+lz*sn, o.position.z-lx*sn+lz*c];
    const add=(lx,lz,type,fx,fz,extra)=>{ const [x,z]=W(lx,lz); const ry=(fx===undefined?0:Math.atan2(fx-lx,fz-lz))+rot; P.add(ci,Object.assign({x,z,type,ry},extra||{})); };
    const circle=(cx,cz,n,type)=>{ for(let k=0;k<n;k++){ const a=k/n*PI*2+cx; add(cx+Math.cos(a)*1.0,cz+Math.sin(a)*1.0,type||'Idle',cx,cz); } };
    if(i===0){ circle(-7,14,3); circle(6,13.5,3); circle(0,17,2); add(0,12,'Wave',0,30); add(-12,20,'Walk',0,20,{seg:[24*c,-24*sn]}); add(10,22,'Walk',0,22,{seg:[-20*c,20*sn]}); }
    else if(i===1||i===5||i===6){ circle(-3,9.5,2); circle(3.2,10,2); add(0,12.5,'Wave',0,30); }
    else if(i===2){ for(let k=0;k<7;k++) add(-9+k*3,11+hash2(k,4)*3,k%3?'Wave':'Idle',-9+k*3,40); }
    else if(i===4){ for(let k=0;k<7;k++) add(-1.5+hash2(k,2)*3,2.5+k*1.25,'Idle',0,-8); } }
  function placeBuilding(grp,site,obj,faceTrack){ const W=ST.World, x=W.cx(site.s)+site.u, z=-site.s, y=W.groundY(x,z)+1.2; obj.position.set(x,y-2.1,z); const toward=site.u<0?1:-1; obj.rotation.y=faceTrack===false?0:(toward>0?PI/2:-PI/2); grp.add(obj); }

  /* ---------- chairlift geometry ---------- */
  const topCache={};
  const LP=42, LS0=-34;
  function pylonS(k){ return LS0+k*LP; }
  function pylonPos(k){ const s=pylonS(k), W=ST.World; const x=W.cx(s)+liftU(s), z=-s; if(!topCache[k]) topCache[k]=W.groundY(x,z)+12.5; return {x,z,y:topCache[k],s}; }
  function cablePoint(s,line){   // line: -1 uphill (left), +1 downhill
    const k=Math.floor((s-LS0)/LP), f=(s-pylonS(k))/LP, a=pylonPos(k), b=pylonPos(k+1);
    const x=lerp(a.x,b.x,f), z=lerp(a.z,b.z,f), y=lerp(a.y,b.y,f)-1.5*4*f*(1-f); const lat=line*2.0; return {x:x+lat,y,z};
  }
  const cabGeo=new THREE.CylinderGeometry(.05,.05,1,5); cabGeo.rotateX(PI/2); cabGeo.translate(0,0,.5);
  function addCable(grp,k,geos){ const a=pylonPos(k), b=pylonPos(k+1); [-1,1].forEach(line=>{ let prev=null; for(let i=0;i<=4;i++){ const s=lerp(a.s,b.s,i/4), p=cablePoint(s,line); if(prev){ const m=new THREE.Mesh(cabGeo,M.cable); m.position.set(prev.x,prev.y,prev.z); m.scale.z=Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z); m.lookAt(p.x,p.y,p.z); grp.add(m); } prev=p; } }); }
  function addPylon(grp,k){ const p=pylonPos(k), W=ST.World, g=new THREE.Group(); const gy=p.y-12.5; g.position.set(p.x,gy,p.z); cyl(.22,.34,12.6,M.metal,0,6.3,0,g,8); box(5.2,.28,.34,M.metal,0,12.1,0,g); [-1,1].forEach(l=>{ cyl(.34,.34,.5,M.steel,l*2.0,12.5,0,g,10).rotation.x=PI/2; }); box(1.1,.5,1.1,M.concrete,0,.1,0,g); grp.add(g); }

  R.cablePoint=(s,l)=>cablePoint(s,l);
  /* ---------- per-chunk static props ---------- */
  R.chunk=function(ci,grp,items,s0,L){
    if(!T) return; const W=ST.World, geos=chunkGeos[ci]=[], plumes=chunkPlumes[ci]=[];
    // pylons and cable
    for(let k=0;k<=Math.ceil((LEN+70-LS0)/LP);k++){ const s=pylonS(k); if(s>=s0&&s<s0+L){ addPylon(grp,k); if(pylonS(k+1)<=LEN+70+LP) addCable(grp,k,geos); } }
    // netting + poles along both edges
    if(T.net){ [-1,1].forEach(side=>{ const seg=6; let run=[]; const flush=()=>{ if(run.length<2){ run=[]; return; } const n=run.length, pos=new Float32Array(n*6), uv=new Float32Array(n*4), idx=[]; let dist=0;
          for(let i=0;i<n;i++){ const p=run[i]; if(i) dist+=Math.hypot(p.x-run[i-1].x,p.z-run[i-1].z); pos.set([p.x,p.y+.1,p.z,p.x,p.y+1.45,p.z],i*6); uv.set([dist/1.3,0,dist/1.3,1.1],i*4); if(i){ const a=(i-1)*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } }
          const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx); const m=new THREE.Mesh(g,T.id==='ipo'?neonNet:netMat); m.frustumCulled=false; grp.add(m); geos.push(g); run=[]; };
        for(let s=Math.ceil(s0/seg)*seg;s<s0+L+seg;s+=seg){ if(s<30||s>LEN-10){ flush(); continue; } const cell=Math.floor(s/72); if(hash2(cell,side*7+3)<.42){ flush(); continue; }
          const u=side*(hw(s)+1.9), x=W.cx(s)+u, z=-s, y=W.groundY(x,z); run.push({x,y,z}); if(Math.round(s/seg)%2===0) cyl(.05,.06,1.9,M.pole,x,y+.9,z,grp,5); } flush(); }); }
    // trail markers
    for(let s=Math.ceil((s0-20)/90)*90+45;s<s0+L;s+=90){ if(s<s0||s>LEN-30) continue; [-1,1].forEach(side=>{ const u=side*(hw(s)+.9), x=W.cx(s)+u, z=-s, y=W.groundY(x,z); cyl(.05,.06,3.2,M.steel,x,y+1.5,z,grp,6);
        const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1),new THREE.MeshBasicMaterial({map:signTex(T.diff),side:THREE.DoubleSide})); sg.position.set(x,y+3.1,z); sg.rotation.y=PI/2+side*.15; grp.add(sg); }); }
    // buildings (only the chunk that owns the site builds it)
    R.sites(T).forEach((t,i)=>{ if(t.s<s0||t.s>=s0+L) return; let o;
      if(i===0) o=chalet(1.0,'BASE LODGE','SNOW TRADER RESORT'); else if(i===1) o=chalet(.62,'CAFÉ','ESPRESSO · COCOA'); else if(i===2) o=chalet(.6,'FINISH ZONE','TAKE PROFIT'); else if(i===5) o=chalet(.62,'APRÈS SKI','BAR & GRILL'); else if(i===6) o=chalet(.6,'MOUNTAIN CAFÉ','WAFFLES'); else o=station();
      if(i===0||i===1||i===5||i===6){ const tr=terrace(i===0?5:3,i); tr.position.set(0,.1,i===0?5:6); o.add(tr); }
      placeBuilding(grp,t,o,i<3||i>4); if(i<3||i>4) addSmoke(grp,o); guests(ci,i,o); });
    // cannons
    for(let s=Math.ceil(s0/120)*120+37;s<s0+L;s+=120){ if(s<s0||s>LEN-30) continue; const side=Math.floor(s/120)%2?1:-1, u=side*(hw(s)+7), x=W.cx(s)+u, z=-s, y=W.groundY(x,z); const g=new THREE.Group(); g.position.set(x,y,z);
      cyl(.18,.25,3.4,M.steel,0,1.7,0,g,8); const barrel=cyl(.3,.4,1.6,M.orange,0,3.6,0,g,10); barrel.rotation.z=side*-.9; [0,1,2].forEach(i=>{ const l=box(.1,2.2,.1,M.steel,Math.cos(i*2.1)*.7,1,Math.sin(i*2.1)*.7,g); l.rotation.z=Math.cos(i*2.1)*.35; l.rotation.x=-Math.sin(i*2.1)*.35; });
      for(let i=0;i<4;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:plumeTex,transparent:true,depthWrite:false,opacity:.55,fog:true})); sp.userData={i,side,bx:x,by:y+4,bz:z}; sp.position.set(x,y+4,z); grp.add(sp); plumes.push(sp); }
      grp.add(g); }
  };
  const neonNet=new THREE.MeshBasicMaterial({color:0xff3df2,transparent:true,opacity:.55,side:THREE.DoubleSide});
  R.disposeChunk=function(ci){ if(ST.People) ST.People.clear(ci); (chunkGeos[ci]||[]).forEach(g=>g.dispose()); delete chunkGeos[ci]; delete chunkPlumes[ci]; };
  function addSmoke(grp,o){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:plumeTex,transparent:true,depthWrite:false,opacity:.35,color:0xdfe3ea,fog:true})); const p=new THREE.Vector3(-6,14,-1).applyMatrix4(o.matrixWorld.identity().compose(o.position,new THREE.Quaternion().setFromEuler(o.rotation),o.scale)); sp.position.copy(p); sp.scale.set(5,7,1); sp.userData.smoke=1; sp.userData.by=p.y; grp.add(sp); (chunkPlumes.smoke=chunkPlumes.smoke||[]); }

  /* ---------- moving chairs ---------- */
  const CH_N=90, CHS=16, CSPEED=5;
  const chairGeo=(()=>{ const parts=[],mk=(w,h,d,x,y,z,c)=>{ const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); const col=new Float32Array(g.attributes.position.count*3); for(let i=0;i<col.length;i+=3){ col[i]=c[0]; col[i+1]=c[1]; col[i+2]=c[2]; } g.setAttribute('color',new THREE.BufferAttribute(col,3)); parts.push(g); };
    mk(.07,2.3,.07,0,-1.15,0,[.1,.1,.12]); mk(2.1,.12,.7,0,-2.35,0,[.85,.14,.12]); mk(2.1,.75,.1,0,-1.95,-.33,[.85,.14,.12]); mk(2.2,.07,.07,0,-1.75,.36,[.1,.1,.12]);
    // merge
    let np=0,ni=0; parts.forEach(g=>{ np+=g.attributes.position.count; ni+=g.index.count; }); const pos=new Float32Array(np*3),nor=new Float32Array(np*3),col=new Float32Array(np*3),idx=new Uint32Array(ni); let po=0,io=0;
    parts.forEach(g=>{ pos.set(g.attributes.position.array,po*3); nor.set(g.attributes.normal.array,po*3); col.set(g.attributes.color.array,po*3); for(let i=0;i<g.index.count;i++) idx[io+i]=g.index.array[i]+po; io+=g.index.count; po+=g.attributes.position.count; });
    const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('color',new THREE.BufferAttribute(col,3)); m.setIndex(new THREE.BufferAttribute(idx,1)); return m; })();
  const chairs=new THREE.InstancedMesh(chairGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.2}),CH_N); chairs.frustumCulled=false; chairs.castShadow=true; scene.add(chairs);
  const riderGeoA=(()=>{ const g=new THREE.BoxGeometry(.5,.8,.34); g.translate(0,-1.62,.0); return g; })();
  const riderTorso=new THREE.InstancedMesh(riderGeoA,new THREE.MeshStandardMaterial({roughness:.7}),CH_N*2); riderTorso.frustumCulled=false; scene.add(riderTorso);
  const riderHead=new THREE.InstancedMesh(new THREE.SphereGeometry(.17,10,8).translate(0,-1.0,0),new THREE.MeshStandardMaterial({roughness:.5}),CH_N*2); riderHead.frustumCulled=false; scene.add(riderHead);
  const JACK=[0xff3d6e,0x2f8bff,0xffc83a,0x16e08a,0xff7a1a,0xb04bff,0x22d3ee,0xf5f5f5,0xe11d48];
  const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(1,1,1), _e=new THREE.Euler(), _c=new THREE.Color();
  function updateChairs(t,ps){
    let n=0, nr=0; const win0=ps-110, win1=ps+230;
    [-1,1].forEach(line=>{ if(R.liftMode&&line>0) return; const dir=line<0?-1:1, off=((dir*CSPEED*t)%CHS+CHS)%CHS;
      for(let k=Math.floor((win0-off)/CHS); k*CHS+off<win1; k++){ const s=k*CHS+off; if(s<LS0+4||s>LEN+60||n>=CH_N) continue; const p=cablePoint(s,line), p2=cablePoint(s+1,line);
        const yaw=Math.atan2(p2.x-p.x,p2.z-p.z)+(line<0?PI:0); _e.set(Math.sin(t*1.3+k)*.05,yaw,Math.sin(t*.9+k*2)*.06,'YXZ'); _q.setFromEuler(_e); _p.set(p.x,p.y,p.z); _m.compose(_p,_q,_s); chairs.setMatrixAt(n,_m);
        const seats=line<0?(hash2(k,5)<.7?2:1):(hash2(k,9)<.25?1:0); for(let r=0;r<seats;r++){ const ox=(r?.55:-.55); _p.set(p.x,p.y-.0,p.z); const off3=new THREE.Vector3(ox,-.82,0).applyQuaternion(_q); _p.set(p.x+off3.x,p.y+off3.y+.9,p.z+off3.z); _m.compose(_p,_q,_s);
          riderTorso.setMatrixAt(nr,_m); riderTorso.setColorAt(nr,_c.setHex(JACK[(k*3+r*5+9000)%JACK.length])); riderHead.setMatrixAt(nr,_m); riderHead.setColorAt(nr,_c.setHex(hash2(k,r)<.5?0x22252e:0xe8b48a)); nr++; }
        n++; } });
    chairs.count=n; chairs.instanceMatrix.needsUpdate=true; riderTorso.count=nr; riderHead.count=nr; riderTorso.instanceMatrix.needsUpdate=true; riderHead.instanceMatrix.needsUpdate=true; if(riderTorso.instanceColor){ riderTorso.instanceColor.needsUpdate=true; riderHead.instanceColor.needsUpdate=true; }
  }

  /* ---------- ambient skiers and boarders ---------- */
  const NPC_N=64, npcs=[];
  const bodyG=(()=>{ const g=new THREE.BoxGeometry(.48,.74,.3); g.translate(0,1.12,0); return g; })();
  const legsG=(()=>{ const a=new THREE.BoxGeometry(.4,.72,.26); a.translate(0,.4,0); const h=new THREE.SphereGeometry(.15,10,8); h.translate(0,1.68,0); const sk=new THREE.BoxGeometry(.5,.05,1.4); sk.translate(0,.03,0);
    const parts=[a,h,sk], cols=[[.12,.14,.2],[.9,.85,.1],[.1,.1,.12]]; let np=0,ni=0; parts.forEach(g=>{ np+=g.attributes.position.count; ni+=g.index.count; }); const pos=new Float32Array(np*3),nor=new Float32Array(np*3),col=new Float32Array(np*3),idx=new Uint32Array(ni); let po=0,io=0;
    parts.forEach((g,pi)=>{ pos.set(g.attributes.position.array,po*3); nor.set(g.attributes.normal.array,po*3); for(let i=0;i<g.attributes.position.count;i++) col.set(cols[pi],(po+i)*3); for(let i=0;i<g.index.count;i++) idx[io+i]=g.index.array[i]+po; io+=g.index.count; po+=g.attributes.position.count; });
    const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('color',new THREE.BufferAttribute(col,3)); m.setIndex(new THREE.BufferAttribute(idx,1)); return m; })();
  const npcBody=new THREE.InstancedMesh(bodyG,new THREE.MeshStandardMaterial({roughness:.7}),NPC_N), npcLegs=new THREE.InstancedMesh(legsG,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7}),NPC_N);
  [npcBody,npcLegs].forEach(m=>{ m.frustumCulled=false; m.castShadow=true; scene.add(m); });
  function npcInit(){ npcs.length=0; for(let i=0;i<NPC_N;i++){ const side=hash2(i,1)<.5?-1:1; npcs.push({s0:hash2(i,2)*(LEN+80),u:side*(.45+hash2(i,3)*.45),v:6+hash2(i,4)*7,c:JACK[i%JACK.length],ph:hash2(i,6)*6.28}); } }
  const _tmpN=new THREE.Vector3();
  function updateNPCs(t,ps){ let n=0; const W=ST.World, span=LEN+90;
    for(let i=0;i<NPC_N;i++){ const a=npcs[i]; if(!a) continue; const s=((a.s0+a.v*t)%span+span)%span-20; if(s<ps-60||s>ps+210||s<0||s>LEN+10||n>=NPC_N) continue;
      const w=hw(s), x=W.cx(s)+a.u*w, z=-s, y=W.groundY(x,z), x2=W.cx(s+2)+a.u*hw(s+2), yaw=-Math.atan2(x2-x,2);
      _e.set(0,yaw,Math.sin(t*1.5+a.ph)*.18,'YXZ'); _q.setFromEuler(_e); _p.set(x,y,z); _s.set(1,.92+Math.sin(t*2+a.ph)*.05,1); _m.compose(_p,_q,_s); npcBody.setMatrixAt(n,_m); npcBody.setColorAt(n,_c.setHex(a.c)); npcLegs.setMatrixAt(n,_m); n++; }
    _s.set(1,1,1); npcBody.count=n; npcLegs.count=n; npcBody.instanceMatrix.needsUpdate=true; npcLegs.instanceMatrix.needsUpdate=true; if(npcBody.instanceColor) npcBody.instanceColor.needsUpdate=true; }

  /* ---------- per-frame ---------- */
  R.update=function(t,ps){ if(!T) return; updateChairs(t,ps); updateNPCs(t,ps);
    for(const k in chunkPlumes){ if(k==='smoke') continue; const arr=chunkPlumes[k]; for(let j=0;j<arr.length;j++){ const sp=arr[j], u=sp.userData, ph=((t*.55+u.i/4)%1); const up=ph*7+1, out=ph*(7+u.i); sp.position.set(u.bx+u.side*-out*.9,u.by+up,u.bz+Math.sin(t+u.i)*.6); const sc=4+ph*11; sp.scale.set(sc,sc,1); sp.material.opacity=.5*(1-ph)*(ph<.1?ph*10:1); } }
  };
  const playerChair=new THREE.Mesh(chairGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.2})); playerChair.castShadow=true; playerChair.visible=false; scene.add(playerChair); R.playerChair=playerChair; R.liftSide=()=>liftSide;
  ST.Resort=R;
})(window.ST);
