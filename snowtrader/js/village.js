/* Snow Rush: the village at the bottom of every run. The run eases out past the finish line onto a valley floor (the slope
   is blended, not the height, so the run-out never kicks back uphill), the valley widens to ~92 m between wooded banks and
   closes with a hill behind the church. On the floor: a square with a Christmas tree and a market, the bottom terminal of the
   chairlift, a main street of hotels, shops and chalets, and a church at its end. Everything is built once per track and
   merged into a few meshes per material (one draw per material per quarter of the village).
   Coordinates are the run's own: d = metres past the finish line (s - len), u = metres across (World.cx(s) is u=0). */
(function(ST){
  const {clamp,lerp,smooth,hash2}=ST; const {scene}=ST;
  const PI=Math.PI;
  const V={T:null,L:0,ls:1,group:null,key:'',night:0,blds:[],lamps:[],terminal:null,square:null};
  V.VW=46;                              // half-width of the valley floor
  V.blds=[]; V.lamps=[]; V.paths=[];
  const SV=.03, EASE=45, PSTEP=.5, PLEN=340, HILL0=205, HILL_H=46, HILL_L=85;
  let prof=null;
  const W=()=>ST.World;

  /* ---------- terrain ---------- */
  V.setTrack=function(T){ V.T=T; V.L=T.len; const i=ST.TRACKS.indexOf(T); V.ls=i%2===0?1:-1;
    // the floor: integrate a slope that eases from the run's own fall line to a gentle 3% over the first 45 m
    const f=W().fall, df=s=>(f(s+.01)-f(s-.01))/.02, n=Math.ceil(PLEN/PSTEP)+1, Y=new Float32Array(n), G=new Float32Array(n), sA=V.L;
    let y=f(sA); for(let k=0;k<n;k++){ const s=sA+k*PSTEP, g=lerp(df(s),-SV,smooth(sA,sA+EASE,s)); G[k]=g; if(k) y+=(G[k-1]+g)*.5*PSTEP; Y[k]=y; }
    prof={sA,Y,G,n};
    V.night={bunny:0,bull:.55,bear:.85,ridge:.3,ipo:1}[T.id]||0;
    layout(); };
  /* height of the valley floor along the run (null before the finish: the run's own fall line applies there) */
  V.floor=function(s){ if(!prof||s<=prof.sA) return null; const x=(s-prof.sA)/PSTEP; let k=Math.floor(x); if(k>=prof.n-1) k=prof.n-2; const t=x-k, h=PSTEP;
    const y0=prof.Y[k], y1=prof.Y[k+1], m0=prof.G[k]*h, m1=prof.G[k+1]*h, t2=t*t, t3=t2*t;
    let y=(2*t3-3*t2+1)*y0+(t3-2*t2+t)*m0+(-2*t3+3*t2)*y1+(t3-t2)*m1;
    const d=s-prof.sA; if(d>HILL0){ const e=(d-HILL0)/HILL_L; y+=HILL_H*e*e; }   // the hill that closes the valley behind the church
    return y; };
  /* how much of the village applies at s: 0 on the run, 1 on the valley floor */
  V.k=s=>prof?smooth(prof.sA,prof.sA+40,s):0;
  /* the half-width of flat ground: the run's width, opening out to the valley floor around the finish */
  V.width=(s,hw)=>prof?lerp(hw,V.VW,smooth(prof.sA-50,prof.sA+40,s)):hw;
  /* no forest trees or rocks on the floor (the village plants its own), nor in the church's lee */
  V.blocked=function(s,u){ if(!prof) return false; const d=s-prof.sA; if(d<-6) return false; const au=Math.abs(u);
    if(d<HILL0+4) return au<V.VW+2; return d<HILL0+16&&au<16; };

  /* ---------- ground colour: packed-snow streets and square, contact shadows at walls, lamp light pools at night ---------- */
  const _c={k:0,ao:0,glow:0};
  V.shade=function(s,u){ _c.k=0; _c.ao=0; _c.glow=0; if(!prof) return _c; const d=s-prof.sA; if(d<20||d>HILL0+20) return _c;
    const Q=V.square;
    if(Q){ const e=Math.hypot((d-Q.d)/Q.rd,u/Q.ru); _c.k=Math.max(_c.k,1-smooth(.82,1.02,e)); }
    if(d>Q.d+10&&d<V.church.d) _c.k=Math.max(_c.k,1-smooth(4.5,7,Math.abs(u)));       // the main street
    for(const p of V.paths){ const t=clamp(((d-p.d0)*(p.d1-p.d0)+(u-p.u0)*(p.u1-p.u0))/p.L2,0,1), dd=Math.hypot(d-(p.d0+(p.d1-p.d0)*t),u-(p.u0+(p.u1-p.u0)*t)); _c.k=Math.max(_c.k,(1-smooth(p.w*.6,p.w,dd))*.85); }
    for(const b of V.blds){ const dx=Math.max(0,Math.abs(d-b.d)-b.hd), du=Math.max(0,Math.abs(u-b.u)-b.hu), r=Math.hypot(dx,du); if(r<3.2) _c.ao=Math.max(_c.ao,(1-r/3.2)*(1-r/3.2)*b.ao); }
    if(V.night>0) for(const l of V.lamps){ const dd=Math.hypot(d-l.d,u-l.u); if(dd<l.r) _c.glow+=(1-dd/l.r)*(1-dd/l.r)*l.k; }
    return _c; };

  /* forest for the valley banks and the end hill (the run's own tree rows stop at the village edge) */
  V.extraTrees=function(s0,len,out){ if(!prof) return; const sA=prof.sA;
    for(let n=0;n<70;n++){ const s=s0+hash2(Math.floor(s0),n*3+17)*len, d=s-sA; if(d<-30) continue;
      const side=hash2(Math.floor(s0),n*3+18)<.5?-1:1, onHill=d>HILL0+6, u=onHill&&hash2(n,Math.floor(s0)+5)<.55?(hash2(Math.floor(s0),n*3+19)-.5)*118:side*(V.VW+2.5+hash2(Math.floor(s0),n*3+19)*15);
      if(V.blocked(s,u)) continue; out.push({s,u,sc:.75+hash2(n,Math.floor(s0)+9)*.6}); } };

  /* ---------- layout (track coordinates; F = the lift's side, Lg = the other side) ---------- */
  function layout(){ const F=V.ls, Lg=-F;
    V.square={d:72,u:0,rd:30,ru:29};
    V.tree={d:74,u:0};
    V.church={d:196,u:0};
    V.terminal={d:56,u:F*37,side:F};       // the bullwheel; riders load ~4 m uphill of it
    V.paths=[{d0:62,u0:F*12,d1:63,u1:F*26.5,w:4.5},{d0:96,u0:Lg*16,d1:104,u1:Lg*4,w:4},{d0:186,u0:0,d1:192,u1:0,w:7}];
    V.paths.forEach(p=>p.L2=(p.d1-p.d0)**2+(p.u1-p.u0)**2||1);
    V.spots=Object.assign({},V.spots,{menu:{d:87,u:Lg*2.5,hd:0}}); }   // (the build adds the rest; a cached build keeps them)

  /* ---------- geometry batching ----------
     Parts are written straight into big buffers, one per material, through a "placement" (origin + yaw) so a building can be
     modelled in its own frame: X along its front, Y up, +Z out of its front. aK tags each part for the shader (plaster, wood
     planks, stone, snow...). */
  const K={plain:0,plaster:1,wood:2,stone:3,roof:4,snow:5,metal:6,ice:7};
  function Batch(uv){ this.p=[]; this.n=[]; this.c=[]; this.k=[]; this.uv=uv?[]:null; this.i=[]; this.v=0; }
  const X={ox:0,oy:0,oz:0,c:1,s:0};
  function place(x,y,z,yaw){ X.ox=x; X.oy=y; X.oz=z; X.c=Math.cos(yaw); X.s=Math.sin(yaw); }
  const pushV=(b,lx,ly,lz,nx,ny,nz,col,k)=>{ b.p.push(X.ox+lx*X.c+lz*X.s,X.oy+ly,X.oz-lx*X.s+lz*X.c); b.n.push(nx*X.c+nz*X.s,ny,-nx*X.s+nz*X.c); b.c.push(col[0],col[1],col[2]); b.k.push(k); };
  /* a quad from four corners (counter-clockwise seen from its front) */
  Batch.prototype.quad=function(a,b2,c,d,col,k,uv){ const e1=[b2[0]-a[0],b2[1]-a[1],b2[2]-a[2]], e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
    let nx=e1[1]*e2[2]-e1[2]*e2[1], ny=e1[2]*e2[0]-e1[0]*e2[2], nz=e1[0]*e2[1]-e1[1]*e2[0]; const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
    const v=this.v; [a,b2,c,d].forEach(q=>pushV(this,q[0],q[1],q[2],nx,ny,nz,col,k)); if(this.uv) this.uv.push(...(uv||[0,0,1,0,1,1,0,1])); this.i.push(v,v+1,v+2,v,v+2,v+3); this.v+=4; return this; };
  Batch.prototype.tri=function(a,b2,c,col,k){ const e1=[b2[0]-a[0],b2[1]-a[1],b2[2]-a[2]], e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let nx=e1[1]*e2[2]-e1[2]*e2[1], ny=e1[2]*e2[0]-e1[0]*e2[2], nz=e1[0]*e2[1]-e1[1]*e2[0]; const l=Math.hypot(nx,ny,nz)||1;
    const v=this.v; [a,b2,c].forEach(q=>pushV(this,q[0],q[1],q[2],nx/l,ny/l,nz/l,col,k)); if(this.uv) this.uv.push(0,0,1,0,.5,1); this.i.push(v,v+1,v+2); this.v+=3; return this; };
  /* a box: centre, size, colour, kind; skip = faces to leave out ('-y' bottom, '-z' back...); B = optional basis {x,y,z} */
  const FACES=[['+x',0,1,2],['-x',0,2,1],['+y',1,2,0],['-y',1,0,2],['+z',2,0,1],['-z',2,1,0]];
  Batch.prototype.box=function(cx,cy,cz,sx,sy,sz,col,k,skip,B){ const h=[sx/2,sy/2,sz/2], ax=B?[B.x,B.y,B.z]:[[1,0,0],[0,1,0],[0,0,1]];
    for(const [nm,ni,t1,t2] of FACES){ if(skip&&skip.indexOf(nm)>=0) continue; const sg=nm[0]==='+'?1:-1;
      const P=(a,b2)=>{ const r=[cx,cy,cz]; for(let q=0;q<3;q++) r[q]+=ax[ni][q]*sg*h[ni]+ax[t1][q]*a*h[t1]+ax[t2][q]*b2*h[t2]; return r; };
      this.quad(P(-1,-1),P(1,-1),P(1,1),P(-1,1),col,k); }   // t1 x t2 is the face's outward normal for every entry, so this order is counter-clockwise from outside
    return this; };
  /* any three.js geometry, through a local matrix (building frame) */
  const _gv=new THREE.Vector3(), _gn=new THREE.Vector3(), _nm=new THREE.Matrix3();
  Batch.prototype.geo=function(g,m,col,k){ const P=g.attributes.position, N=g.attributes.normal, v=this.v; _nm.getNormalMatrix(m);
    for(let i=0;i<P.count;i++){ _gv.fromBufferAttribute(P,i).applyMatrix4(m); _gn.fromBufferAttribute(N,i).applyMatrix3(_nm).normalize(); pushV(this,_gv.x,_gv.y,_gv.z,_gn.x,_gn.y,_gn.z,col,k); if(this.uv) this.uv.push(0,0); }
    if(g.index) for(let i=0;i<g.index.count;i++) this.i.push(v+g.index.getX(i)); else for(let i=0;i<P.count;i++) this.i.push(v+i); this.v+=P.count; return this; };
  /* a geometry that brings its own vertex colours (the World's conifers) */
  Batch.prototype.geoC=function(g,m,k){ const P=g.attributes.position, N=g.attributes.normal, Cc=g.attributes.color, v=this.v; _nm.getNormalMatrix(m); const col=[0,0,0];
    for(let i=0;i<P.count;i++){ _gv.fromBufferAttribute(P,i).applyMatrix4(m); _gn.fromBufferAttribute(N,i).applyMatrix3(_nm).normalize(); col[0]=Cc.getX(i); col[1]=Cc.getY(i); col[2]=Cc.getZ(i); pushV(this,_gv.x,_gv.y,_gv.z,_gn.x,_gn.y,_gn.z,col,k); if(this.uv) this.uv.push(0,0); }
    for(let i=0;i<g.index.count;i++) this.i.push(v+g.index.getX(i)); this.v+=P.count; return this; };
  Batch.prototype.mesh=function(mat){ if(!this.v) return null; const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3)); g.setAttribute('aK',new THREE.Float32BufferAttribute(this.k,1));
    if(this.uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2)); g.setIndex(this.v>65535?new THREE.Uint32BufferAttribute(this.i,1):new THREE.Uint16BufferAttribute(this.i,1)); g.computeBoundingSphere(); return new THREE.Mesh(g,mat); };

  /* ---------- materials ---------- */
  const MAT={};
  MAT.body=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0});
  MAT.body.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aK; varying float vK; varying vec3 vWPv; varying vec3 vWN;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n vK=aK; vWPv=(modelMatrix*vec4(transformed,1.0)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying float vK; varying vec3 vWPv; varying vec3 vWN;
      float vh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(vh(i),vh(i+vec2(1,0)),f.x),mix(vh(i+vec2(0,1)),vh(i+vec2(1,1)),f.x),f.y); }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
      { float k=floor(vK+.5); vec3 n=normalize(vWN); float hz=dot(vWPv.xz,normalize(vec2(-n.z,n.x)+1e-4));   // the horizontal coordinate along a wall
        if(k==1.){ float m=vn(vWPv.xz*1.7+vWPv.y*1.3)*.6+vn(vWPv.xz*6.+vWPv.y*5.)*.4; diffuseColor.rgb*=.9+.14*m-.1*smoothstep(.75,1.,1.-fract(vWPv.y*.3)); }
        else if(k==2.){ float y=vWPv.y/.23, ln=smoothstep(.0,.07,fract(y))*smoothstep(1.,.92,fract(y)); float g=vn(vec2(hz*.7,floor(y)*3.1))*.5+vn(vec2(hz*9.,floor(y)*7.))*.25; diffuseColor.rgb*=(.62+.38*ln)*(.82+.32*g)*(.92+.16*vh(vec2(floor(y),3.)));
          if(abs(n.y)>.6){ float x=hz/.23; diffuseColor.rgb*=.75+.25*smoothstep(.0,.1,fract(x)); } }
        else if(k==3.){ float row=floor(vWPv.y/.42), bx=(hz+row*.37)/.78, cell=vh(vec2(floor(bx),row)); float m=smoothstep(.0,.08,fract(vWPv.y/.42))*smoothstep(.0,.06,fract(bx))*smoothstep(1.,.94,fract(bx));
          diffuseColor.rgb*=(.55+.45*m)*(.8+.35*cell); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.94,1.)*.95,smoothstep(.55,.85,n.y)*.8); }
        else if(k==4.){ float y=(vWPv.y+hz*.0)/.3; diffuseColor.rgb*=.8+.2*smoothstep(0.,.15,fract(y)); }
        else if(k==5.){ float m=vn(vWPv.xz*2.3)*.5+vn(vWPv.xz*9.)*.5; diffuseColor.rgb*=.93+.09*m; }
        else if(k==7.){ diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.9,1.),.3); } }`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n if(floor(vK+.5)==7.) roughnessFactor=.15; else if(floor(vK+.5)==6.) roughnessFactor=.45;'); };
  MAT.body.customProgramCacheKey=()=>'st-vbody';
  // windows: lit ones glow warm (the glow follows the time of day: V.applyLight), dark ones mirror the sky
  MAT.glass=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.12,metalness:.25,emissive:0xffffff,emissiveIntensity:1});
  MAT.glass.onBeforeCompile=sh=>{ sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance*=vColor*smoothstep(.3,.7,vColor.r);'); };
  MAT.glass.customProgramCacheKey=()=>'st-vglass';
  MAT.bulb=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,emissive:0xffffff,emissiveIntensity:1});
  MAT.bulb.onBeforeCompile=sh=>{ sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance*=vColor;'); };
  MAT.bulb.customProgramCacheKey=()=>'st-vbulb';
  let atlas=null;
  MAT.sign=new THREE.MeshStandardMaterial({roughness:.75,metalness:0,emissive:0xffffff,emissiveIntensity:.2});

  /* ---------- sign atlas: every painted board in the village on one canvas ---------- */
  const SIGNS={};
  function buildAtlas(){ if(atlas) return; const c=document.createElement('canvas'); c.width=2048; c.height=2048; const g=c.getContext('2d'); let x=0, y=0, rowH=0;
    const serif='Georgia,"Times New Roman",serif', sans='"Arial Black","Helvetica Neue",Arial,sans-serif';
    const SC=.78;   // every board is drawn at 78% of its nominal pixel size so the whole set fits one 2048 canvas
    const add=(id,w0,h0,draw)=>{ const w=Math.round(w0*SC), h=Math.round(h0*SC); if(x+w>2048){ x=0; y+=rowH+4; rowH=0; } g.save(); g.translate(x,y); g.beginPath(); g.rect(0,0,w,h); g.clip(); g.scale(SC,SC); draw(g,w0,h0); g.restore(); SIGNS[id]={u0:x/2048,v0:1-(y+h)/2048,u1:(x+w)/2048,v1:1-y/2048,a:w/h}; x+=w+4; rowH=Math.max(rowH,h); V.atlasH=y+rowH; };
    const fit=(g,t,max,font,size)=>{ let s=size; g.font=font.replace('#',s); while(g.measureText(t).width>max&&s>10){ s-=2; g.font=font.replace('#',s); } return s; };
    // carved wooden boards with gilded letters
    const board=(id,t,sub,w,h,bg,fg)=>add(id,w,h,(g,W,H)=>{ const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,bg||'#4a2c17'); gr.addColorStop(1,'#2a170b'); g.fillStyle=gr; g.fillRect(0,0,W,H);
      for(let i=0;i<H;i+=7){ g.fillStyle='rgba(0,0,0,'+(.05+.05*Math.sin(i*1.7))+')'; g.fillRect(0,i,W,2); }
      g.strokeStyle=fg||'#e8b54a'; g.lineWidth=Math.max(4,H*.05); g.strokeRect(H*.07,H*.07,W-H*.14,H-H*.14);
      g.fillStyle=fg||'#f2c45a'; g.textAlign='center'; g.textBaseline='middle'; const fs=fit(g,t,W*.86,'bold italic #px '+serif,Math.round(H*(sub?.42:.55))); g.fillText(t,W/2,H*(sub?.42:.52));
      if(sub){ g.fillStyle='#f6ead0'; fit(g,sub,W*.8,'bold #px '+serif,Math.round(H*.17)); g.fillText(sub,W/2,H*.76); } });
    board('alpenrose','Hotel Alpenrose','★★★★  ·  SINCE 1898',1024,200);
    board('belvedere','Grand Hotel Belvédère','★★★★★  ·  SPA · RESTAURANT',1024,200,'#20304a','#e8c76a');
    board('edelweiss','Hotel Edelweiss','★★★  ·  ZIMMER · ROOMS',900,190,'#3b2414');
    board('cafe','Café Edelweiss','KAFFEE · KUCHEN · HOT CHOCOLATE',900,200,'#5a1f1f','#f2d28a');
    board('bakery','Bäckerei','FRESH BREAD · STRUDEL',760,190,'#4a2c17');
    board('stube','Zur Alten Stube','RESTAURANT · FONDUE',900,190,'#2c3b22','#f0d080');
    board('choco','Chocolatier','PRALINÉS · TRUFFLES',760,190,'#3a1d12','#f3c98b');
    board('pizza','Pizzeria Bella','FORNO A LEGNA',760,190,'#1f3a26','#f6e2a0');
    board('apres','Après Bar La Piste','LIVE MUSIC · 16:00',860,190,'#2a1638','#ff9ad8');
    board('school','Ski & Snowboard School','LESSONS · KIDS CLUB',1000,190,'#1d3e6e','#ffffff');
    board('rent','Sport & Rent','SKI · SNOWBOARD · SERVICE',900,190,'#7a1a1a','#ffffff');
    board('summit','Summit Lodge','SNOW RUSH RESORT · RESTAURANT',1000,200,'#2b1a10','#f2c45a'); board('rcafe','Café','ESPRESSO · COCOA',700,190,'#5a1f1f','#f2d28a');
    board('rapres','Après Ski','BAR & GRILL',760,190,'#2a1638','#ff9ad8'); board('rmcafe','Mountain Café','WAFFLES · SOUP',820,190,'#1f3a26','#f6e2a0');
    board('chalet1','Chalet Bergblick','',520,130); board('chalet2','Haus Tannenhof','',520,130); board('chalet3','Chalet Sonnhalde','',520,130); board('chalet4','Haus Gletscherblick','',560,130);
    // the lift's own sign: enamel blue
    add('lift',900,220,(g,W,H)=>{ g.fillStyle='#103d8c'; g.fillRect(0,0,W,H); g.strokeStyle='#fff'; g.lineWidth=10; g.strokeRect(14,14,W-28,H-28); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle';
      fit(g,'SUMMIT EXPRESS',W*.84,'900 #px '+sans,96); g.fillText('SUMMIT EXPRESS',W/2,H*.42); g.fillStyle='#ffd34a'; fit(g,'CHAIRLIFT · 1 ▸ SUMMIT PARK · ALL RUNS',W*.84,'bold #px '+sans,40); g.fillText('CHAIRLIFT · ▲ TO ALL RUNS',W/2,H*.76); });
    // market stall headers
    [['m1','Glühwein','#8a1f1f'],['m2','Crêpes','#1f4a8a'],['m3','Raclette','#8a5a1f'],['m4','Waffeln','#2e6b33'],['m5','Lebkuchen','#6b2e5c'],['m6','Bratwurst','#5c3b1d'],['m7','Maroni','#3b3b3b']].forEach(([id,t,bg])=>
      add(id,420,110,(g,W,H)=>{ g.fillStyle=bg; g.fillRect(0,0,W,H); g.fillStyle='#fff4d6'; g.textAlign='center'; g.textBaseline='middle'; fit(g,t,W*.86,'bold italic #px '+serif,62); g.fillText(t,W/2,H*.54); g.strokeStyle='#f5d28a'; g.lineWidth=5; g.strokeRect(6,6,W-12,H-12); }));
    // yellow trail signposts (Swiss hiking style) with an arrow end
    [['a1','Summit Express','2 min'],['a2','Hotels · Hotel','1 min'],['a3','Kirche · Church','4 min'],['a4','Ski School','1 min']].forEach(([id,t,m])=>[0,1].forEach(back=>
      add(id+(back?'b':''),560,96,(g,W,H)=>{ g.save(); if(back){ g.translate(W,0); g.scale(-1,1); } g.fillStyle='#f4c21b'; g.beginPath(); g.moveTo(0,0); g.lineTo(W-H*.5,0); g.lineTo(W,H/2); g.lineTo(W-H*.5,H); g.lineTo(0,H); g.closePath(); g.fill(); g.restore();
        g.fillStyle='#14110c'; g.textBaseline='middle'; g.textAlign='left'; fit(g,t,W*.6,'bold #px '+sans,40); g.fillText(t,back?H*.55+4:16,H*.52); g.textAlign='right'; g.font='bold 30px '+sans; g.fillText(m,back?W-16:W-H*.55,H*.52); })));
    // church clock
    add('clock',256,256,(g,W,H)=>{ g.fillStyle='#1d2433'; g.fillRect(0,0,W,H); g.fillStyle='#f3f0e6'; g.beginPath(); g.arc(W/2,H/2,W*.46,0,PI*2); g.fill(); g.strokeStyle='#c9a54a'; g.lineWidth=10; g.stroke(); g.fillStyle='#1d2433';
      for(let i=0;i<12;i++){ const a=i/12*PI*2; g.save(); g.translate(W/2,H/2); g.rotate(a); g.fillRect(-4,-W*.42,8,i%3?18:30); g.restore(); }
      g.strokeStyle='#1d2433'; g.lineCap='round'; g.lineWidth=12; g.beginPath(); g.moveTo(W/2,H/2); g.lineTo(W/2+W*.2,H/2-W*.08); g.stroke(); g.lineWidth=8; g.beginPath(); g.moveTo(W/2,H/2); g.lineTo(W/2-W*.06,H/2-W*.33); g.stroke(); });
    // finish area: the timing board
    add('timing',768,256,(g,W,H)=>{ g.fillStyle='#0b0d14'; g.fillRect(0,0,W,H); g.fillStyle='#ff3d6e'; g.fillRect(0,0,W,44); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='900 30px '+sans; g.fillText('SNOW RUSH · OFFICIAL TIMING',W/2,23);
      g.fillStyle='#ffd24a'; g.font='900 120px "Courier New",monospace'; g.fillText('00:58.27',W/2,H*.62); g.fillStyle='#16e08a'; g.font='bold 30px '+sans; g.fillText('▲ NEW RECORD',W/2,H*.9); });
    atlas=new THREE.CanvasTexture(c); atlas.encoding=THREE.sRGBEncoding; atlas.anisotropy=Math.min(8,ST.renderer.capabilities.getMaxAnisotropy()); MAT.sign.map=atlas; MAT.sign.emissiveMap=atlas; MAT.sign.needsUpdate=true; }
  /* a sign quad (front +Z) of width w, centred at (x,y,z) in the current placement, rotated ry about Y */
  function sign(B,id,x,y,z,w,ry){ const S=SIGNS[id]; if(!S) return; const h=w/S.a, c=Math.cos(ry||0), sn=Math.sin(ry||0), P=(a,b2)=>[x+a*c,y+b2,z-a*sn];
    B.sign.quad(P(-w/2,-h/2),P(w/2,-h/2),P(w/2,h/2),P(-w/2,h/2),[1,1,1],0,[S.u0,S.v0,S.u1,S.v0,S.u1,S.v1,S.u0,S.v1]); }

  /* ---------- colours ---------- */
  const C=(h)=>{ const c=new THREE.Color(h).convertSRGBToLinear(); return [c.r,c.g,c.b]; };
  const PAL={plaster:['#efe6d2','#f3efe8','#e9d3a6','#ecc9bd','#cfd8de','#d9dfc8','#f0dcc0'].map(C),timber:['#6b4325','#7a4e2a','#583520','#8a5a33'].map(C),
    stone:C('#8c8a86'),roof:C('#3a2a20'),snow:C('#f4f7fc'),dark:C('#1c1e24'),metal:C('#2d323b'),shutter:['#2f6b3c','#8e2a22','#6b4325','#2c4a7a','#3d6b6b'].map(C),
    frame:C('#f2efe6'),frameD:C('#4a2e1a'),lit:[[1,.78,.45],[1,.7,.38],[1,.84,.58],[.98,.66,.36]],dim:[.07,.085,.11],door:C('#4a2a16'),ice:C('#dff1ff'),gold:C('#d9a83a')};
  const rnd=(a,b)=>{ const h=hash2(a,b); return h; };

  /* face helpers in a building frame (w along X, d along Z, front +Z): a = across the face (viewer's right), out = off the wall */
  function fpt(f,w,d,a,y,out){ return f==='+z'?[a,y,d/2+out]:f==='-z'?[-a,y,-d/2-out]:f==='+x'?[w/2+out,y,-a]:[-w/2-out,y,a]; }
  function fbox(Bt,f,w,d,a,y,out,sa,sy,so,col,k,skip){ const p=fpt(f,w,d,a,y,out), z=f[1]==='z'; Bt.box(p[0],p[1],p[2],z?sa:so,sy,z?so:sa,col,k,skip); }
  function window_(B,f,w,d,a,y,ww,wh,lit,sh,rich){ const g=B.glass, P=(da,dy)=>fpt(f,w,d,a+da,y+dy,.075);
    g.quad(P(-ww/2,-wh/2),P(ww/2,-wh/2),P(ww/2,wh/2),P(-ww/2,wh/2),lit?PAL.lit[Math.floor(lit*4)%4]:PAL.dim,0);
    const fr=rich===2?PAL.frameD:PAL.frame; fbox(B.body,f,w,d,a,y,.02,ww+.26,wh+.26,.1,fr,K.plain,['-z','-x','+x'].filter(x=>false));
    if(rich){ fbox(B.body,f,w,d,a,y,.09,.06,wh,.03,fr,K.plain); fbox(B.body,f,w,d,a,y+wh*.12,.09,ww,.06,.03,fr,K.plain);
      fbox(B.body,f,w,d,a,y-wh/2-.12,.14,ww+.45,.09,.28,PAL.stone,K.plain); fbox(B.body,f,w,d,a,y-wh/2-.04,.15,ww+.36,.07,.22,PAL.snow,K.snow);
      if(sh){ const sw=ww*.5+.06; [-1,1].forEach(sd=>fbox(B.body,f,w,d,a+sd*(ww/2+.16+sw/2),y,.06,sw,wh+.1,.05,sh,K.wood)); } } }
  /* a row of windows on one face of a storey */
  function windows(B,f,w,d,y,o,seed){ const span=f[1]==='z'?w:d, n=Math.max(1,Math.floor((span-1.4)/o.pitch)); const st=(span-1.4)/n;
    for(let i=0;i<n;i++){ const a=-span/2+.7+st*(i+.5); if(o.skip&&o.skip(a)) continue; const lit=hash2(seed+i*7,Math.round(y*10))<o.litP?hash2(seed,i)+.01:0;
      window_(B,f,w,d,a,y,o.ww,o.wh,lit,o.sh,f==='+z'||o.rich?(o.dark?2:1):0); } }

  /* gable roof with the ridge along the frame's X; walls end at y=H; the slabs carry a thick snow pack with rounded eaves, icicles below */
  const _m4=new THREE.Matrix4(), _q4=new THREE.Quaternion(), _e4=new THREE.Euler(), _v4=new THREE.Vector3(), _s4=new THREE.Vector3();
  const coneG=new THREE.ConeGeometry(1,1,5,1), cylG=new THREE.CylinderGeometry(1,1,1,10,1), sphG=new THREE.SphereGeometry(1,10,7), octG=new THREE.OctahedronGeometry(1,0), torG=new THREE.TorusGeometry(2,.13,6,28);
  const M4=(x,y,z,rx,ry,rz,sx,sy,sz)=>{ _e4.set(rx||0,ry||0,rz||0,'YXZ'); _q4.setFromEuler(_e4); return _m4.compose(_v4.set(x,y,z),_q4,_s4.set(sx,sy==null?sx:sy,sz==null?sx:sz)); };
  function roof(B,w,d,H,o){ const a=o.pitch, ov=o.over, t=.28, sn=o.snowT||.42, ca=Math.cos(a), sa=Math.sin(a), half=(d/2+ov)/ca, r=d/2*Math.tan(a);
    [1,-1].forEach(sd=>{ const Bx=sd>0?{x:[1,0,0],y:[0,ca,sa],z:[0,-sa,ca]}:{x:[-1,0,0],y:[0,ca,-sa],z:[0,-sa,-ca]};
      const zc=sd*(d/2+ov)/2-sd*ov*0, yc=H+r-(d/2+ov)/2*Math.tan(a), ny=[0,ca,sd*sa];
      const cz=sd*((d/2+ov)/2), cy=H+(d/2-ov)/2*Math.tan(a);
      B.body.box(cz*0,cy+ny[1]*t/2,cz+ny[2]*t/2,w+2*ov,t,half,o.eave||PAL.timber[2],K.wood,null,Bx);
      B.body.box(0,cy+ny[1]*(t+sn/2),cz+ny[2]*(t+sn/2),w+2*ov+.12,sn,half+.06,PAL.snow,K.snow,null,Bx);
      // the snow pack's rounded lip along the eave
      const ez=sd*(d/2+ov+.03), ey=H-ov*Math.tan(a)+t+sn*.45; B.body.geo(cylG,M4(0,ey,ez,0,0,PI/2,sn*.55,w+2*ov+.12,sn*.55),PAL.snow,K.snow);
      // icicles
      const n=Math.floor((w+2*ov)/.45); for(let i=0;i<n;i++){ const hh=hash2(i,Math.round(w*7+d*3+sd)); if(hh<.45) continue; const L=.18+hh*hh*.75, x=-w/2-ov+(i+.5)*(w+2*ov)/n;
        B.body.geo(coneG,M4(x,H-ov*Math.tan(a)-L/2+.05,sd*(d/2+ov-.05),PI,0,0,.05,L,.05),PAL.ice,K.ice); } });
    // gable ends (timber), with a small attic window
    [1,-1].forEach(sd=>{ const x=sd*w/2; if(sd>0) B.body.tri([x,H,d/2],[x,H,-d/2],[x,H+r,0],o.gable||PAL.timber[0],K.wood); else B.body.tri([x,H,-d/2],[x,H,d/2],[x,H+r,0],o.gable||PAL.timber[0],K.wood);
      if(r>1.6){ const f=sd>0?'+x':'-x'; window_(B,f,w,d,0,H+r*.38,.8,.9,o.attic?.5:0,null,2); } });
    return r; }

  /* a building: o = {w,d,floors,gH,fH,wall,top:'wood'|'plaster', timber, shutter, ridge:'x'|'z', pitch, over, balc, shop, sign, signW, lights, chimney, litP} */
  function house(B,o){ const w=o.w, d=o.d, gH=o.gH||3.3, fH=o.fH||2.85, nF=o.floors||3, H=.5+gH+(nF-1)*fH, seed=o.seed||1, base=o.base||1.6;
    const wall=o.wall||PAL.plaster[seed%PAL.plaster.length], tim=o.timber||PAL.timber[seed%PAL.timber.length], woodFrom=o.top==='wood'?H-fH*(o.woodFloors||1):H;
    B.body.box(0,.25-base/2,0,w+.3,.5+base,d+.3,PAL.stone,K.stone,['-y']);                         // stone plinth, sunk into the snow
    B.body.box(0,.5+(woodFrom-.5)/2,0,w,woodFrom-.5,d,wall,K.plaster,['-y','+y']);
    if(woodFrom<H) B.body.box(0,woodFrom+(H-woodFrom)/2,0,w+.08,H-woodFrom,d+.08,tim,K.wood,['-y','+y']);
    if(o.quoins){ [-1,1].forEach(sx=>[-1,1].forEach(sz=>B.body.box(sx*(w/2+.02),.5+(woodFrom-.5)/2,sz*(d/2+.02),.55,woodFrom-.5,.55,PAL.stone,K.stone,['-y']))); }
    // storeys: windows on all four faces (the street front gets frames, sills, shutters)
    const shut=o.shutter||PAL.shutter[seed%PAL.shutter.length], wo={pitch:o.pitch2||2.5,ww:1.15,wh:1.45,sh:shut,litP:o.litP==null?.55:o.litP,dark:o.top==='wood'};
    for(let f=0;f<nF;f++){ const y0=f===0?.5:.5+gH+(f-1)*fH, yc=y0+(f===0?gH*.52:fH*.55), inWood=y0>=woodFrom-.01, opt=Object.assign({},wo,{dark:inWood});
      if(f===0&&o.shop){ shopFront(B,o,w,d,gH); ['-z','+x','-x'].forEach(fc=>windows(B,fc,w,d,yc,Object.assign({},opt,{rich:false}),seed*31+f*5+fc.length)); continue; }
      if(f===0&&o.door!==false){ const da=o.doorA||0; fbox(B.body,'+z',w,d,da,.5+1.2,.04,1.3,2.4,.1,PAL.door,K.wood); fbox(B.body,'+z',w,d,da,.5+2.55,.45,1.9,.12,.9,PAL.timber[2],K.wood); fbox(B.body,'+z',w,d,da,.5+2.66,.45,2,.12,.95,PAL.snow,K.snow);
        [-1,1].forEach(sd=>{ const p=fpt('+z',w,d,da+sd*1.05,.5+2.1,.16); B.bulb.geo(sphG,M4(p[0],p[1],p[2],0,0,0,.11),[1,.75,.4],0); });
        windows(B,'+z',w,d,yc,Object.assign({},opt,{skip:a=>Math.abs(a-da)<1.6}),seed*31+f); }
      else windows(B,'+z',w,d,yc,opt,seed*31+f);
      ['-z','+x','-x'].forEach(fc=>windows(B,fc,w,d,yc,Object.assign({},opt,{rich:fc!=='-z'&&o.richSides}),seed*31+f*5+fc.length));
      if(o.balc&&f>=nF-o.balc&&f>0){ const bw=w-1.2, by=y0-.06; B.body.box(0,by,d/2+.7,bw,.16,1.4,tim,K.wood); B.body.box(0,by+.5,d/2+1.38,bw,.92,.07,tim,K.wood); B.body.box(0,by+.98,d/2+1.38,bw+.06,.09,.16,PAL.snow,K.snow);
        [-1,1].forEach(sd=>{ B.body.box(sd*bw/2,by+.5,d/2+.72,.07,.92,1.36,tim,K.wood); B.body.box(sd*(bw/2-.6),by-.45,d/2+.45,.14,.8,.14,tim,K.wood); }); } }
    // roof (ridge along X, or along Z: the gable to the street)
    let r; if(o.ridge==='z'){ const sx=X.ox, sy=X.oy, sz=X.oz, yaw=Math.atan2(X.s,X.c); place(sx,sy,sz,yaw+PI/2); r=roof(B,d,w,H,{pitch:o.roofPitch||.42,over:o.over||1.1,gable:tim}); place(sx,sy,sz,yaw); }
    else r=roof(B,w,d,H,{pitch:o.roofPitch||.42,over:o.over||1.1,gable:tim});
    if(o.chimney!==false){ const cx=w*.22*(seed%2?1:-1), cz=-d*.18, top=H+r+.9; B.body.box(cx,H+(top-H)/2,cz,.9,top-H,.9,PAL.stone,K.stone,['-y']); B.body.box(cx,top+.1,cz,1.15,.18,1.15,PAL.snow,K.snow); }
    if(o.sign){ const sw=o.signW||Math.min(w*.75,9); sign(B,o.sign,0,o.signY||(.5+gH+.2),d/2+.12,sw,0); }
    if(o.lights){ const ey=H-(o.over||1.1)*Math.tan(o.roofPitch||.42)-.15, ez=d/2+(o.over||1.1)-.1, n=Math.floor((w+2)/.55);
      if(o.ridge!=='z'){ const segs=Math.max(1,Math.round((w+1.8)/2.6)); for(let i=0;i<=n;i++){ const t=i/n, x=-w/2-.9+t*(w+1.8), tl=(t*segs)%1; B.bulb.geo(octG,M4(x,ey-.26*4*tl*(1-tl),ez,0,0,0,.065),o.lights[i%o.lights.length],0); } } }
    return H+r; }
  /* a shop's ground floor: big lit windows, a door, the name board and a striped awning */
  function shopFront(B,o,w,d,gH){ const n=Math.max(1,Math.floor((w-2.6)/2.6)), da=o.doorA!=null?o.doorA:w/2-1.5, ww=2.1, wh=2.2;
    fbox(B.body,'+z',w,d,da,.5+1.2,.04,1.25,2.4,.1,PAL.door,K.wood); B.glass.quad(...[[-.4,.9],[.4,.9],[.4,2.1],[-.4,2.1]].map(([a,y])=>fpt('+z',w,d,da+a,.5+y,.1)),PAL.lit[1],0);
    for(let i=0;i<n;i++){ const a=-w/2+1.2+i*2.6+ww/2; if(Math.abs(a-da)<2) continue; const p=(da2,dy)=>fpt('+z',w,d,a+da2,.5+.4+wh/2+dy,.09);
      B.glass.quad(p(-ww/2,-wh/2),p(ww/2,-wh/2),p(ww/2,wh/2),p(-ww/2,wh/2),PAL.lit[(i+o.seed)%4],0); fbox(B.body,'+z',w,d,a,.5+.4+wh/2,.03,ww+.3,wh+.3,.1,PAL.frameD,K.plain);
      fbox(B.body,'+z',w,d,a,.5+.25,.08,ww+.4,.5,.2,PAL.stone,K.stone); }
    const aw=o.shop.awning; if(aw){ const AW=w-.6, depth=1.5, tilt=.38, ns=Math.max(5,Math.round(AW/.55)), ca=Math.cos(tilt), sa=Math.sin(tilt), Bx={x:[1,0,0],y:[0,ca,sa],z:[0,-sa,ca]}, y=.5+gH-.15-depth/2*sa, z=d/2+depth/2*ca;
      for(let i=0;i<ns;i++) B.body.box(-AW/2+(i+.5)*AW/ns,y,z,AW/ns+.01,.06,depth,aw[i%2],K.plain,null,Bx);
      for(let i=0;i<ns;i++) B.body.box(-AW/2+(i+.5)*AW/ns,y-depth/2*sa-.13,z+depth/2*ca,AW/ns+.01,.26,.03,aw[i%2],K.plain);
      B.body.box(0,y+.09,z,AW-.1,.09,depth-.1,PAL.snow,K.snow,null,Bx); } }

  /* ---------- the church: white nave, steep roof, a tower with clock faces and a slate spire ---------- */
  function church(B){ const w=12, d=18, H=9, z0=3;   // nave centred at z0 behind the tower; front of the whole church +Z
    place(X.ox,X.oy,X.oz,Math.atan2(X.s,X.c)); const W1=C('#f4f1ea');
    // nave (its own frame: shifted back)
    const sv={x:X.ox,y:X.oy,z:X.oz,yaw:Math.atan2(X.s,X.c)}, at=(lx,lz)=>[sv.x+lx*Math.cos(sv.yaw)+lz*Math.sin(sv.yaw),sv.z-lx*Math.sin(sv.yaw)+lz*Math.cos(sv.yaw)];
    let p=at(0,-z0); place(p[0],sv.y,p[1],sv.yaw);
    B.body.box(0,-.4,0,w+.4,1.8,d+.4,PAL.stone,K.stone,['-y']); B.body.box(0,.5+(H-.5)/2,0,w,H-.5,d,W1,K.plaster,['-y','+y']);
    [-1,1].forEach(sd=>{ for(let i=0;i<4;i++){ const a=-d/2+2.6+i*4.2, f=sd>0?'+x':'-x';   // tall round-headed windows, warm inside
      const P=(da,dy)=>fpt(f,w,d,a+da,dy,.07); B.glass.quad(P(-.6,3),P(.6,3),P(.6,6.2),P(-.6,6.2),[1,.72,.42],0); B.glass.tri(P(-.6,6.2),P(.6,6.2),P(0,6.85),[1,.72,.42],0);
      fbox(B.body,f,w,d,a,4.7,.02,1.5,3.9,.1,C('#d8d2c4'),K.plain); } });
    place(p[0],sv.y,p[1],sv.yaw+PI/2); const r=roof(B,d,w,H,{pitch:.72,over:.8,gable:W1});   // the ridge runs along the nave
    place(sv.x,sv.y,sv.z,sv.yaw);
    // tower at the front
    const tw=5.6, tH=21; p=at(0,d/2-z0+0); place(p[0],sv.y,p[1],sv.yaw);
    B.body.box(0,-.4,0,tw+.5,1.8,tw+.5,PAL.stone,K.stone,['-y']); B.body.box(0,.5+(tH-.5)/2,0,tw,tH-.5,tw,W1,K.plaster,['-y']);
    [-1,1].forEach(sx=>[-1,1].forEach(sz=>B.body.box(sx*(tw/2+.03),.5+(tH-.5)/2,sz*(tw/2+.03),.5,tH-.5,.5,C('#ddd6c6'),K.stone,['-y'])));
    B.body.box(0,tH+.15,0,tw+.6,.3,tw+.6,C('#ddd6c6'),K.stone); B.body.box(0,tH+.36,0,tw+.5,.14,tw+.5,PAL.snow,K.snow);
    ['+z','+x','-x','-z'].forEach(f=>{ const P=(da,dy)=>fpt(f,tw,tw,da,dy,.06); if(f!=='-z'){ const cs=SIGNS.clock, q=(a,y)=>fpt(f,tw,tw,a,y,.08); B.sign.quad(q(-1.25,15),q(1.25,15),q(1.25,17.5),q(-1.25,17.5),[1,1,1],0,[cs.u0,cs.v0,cs.u1,cs.v0,cs.u1,cs.v1,cs.u0,cs.v1]); }
      B.glass.quad(P(-.9,18.6),P(.9,18.6),P(.9,20.3),P(-.9,20.3),[.05,.05,.07],0); B.glass.tri(P(-.9,20.3),P(.9,20.3),P(0,20.75),[.05,.05,.07],0);   // belfry openings
      fbox(B.body,f,tw,tw,0,19.4,.02,2.2,2.6,.1,C('#ddd6c6'),K.stone); });
    // door with steps
    fbox(B.body,'+z',tw,tw,0,1.9,.05,1.8,3,.12,PAL.door,K.wood); B.glass.tri(...[[-.9,3.4],[.9,3.4],[0,4.1]].map(([a,y])=>fpt('+z',tw,tw,a,y,.1)),[1,.72,.42],0);
    for(let i=0;i<3;i++) B.body.box(0,.18+i*.16-.3,tw/2+1.4-i*.35,3.4,.3,.7,PAL.stone,K.stone);
    // spire: octagonal, slate, a snowy band, gilded ball and cross
    B.body.geo(new THREE.CylinderGeometry(.05,3.0,11,8,1,true),M4(0,tH+.42+5.5,0,0,PI/8,0,1,1,1),C('#2e3440'),K.roof);
    B.body.geo(new THREE.CylinderGeometry(2.45,2.84,1.4,8,1,true),M4(0,tH+.42+1.6,0,0,PI/8,0,1,1,1),PAL.snow,K.snow);
    B.body.geo(sphG,M4(0,tH+11.6,0,0,0,0,.32),PAL.gold,K.metal); B.body.box(0,tH+12.6,0,.14,1.6,.14,PAL.gold,K.metal); B.body.box(0,tH+12.9,0,.9,.14,.14,PAL.gold,K.metal);
    place(sv.x,sv.y,sv.z,sv.yaw); return r; }

  /* market stall: dark timber hut, counter open to the square, warm light inside, snowy roof, garland of bulbs */
  function hut(B,id,seed){ const w=3.4, d=2.4, H=2.5, tim=PAL.timber[seed%4];
    B.body.box(0,H/2,-d/2+.08,w,H,.16,tim,K.wood,['-y']); [-1,1].forEach(sd=>B.body.box(sd*(w/2-.08),H/2,0,.16,H,d,tim,K.wood,['-y']));
    B.body.box(0,.55,d/2-.1,w,1.1,.2,tim,K.wood,['-y']); B.body.box(0,1.12,d/2+.05,w+.1,.08,.55,PAL.timber[2],K.wood);
    B.glass.quad([-w/2+.2,1.15,d/2-.25],[w/2-.2,1.15,d/2-.25],[w/2-.2,H-.35,d/2-.25],[-w/2+.2,H-.35,d/2-.25],[1,.74,.42],0);   // the lit inside
    B.body.box(0,H-.15,0,w,.3,d,tim,K.wood);
    roof(B,w,d,H,{pitch:.5,over:.45,snowT:.3}); sign(B,id,0,H+.1,d/2+.5,2.4,0); B.body.box(0,H+.1,d/2+.47,2.5,.68,.04,PAL.timber[2],K.wood);
    const n=14; for(let i=0;i<=n;i++){ const t=i/n, x=-w/2-.3+t*(w+.6), tl=(t*2)%1; B.bulb.geo(octG,M4(x,H-.15-.18*4*tl*(1-tl),d/2+.48,0,0,0,.05),hash2(i,seed)<.5?[1,.8,.45]:[1,.35,.25],0); } }

  /* the Christmas tree: tiers of snowy branches, a spiral of bulbs, a star */
  function xtree(B,h){ const tiers=9; for(let i=0;i<tiers;i++){ const t=i/tiers, r=(1-t)*h*.3+.25, y0=1.6+t*(h-2.2), hh=h*.2;
      B.body.geo(coneG,M4(0,y0+hh/2,0,0,i*.7,0,r,hh,r),C('#1e3d2a'),K.plain); B.body.geo(coneG,M4(0,y0+hh*.62,0,0,i*.7+.3,0,r*.82,hh*.5,r*.82),C('#e8eef6'),K.snow); }
    B.body.geo(cylG,M4(0,.8,0,0,0,0,.35,1.6,.35),PAL.timber[2],K.wood);
    const cols=[[1,.82,.45],[1,.3,.22],[1,.75,.2],[.55,.75,1]]; for(let i=0;i<190;i++){ const t=i/190, y=1.9+t*(h-2.6), r=(1-(y-1.6)/(h-2.2))*h*.3+.3, a=t*PI*2*7.5;
      B.bulb.geo(octG,M4(Math.cos(a)*r,y,Math.sin(a)*r,0,0,0,.11),cols[i%4],0); }
    B.bulb.geo(octG,M4(0,h+.35,0,0,0,PI/4,.55,.75,.18),[1,.85,.3],0); }
  /* small furniture */
  function lamp(B,ht){ B.body.geo(cylG,M4(0,ht/2,0,0,0,0,.07,ht,.07),PAL.metal,K.metal); B.body.geo(cylG,M4(0,.3,0,0,0,0,.16,.6,.16),PAL.metal,K.metal);
    B.body.box(0,ht+.05,.0,.2,.1,.2,PAL.metal,K.metal); B.bulb.box(0,ht+.38,0,.32,.5,.32,[1,.78,.45],0); B.body.geo(coneG,M4(0,ht+.78,0,0,PI/4,0,.33,.3,.33),PAL.metal,K.metal); B.body.geo(coneG,M4(0,ht+.84,0,0,PI/4,0,.26,.18,.26),PAL.snow,K.snow); }
  function bench(B){ const wd=PAL.timber[1]; B.body.box(0,.46,0,1.8,.07,.5,wd,K.wood); B.body.box(0,.85,-.24,1.8,.4,.06,wd,K.wood); [-1,1].forEach(sd=>B.body.box(sd*.75,.23,0,.07,.46,.45,PAL.metal,K.metal)); B.body.box(0,.53,.02,1.7,.07,.42,PAL.snow,K.snow); }
  function signpost(B){ B.body.geo(cylG,M4(0,1.6,0,0,0,0,.07,3.2,.07),PAL.metal,K.metal); [['a1',.6],['a2',2.1],['a3',-1.2],['a4',2.9]].forEach(([id,ry],i)=>{ const x=Math.sin(ry)*1.25, z=Math.cos(ry)*1.25, y=2.95-i*.42;
      sign(B,id,x-Math.cos(ry)*.012,y,z+Math.sin(ry)*.012,2.5,ry-PI/2); sign(B,id+'b',x+Math.cos(ry)*.012,y,z-Math.sin(ry)*.012,2.5,ry+PI/2); }); }   // both faces read the right way
  function flag(B,col,seed){ B.body.geo(cylG,M4(0,4,0,0,0,0,.05,8,.05),C('#d7dbe2'),K.metal); B.body.geo(sphG,M4(0,8.05,0,0,0,0,.09),PAL.gold,K.metal);
    for(let i=0;i<6;i++){ const x0=.06+i*.38, x1=x0+.38, z0=Math.sin(i*.9+seed)*.12, z1=Math.sin(i*.9+.9+seed)*.12; B.body.quad([x0,6.2,z0],[x1,6.2,z1],[x1,7.8,z1],[x0,7.8,z0],col,K.plain); B.body.quad([x1,6.2,z1],[x0,6.2,z0],[x0,7.8,z0],[x1,7.8,z1],col,K.plain); } }
  function spruce(B,h,seed){ const T=ST.World.TREE[seed%3===0?'fir':'spruce'].near, k=h/9.2; B.body.geoC(T,M4(0,0,0,0,seed*1.7,0,k,k*(.95+hash2(seed,3)*.15),k),K.plain); }
  function snowbank(B,len,seed){ const n=Math.max(1,Math.round(len/2.2)); for(let i=0;i<n;i++){ const x=-len/2+(i+.5)*len/n, r=.75+hash2(i,seed)*.5; B.body.geo(sphG,M4(x,0,0,0,hash2(i,seed+3)*3,0,r*1.4,r*.65,r),PAL.snow,K.snow); } }
  function fenceLine(B,ax,az,bx,bz,col){ const L=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.round(L/2.2)), ry=Math.atan2(bx-ax,bz-az);
    for(let i=0;i<=n;i++){ const t=i/n; B.body.geo(cylG,M4(ax+(bx-ax)*t,.55,az+(bz-az)*t,0,0,0,.04,1.1,.04),PAL.metal,K.metal); }
    B.body.geo(cylG,M4((ax+bx)/2,.98,(az+bz)/2,PI/2,ry,0,.025,L,.025),col,K.plain); B.body.geo(cylG,M4((ax+bx)/2,.6,(az+bz)/2,PI/2,ry,0,.025,L,.025),col,K.plain); }
  /* grandstand at the finish: four stepped rows, a roof, the timing board on top */
  function stand(B,w){ const wd=PAL.timber[1], st=PAL.metal; for(let i=0;i<4;i++){ B.body.box(0,.35+i*.55,-i*.9,w,.12,.9,wd,K.wood); B.body.box(0,.55+i*.55-.08,-i*.9+.4,w,.06,.1,PAL.snow,K.snow); B.body.box(0,.18+i*.55/2,-i*.9,w,.35+i*.55,.9,C('#4c5562'),K.metal,['-y']); }
    [-1,1].forEach(sd=>{ B.body.box(sd*w/2,2.6,-1.5,.18,5.2,.18,st,K.metal); B.body.box(sd*w/2,2.2,1.1-.6,.18,4.4,.18,st,K.metal); }); B.body.box(0,4.9,-.7,w+.6,.18,4.2,C('#c8102e'),K.plain,null,{x:[1,0,0],y:[0,.985,.17],z:[0,-.17,.985]});
    B.body.box(0,5.08,-.7,w+.5,.2,4.1,PAL.snow,K.snow,null,{x:[1,0,0],y:[0,.985,.17],z:[0,-.17,.985]}); sign(B,'timing',0,6.6,-1.4,5.2,0); B.body.box(0,6.6,-1.5,5.5,2,.15,PAL.dark,K.metal); }

  /* ---------- the lift's bottom terminal (the rope geometry is the Resort's) ---------- */
  /* a terminal: the bottom one (on the square: gates, loading mat, the queue's sign) or the top one (unload ramp) */
  function terminal(Bat,top){ const R=ST.Resort; if(!R||!R.towers) return; const tw=R.towers(), bw=top?tw[0]:tw[tw.length-1], ld=top?tw[1]:tw[tw.length-2]; if(!bw||!bw.wheel) return;
    const F=V.ls, yaw=Math.atan2(bw.x-ld.x,bw.z-ld.z);   // local +Z: from the sheave toward the wheel along the rope
    const B=Bat(bw.s-V.L); place(bw.x,bw.gy,bw.z,yaw); const hB=bw.y-bw.gy, red=C('#c8102e'), grey=C('#c9ced6');
    // bullwheel and its drive housing on a central column; a canopy over the whole station
    B.body.geo(torG,M4(0,hB,0,PI/2,0,0,1),PAL.metal,K.metal); B.body.geo(cylG,M4(0,hB+.15,0,0,0,0,.35,.6,.35),PAL.metal,K.metal);
    B.body.box(0,hB+.85,.6,3.2,1.1,3.4,red,K.plain); B.body.box(0,hB+1.45,.6,3.3,.12,3.5,PAL.snow,K.snow);
    B.body.box(0,(hB+.3)/2,1.5,.7,hB+.3,.7,grey,K.metal,['-y']); B.body.box(0,.15,1.5,1.6,.3,1.6,C('#a9aeb6'),K.stone);
    const sL=bw.s-ld.s, cz0=-sL-3.2, cz1=3.6, cy=hB+2.2, cw=8.2;   // canopy from behind the load sheave to past the bullwheel
    B.body.box(0,cy,(cz0+cz1)/2,cw,.32,cz1-cz0,C('#3a4150'),K.metal); B.body.box(0,cy+.3,(cz0+cz1)/2,cw+.2,.38,cz1-cz0+.2,PAL.snow,K.snow);
    [[-1,cz0+.6],[1,cz0+.6],[-1,cz1-.6],[1,cz1-.6]].forEach(([sx,z])=>B.body.box(sx*(cw/2-.25),cy/2,z,.28,cy,.28,grey,K.metal,['-y']));
    B.body.box(0,cy-.45,cz0+.4,cw,.6,.2,red,K.plain); sign(B,'lift',0,cy-.42,cz0+.25,4.6,PI);   // the name board faces up the run
    [[-1,cz0+1.2],[1,cz0+1.2],[-1,cz1-1.5],[1,cz1-1.5],[-1,(cz0+cz1)/2],[1,(cz0+cz1)/2]].forEach(([sx,z])=>B.bulb.box(sx*(cw/2-.6),cy-.2,z,.5,.08,.5,[1,.92,.75],0));   // canopy lights
    // gates across the uphill line, the loading mat, the operator's hut on the outer side
    place(bw.x,bw.gy,bw.z,yaw); const cu=R.cablePoint(ld.s,-1), inner=Math.sign((cu.x-bw.x)*X.c-(cu.z-bw.z)*X.s)||1;   // local side of the uphill (loading) line
    const dark=C('#3b4250');
    if(!top) for(let i=0;i<3;i++){ const gx=inner*(HALFX-1.4+i*1.4); B.body.box(gx,.5,-sL+2.6,.08,1,.36,dark,K.metal); B.body.box(gx,.95,-sL+2.6,.1,.06,.42,dark,K.metal); B.bulb.box(gx,1.02,-sL+2.6,.08,.05,.08,[.2,1,.4],0); }
    // load sheave: a gallows from the outer side, its beam over both lines (nothing stands between the lines at the load)
    place(ld.x,ld.gy,ld.z,yaw); const hL=ld.y-ld.gy, ox=-inner*3.7; B.body.box(ox,(hL+.6)/2,0,.4,hL+.6,.4,grey,K.metal,['-y']); B.body.box((ox+inner*2.6)/2,hL+.42,0,Math.abs(ox-inner*2.6)+.3,.3,.4,grey,K.metal);
    [-1,1].forEach(sd=>B.body.geo(cylG,M4(sd*2,hL+.12,0,0,0,PI/2,.28,.24,.28),PAL.metal,K.metal));
    place(bw.x,bw.gy,bw.z,yaw);
    if(!top) B.body.box(inner*HALFX,.02,-sL+.5,2.8,.04,1.6,C('#26313f'),K.plain);
    else { B.body.box(inner*HALFX,.22,-sL+.4,2.6,.44,3,PAL.snow,K.snow,['-y']); B.body.box(inner*(HALFX+2.4),.12,-sL+.4,2.2,.24,3,PAL.snow,K.snow,['-y']); }   // the unload ramp, stepping down to the side
    { const lx=-inner*(HALFX+3.8), lz=-sL+1.5, wx=X.ox+lx*X.c+lz*X.s, wz=X.oz-lx*X.s+lz*X.c; place(wx,bw.gy,wz,yaw+(inner>0?-PI/2:PI/2));   // its windows face the line
      B.body.box(0,1.3,0,2.6,2.6,2.6,C('#e6e1d6'),K.plaster,['-y']); B.body.box(0,2.75,0,3.2,.25,3.2,C('#3a4150'),K.metal); B.body.box(0,2.95,0,3.1,.3,3.1,PAL.snow,K.snow);
      ['+z','+x','-x'].forEach(f=>window_(B,f,2.6,2.6,0,1.6,1.7,1,.6,null,0)); }
    if(top) return;
    { const sx=inner*(cw/2+.08), zc=(cz0+cz1)/2-1; B.body.box(sx,cy-.5,zc,.16,1.3,5.2,red,K.plain); sign(B,'lift',sx+inner*.09,cy-.5,zc,4.9,inner*PI/2); }   // and one to the square
    V.loadPt={s:R.sLoad,x:cu.x,z:cu.z,yaw,inner}; }
  /* the top terminal, for the chunk at the top of the run (world coordinates) */
  V.makeTerminal=function(){ if(!V.T) return null; buildAtlas(); const B={body:new Batch(),glass:new Batch(),sign:new Batch(true),bulb:new Batch()}; terminal(()=>B,true); const g=new THREE.Group();
    SET.forEach(k=>{ const m=B[k].mesh(MAT[k]); if(!m) return; m.castShadow=k==='body'; m.receiveShadow=k!=='bulb'; m.userData.dyn=1; g.add(m); }); return g; };
  const HALFX=2.0;

  /* ---------- build: lay the village out on the floor, one set of buffers per quarter ---------- */
  const SET=['body','glass','sign','bulb'];
  V.build=function(T){ const key=T.id+':'+T.len; if(V.group&&V.key===key&&V.group.parent){ V.applyLight(); V.populate(); return; }
    V.dispose(); buildAtlas(); const Wd=W(), F=V.ls, G=-F, L=V.L;
    const cl=[0,1,2,3].map(()=>({body:new Batch(),glass:new Batch(),sign:new Batch(true),bulb:new Batch()})), Bat=d=>cl[d<64?0:d<112?1:d<160?2:3];
    const wp=(d,u)=>{ const s=L+d, x=Wd.cx(s)+u, z=-s; return {x,z,y:Wd.groundY(x,z)}; };
    const dirs=d=>{ const s=L+d, k=Wd.dcx(s), n=Math.hypot(k,1); return {fx:k/n,fz:-1/n,rx:1/n,rz:k/n}; };   // downhill, across (+u)
    // set the placement for something standing at (d,u) facing: 'street' (toward u=0), 'up' (uphill), 'down', or a point {d,u}
    function put(d,u,face,yOff,lift){ const p=wp(d,u), D=dirs(d); let dx,dz;
      if(face==='street'){ const sg=-Math.sign(u)||1; dx=D.rx*sg; dz=D.rz*sg; } else if(face==='up'){ dx=-D.fx; dz=-D.fz; } else if(face==='down'){ dx=D.fx; dz=D.fz; }
      else { const q=wp(face.d,face.u); dx=q.x-p.x; dz=q.z-p.z; }
      place(p.x,(lift!=null?lift:p.y)+(yOff||0),p.z,Math.atan2(dx,dz)); return Bat(d); }
    /* a building with a footprint: sits level on the highest corner, the plinth reaches the lowest */
    function bld(d,u,face,o){ const along=face==='up'||face==='down', hd=(along?o.d:o.w)/2, hu=(along?o.w:o.d)/2;
      let top=-1e9, low=1e9; [[-1,-1],[1,-1],[1,1],[-1,1],[0,0]].forEach(([a,b2])=>{ const y=wp(d+a*hd,u+b2*hu).y; top=Math.max(top,y); low=Math.min(low,y); });
      const onBank=Math.abs(u)>V.VW-2, y0=onBank?wp(d,u-Math.sign(u)*hu).y+.1:top+.05; o.base=Math.max(1.6,y0-low+1.2);
      const B=put(d,u,face,0,y0); const h=house(B,o); V.blds.push({d,u,hd:hd+.2,hu:hu+.2,ao:.42,h}); return B; }
    V.blds=[]; V.lamps=[]; V.seats=[];
    const warm=[[1,.8,.45],[1,.7,.35]], fest=[[1,.82,.45],[1,.3,.25],[.4,.8,1],[1,.75,.2]];

    // --- the square ---
    bld(52,G*38,'street',{w:22,d:13,floors:5,top:'wood',woodFloors:2,balc:3,sign:'alpenrose',signW:9.5,signY:.5+3.3+2.85*2+1.5,quoins:true,lights:warm,seed:3,litP:.6,wall:C('#efe3cc'),shutter:C('#8e2a22')});
    bld(80,G*39.5,'street',{w:26,d:14,floors:6,top:'wood',woodFloors:1,balc:4,sign:'belvedere',signW:11,signY:.5+3.4+.15,gH:3.4,quoins:true,lights:warm,seed:2,litP:.7,wall:C('#ead6ab'),shutter:C('#2c4a7a'),roofPitch:.36});
    bld(78,F*38,'street',{w:14,d:11,floors:3,top:'wood',balc:1,sign:'school',signW:9,seed:5,wall:C('#dfe6ea'),shutter:C('#2c4a7a'),lights:fest});
    bld(96,F*27,'street',{w:12,d:10,floors:2,top:'wood',shop:{awning:[C('#1d5bb8'),C('#f2f2f2')]},sign:'rent',signW:8.6,seed:6,chimney:false});
    bld(101,G*15,'up',{w:12,d:10,floors:2,top:'wood',shop:{awning:[C('#a3201b'),C('#f4efe4')]},sign:'cafe',signW:9,seed:7,lights:warm,doorA:-3.5});
    // --- the main street ---
    bld(116,G*14,'street',{w:11,d:9,floors:3,shop:{awning:[C('#f0e6c8'),C('#6b4325')]},sign:'bakery',signW:7.6,seed:8,wall:C('#f2e8d0')});
    bld(133,G*14.5,'street',{w:14,d:10,floors:3,top:'wood',sign:'stube',signW:9,seed:9,litP:.8,lights:warm,shutter:C('#2f6b3c'),richSides:true});
    bld(150,G*14,'street',{w:11,d:9,floors:3,shop:{awning:[C('#5a2d1a'),C('#e8b7c3')]},sign:'choco',signW:7.6,seed:10,wall:C('#ecc9bd')});
    bld(167,G*14.5,'street',{w:12,d:11,floors:3,top:'wood',woodFloors:2,balc:2,ridge:'z',sign:'chalet1',signW:3.6,signY:3.2,seed:11});
    bld(115,F*15.5,'street',{w:16,d:12,floors:4,top:'wood',balc:2,sign:'edelweiss',signW:9,seed:12,lights:warm,quoins:true,wall:C('#f3efe8')});
    bld(133,F*14,'street',{w:12,d:10,floors:3,shop:{awning:[C('#2e6b33'),C('#f4f1e6')]},sign:'pizza',signW:7.6,seed:13,wall:C('#e9d3a6')});
    bld(150,F*14,'street',{w:13,d:10,floors:2,top:'wood',shop:{awning:[C('#3b1d4a'),C('#18151c')]},sign:'apres',signW:8.4,seed:14,lights:fest});
    bld(167,F*14.5,'street',{w:12,d:11,floors:3,top:'wood',balc:2,ridge:'z',sign:'chalet2',signW:3.6,signY:3.2,seed:15});
    // --- second row and the banks ---
    [[119,G*31,13,11,3,'z'],[141,G*32,15,12,4,'x'],[161,G*31,12,10,3,'z'],[181,G*30,12,11,3,'x','chalet3'],[123,F*31,14,12,3,'z'],[143,F*32,12,11,3,'x'],[163,F*31,13,11,4,'x'],[182,F*30,12,10,3,'z','chalet4'],
     [106,G*53,12,10,3,'z'],[151,G*54,13,10,3,'x'],[176,G*52,11,9,2,'z'],[112,F*53,12,10,3,'x'],[152,F*54,13,10,3,'z'],[134,F*52,10,9,2,'z']].forEach(([d,u,w,dd,fl,rg,sg],i)=>
      bld(d,u,'street',{w,d:dd,floors:fl,top:'wood',woodFloors:fl>3?2:1,balc:fl-1,ridge:rg,seed:20+i,sign:sg,signW:3.6,signY:3.2,litP:.45}));
    // --- the church closes the street ---
    { const B=put(196,0,'up'); church(B); V.blds.push({d:200,u:0,hd:12,hu:6.4,ao:.4}); V.spots.church={d:186,u:0}; }
    // --- the Christmas tree, benches, the market ---
    { const B=put(74,0,'up'); xtree(B,13); V.lamps.push({d:74,u:0,r:10,k:1.3}); V.blds.push({d:74,u:0,hd:3.8,hu:3.8,ao:.3}); }
    for(let i=0;i<4;i++){ const a=PI/4+i*PI/2, d=74+Math.cos(a)*7.2, u=Math.sin(a)*7.2, B=put(d,u,{d:74,u:0}); bench(B); const yaw=Math.atan2(X.s,X.c); V.seats.push({x:X.ox+X.s*.06,z:X.oz+X.c*.06,y:X.oy,ry:yaw,kind:'bench'}); }
    V.huts=[]; [['m1',61,G*17],['m2',72,G*19],['m3',84,G*17],['m4',67,F*18],['m5',79,F*19],['m6',90,F*13],['m7',57,G*7]].forEach(([id,d,u],i)=>{ const B=put(d,u,{d:74,u:0}); hut(B,id,i); V.blds.push({d,u,hd:1.9,hu:1.9,ao:.3}); V.lamps.push({d:d+(74-d)*.12,u:u*.88,r:5,k:.7});
      V.huts.push({x:X.ox,z:X.oz,yaw:Math.atan2(X.s,X.c)}); });
    { const B=put(46,G*7,{d:74,u:0}); signpost(B); }
    // café terrace: tables, closed parasols, heaters
    for(let i=0;i<4;i++){ const d=90.5+(i%2)*3.2, u=G*(11+Math.floor(i/2)*5.5+(i%2)*1.2), B=put(d,u,'up');
      B.body.geo(cylG,M4(0,.55,0,0,0,0,.05,1.1,.05),PAL.metal,K.metal); B.body.geo(cylG,M4(0,1.1,0,0,0,0,.45,.05,.45),C('#e9e4da'),K.plain); B.body.geo(cylG,M4(0,1.14,0,0,0,0,.4,.04,.4),PAL.snow,K.snow);
      B.body.geo(cylG,M4(0,1.9,0,0,0,0,.025,2.8,.025),PAL.metal,K.metal); B.body.geo(coneG,M4(0,2.6,0,0,0,0,.18,1.4,.18),C(i%2?'#a3201b':'#f4efe4'),K.plain);
      [[-.8,0],[.8,0]].forEach(([x])=>{ B.body.box(x,.45,0,.45,.06,.45,PAL.timber[1],K.wood); B.body.box(x+Math.sign(x)*.2,.75,0,.06,.6,.45,PAL.timber[1],K.wood); const sg=Math.sign(x);
        V.seats.push({x:X.ox+(x+sg*.05)*X.c,z:X.oz-(x+sg*.05)*X.s,y:X.oy,ry:Math.atan2(-sg*X.c,sg*X.s),kind:'cafe'}); }); }
    [[89,G*9.5],[95,G*22]].forEach(([d,u])=>{ const B=put(d,u,'up'); B.body.geo(cylG,M4(0,1.2,0,0,0,0,.06,2.4,.06),PAL.metal,K.metal); B.bulb.geo(cylG,M4(0,2.35,0,0,0,0,.22,.3,.22),[1,.45,.15],0); B.body.geo(coneG,M4(0,2.7,0,0,0,0,.45,.35,.45),PAL.metal,K.metal); V.lamps.push({d,u,r:4,k:.8}); });
    // --- lamps along the street and round the square ---
    for(let d=106;d<=182;d+=12) [-1,1].forEach(sd=>{ const u=sd*6.4, B=put(d+(sd>0?6:0),u,'street'); lamp(B,4.2); V.lamps.push({d:d+(sd>0?6:0),u,r:7.5,k:1}); });
    for(let i=0;i<9;i++){ const a=i/9*PI*2+.35, d=74+Math.cos(a)*27, u=Math.sin(a)*22; if(Math.abs(u)>18&&d<66&&Math.sign(u)===F) continue; const B=put(d,u,'up'); lamp(B,4.2); V.lamps.push({d,u,r:7.5,k:1}); }
    // flags in front of the Grand Hotel, snow banks along the street, spruces
    [C('#c8102e'),C('#f4f4f4'),C('#1d5bb8'),C('#ffc21a'),C('#16a34a')].forEach((c,i)=>{ const B=put(70+i*4.4,G*31,'street'); flag(B,c,i); });
    for(let d=110;d<182;d+=12) [-1,1].forEach(sd=>{ if(hash2(d,sd+5)<.35) return; const B=put(d+2+hash2(d,sd)*4,sd*5.9,'street'); place(X.ox,X.oy,X.oz,Math.atan2(X.s,X.c)+PI/2); snowbank(B,3.5+hash2(d,sd+1)*3,d+sd); });
    [[129,G*24,9],[153,F*23,8],[189,G*10,10],[189,F*10,9.5],[207,G*13,11],[207,F*13,12],[170,G*43,10],[128,F*43,11],[100,G*45,9],[44,F*24,8],[92,F*44,10],[172,F*44,9],[63,G*27,7],[194,G*30,11],[196,F*31,10]].forEach(([d,u,h],i)=>{ const B=put(d,u,'up'); spruce(B,h,i); V.blds.push({d,u,hd:1.6,hu:1.6,ao:.25}); });
    // --- the finish: a grandstand facing the run-out ---
    { const u=G*(Wd.halfW(L+14)+8); const B=put(14,u,'street'); stand(B,14); V.blds.push({d:14,u,hd:7,hu:2.5,ao:.3}); V.spots.stand={x:X.ox,y:X.oy,z:X.oz,yaw:Math.atan2(X.s,X.c)}; }
    // --- the lift: terminal, and the queue's maze ---
    terminal(Bat);
    /* the maze: three lanes on the square's side of the loading line; the queue snakes from the entry (downhill end of the
       outer lane) to the gates. off = metres from the uphill rope toward the square. */
    if(V.loadPt){ const R=ST.Resort, tw=R.towers(), ld=tw[tw.length-2], dL=ld.s-L, uq=R.liftU(ld.s)-F*2.0, U=off=>uq-F*off;
      const B=Bat(dL); const red=C('#c8102e');
      [[2.0,3.6,11],[4.15,2.4,9.9],[6.45,3.8,11.5],[8.75,2.4,11.5]].forEach(([off,a0,a1])=>{ const a=wp(dL+a0,U(off)), b=wp(dL+a1,U(off)); place(0,Math.min(a.y,b.y),0,0); fenceLine(B,a.x,a.z,b.x,b.z,red); });
      V.queuePath=[[2.6+.5,1.0],[3.2,3.05],[10.5,3.05],[10.5,5.3],[3.2,5.3],[3.2,7.6],[12.5,7.6],[16,9]].map(([dd,off])=>({d:dL+dd,u:U(off)}));
      V.loadD=R.sLoad-L; V.gateD=dL+2.6; V.lineU=uq; }

    // --- meshes ---
    const grp=new THREE.Group(); grp.name='village';
    cl.forEach(c=>SET.forEach(k=>{ const m=c[k].mesh(MAT[k]); if(!m) return; m.castShadow=k==='body'; m.receiveShadow=k!=='bulb'; m.matrixAutoUpdate=false; grp.add(m); }));
    scene.add(grp); V.group=grp; V.key=key; V.applyLight(); V.populate(); };
  /* ---------- village life: who stands, walks, sits and queues where (registered with ST.People after every reset) ---------- */
  const _o={x:0,z:0,dx:0,dz:1};
  function pathOf(pts,loop){ const Wd=W(), L=V.L, P=pts.map(p=>{ const s=L+p[0]; return {x:Wd.cx(s)+p[1],z:-s}; }); if(loop) P.push(P[0]);
    const cum=[0]; for(let i=1;i<P.length;i++) cum.push(cum[i-1]+Math.hypot(P[i].x-P[i-1].x,P[i].z-P[i-1].z));
    return {P,cum,len:cum[cum.length-1],loop,at(t,o){ t=this.loop?((t%this.len)+this.len)%this.len:clamp(t,0,this.len); let i=0; while(i<P.length-2&&cum[i+1]<t) i++; const a=P[i], b=P[i+1], f=(t-cum[i])/((cum[i+1]-cum[i])||1); o.x=a.x+(b.x-a.x)*f; o.z=a.z+(b.z-a.z)*f; o.dx=b.x-a.x; o.dz=b.z-a.z; return o; }}; }
  /* walk a path (to the end and back, or round a loop), stopping now and then as if to look at something */
  function walker(path,speed,phase,seed){ return (r,dt)=>{ if(r.wt===undefined){ r.wt=phase*path.len; r.wd=1; r.pause=0; r.nx=4+hash2(seed,1)*10; }
      if(r.pause>0){ r.pause-=dt; r.anim='Idle'; r.spd=0; return; }
      r.wt+=speed*dt*r.wd; r.nx-=dt; if(r.nx<=0){ r.nx=8+hash2(seed,Math.floor(r.wt))*14; r.pause=1.5+hash2(seed,Math.floor(r.wt)+3)*3.5; }
      if(!path.loop){ if(r.wt>path.len){ r.wt=path.len; r.wd=-1; r.pause=1+hash2(seed,5)*2; } else if(r.wt<0){ r.wt=0; r.wd=1; r.pause=1+hash2(seed,6)*2; } }
      path.at(r.wt,_o); r.x=_o.x; r.z=_o.z; r.y=W().groundY(r.x,r.z); r.ry=Math.atan2(_o.dx*r.wd,_o.dz*r.wd); r.anim='Walk'; r.spd=speed; }; }
  /* talk in a group: mostly standing, now and then a big gesture */
  const talker=seed=>(r,dt,t)=>{ const ph=(t*.09+hash2(seed,7))%1; r.anim=ph<.09?'Wave':'Idle'; };
  const cheer=seed=>(r,dt,t)=>{ r.anim=V.cheerT>0&&hash2(seed,2)<.85?'Wave':((t*.05+hash2(seed,9))%1<.05?'Wave':'Idle'); };
  /* the lift queue: everyone holds a ticket; each chair that passes the load line serves its seats' worth. The next chair's
     riders wait on the line, the rest stand in the maze, one slot (0.95 m) apart; served riders vanish onto the chair and
     walk back in at the entry. */
  const Q={served:0,j:null,n:0,path:null,seats:[]};
  function queueBeh(r,dt){ const R=ST.Resort, qi=r.ticket-Q.served;
    if(r.away>0){ r.away-=dt; r.hide=true; return; }
    if(qi<0){ r.hide=true; r.ticket+=Q.n; r.pd=Math.min(Q.path.len,(r.ticket-Q.served-2)*.95+.6+5+hash2(r.id,r.ticket)*3); r.away=1.5+hash2(r.id,r.ticket+1)*4; return; }   // on the chair; joins the back of the queue a few seconds later
    r.hide=false; const ns=Q.next?Q.next.seats:2;
    if(qi<ns){ const S=Q.seats[qi];   // to the load line: first along the maze to the gate, then straight to the seat
      if(r.pd>.05){ r.pd=Math.max(0,r.pd-1.3*dt); Q.path.at(r.pd,_o); r.x=_o.x; r.z=_o.z; r.ry=Math.atan2(-_o.dx,-_o.dz); r.anim='Walk'; r.spd=1.3; }
      else { const dx=S.x-r.x, dz=S.z-r.z, dd=Math.hypot(dx,dz); if(dd>.06){ const k=Math.min(1,1.2*dt/dd); r.x+=dx*k; r.z+=dz*k; r.ry=Math.atan2(dx,dz); r.anim='Walk'; r.spd=1.2; } else { r.ry=S.ry; r.anim='Idle'; r.spd=0; } } }
    else { const td=(qi-ns)*.95+.6; if(r.pd>td+.04){ r.pd=Math.max(td,r.pd-1.25*dt); r.anim='Walk'; r.spd=1.25; } else { r.anim='Idle'; r.spd=0; }
      Q.path.at(r.pd,_o); r.x=_o.x; r.z=_o.z; r.ry=Math.atan2(-_o.dx,-_o.dz); }
    r.y=W().groundY(r.x,r.z); }
  V.update=function(dt){ if(V.cheerT>0) V.cheerT-=dt; const R=ST.Resort; if(!Q.path||!R||!R.nextChair) return;
    const nc=R.nextChair(R.lastT||0); if(Q.j===null) Q.j=nc.j; let guard=0; while(Q.j<nc.j&&guard++<40){ Q.served+=R.seatsOf(Q.j); Q.j++; } if(Q.j>nc.j+2) Q.j=nc.j;   // chairs that passed the line took their riders
    Q.next=nc; };
  V.cheer=function(){ V.cheerT=6; };
  V.Q=Q;
  /* after the finish line the rider slides on without the run's colliders: keep it out of the buildings, stalls and stands */
  V.keepOut=function(P){ if(!V.T||!V.blds.length) return; const Wd=W(), d=P.s-V.L; if(d<-5) return; const u=P.x-Wd.cx(P.s);
    for(const b of V.blds){ if(b.hd<1.5) continue; const ed=b.hd+.45, eu=b.hu+.45, dd=d-b.d, du=u-b.u; if(Math.abs(dd)>=ed||Math.abs(du)>=eu) continue;
      if(ed-Math.abs(dd)<eu-Math.abs(du)){ P.z=-(V.L+b.d+Math.sign(dd||1)*ed); P.s=-P.z; P.vz=0; } else { P.x=Wd.cx(P.s)+b.u+Math.sign(du||1)*eu; P.vx=0; } } };
  V.populate=function(){ const PP=ST.People; if(!PP||!V.T) return; const F=V.ls, G=-F, Wd=W(), L=V.L, ci='village';
    const at=(d,u)=>{ const s=L+d; return {x:Wd.cx(s)+u,z:-s}; }; let k=0;
    const add=(o,beh,extra)=>{ PP.add(ci,Object.assign({type:'Idle',ry:0},o,{beh},extra||{})); k++; };
    // walkers
    const paths=[[[[98,G*7.6],[186,G*7.6]],[.1,.45,.8]],[[[100,F*7.6],[184,F*7.6]],[.25,.6,.92]],[[...Array(12)].map((_,i)=>[74+Math.cos(i/12*PI*2)*11.5,Math.sin(i/12*PI*2)*11.5]),[0,.33,.66],true],
      [[[52,G*31],[56,G*22],[64,G*11],[70,G*6]],[.3]],[[[18,G*14],[40,G*10],[58,G*8]],[.7]],[[[176,G*4],[185,0],[176,F*4]],[.5]],[[[80,G*31],[86,G*20],[92,G*14]],[.2]],[[[104,F*7.6],[96,F*16],[88,F*22]],[.55]]];
    paths.forEach(([pts,ph,loop],pi)=>{ const path=pathOf(pts,loop); ph.forEach((f,i)=>{ path.at(f*path.len,_o); add({x:_o.x,z:_o.z},walker(path,1.12+hash2(pi,i)*.3,f,pi*10+i)); }); });
    // groups: a ring of people facing its middle
    [[66,G*8.5,3],[50,F*10,2],[76,F*30.5,3],[140,F*9,2],[122,G*9,2],[186,G*5.5,2],[24,F*13,4]].forEach(([d,u,n],gi)=>{ const c=at(d,u); for(let i=0;i<n;i++){ const a=i/n*PI*2+gi, x=c.x+Math.cos(a)*.85, z=c.z+Math.sin(a)*.85; add({x,z,ry:Math.atan2(c.x-x,c.z-z)},talker(gi*7+i)); } });
    // customers at the market stalls, facing the counter
    (V.huts||[]).forEach((h,i)=>{ const n=1+(hash2(i,4)<.5?1:0); for(let q=0;q<n;q++){ const lx=(q-(n-1)/2)*.8, lz=2.6+hash2(i,q)*.4, x=h.x+lx*Math.cos(h.yaw)+lz*Math.sin(h.yaw), z=h.z-lx*Math.sin(h.yaw)+lz*Math.cos(h.yaw); add({x,z,ry:h.yaw+PI},talker(100+i*3+q)); } });
    // sitting: three on the benches round the tree, five on the café terrace
    (V.seats||[]).forEach((st,i)=>{ if(st.kind==='bench'&&i===2) return; if(st.kind==='cafe'&&hash2(i,8)<.3) return; add({x:st.x,z:st.z,ry:st.ry,type:'Sit',anim:'Sit'},null); });
    // spectators on the finish grandstand
    const S=V.spots.stand; if(S){ for(let i=0;i<9;i++){ const row=i%3, lx=-5+i*1.15+hash2(i,2)*.3, lz=-row*.9-.1, x=S.x+lx*Math.cos(S.yaw)+lz*Math.sin(S.yaw), z=S.z-lx*Math.sin(S.yaw)+lz*Math.cos(S.yaw);
      add({x,z,ry:S.yaw},cheer(i),{yFix:S.y+.35+row*.55+.06}); } }
    // the lift queue
    if(V.queuePath){ const pts=[[V.queuePath[0].d,V.queuePath[0].u]].concat(V.queuePath.slice(1).map(p=>[p.d,p.u])); Q.path=pathOf(pts,false); Q.served=0; Q.j=null; Q.n=16;
      const R=ST.Resort, sl=R.sLoad, a=R.cablePoint(sl,-1), b=R.cablePoint(sl-1,-1), ry=Math.atan2(b.x-a.x,b.z-a.z), cx=Math.cos(ry), sx=Math.sin(ry);
      Q.seats=[-.55,.55].map(o=>({x:a.x+o*cx,z:a.z-o*sx,ry}));
      for(let i=0;i<Q.n;i++){ const pd=(i)*.95+.6; Q.path.at(pd,_o); add({x:_o.x,z:_o.z},queueBeh,{ticket:i,pd}); } }
    return k; };

  /* a building for the resort along the run (World chunks place it): the village's house, merged at its own origin */
  V.makeHouse=function(o){ buildAtlas(); const B={body:new Batch(),glass:new Batch(),sign:new Batch(true),bulb:new Batch()}; place(0,0,0,0); const h=house(B,o), g=new THREE.Group();
    SET.forEach(k=>{ const m=B[k].mesh(MAT[k]); if(!m) return; m.castShadow=k==='body'; m.receiveShadow=k!=='bulb'; m.userData.dyn=1; g.add(m); }); g.userData.h=h; return g; };
  V.dispose=function(){ if(!V.group) return; scene.remove(V.group); V.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); V.group=null; V.key=''; };
  /* windows and bulbs follow the time of day of the run (morning, sunset, blue hour, night) */
  V.applyLight=function(){ const n=V.night; MAT.glass.emissiveIntensity=.3+1.25*n; MAT.bulb.emissiveIntensity=1.1+2.2*n; MAT.sign.emissiveIntensity=.12+.55*n; };

  ST.Village=V;
})(window.ST);
