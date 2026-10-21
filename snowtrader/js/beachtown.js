/* Surf Rush: the beach town. A seafront of white hotels and apartment blocks with balconies over a promenade (palms, lamps,
   benches, kiosks), streets running inland to rows of smaller houses with roof terraces, water tanks and solar heaters. On
   the sand: a lifeguard tower, beach bars on wooden decks, rows of umbrellas and loungers, a volleyball court, and at the
   downwind end of the bay the kite beach with its school. People walk the promenade, sit on the benches and the loungers,
   drink at the bars and watch the kites.
   Everything static is built once into a few merged meshes (one per material); palms, umbrellas and loungers are instanced.
   Coordinates: x along the shore, d = metres inland from the waterline (z = Coast.shoreZ(x) + d); buildings face the sea. */
(function(ST){
  const {clamp,lerp,smooth,hash2}=ST; const {scene}=ST; const PI=Math.PI, Cst=ST.Coast;
  const T={blds:[],solids:[],group:null,spots:{}};
  const wz=(x,d)=>Cst.shoreZ(x)+d, gy=(x,d)=>Cst.groundY(x,wz(x,d));
  /* ---------- batcher: geometry in a local frame (place: position + yaw; local +z = the front), one buffer set per material ---------- */
  const X={ox:0,oy:0,oz:0,c:1,s:0};
  function place(x,y,z,yaw){ X.ox=x; X.oy=y; X.oz=z; X.c=Math.cos(yaw); X.s=Math.sin(yaw); }
  const lin=hex=>new THREE.Color(hex).convertSRGBToLinear();
  function Batch(){ this.p=[]; this.n=[]; this.c=[]; this.u=[]; this.i=[]; this.v=0; }
  Batch.prototype.vert=function(x,y,z,nx,ny,nz,c,u,v){ this.p.push(X.ox+x*X.c+z*X.s,X.oy+y,X.oz-x*X.s+z*X.c); this.n.push(nx*X.c+nz*X.s,ny,-nx*X.s+nz*X.c); this.c.push(c.r,c.g,c.b); this.u.push(u||0,v||0); return this.v++; };
  Batch.prototype.quad=function(a,b,c2,d,n,col,uv){ const i0=this.vert(a[0],a[1],a[2],n[0],n[1],n[2],col,uv?uv[0]:0,uv?uv[3]:0), i1=this.vert(b[0],b[1],b[2],n[0],n[1],n[2],col,uv?uv[2]:0,uv?uv[3]:0),
      i2=this.vert(c2[0],c2[1],c2[2],n[0],n[1],n[2],col,uv?uv[2]:0,uv?uv[1]:0), i3=this.vert(d[0],d[1],d[2],n[0],n[1],n[2],col,uv?uv[0]:0,uv?uv[1]:0); this.i.push(i0,i1,i2,i0,i2,i3); };
  /* a box from y0 up h, centred at (cx,cz); skip: faces to leave out ('+x','-x','+y','-y','+z','-z') */
  Batch.prototype.box=function(cx,y0,cz,w,h,d,col,skip){ const x0=cx-w/2,x1=cx+w/2,y1=y0+h,z0=cz-d/2,z1=cz+d/2, S=skip||[];
    if(!S.includes('+z')) this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],col);
    if(!S.includes('-z')) this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],col);
    if(!S.includes('+x')) this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],col);
    if(!S.includes('-x')) this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],col);
    if(!S.includes('+y')) this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],col);
    if(!S.includes('-y')) this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],col); };
  /* an upright n-sided prism (poles, trunks, tanks) */
  Batch.prototype.cyl=function(cx,y0,cz,r0,r1,h,n,col,cap){ const b=this.v; for(let i=0;i<=n;i++){ const a=i/n*PI*2, ca=Math.cos(a), sa=Math.sin(a); this.vert(cx+ca*r0,y0,cz+sa*r0,ca,0,sa,col); this.vert(cx+ca*r1,y0+h,cz+sa*r1,ca,0,sa,col); }
    for(let i=0;i<n;i++){ const a=b+i*2; this.i.push(a,a+1,a+2,a+2,a+1,a+3); }
    if(cap){ const c0=this.vert(cx,y0+h,cz,0,1,0,col); for(let i=0;i<n;i++){ const a=i/n*PI*2, a2=(i+1)/n*PI*2; const p1=this.vert(cx+Math.cos(a)*r1,y0+h,cz+Math.sin(a)*r1,0,1,0,col), p2=this.vert(cx+Math.cos(a2)*r1,y0+h,cz+Math.sin(a2)*r1,0,1,0,col); this.i.push(c0,p2,p1); } } };
  /* a sloping quad between two heights (roofs, ramps): corners given in local space, normal computed */
  Batch.prototype.tri4=function(a,b,c2,d,col){ const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c2[0]-a[0],c2[1]-a[1],c2[2]-a[2]], n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], l=Math.hypot(n[0],n[1],n[2])||1; this.quad(a,b,c2,d,[n[0]/l,n[1]/l,n[2]/l],col); };
  Batch.prototype.mesh=function(mat){ if(!this.i.length) return null; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2)); g.setIndex(this.i); g.computeBoundingSphere(); const m=new THREE.Mesh(g,mat); return m; };
  /* ---------- signs: one canvas atlas ---------- */
  const SIGNS={surf:['SURF RUSH','חוף הגלשנים','#0b6fa4','#fff'],kite:['KITE SCHOOL','בית ספר לקייטסרף','#ff4f2e','#fff'],surfs:['SURF SCHOOL','בית ספר לגלישה','#0077b6','#fff'],bar1:['BEACH BAR','LA PLAYA','#2a9d8f','#fff'],bar2:['MANGO','BEACH BAR','#f4a261','#2b1a00'],bar3:['SUNSET','BAR · ביץ׳ בר','#e76f51','#fff'],
    h1:['SEA BREEZE','HOTEL','#ffffff','#0b5c8a'],h2:['MARINA','HOTEL ★★★★','#ffffff','#1d3557'],h3:['BLUE BAY','HOTEL','#ffffff','#0077b6'],h4:['CORAL','SUITES','#ffffff','#c2410c'],
    cafe:['CAFÉ','DEL MAR','#264653','#f1faee'],gel:['GELATO','גלידה','#ffb4c8','#7a1f3d'],fal:['FALAFEL','פלאפל','#ffd166','#3a2a00'],pizza:['PIZZA','PRONTO','#d62828','#fff'],shop:['SURF SHOP','ציוד גלישה','#00b4d8','#fff'],
    sushi:['SUSHI','BAR','#111','#fff'],fish:['FISH','& CHIPS','#023e8a','#fff'],guard:['מציל','LIFEGUARD','#d62828','#fff'],juice:['JUICE','מיצים','#80b918','#fff']};
  const atlas={tex:null,uv:{}};
  function buildAtlas(){ if(atlas.tex) return; const W=2048, H=1024, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H);
    const ids=Object.keys(SIGNS), cw=512, ch=170; ids.forEach((id,i)=>{ const [a,b,bg,fg]=SIGNS[id], x=(i%4)*cw, y=Math.floor(i/4)*ch; g.fillStyle=bg; g.fillRect(x+4,y+4,cw-8,ch-8);
      g.strokeStyle=fg; g.globalAlpha=.35; g.lineWidth=4; g.strokeRect(x+14,y+14,cw-28,ch-28); g.globalAlpha=1; g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle';
      const heb=s=>/[֐-׿]/.test(s); g.direction=heb(a)?'rtl':'ltr'; g.font=(heb(a)?'900 66px Rubik, Arial':'72px Anton, Impact, sans-serif'); g.fillText(a,x+cw/2,y+66,cw-50);
      g.direction=heb(b)?'rtl':'ltr'; g.font=(heb(b)?'700 36px Rubik, Arial':'34px Anton, Impact, sans-serif'); g.fillText(b,x+cw/2,y+128,cw-60);
      atlas.uv[id]=[(x+4)/W,1-(y+4)/H,(x+cw-4)/W,1-(y+ch-4)/H]; });
    const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; atlas.tex=t; }
  function sign(Bs,id,lx,ly,lz,w,ry){ const uv=atlas.uv[id]; if(!uv) return; const h=w*170/512, c=Math.cos(ry||0), s=Math.sin(ry||0), hw=w/2, P=(u,v)=>[lx+u*c+0*s,ly+v,lz-u*s];
    Bs.quad(P(-hw,0),P(hw,0),P(hw,h),P(-hw,h),[s,0,c],WHITE,uv); }
  const WHITE=new THREE.Color(1,1,1);
  /* ---------- the pieces ---------- */
  const PAL={white:lin(0xf6f3ee),cream:lin(0xefe4cf),sand:lin(0xe9d8b6),peach:lin(0xf3d1b4),blue:lin(0x2e6f9e),teal:lin(0x2a9d8f),wood:lin(0x9c6b3f),woodD:lin(0x6b4528),straw:lin(0xd8b36a),metal:lin(0x7d848c),dark:lin(0x30353b),
    red:lin(0xd62828),glass:lin(0x6f8ea3),tank:lin(0xe8e8e8),solar:lin(0x1d3557),pink:lin(0xd9468f),green:lin(0x4f7942),stone:lin(0xcfc6b8)};
  const WALLS=[0xf6f3ee,0xf2ead8,0xfaf7f2,0xeadfcd,0xf3e1c9,0xe6eef2,0xf6e7da].map(lin), SHUT=[0x2e6f9e,0x2a9d8f,0x3d405b,0x6b8f71,0xbc6c25,0x1d3557].map(lin), AWN=[0xe63946,0x1d3557,0x2a9d8f,0xf4a261,0x264653,0xe9c46a].map(lin);
  /* a block of flats / a hotel: floors over a shop floor, balconies toward the sea, a parapet, tanks and solar heaters on the roof */
  function building(Bb,Bg,Bs,o){ const w=o.w, d=o.d, nF=o.floors, gH=o.shop?4:3.2, fH=3.1, H=gH+(nF-1)*fH, wall=o.wall, seed=o.seed, sh=SHUT[seed%SHUT.length];
    Bb.box(0,-.8,0,w,H+.8,d,wall,['-y']); Bb.box(0,H,0,w+.1,.7,d+.1,wall,['-y']); Bb.box(0,H,0,w-.5,.06,d-.5,PAL.stone,['-y']);   // body, parapet, roof
    const bays=Math.max(2,Math.round(w/3.6)), bw=w/bays;
    for(let f=0;f<nF;f++){ const y=f===0?0:gH+(f-1)*fH;
      for(let b=0;b<bays;b++){ const x=-w/2+bw*(b+.5);
        if(f===0&&o.shop){ Bg.box(x,.1,d/2+.02,bw-.6,2.9,.04,PAL.glass,['-z']); continue; }
        if(f===0){ if(b%2===0) Bg.box(x,.9,d/2+.02,1.2,1.4,.04,PAL.glass,['-z']); continue; }
        // the sea side: balconies (hotel: every bay; flats: alternate) with glass doors
        if(o.balc&&(o.hotel||b%2===0)){ Bg.box(x,y+.05,d/2+.02,bw*.75,2.3,.04,PAL.glass,['-z']); Bb.box(x,y-.05,d/2+.75,bw-.15,.15,1.5,PAL.white); Bg.box(x,y+.1,d/2+1.48,bw-.15,.95,.05,PAL.glass,['-y']);
          if(!o.hotel) Bb.box(x+bw*.45,y+.1,d/2+.75,.08,2.6,1.4,wall); }
        else { Bg.box(x,y+.8,d/2+.02,1.3,1.5,.04,PAL.glass,['-z']); Bb.box(x-.85,y+.75,d/2+.06,.32,1.6,.06,sh); Bb.box(x+.85,y+.75,d/2+.06,.32,1.6,.06,sh); }
        // the back and the sides: a window a bay
        Bg.box(x,y+.8,-d/2-.02,1.2,1.4,.04,PAL.glass,['+z']); }
      if(f>0) for(const sd of [-1,1]) for(let k=0;k<Math.max(1,Math.round(d/5));k++){ const z=-d/2+(k+.5)*d/Math.max(1,Math.round(d/5)); Bg.box(sd*(w/2+.02),y+.8,z,.04,1.4,1.1,PAL.glass,[sd>0?'-x':'+x']); } }
    if(o.shop){ const aw=AWN[seed%AWN.length]; Bb.tri4([-w/2,3.4,d/2],[w/2,3.4,d/2],[w/2,2.8,d/2+2.2],[-w/2,2.8,d/2+2.2],aw); Bb.tri4([w/2,2.8,d/2+2.2],[-w/2,2.8,d/2+2.2],[-w/2,3.4,d/2],[w/2,3.4,d/2],aw);
      if(o.sign) sign(Bs,o.sign,0,3.5,d/2+.08,Math.min(w*.6,7.5),0); }
    if(o.hsign) sign(Bs,o.hsign,0,H-2.4,d/2+.12,Math.min(w*.7,12),0);
    // the roof: water tanks and solar heaters, an access hut
    const nT=1+(seed%3); for(let k=0;k<nT;k++){ const tx=-w/2+2+k*2.6, tz=-d/2+2.2; Bb.cyl(tx,H,tz,.55,.55,1.2,10,PAL.tank,true); Bb.tri4([tx-.8,H+.3,tz+1.2],[tx+.8,H+.3,tz+1.2],[tx+.8,H+1.2,tz+.2],[tx-.8,H+1.2,tz+.2],PAL.solar); }
    Bb.box(w/2-2.2,H,-d/2+2,2.6,2.3,2.4,wall,['-y']);
    if(o.flowers) Bb.box(-w/2+1.2,0,d/2+.4,1.8,o.floors>2?3.4:2.2,.5,PAL.pink,['-y']);   // bougainvillea by the door
    return H; }
  /* a beach bar on its deck: counter, straw roof, stools, parasols with tables */
  function beachBar(Bb,Bs,o){ Bb.box(0,0,0,16,.42,10,PAL.wood); Bb.box(0,.42,-2.5,7,1.1,1.2,PAL.woodD); Bb.box(0,1.52,-2.5,7.4,.08,1.5,PAL.wood);
    for(const [x,z] of [[-3.6,-4.2],[3.6,-4.2],[-3.6,-.8],[3.6,-.8]]) Bb.cyl(x,.42,z,.09,.09,2.6,6,PAL.woodD);
    Bb.tri4([-4.6,3.4,-5],[4.6,3.4,-5],[4.6,2.9,.2],[-4.6,2.9,.2],PAL.straw); Bb.tri4([4.6,2.9,.2],[-4.6,2.9,.2],[-4.6,3.4,-5],[4.6,3.4,-5],PAL.straw);
    sign(Bs,o.sign,0,3.1,.25,5.2,0);
    for(let i=0;i<5;i++){ const x=-3+i*1.5; Bb.cyl(x,.42,-1.2,.17,.17,.75,8,PAL.dark,true); }
    for(const [x,z] of [[-5.5,2.5],[0,3],[5.5,2.5]]){ Bb.cyl(x,.42,z,.05,.05,2.5,6,PAL.woodD); Bb.cyl(x,2.92,z,1.7,.06,.6,10,PAL.straw); Bb.cyl(x,.42,z,.45,.45,.75,10,PAL.wood,true);
      for(const [a,b] of [[1,0],[-1,0],[0,1]]) Bb.cyl(x+a*.9,.42,z+b*.9,.2,.2,.45,8,PAL.wood,true); } }
  /* the lifeguard tower: on stilts, glazed all round, a ramp, a flag */
  function lifeguard(Bb,Bg,Bs){ for(const [x,z] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]) Bb.cyl(x,0,z,.12,.12,3,6,PAL.white);
    Bb.box(0,3,0,4,.2,4,PAL.white); Bb.box(0,3.2,0,3.4,2.4,3.4,PAL.red,['-y']); Bg.box(0,4.1,1.72,3,1,.04,PAL.glass,['-z']); Bg.box(1.72,4.1,0,.04,1,3,PAL.glass,['-x']); Bg.box(-1.72,4.1,0,.04,1,3,PAL.glass,['+x']);
    Bb.tri4([-2.2,5.6,2.2],[2.2,5.6,2.2],[2.2,6.2,0],[-2.2,6.2,0],PAL.white); Bb.tri4([2.2,5.6,-2.2],[-2.2,5.6,-2.2],[-2.2,6.2,0],[2.2,6.2,0],PAL.white);
    Bb.tri4([-.6,0,-6],[.6,0,-6],[.6,3,-2],[-.6,3,-2],PAL.wood); Bb.cyl(1.8,3.2,1.8,.04,.04,4.4,5,PAL.metal); Bb.box(2.4,6.6,1.8,1.2,.8,.03,PAL.red); sign(Bs,'guard',0,5.75,2.25,2.6,0); }
  function kiosk(Bb,Bg,Bs,o){ Bb.box(0,0,0,3.2,2.6,2.6,o.col); Bg.box(0,.9,1.32,2.4,1.1,.04,PAL.glass,['-z']); Bb.box(0,2.6,.4,3.8,.12,3.6,o.awn); sign(Bs,o.sign,0,2.75,1.35,2.8,0); }
  function lamp(Bb,Bu){ Bb.cyl(0,0,0,.08,.06,5,6,PAL.dark); Bb.box(0,4.9,.5,.12,.08,1.1,PAL.dark); Bb.box(0,4.72,1,.4,.18,.4,PAL.dark); }
  function bench(Bb){ Bb.box(0,.42,0,1.9,.06,.5,PAL.wood); Bb.box(0,.75,-.24,1.9,.36,.06,PAL.wood); for(const sx of [-.8,.8]) Bb.box(sx,0,0,.06,.42,.45,PAL.dark); }
  function kiteSchool(Bb,Bg,Bs){ Bb.box(0,0,0,7,3,4.4,lin(0xfff3e0)); Bg.box(-1.5,.9,2.22,2.6,1.4,.04,PAL.glass,['-z']); Bb.box(2,0,2.22,1.2,2.2,.04,PAL.woodD,['-z']);
    Bb.tri4([-3.8,3,2.6],[3.8,3,2.6],[3.8,3.6,-2.6],[-3.8,3.6,-2.6],lin(0xff6b35)); Bb.box(0,3,0,7.2,.12,4.6,PAL.white,['-y']);
    sign(Bs,'kite',0,3.2,2.5,5.4,0);
    for(let i=0;i<5;i++) Bb.box(-3.2+i*.32,0,3.2,.08,1.4,.42,AWN[i%AWN.length]);   // boards in the rack
    Bb.box(-1.6,0,3.2,3.4,.08,.6,PAL.woodD); }
  /* the surf school at the west end, by the break: a wooden hut, its sign, a rack of boards standing on their tails */
  function surfSchool(Bb,Bg,Bs){ const wood=lin(0xc8a27a), woodD=PAL.woodD; Bb.box(0,0,0,6,2.8,4,wood); Bg.box(1.3,.9,2.02,2.4,1.3,.04,PAL.glass,['-z']); Bb.box(-1.6,0,2.02,1.1,2.1,.04,woodD,['-z']);
    Bb.tri4([-3.4,2.8,2.3],[3.4,2.8,2.3],[3.4,3.5,-2.3],[-3.4,3.5,-2.3],lin(0x0096c7)); Bb.box(0,2.8,0,6.2,.12,4.2,PAL.white,['-y']);
    sign(Bs,'surfs',0,3.05,2.15,5,0);
    const cols=[0xffffff,0xffd166,0xef476f,0x06d6a0,0x118ab2,0xff9f1c,0xf4f1de]; for(let i=0;i<7;i++){ const x=-3.1+i*.55; Bb.box(x,0,3.3,.46,1.85,.07,lin(cols[i])); Bb.box(x,1.1,3.36,.05,.6,.01,lin(0x5a3820)); }   // boards in the rack, their stringers
    Bb.box(-1.45,.55,3.18,3.8,.08,.5,woodD); Bb.box(-3.4,0,3.18,.1,1.1,.5,woodD); Bb.box(.5,0,3.18,.1,1.1,.5,woodD); }
  /* ---------- instanced: palms, umbrellas, loungers ---------- */
  function palmGeo(){ const P=[], N=[], Cc=[], I=[]; let v=0; const vert=(x,y,z,nx,ny,nz,c)=>{ P.push(x,y,z); N.push(nx,ny,nz); Cc.push(c.r,c.g,c.b); return v++; };
    const bark=lin(0x8a6d4b), bark2=lin(0x6e5538), leaf=lin(0x3f7a2e), leaf2=lin(0x2f5e24);
    // the trunk: 9 rings, leaning and curving a little, ringed bark
    const ring=[]; for(let k=0;k<=9;k++){ const t=k/9, y=t*7.2, lx=Math.pow(t,1.6)*.9, r=.24-.08*t; const row=[]; for(let i=0;i<=6;i++){ const a=i/6*PI*2; row.push(vert(lx+Math.cos(a)*r,y,Math.sin(a)*r,Math.cos(a),0,Math.sin(a),k%2?bark:bark2)); } ring.push(row); }
    for(let k=0;k<9;k++) for(let i=0;i<6;i++){ const a=ring[k][i], b=ring[k][i+1], c=ring[k+1][i], d=ring[k+1][i+1]; I.push(a,c,b,b,c,d); }
    // the crown: 10 fronds, each a drooping blade with a fold (two strips)
    const top=[.9,7.2,0]; for(let f=0;f<10;f++){ const a=f/10*PI*2+(f%2)*.3, L=3.2+(f%3)*.4, up=f%2?.5:.15, col=f%3?leaf:leaf2; const ca=Math.cos(a), sa=Math.sin(a);
      let prevL=null, prevR=null, prevC=null; for(let k=0;k<=7;k++){ const t=k/7, r=t*L, y=top[1]+up*Math.sin(t*PI*.6)*1.4-t*t*1.9, w=Math.sin(t*PI)*.55+.05;
        const cx=top[0]+ca*r, cz=top[2]+sa*r, px=-sa*w, pz=ca*w;
        const C2=vert(cx,y+.06,cz,0,1,0,col), Lv=vert(cx+px,y-.12*w,cz+pz,0,1,0,col), Rv=vert(cx-px,y-.12*w,cz-pz,0,1,0,col);
        if(prevC!==null){ I.push(prevC,C2,prevL,prevL,C2,Lv, prevC,prevR,C2,prevR,Rv,C2); } prevL=Lv; prevR=Rv; prevC=C2; } }
    // coconuts
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
  function umbrellaGeo(){ const g1=new THREE.ConeGeometry(1.35,.5,10,1,true); g1.translate(0,2.35,0); const g2=new THREE.CylinderGeometry(.035,.035,2.5,5); g2.translate(0,1.25,0);
    const col=(g,c)=>{ const n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ const y=g.attributes.position.getY(i), k=c||(y>2.2&&((Math.round(Math.atan2(g.attributes.position.getZ(i),g.attributes.position.getX(i))/PI*5+5))%2)?.98:1); a[i*3]=a[i*3+1]=a[i*3+2]=typeof k==='number'?k:1; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); return g; };
    return mergeG([col(g1),col(g2,.35)]); }
  function loungerGeo(){ const B2=new Batch(); place(0,0,0,0); const w=lin(0xf4f1ea), m=PAL.metal; B2.box(0,.32,0,.62,.06,1.3,w); B2.tri4([-.31,.38,-.65],[.31,.38,-.65],[.31,.9,-1.05],[-.31,.9,-1.05],w); B2.tri4([.31,.9,-1.05],[-.31,.9,-1.05],[-.31,.38,-.65],[.31,.38,-.65],w);
    for(const [x,z] of [[-.27,-.6],[.27,-.6],[-.27,.6],[.27,.6]]) B2.box(x,0,z,.04,.32,.04,m);
    const me=B2.mesh(null); return me.geometry; }
  function mergeG(list){ let n=0, ni=0; list.forEach(g=>{ n+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count; }); const P=new Float32Array(n*3), N=new Float32Array(n*3), Cc=new Float32Array(n*3), I=new Uint32Array(ni); let o=0, oi=0;
    list.forEach(g=>{ const c=g.attributes.position.count; P.set(g.attributes.position.array,o*3); N.set(g.attributes.normal.array,o*3); Cc.set(g.attributes.color.array,o*3); if(g.index){ for(let i=0;i<g.index.count;i++) I[oi+i]=g.index.array[i]+o; oi+=g.index.count; } else { for(let i=0;i<c;i++) I[oi+i]=o+i; oi+=c; } o+=c; });
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('normal',new THREE.BufferAttribute(N,3)); g.setAttribute('color',new THREE.BufferAttribute(Cc,3)); g.setIndex(new THREE.BufferAttribute(I,1)); g.computeBoundingSphere(); return g; }
  /* ---------- build ---------- */
  const MAT={body:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0}),glass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.15,metalness:.35}),sign:null,
    inst:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,side:THREE.DoubleSide})};
  T.build=async function(){ if(T.group) return T.group;
    try{ await Promise.race([document.fonts.load('900 64px Rubik'),document.fonts.load('72px Anton'),new Promise(r=>setTimeout(r,1500))]); }catch(e){}
    buildAtlas(); MAT.sign=new THREE.MeshStandardMaterial({map:atlas.tex,roughness:.6,metalness:0,emissive:0xffffff,emissiveMap:atlas.tex,emissiveIntensity:.25});
    const Bb=new Batch(), Bg=new Batch(), Bs=new Batch(); T.blds=[]; T.solids=[]; const grp=new THREE.Group(); grp.name='beachtown';
    const foot=(x,d,w,dd,ry)=>{ const z=wz(x,d); T.blds.push({x0:x-w/2,x1:x+w/2,z0:z-dd/2,z1:z+dd/2}); };
    // --- the seafront: hotels and flats, streets every 60 m ---
    const STREETS=[-180,-120,-60,0,60,120,180], HS=['h1','h2','h3','h4'], SH2=['cafe','gel','pizza','shop','sushi','fish','fal','juice'];
    let hi=0, si=0, seed=1;
    const rowAt=(d0,depth,minF,maxF,shop,balc,hotelEvery)=>{ for(let k=0;k<STREETS.length+1;k++){ const xa=k===0?-246:STREETS[k-1]+6, xb=k===STREETS.length?246:STREETS[k]-6; let x=xa;
        while(x<xb-8){ const w=Math.min(xb-x,10+hash2(seed,3)*16); if(w<8) break; const cx=x+w/2, d=d0+depth/2, base=Math.min(gy(cx-w/2,d0),gy(cx+w/2,d0),gy(cx,d0+depth));
          const hotel=hotelEvery&&hash2(seed,5)<hotelEvery, fl=hotel?maxF+Math.floor(hash2(seed,7)*3):minF+Math.floor(hash2(seed,9)*(maxF-minF+1));
          place(cx,base,wz(cx,d),PI); building(Bb,Bg,Bs,{w,d:depth,floors:fl,wall:hotel?PAL.white:WALLS[seed%WALLS.length],seed,shop:shop&&!hotel,balc,hotel,hsign:hotel?HS[(hi++)%HS.length]:null,sign:shop&&!hotel?SH2[(si++)%SH2.length]:null,flowers:!shop&&hash2(seed,11)<.5});
          foot(cx,d,w,depth); x+=w+1.5+hash2(seed,13)*2; seed++; } } };
    rowAt(62,14,4,7,true,true,.35);       // the seafront
    rowAt(92,12,2,5,false,true,0); rowAt(120,12,2,4,false,false,0); rowAt(148,12,2,4,false,true,0); rowAt(176,11,1,3,false,false,0);
    // --- the promenade: palms, lamps, benches, kiosks ---
    const palms=[], benches=[];
    for(let x=-238;x<=238;x+=16){ const d=48.5; palms.push({x,d,s:.9+hash2(x|0,3)*.3,r:hash2(x|0,5)*6.28}); T.solids.push({x,z:wz(x,d),r:.45}); }
    for(let x=-230;x<=230;x+=24){ place(x,gy(x,57.5),wz(x,57.5),PI); lamp(Bb); }
    for(let x=-230;x<=230;x+=16){ const bx=x+8, d=47; place(bx,gy(bx,d),wz(bx,d),PI); bench(Bb); benches.push({x:bx,z:wz(bx,d)-.06,y:gy(bx,d),ry:PI}); }
    [[-150,'gel',PAL.peach],[-30,'juice',lin(0xd8f3dc)],[90,'fal',lin(0xfff1c1)],[200,'gel',lin(0xffe0ec)]].forEach(([x,id,col],i)=>{ const d=53; place(x,gy(x,d),wz(x,d),PI); kiosk(Bb,Bg,Bs,{col,awn:AWN[i%AWN.length],sign:id}); foot(x,d,3.4,2.8); });
    // the big welcome sign over the promenade
    { const x=40, d=55; place(x,gy(x,d),wz(x,d),PI); Bb.cyl(-3.4,0,0,.12,.12,5.4,8,PAL.white); Bb.cyl(3.4,0,0,.12,.12,5.4,8,PAL.white); Bb.box(0,4.9,0,7.4,1.8,.25,PAL.blue); sign(Bs,'surf',0,4.9,.14,6.9,0); T.solids.push({x:x-3.4,z:wz(x,d),r:.3},{x:x+3.4,z:wz(x,d),r:.3}); }
    // steps down to the sand all along the promenade's edge
    for(let x=-246;x<246;x+=6){ for(let k=0;k<3;k++){ const d=42.6+k*.9; place(x+3,gy(x+3,d+.45)-.02,wz(x+3,d+.45),PI); Bb.box(0,-.3,0,6,.32,.9,PAL.stone,['-y']); } }
    // --- on the sand ---
    { const x=-20, d=15; place(x,gy(x,d),wz(x,d),PI); lifeguard(Bb,Bg,Bs); T.solids.push({x,z:wz(x,d),r:2.4}); T.spots.guard={x,z:wz(x,d)}; }
    const bars=[[-140,'bar1'],[-10,'bar2'],[105,'bar3']]; T.bars=[];
    bars.forEach(([x,id])=>{ const d=29; place(x,gy(x,d),wz(x,d),PI); beachBar(Bb,Bs,{sign:id}); foot(x,d+2.5,7.4,1.6); T.bars.push({x,d}); });
    // volleyball
    { const x=-78, d=22; place(x,gy(x,d),wz(x,d),PI*.5); Bb.cyl(-4.5,0,0,.06,.06,2.5,6,PAL.white); Bb.cyl(4.5,0,0,.06,.06,2.5,6,PAL.white); Bb.box(0,1.55,0,9,.9,.02,lin(0x222222)); Bb.box(0,2.42,0,9,.07,.04,PAL.white); T.spots.volley={x,d}; }
    // the kite beach: the school, boards, kites on the sand
    { const x=218, d=31; place(x,gy(x,d),wz(x,d),PI); kiteSchool(Bb,Bg,Bs); foot(x,d,7.4,4.8); T.spots.school={x,z:wz(x,d)-4,d:d-4}; }
    { const x=-196, d=31; place(x,gy(x,d),wz(x,d),PI); surfSchool(Bb,Bg,Bs); foot(x,d,6.4,4.4); T.spots.surfSchool={x,z:wz(x,d)-4,d:d-4}; }
    T.spots.launch={x:226,z:wz(226,3),d:3}; T.spots.surf={x:-200,z:wz(-200,3),d:3}; T.spots.start={x:60,z:wz(60,51),d:51};
    // --- the meshes ---
    [[Bb,MAT.body,true],[Bg,MAT.glass,false],[Bs,MAT.sign,false]].forEach(([b,m,sh])=>{ const me=b.mesh(m); if(me){ me.castShadow=sh; me.receiveShadow=true; me.matrixAutoUpdate=false; grp.add(me); } });
    // palms: along the promenade, in the town, round the bars
    for(const s of STREETS) for(let d=78;d<175;d+=28) palms.push({x:s+(hash2(s,d)<.5?-4:4),d,s:.8+hash2(s,d+1)*.3,r:hash2(s,d+2)*6.28});
    T.bars.forEach(b=>{ for(const [dx,dd] of [[-9.5,-1],[9.5,-1],[-9,4.5],[9,4.5]]) palms.push({x:b.x+dx,d:b.d+dd,s:.85+hash2(b.x|0,dd)*.25,r:hash2(dx,b.x|0)*6.28}); });
    for(let i=0;i<14;i++){ const x=150+i*10+hash2(i,1)*5, d=36+hash2(i,2)*5; palms.push({x,d,s:.8+hash2(i,3)*.35,r:hash2(i,4)*6.28}); }
    { const pg=palmGeo(), im=new THREE.InstancedMesh(pg,MAT.inst,palms.length), dm=new THREE.Object3D(), tint=new THREE.Color();
      palms.forEach((p,i)=>{ dm.position.set(p.x,gy(p.x,p.d)-.1,wz(p.x,p.d)); dm.rotation.set(0,p.r,0); dm.scale.setScalar(p.s); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); im.setColorAt(i,tint.setRGB(.9+hash2(i,7)*.2,.92+hash2(i,8)*.16,.9)); });
      im.castShadow=true; im.receiveShadow=true; grp.add(im); palms.forEach(p=>{ if(p.d>60) T.solids.push({x:p.x,z:wz(p.x,p.d),r:.4}); }); }
    // umbrellas and loungers in rows on the sand (not on the kite beach)
    const ums=[], lgs=[]; T.loungers=[];
    for(let x=-235;x<135;x+=7.5){ if(Math.abs(x+20)<9||bars.some(b=>Math.abs(x-b[0])<11)||Math.abs(x+78)<9) continue; for(const d of [13,21]){ if(hash2(x|0,d)<.2) continue; const ux=x+hash2(x|0,d+1)*1.5;
        ums.push({x:ux,d,c:AWN[Math.floor(hash2(x|0,d+2)*AWN.length)]}); for(const sd of [-1,1]){ const lx=ux+sd*1.1, ld=d-.3; lgs.push({x:lx,d:ld}); T.loungers.push({x:lx,z:wz(lx,ld)+.15,y:gy(lx,ld)+.3,ry:PI}); } } }
    { const ug=umbrellaGeo(), im=new THREE.InstancedMesh(ug,MAT.inst,ums.length), dm=new THREE.Object3D(); ums.forEach((u,i)=>{ dm.position.set(u.x,gy(u.x,u.d)-.15,wz(u.x,u.d)); dm.rotation.set(.06,hash2(i,1)*6,0); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); im.setColorAt(i,u.c); }); im.castShadow=true; grp.add(im);
      const lg=loungerGeo(), il=new THREE.InstancedMesh(lg,MAT.body,lgs.length); lgs.forEach((l,i)=>{ dm.position.set(l.x,gy(l.x,l.d),wz(l.x,l.d)); dm.rotation.set(0,PI,0); dm.updateMatrix(); il.setMatrixAt(i,dm.matrix); }); il.castShadow=true; il.receiveShadow=true; grp.add(il); }
    T.benches=benches; scene.add(grp); T.group=grp;
    if(ST.Games) T.games=ST.Games.build(T,grp,[{kind:'volleyball',x:T.spots.volley.x,d:T.spots.volley.d},{kind:'matkot',x:24,d:3.4},{kind:'matkot',x:-128,d:4.2}]);
    return grp; };
  /* ---------- for the walker: what is solid, where the walls are, how far one may go ---------- */
  T.out=function(p,r){ let hit=false; for(const b of T.blds){ if(p.x<b.x0-r||p.x>b.x1+r||p.z<b.z0-r||p.z>b.z1+r) continue; hit=true;
      const dl=p.x-(b.x0-r), dr=(b.x1+r)-p.x, dn=p.z-(b.z0-r), df=(b.z1+r)-p.z, m=Math.min(dl,dr,dn,df); if(m===dl) p.x=b.x0-r; else if(m===dr) p.x=b.x1+r; else if(m===dn) p.z=b.z0-r; else p.z=b.z1+r; }
    for(const c of T.solids){ const dx=p.x-c.x, dz=p.z-c.z, dl=Math.hypot(dx,dz), m=c.r+r; if(dl<m){ if(dl>1e-4){ p.x=c.x+dx/dl*m; p.z=c.z+dz/dl*m; } else p.x=c.x+m; hit=true; } }
    return hit; };
  T.inside=function(x,z,pad){ for(const b of T.blds){ if(b.x1-b.x0<4) continue; if(x>b.x0-pad&&x<b.x1+pad&&z>b.z0-pad&&z<b.z1+pad) return true; } return false; };
  T.bounds=function(p){ p.x=clamp(p.x,-250,250); const d=clamp(p.z-Cst.shoreZ(p.x),-2.5,186); p.z=Cst.shoreZ(p.x)+d; };
  /* ---------- people: summer clothes; walking the promenade and the streets, on the benches, the loungers, at the bars ---------- */
  const _o={x:0,z:0,dx:0,dz:1};
  function pathOf(pts,loop){ const P=pts.map(([x,d])=>({x,z:wz(x,d)})); if(loop) P.push(P[0]); const cum=[0]; for(let i=1;i<P.length;i++) cum.push(cum[i-1]+Math.hypot(P[i].x-P[i-1].x,P[i].z-P[i-1].z));
    return {P,cum,len:cum[cum.length-1],loop,at(t,o){ t=this.loop?((t%this.len)+this.len)%this.len:clamp(t,0,this.len); let i=0; while(i<P.length-2&&cum[i+1]<t) i++; const a=P[i], b=P[i+1], f=(t-cum[i])/((cum[i+1]-cum[i])||1); o.x=a.x+(b.x-a.x)*f; o.z=a.z+(b.z-a.z)*f; o.dx=b.x-a.x; o.dz=b.z-a.z; return o; }}; }
  function walker(path,speed,phase,seed){ return (r,dt)=>{ if(r.wt===undefined){ r.wt=phase*path.len; r.wd=1; r.pause=0; r.nx=4+hash2(seed,1)*10; }
      if(r.pause>0){ r.pause-=dt; r.anim='Idle'; r.spd=0; return; }
      r.wt+=speed*dt*r.wd; r.nx-=dt; if(r.nx<=0){ r.nx=8+hash2(seed,Math.floor(r.wt))*14; r.pause=1.5+hash2(seed,Math.floor(r.wt)+3)*3.5; }
      if(!path.loop){ if(r.wt>path.len){ r.wt=path.len; r.wd=-1; r.pause=1+hash2(seed,5)*2; } else if(r.wt<0){ r.wt=0; r.wd=1; r.pause=1+hash2(seed,6)*2; } }
      path.at(r.wt,_o); r.x=_o.x; r.z=_o.z; r.y=ST.World.groundY(r.x,r.z); r.ry=Math.atan2(_o.dx*r.wd,_o.dz*r.wd); r.anim='Walk'; r.spd=speed; }; }
  const talker=seed=>(r,dt,t)=>{ const ph=(t*.09+hash2(seed,7))%1; r.anim=ph<.09?'Wave':'Idle'; };
  T.wz=wz;
  T.populate=function(){ const PP=ST.People; if(!PP) return; PP.clear('beach'); if(ST.Crowd) ST.Crowd.clear(); let n=0; const add=(o,beh)=>{ o.beh=beh; PP.add('beach',o); n++; };
    const CW=ST.Crowd, SEA=PI;   // facing the sea
    // the promenade: people stroll both ways, each on its right; couples side by side; joggers. Up and down the streets. Along the water's edge.
    const prom=pathOf([[-235,52],[235,52]],false), shore=pathOf([[-200,3.6],[140,3.6]],false);
    for(let i=0;i<16;i++){ const lead={x:0,z:0,type:'Walk'}; add(lead,CW.walker({path:prom,speed:1.05+hash2(i,1)*.4,phase:hash2(i,2),seed:i+1,lane:.6+hash2(i,3)*2.6,look:SEA,place:T}));
      if(i%5===2) add({x:0,z:0,type:'Walk'},CW.walker({path:prom,phase:hash2(i,2),seed:i+101,leader:lead,side:hash2(i,4)<.5?-1:1,place:T})); }   // a couple
    for(let i=0;i<4;i++) add({x:0,z:0,type:'Walk'},CW.walker({path:prom,speed:2.55+hash2(i,7)*.6,phase:hash2(i,8),seed:200+i,lane:.4+hash2(i,9)*2.2,jog:true,place:T}));
    [-180,-60,60,180].forEach((sx,k)=>{ for(let j=0;j<2;j++) add({x:0,z:0,type:'Walk'},CW.walker({path:pathOf([[sx,60],[sx,172]],false),speed:1.1+hash2(k,j)*.3,phase:hash2(k,j+3),seed:40+k*2+j,lane:1.2+hash2(k,j+5)*1.4,place:T})); });
    for(let i=0;i<6;i++) add({x:0,z:0,type:'Walk'},CW.walker({path:shore,speed:.95+hash2(i,9)*.35,phase:hash2(i,10),seed:60+i,lane:.4+hash2(i,11)*1.6,look:SEA,pauseEvery:22}));
    for(let i=0;i<2;i++) add({x:0,z:0,type:'Walk'},CW.walker({path:shore,speed:2.8+hash2(i,12)*.4,phase:hash2(i,13),seed:70+i,lane:.3+hash2(i,14),jog:true}));
    // the ball games (js/beachgames.js): volleyball at the court, matkot at the water's edge
    if(ST.Games&&T.games) ST.Games.register(PP,'beach');
    // the benches (every other one) and some loungers
    (T.benches||[]).forEach((b,i)=>{ if(i%2) return; add({x:b.x,z:b.z,yFix:b.y,type:'Sit',ry:b.ry},null); });
    (T.loungers||[]).forEach((l,i)=>{ if(hash2(i,31)<.72) return; add({x:l.x,z:l.z,yFix:l.y,type:'Sit',ry:l.ry},null); });
    // at the bars: standing and talking
    (T.bars||[]).forEach((b,k)=>{ for(let j=0;j<4;j++){ const x=b.x-3+j*2, d=b.d+1.4+(j%2)*1.2; add({x,z:wz(x,d),yFix:gy(b.x,b.d)+.42,type:'Idle',ry:PI*(j%2?1:0)+.3},talker(100+k*4+j)); } });
    // the kite school and the surf school
    if(T.spots.school){ const s=T.spots.school; for(let j=0;j<4;j++){ const x=s.x-3+j*2, z=s.z-1-(j%2); add({x,z,type:'Idle',ry:PI},talker(300+j)); } }
    if(T.spots.surfSchool){ const s=T.spots.surfSchool; for(let j=0;j<3;j++){ const x=s.x-2.5+j*2.4, z=s.z-1.5-(j%2); add({x,z,type:'Idle',ry:PI},talker(320+j)); } }
    return n; };
  ST.BeachTown=T;
})(window.ST);
