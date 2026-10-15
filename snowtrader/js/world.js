/* Snow Trader: the mountain. A track is a function of distance s (forward = -Z): a centre line, a width, a fall and
   a row of kickers, all closed-form, so the ground can be asked for anywhere (physics) and meshed in chunks (render). */
(function(ST){
  const {clamp,lerp,smooth,hash2,vnoise}=ST;
  const {scene,renderer,camera,sun,hemi}=ST;

  ST.TRACKS=[
    {id:'bull',name:'עמק הבול',en:'BULL VALLEY',blurb:'שקיעה, מדרון נעים וכסף קל',len:1500,slope:.30,halfW:21,bend:[30,11],rampStart:130,rampEvery:112,rampH:[3.9,5.9],redRate:.30,goals:[2500,6000],par:70,
      sky:{zen:0x1d2a78,mid:0xb8509a,hor:0xffa860,sun:0xffd2a2,sunDir:[-.42,.17,-.89],fog:0xe8a9a0,fogNear:55,fogFar:340,snow:0xfaf4ff,hemiS:0x9fb4ff,hemiG:0xd8d2e8,hemiI:.95,sunI:2.0,exp:1.0,stars:0,mount:[0xf2d9e8,0x7e5c8a],neon:0}},
    {id:'bear',name:'קניון הדוב',en:'BEAR CANYON',blurb:'שעת כחול, קניון צר, נרות אדומים',len:1900,slope:.34,halfW:17,bend:[44,15],rampStart:120,rampEvery:98,rampH:[4.3,6.4],redRate:.46,goals:[4500,10500],par:80,
      sky:{zen:0x070f2e,mid:0x2a4f93,hor:0x9ec4f0,sun:0xb8d4ff,sunDir:[.5,.2,-.84],fog:0x8fb2dc,fogNear:40,fogFar:300,snow:0xeaf3ff,hemiS:0x8fb4ff,hemiG:0xcfe0ff,hemiI:.7,sunI:2.0,exp:1.05,stars:.5,mount:[0xdfeaff,0x37507f],neon:0}},
    {id:'ipo',name:'פסגת ה‑IPO',en:'IPO SUMMIT',blurb:'לילה, ניאון וקפיצות ענק',len:2300,slope:.38,halfW:18,bend:[50,18],rampStart:110,rampEvery:90,rampH:[4.8,7.2],redRate:.5,goals:[8000,19000],par:92,
      sky:{zen:0x030014,mid:0x2b0c5e,hor:0xff2f92,sun:0xff6ad5,sunDir:[-.3,.3,-.9],fog:0x35145f,fogNear:35,fogFar:290,snow:0xcfd0ff,hemiS:0x6a5cff,hemiG:0xff3da0,hemiI:.85,sunI:1.5,exp:1.1,stars:1,mount:[0x7d5cff,0x180a3a],neon:1}}
  ];

  const L=48, U=64, NU=65, NS=49;           // chunk length (m), half width, columns, rows
  let T=ST.TRACKS[0], cx0=0;
  const S=z=>-z;                              // forward distance from a world z

  const cxRaw=s=>T.bend[0]*Math.sin(s*.0063)+T.bend[1]*Math.sin(s*.0151+2);
  const cx=s=>cxRaw(s)-cx0;
  const dcx=s=>T.bend[0]*.0063*Math.cos(s*.0063)+T.bend[1]*.0151*Math.cos(s*.0151+2);
  const halfW=s=>T.halfW+3.5*Math.sin(s*.011+1);
  const fall=s=>-(T.slope*s)+4.5*Math.sin(s*.021)+2.2*Math.sin(s*.057+1.3);
  const rampAt=k=>({s:T.rampStart+k*T.rampEvery+(hash2(k,11)-.5)*26, u:(hash2(k,23)-.5)*halfW(T.rampStart+k*T.rampEvery)*.9,
    h:lerp(T.rampH[0],T.rampH[1],hash2(k,37)), w:4.6+hash2(k,41)*1.8});
  const RL=11;                                // kicker length
  function rampProfile(d,h){ if(d<0) return 0; if(d<RL) return h*Math.pow(d/RL,1.45); if(d<RL+1.9) return h*(1-smooth(RL,RL+1.9,d)); return 0; }
  function rampH(u,s){
    const k0=Math.round((s-T.rampStart)/T.rampEvery); let y=0;
    for(let k=k0-1;k<=k0+1;k++){ if(k<0) continue; const r=rampAt(k), d=s-r.s; if(d<-1||d>RL+3) continue;
      y+=rampProfile(d,r.h)*(1-smooth(r.w-1.5,r.w+1.5,Math.abs(u-r.u))); }
    return y;
  }
  function groundY(x,z){
    const s=S(z), c=cx(s), u=x-c, w=halfW(s), a=Math.abs(u)-w;
    let y=fall(s);
    if(a>0) y+=a*a*.05+a*.18;
    y+=vnoise(x*.02,z*.02)*(a>0?3.2:1.5)+vnoise(x*.1,z*.1)*(a>0?.5:.16);
    return y+rampH(u,s);
  }
  const _n=new THREE.Vector3();
  function groundN(x,z,out){ const e=.6, hx=groundY(x+e,z)-groundY(x-e,z), hz=groundY(x,z+e)-groundY(x,z-e); out=out||_n; return out.set(-hx,2*e,-hz).normalize(); }

  /* ---------- shared materials ---------- */
  function snowNormalMap(){
    const N=256,c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d'), im=g.createImageData(N,N), h=new Float32Array(N*N);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ let v=0,a=.5,f=8; for(let o=0;o<4;o++){ v+=a*vnoise((x/N)*f%f+o*7.1,(y/N)*f+o*3.3)*0+a*tile(x/N*f,y/N*f,f,o); a*=.5; f*=2; } h[y*N+x]=v; }
    function tile(x,y,p,o){ const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,m=v=>((v%p)+p)%p; const a=hash2(m(xi)+o*91,m(yi)),b=hash2(m(xi+1)+o*91,m(yi)),c2=hash2(m(xi)+o*91,m(yi+1)),d=hash2(m(xi+1)+o*91,m(yi+1)); const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf); return (a+(b-a)*u+(c2-a)*v+(a-b-c2+d)*u*v)*2-1; }
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const dx=h[y*N+(x+1)%N]-h[y*N+(x+N-1)%N], dy=h[((y+1)%N)*N+x]-h[((y+N-1)%N)*N+x], i=(y*N+x)*4;
      im.data[i]=clamp(128-dx*220,0,255); im.data[i+1]=clamp(128-dy*220,0,255); im.data[i+2]=235; im.data[i+3]=255; }
    g.putImageData(im,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=renderer.capabilities.getMaxAnisotropy(); return t;
  }
  const SNOW_UNI={uSparkle:{value:1}};
  function snowPatch(sh){
    Object.assign(sh.uniforms,SNOW_UNI);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\n vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP; uniform float uSparkle;
      float sh1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }`)
      .replace('vec3 outgoingLight =',`{
        vec2 cell=floor(vWP.xz*34.0); float k=sh1(cell);
        vec3 vd=normalize(cameraPosition-vWP);
        float ph=dot(vd,vec3(sh1(cell+3.1)-.5,.35,sh1(cell+7.7)-.5))*95.0+k*60.0;
        float gl=step(.972,k)*pow(max(sin(ph),0.0),22.0);
        reflectedLight.directSpecular+=vec3(gl*1.6*uSparkle);
      }
      vec3 outgoingLight =`);
  }
  const normalMap=snowNormalMap();
  const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0,normalMap,normalScale:new THREE.Vector2(.55,.55),envMapIntensity:.7});
  terrainMat.onBeforeCompile=snowPatch;

  function mergeGeos(list){
    let np=0,ni=0; list.forEach(g=>{ np+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count; });
    const pos=new Float32Array(np*3),nor=new Float32Array(np*3),col=new Float32Array(np*3),idx=new Uint32Array(ni); let po=0,io=0;
    list.forEach(g=>{ const p=g.attributes.position, n=g.attributes.normal, c=g.attributes.color, cnt=p.count;
      pos.set(p.array,po*3); nor.set(n.array,po*3); if(c) col.set(c.array,po*3); else col.fill(1,po*3,(po+cnt)*3);
      if(g.index){ for(let i=0;i<g.index.count;i++) idx[io+i]=g.index.array[i]+po; io+=g.index.count; } else { for(let i=0;i<cnt;i++) idx[io+i]=po+i; io+=cnt; }
      po+=cnt; });
    const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('color',new THREE.BufferAttribute(col,3)); m.setIndex(new THREE.BufferAttribute(idx,1)); return m;
  }
  function paint(g,fn){ const p=g.attributes.position, c=new Float32Array(p.count*3), col=new THREE.Color(); for(let i=0;i<p.count;i++){ fn(p.getX(i),p.getY(i),p.getZ(i),col,i); c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; } g.setAttribute('color',new THREE.BufferAttribute(c,3)); return g; }

  /* pine: trunk + three snow-dusted tiers, one merged geometry, instanced per chunk */
  function pineGeo(){
    const parts=[], trunk=new THREE.CylinderGeometry(.22,.34,2.2,7); trunk.translate(0,1.1,0); paint(trunk,(x,y,z,c)=>c.setRGB(.2,.12,.08)); parts.push(trunk);
    [[3.3,5.4,1.8],[2.7,4.8,4.0],[1.9,4.0,6.0]].forEach(([r,h,y0],i)=>{
      const g=new THREE.ConeGeometry(r,h,9,3); g.translate(0,y0+h/2,0);
      paint(g,(x,y,z,c)=>{ const t=(y-y0)/h, n=hash2(Math.round(x*9),Math.round(z*9))*.12; const snow=smooth(.38,.78,t+Math.hypot(x,z)/r*-.25+n);
        c.setRGB(.05+n*.5,.2+n,.14+n*.6).lerp(new THREE.Color(.92,.95,1),snow*.85); }); parts.push(g); });
    return mergeGeos(parts);
  }
  function rockGeo(){ const g=new THREE.IcosahedronGeometry(1,1); const p=g.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i),y=p.getY(i),z=p.getZ(i), k=1+hash2(Math.round(x*7),Math.round(z*7+y*3))*.45; p.setXYZ(i,x*k*1.25,y*k*.8,z*k); }
    g.computeVertexNormals(); return paint(g,(x,y,z,c)=>{ const s=smooth(.15,.65,y); c.setRGB(.26,.25,.3).lerp(new THREE.Color(.93,.95,1),s*.9); }); }
  const GEO={pine:pineGeo(),rock:rockGeo()};
  const MATS={tree:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}),
    coin:new THREE.MeshStandardMaterial({color:0xffc83a,metalness:.9,roughness:.25,emissive:0xff9d00,emissiveIntensity:.9}),
    green:new THREE.MeshStandardMaterial({color:0x13d672,roughness:.35,metalness:.1,emissive:0x07ff7d,emissiveIntensity:1.5}),
    red:new THREE.MeshStandardMaterial({color:0xe3243f,roughness:.35,metalness:.1,emissive:0xff1c3c,emissiveIntensity:1.5}),
    wickG:new THREE.MeshBasicMaterial({color:0xb8ffd8}), wickR:new THREE.MeshBasicMaterial({color:0xffc2cb}),
    metal:new THREE.MeshStandardMaterial({color:0x2a2f3a,metalness:.7,roughness:.35})};
  const coinGeo=new THREE.CylinderGeometry(.62,.62,.14,24); coinGeo.rotateZ(Math.PI/2);
  const candleGeoCache={};
  function candleGeo(h){ const k=Math.round(h*4); if(candleGeoCache[k]) return candleGeoCache[k]; const b=new THREE.BoxGeometry(1.15,h,1.15); b.translate(0,h/2,0);
    const w=new THREE.BoxGeometry(.12,h+2.2,.12); w.translate(0,(h+2.2)/2-1.1,0); return candleGeoCache[k]={b,w}; }

  /* billboards: glowing ticker panels */
  const BB=[]; function makeBoards(){
    const syms=['BTC','ETH','TSLA','NVDA','AAPL','GOLD','OIL','SPX'];
    for(let i=0;i<6;i++){ const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d'); const up=i%3!==2;
      const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#0a0f1f'); gr.addColorStop(1,up?'#052a1c':'#2a0712'); g.fillStyle=gr; g.fillRect(0,0,512,256);
      g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=1; for(let y=0;y<256;y+=32){ g.beginPath(); g.moveTo(0,y); g.lineTo(512,y); g.stroke(); }
      let y=170; for(let x=170;x<500;x+=16){ const o=y, d=(hash2(i*13+x,5)-(up?.38:.62))*22; y=clamp(y+d,40,215); const col=d>=0?'#18e27a':'#ff3b57'; g.strokeStyle=col; g.fillStyle=col; g.beginPath(); g.moveTo(x+5,Math.min(o,y)-8); g.lineTo(x+5,Math.max(o,y)+8); g.stroke(); g.fillRect(x,Math.min(o,y),10,Math.max(4,Math.abs(y-o))); }
      g.fillStyle='#fff'; g.font='900 56px "Arial Black",Impact,sans-serif'; g.textAlign='left'; g.fillText(syms[(i*3)%8],18,72);
      g.fillStyle=up?'#18e27a':'#ff3b57'; g.font='900 40px "Arial Black",sans-serif'; g.fillText((up?'▲ +':'▼ −')+(1+hash2(i,2)*7).toFixed(2)+'%',18,124);
      g.strokeStyle=up?'#18e27a':'#ff3b57'; g.lineWidth=6; g.strokeRect(3,3,506,250);
      const t=new THREE.CanvasTexture(c); t.anisotropy=4; t.encoding=THREE.sRGBEncoding; BB.push(t); }
  }
  makeBoards();
  function bannerTex(l1,l2){ const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,1024,0); gr.addColorStop(0,'#ff3d8b'); gr.addColorStop(.5,'#ffb020'); gr.addColorStop(1,'#16e08a'); g.fillStyle=gr; g.fillRect(0,0,1024,256);
    g.fillStyle='rgba(0,0,0,.78)'; g.fillRect(14,14,996,228); g.textAlign='center'; g.fillStyle='#fff'; g.font='900 104px "Arial Black",Impact,sans-serif'; g.fillText(l1,512,128);
    g.fillStyle='#ffd24a'; g.font='800 52px "Arial Black",sans-serif'; g.fillText(l2,512,206); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }

  /* ---------- chunks ---------- */
  const chunks=new Map();                     // index -> {group,items,idx}
  const world=new THREE.Group(); scene.add(world);
  const ctx={snow:new THREE.Color()};

  function buildChunk(ci){
    const grp=new THREE.Group(), items=[], s0=ci*L;
    // terrain
    const pos=new Float32Array(NU*NS*3), col=new Float32Array(NU*NS*3), uv=new Float32Array(NU*NS*2), nor=new Float32Array(NU*NS*3);
    const snow=ctx.snow, cA=new THREE.Color(), cR=new THREE.Color(0x4a4655), n=new THREE.Vector3();
    for(let j=0;j<NS;j++){ const s=s0+j*(L/(NS-1)); const c=cx(s);
      for(let i=0;i<NU;i++){ const u=-U+i*(2*U/(NU-1)), x=c+u, z=-s, y=groundY(x,z), o=j*NU+i;
        pos[o*3]=x; pos[o*3+1]=y; pos[o*3+2]=z; uv[o*2]=x/9; uv[o*2+1]=z/9;
        groundN(x,z,n); const a=Math.abs(u)-halfW(s), steep=smooth(.62,.86,1-n.y), nz=vnoise(x*.05,z*.05)*.04;
        cA.copy(snow).multiplyScalar(.93+nz+n.y*.07); cA.lerp(cR,steep*.75);
        if(a>0) cA.multiplyScalar(1-smooth(0,26,a)*.16);
        col[o*3]=cA.r; col[o*3+1]=cA.g; col[o*3+2]=cA.b; nor[o*3]=n.x; nor[o*3+1]=n.y; nor[o*3+2]=n.z; } }
    const idx=new Uint32Array((NU-1)*(NS-1)*6); let k=0;
    for(let j=0;j<NS-1;j++) for(let i=0;i<NU-1;i++){ const a=j*NU+i,b=a+1,c=a+NU,d=c+1; idx[k++]=a; idx[k++]=b; idx[k++]=c; idx[k++]=b; idx[k++]=d; idx[k++]=c; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(new THREE.BufferAttribute(idx,1));
    g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,terrainMat); mesh.receiveShadow=true; grp.add(mesh);

    // trees + rocks (instanced)
    const trees=[], rocks=[];
    for(let n2=0;n2<150;n2++){ const s=s0+hash2(ci,n2*3+1)*L, w=halfW(s), side=hash2(ci,n2*3+2)<.5?-1:1, off=w+6+Math.pow(hash2(ci,n2*3+3),1.4)*(U-w-9), u=side*off;
      const dense=1-smooth(0,28,off-w); if(hash2(ci*7,n2)>.25+dense*.7*0+ (off<w+14?.5:.35)) continue;
      const x=cx(s)+u, z=-s, y=groundY(x,z); trees.push({x,y:y-.2,z,sc:.5+hash2(ci,n2+500)*.7+(off>w+18?.35:0),r:hash2(ci,n2+900)*6.28}); }
    for(let n2=0;n2<9;n2++){ const s=s0+hash2(ci,n2*5+700)*L, w=halfW(s), side=hash2(ci,n2*5+701)<.5?-1:1, u=side*(w*.8+hash2(ci,n2*5+702)*14);
      const x=cx(s)+u, z=-s; rocks.push({x,y:groundY(x,z)-.15,z,sc:.9+hash2(ci,n2+333)*1.8,r:hash2(ci,n2+444)*6.28}); }
    const dummy=new THREE.Object3D();
    if(trees.length){ const im=new THREE.InstancedMesh(GEO.pine,MATS.tree,trees.length); trees.forEach((t,i)=>{ dummy.position.set(t.x,t.y,t.z); dummy.rotation.set(0,t.r,0); dummy.scale.set(t.sc,t.sc*(.9+hash2(i,ci)*.4),t.sc); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); });
      im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; grp.add(im); trees.forEach(t=>{ if(Math.abs(t.x-cx(-t.z))<halfW(-t.z)+7) items.push({type:'tree',x:t.x,z:t.z,y:t.y,r:.8*t.sc}); }); }
    if(rocks.length){ const im=new THREE.InstancedMesh(GEO.rock,MATS.tree,rocks.length); rocks.forEach((t,i)=>{ dummy.position.set(t.x,t.y,t.z); dummy.rotation.set(0,t.r,0); dummy.scale.setScalar(t.sc); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); });
      im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; grp.add(im); rocks.forEach(t=>{ if(Math.abs(t.x-cx(-t.z))<halfW(-t.z)+2) items.push({type:'rock',x:t.x,z:t.z,y:t.y,r:1.1*t.sc}); }); }

    // pickups and hazards: one pattern per 24 m cell
    const cellL=24, c0=Math.floor(s0/cellL);
    for(let cc=c0;cc<c0+L/cellL;cc++){ const s=cc*cellL; if(s<70||s>T.len-40) continue;
      let near=false; const k0=Math.round((s-T.rampStart)/T.rampEvery); for(let kk=k0-1;kk<=k0+1;kk++){ if(kk<0) continue; const r=rampAt(kk); if(s>r.s-26&&s<r.s+50) near=true; }
      const w=halfW(s), roll=hash2(cc,77); if(near) continue;
      const put=(type,sOff,u,extra)=>{ const ss=s+sOff, x=cx(ss)+clamp(u,-w+2.2,w-2.2), z=-ss; items.push(Object.assign({type,x,z,y:groundY(x,z)},extra||{})); };
      if(roll<.20){ const ph=hash2(cc,5)*6.28; for(let i=0;i<8;i++) put('coin',i*2.6,Math.sin(ph+i*.55)*w*.45,{air:.9}); }
      else if(roll<.38){ const u0=(hash2(cc,6)-.5)*w*1.0; for(let i=0;i<3;i++) put('green',i*6,u0+(i-1)*3.4,{h:2.2+i*1.3+hash2(cc,i)*.6}); }
      else if(roll<.38+T.redRate*.32){ const u0=(hash2(cc,9)-.5)*w*.7; put('red',0,u0-4.5,{h:2.6+hash2(cc,1)*2}); put('red',9,u0+4.5,{h:2.6+hash2(cc,2)*2}); if(hash2(cc,3)>.5) put('red',17,u0-.5,{h:2+hash2(cc,4)*2}); }
      else if(roll<.80){ const u0=(hash2(cc,13)>.5?1:-1)*w*.55; put('rockhaz',2,u0,{r:1.5}); if(hash2(cc,14)>.5) put('coin',-2,-u0*.4,{air:.9}); if(hash2(cc,15)>.55) put('coin',3,-u0*.4,{air:.9}); }
    }
    // coins floating over every kicker (the line a clean jump flies)
    { const k0=Math.floor((s0-T.rampStart)/T.rampEvery)-1; for(let kk=Math.max(0,k0);kk<=k0+3;kk++){ const r=rampAt(kk); if(r.s+RL<s0||r.s+RL>=s0+L) continue;
        for(let i=0;i<7;i++){ const ss=r.s+RL+3+i*4.2, x=cx(ss)+r.u, z=-ss, tt=i/6; items.push({type:'coin',x,z,y:groundY(x,z),air:2.6+Math.sin(tt*Math.PI)*3.6,big:true}); } } }
    // gates and boards
    if(s0<=10&&s0+L>10){ addArch(grp,10,'SNOW TRADER','פתיחת המסחר · יאללה לרדת'); }
    if(s0<=T.len&&s0+L>T.len){ addArch(grp,T.len,'FINISH','סגירת פוזיציה · לקחת רווח'); items.push({type:'finish',x:cx(T.len),z:-T.len,y:groundY(cx(T.len),-T.len),r:30}); }
    for(let bs=Math.ceil((s0-60)/170)*170+90; bs<s0+L+60; bs+=170){ if(bs<s0||bs>=s0+L||bs>T.len) continue; const side=Math.floor(bs/170)%2?1:-1, u=side*(halfW(bs)+4.5), x=cx(bs)+u, z=-bs, y=groundY(x,z);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(14,7),new THREE.MeshBasicMaterial({map:BB[Math.floor(bs/170)%BB.length],toneMapped:false}));
      const post=new THREE.Mesh(new THREE.BoxGeometry(.5,9,.5),MATS.metal); const pg=new THREE.Group(); pg.position.set(x,y,z); post.position.set(0,4,-.4); m.position.set(0,8.4,0); pg.lookAt(cx(bs),y+8.4,-bs); pg.rotation.set(0,pg.rotation.y,0); pg.add(post,m); const post2=post.clone(); post2.position.x=4.5; const post3=post.clone(); post3.position.x=-4.5; pg.add(post2,post3); grp.add(pg); }
    // item meshes
    items.forEach(it=>{
      if(it.type==='coin'){ const m=new THREE.Mesh(coinGeo,MATS.coin); it.y+=it.air||1; m.position.set(it.x,it.y,it.z); m.scale.setScalar(it.big?1.7:1.35); m.castShadow=true; it.mesh=m; it.r=1.7; grp.add(m); }
      else if(it.type==='green'||it.type==='red'){ const G=candleGeo(it.h), gm=new THREE.Group(); const b=new THREE.Mesh(G.b,it.type==='green'?MATS.green:MATS.red), w=new THREE.Mesh(G.w,it.type==='green'?MATS.wickG:MATS.wickR); b.castShadow=true; gm.add(b,w); gm.position.set(it.x,it.y,it.z); it.mesh=gm; it.r=it.type==='green'?2.1:1.35; grp.add(gm);
        const bm=it.type==='green'?MATS.green:MATS.red; } 
      else if(it.type==='rockhaz'){ const m=new THREE.Mesh(GEO.rock,MATS.tree); m.position.set(it.x,it.y-.1,it.z); m.scale.setScalar(it.r*1.1); m.rotation.y=hash2(it.x|0,it.z|0)*6; m.castShadow=true; grp.add(m); }
    });
    world.add(grp); return {group:grp,items,geo:g,idx:ci};
  }
  function addArch(grp,s,l1,l2){ const w=halfW(s)+2, x=cx(s), z=-s, y=groundY(x,z), tex=bannerTex(l1,l2);
    [-1,1].forEach(sd=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(1,15,1),MATS.metal); p.position.set(x+sd*w,groundY(x+sd*w,z)+7,z); p.castShadow=true; grp.add(p); });
    const bw=Math.min(w*2,24), b=new THREE.Mesh(new THREE.PlaneGeometry(bw,bw/4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false})); b.position.set(x,y+11.2,z); grp.add(b);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(w*2+1,.6,.8),MATS.metal); bar.position.set(x,y+13.1,z); grp.add(bar); }
  function disposeChunk(c){ world.remove(c.group); c.group.traverse(o=>{ if(o===c.group) return; if(o.geometry&&o.geometry===c.geo) o.geometry.dispose(); }); }

  let lastCi=null;
  function update(playerS,force){
    const ci=Math.floor(playerS/L); if(!force&&ci===lastCi) return; lastCi=ci;
    const want=new Set(); for(let i=ci-1;i<=ci+7;i++){ if(i<0||i*L>T.len+160) continue; want.add(i); }
    want.forEach(i=>{ if(!chunks.has(i)) chunks.set(i,buildChunk(i)); });
    chunks.forEach((c,i)=>{ if(!want.has(i)){ disposeChunk(c); chunks.delete(i); } });
  }
  function nearItems(s,fn){ const ci=Math.floor(s/L); for(let i=ci-1;i<=ci+1;i++){ const c=chunks.get(i); if(c) c.items.forEach(fn); } }
  function reset(){ chunks.forEach(disposeChunk); chunks.clear(); lastCi=null; }

  /* ---------- sky, mountains, weather ---------- */
  const sky=new THREE.Mesh(new THREE.SphereGeometry(700,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{zen:{value:new THREE.Color()},mid:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunC:{value:new THREE.Color()},sunD:{value:new THREE.Vector3(0,.2,-1)},stars:{value:0},fogC:{value:new THREE.Color()},time:{value:0}},
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform vec3 zen,mid,hor,sunC,sunD,fogC; uniform float stars,time; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h3(vec3(i,1.)),h3(vec3(i+vec2(1,0),1.)),f.x),mix(h3(vec3(i+vec2(0,1),1.)),h3(vec3(i+vec2(1,1),1.)),f.x),f.y); }
      void main(){
        vec3 d=normalize(vD); float y=d.y;
        vec3 c=mix(hor,mid,smoothstep(0.0,.28,y)); c=mix(c,zen,smoothstep(.18,.85,y));
        c=mix(fogC,c,smoothstep(-.12,.03,y));
        float sd=max(dot(d,normalize(sunD)),0.);
        c+=sunC*(pow(sd,900.)*9.+pow(sd,60.)*.55+pow(sd,6.)*.28);
        if(y>0.){ vec2 p=d.xz/(y+.35)*2.4; float cl=n2(p*1.1+time*.01)*.6+n2(p*2.7)*.3+n2(p*6.)*.1; cl=smoothstep(.52,.86,cl)*smoothstep(0.,.25,y)*(1.-smoothstep(.55,.95,y));
          c=mix(c,mix(hor,sunC,.55)*1.25,cl*.5); }
        if(stars>0.&&y>0.02){ vec3 g=floor(d*260.); float s=step(.9965,h3(g)); c+=vec3(s)*stars*smoothstep(.02,.3,y)*(.6+.4*h3(g+1.)); }
        gl_FragColor=vec4(c,1.);
      }`}));
  sky.renderOrder=-10; sky.frustumCulled=false; scene.add(sky);

  const mount=new THREE.Group(); scene.add(mount);
  function buildMountains(palette,sunDir,fogC){
    while(mount.children.length){ const o=mount.children.pop(); o.geometry.dispose(); o.material.dispose(); }
    const sunV=new THREE.Vector3(...sunDir).normalize(), lo=new THREE.Color(palette[1]), hi=new THREE.Color(palette[0]), fc=new THREE.Color(fogC);
    [[820,330,0.5,11],[600,190,0.4,23]].forEach(([R,H,sn,seed],layer)=>{
      const N=240, M=14, pos=[], cols=[], idx=[]; 
      for(let i=0;i<=N;i++){ const a=i/N*Math.PI*2; const ridge=(Math.abs(vnoise(Math.cos(a)*2.2+seed,Math.sin(a)*2.2))*.7+Math.abs(vnoise(Math.cos(a)*6.5+seed,Math.sin(a)*6.5))*.3);
        const hh=H*(.28+ridge*.9);
        for(let j=0;j<=M;j++){ const t=j/M, r=R-t*30, y=-80+t*(hh+80); pos.push(Math.cos(a)*r,y,Math.sin(a)*r); } }
      for(let i=0;i<N;i++) for(let j=0;j<M;j++){ const a=i*(M+1)+j,b=a+1,c=a+(M+1),d=c+1; idx.push(a,c,b,b,c,d); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
      const p=g.attributes.position, nr=g.attributes.normal, col=new Float32Array(p.count*3), cc=new THREE.Color();
      for(let i=0;i<p.count;i++){ const y=p.getY(i), snow=smooth(H*.32,H*.62,y+hash2(i%97,3)*20), sh=clamp(.55+.55*(nr.getX(i)*sunV.x+nr.getY(i)*sunV.y+nr.getZ(i)*sunV.z),.3,1.15);
        cc.copy(lo).lerp(hi,snow).multiplyScalar(sh); const haze=smooth(.4,0,(y+80)/(H*1.4))*0+ (layer===0?.45:.2); cc.lerp(fc,haze+smooth(60,-60,y)*.7); col[i*3]=cc.r; col[i*3+1]=cc.g; col[i*3+2]=cc.b; }
      g.setAttribute('color',new THREE.BufferAttribute(col,3));
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,toneMapped:true})); m.frustumCulled=false; mount.add(m); });
  }

  /* falling snow: a box of flakes that wraps around the camera */
  const FL=1400, flakePos=new Float32Array(FL*3), flakeSeed=new Float32Array(FL*3);
  for(let i=0;i<FL;i++){ flakeSeed[i*3]=Math.random(); flakeSeed[i*3+1]=Math.random(); flakeSeed[i*3+2]=Math.random(); }
  const flakeGeo=new THREE.BufferGeometry(); flakeGeo.setAttribute('position',new THREE.BufferAttribute(flakePos,3));
  const flakeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{col:{value:new THREE.Color(1,1,1)},px:{value:1},alpha:{value:.85}},
    vertexShader:'uniform float px; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; float d=-mv.z; gl_PointSize=clamp(px*5.5/d*6.0,1.0,9.0); vA=smoothstep(60.,8.,d); }',
    fragmentShader:'uniform vec3 col; uniform float alpha; varying float vA; void main(){ vec2 q=gl_PointCoord-.5; float a=smoothstep(.5,.1,length(q)); gl_FragColor=vec4(col,a*vA*alpha); }'});
  const flakes=new THREE.Points(flakeGeo,flakeMat); flakes.frustumCulled=false; scene.add(flakes);
  const BOX=[70,38,70];
  function updateFlakes(t,center,vel){
    for(let i=0;i<FL;i++){ const sx=flakeSeed[i*3],sy=flakeSeed[i*3+1],sz=flakeSeed[i*3+2];
      let x=sx*BOX[0]+Math.sin(t*.6+sz*20)*1.2-t*(1.5+sz)-vel.x*t*.0, y=sy*BOX[1]-t*(1.7+sy*1.3), z=sz*BOX[2]+t*.9;
      const mx=((x-center.x+BOX[0]/2)%BOX[0]+BOX[0])%BOX[0]-BOX[0]/2, my=((y-center.y+BOX[1]/2)%BOX[1]+BOX[1])%BOX[1]-BOX[1]/2, mz=((z-center.z+BOX[2]/2)%BOX[2]+BOX[2])%BOX[2]-BOX[2]/2;
      flakePos[i*3]=center.x+mx; flakePos[i*3+1]=center.y+my+4; flakePos[i*3+2]=center.z+mz; }
    flakeGeo.attributes.position.needsUpdate=true; }

  function setTrack(tr){
    T=tr; cx0=0; cx0=cxRaw(0); const k=T.sky;
    ctx.snow.set(k.snow); ctx.snow.convertSRGBToLinear();
    const u=sky.material.uniforms; u.zen.value.set(k.zen); u.mid.value.set(k.mid); u.hor.value.set(k.hor); u.sunC.value.set(k.sun); u.sunD.value.set(...k.sunDir); u.stars.value=k.stars; u.fogC.value.set(k.fog);
    [u.zen,u.mid,u.hor,u.sunC,u.fogC].forEach(c=>c.value.convertSRGBToLinear());
    scene.fog=new THREE.Fog(k.fog,k.fogNear,k.fogFar); scene.fog.color.convertSRGBToLinear(); scene.background=null;
    hemi.color.set(k.hemiS); hemi.groundColor.set(k.hemiG); hemi.intensity=k.hemiI; sun.color.set(k.sun); sun.intensity=k.sunI; ST.renderer.toneMappingExposure=k.exp;
    ST.bloomStrength=k.neon?.8:.5; if(ST.GFX.bloom) ST.GFX.bloom.strength=ST.bloomStrength;
    SNOW_UNI.uSparkle.value=k.neon?.7:1; MATS.coin.emissiveIntensity=k.neon?1.4:.9;
    buildMountains(k.mount,k.sunDir,k.fog);
    reset();
  }
  function follow(p,t){ sky.position.copy(camera.position); sky.material.uniforms.time.value=t; mount.position.set(camera.position.x,p.y-30,camera.position.z);
    const sd=T.sky.sunDir; sun.position.set(p.x-sd[0]*0+sd[0]*120,p.y+sd[1]*120+30,p.z+sd[2]*120); sun.target.position.set(p.x,p.y,p.z); sun.target.updateMatrixWorld(); }

  ST.World={get T(){return T;},groundY,groundN,cx,dcx,halfW,fall,update,nearItems,setTrack,follow,updateFlakes,rampAt,L,RL,flakes,reset,rampProfile};
})(window.ST);
