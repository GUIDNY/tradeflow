/* Surf Rush: the beach — the land, the sea and the sky.
   A bay on a warm sea. The shoreline runs along x (z = shoreZ(x)); the land rises toward +z: a wide sand beach, a promenade
   2.2 m up, the town on a gentle slope, dry hills behind. Toward -z the seabed slopes gently to a sandbar ~65 m out (2 m deep)
   and on into deeper water.
   The sea is a sum of Gerstner waves (two swells rolling in toward the beach, a wind sea and a chop). The same function runs
   on the GPU (the water mesh's vertices) and here (waterY: the height the board rides on, solved for the point that the
   waves' sideways motion brings over (x,z)), so the board sits on the surface you see. The waves fade where the water gets
   shallow and run up the sand as swash; foam gathers at the waterline, on the bar and on steep crests. The sky is a dome
   (gradient, sun, soft clouds) that also lights the scene as its environment (the sea reflects it). */
(function(ST){
  const {clamp,lerp,smooth,hash2,vnoise}=ST; const {scene,renderer,camera,sun,hemi}=ST; const PI=Math.PI;
  const C={};
  /* ---------- the land and the seabed ---------- */
  const shoreZ=x=>10*Math.sin(x/170)+4*Math.sin(x/53+1.3);
  const seabed=a=>Math.max(-14,-.045*a+.9*Math.exp(-((a-65)/14)*((a-65)/14))-.035*Math.max(0,a-110));   // a = metres offshore
  const PROM0=44, PROM1=60, PROM_Y=2.2;   // the promenade: from 44 to 60 m inland, 2.2 m above the sea
  function land(x,d){   // d = metres inland from the waterline
    if(d<38) return .04*d+(d>24?.18*Math.sin(x*.21)*Math.sin(d*.6)*smooth(24,30,d):0);   // the beach (small dunes at its back)
    if(d<PROM0) return lerp(.04*38,PROM_Y,smooth(38,PROM0,d));
    if(d<PROM1) return PROM_Y;
    if(d<190) return PROM_Y+(d-PROM1)*.025;
    const e=d-190; return PROM_Y+130*.025+e*.012+3*vnoise(x*.008,d*.008)*smooth(0,80,e); }   // the city on its coastal plain, rising a little inland
  function groundY(x,z){ const d=z-shoreZ(x); return d<0?seabed(-d):land(x,d); }
  C.shoreZ=shoreZ; C.groundY=groundY; C.PROM={d0:PROM0,d1:PROM1,y:PROM_Y}; C.inland=(x,z)=>z-shoreZ(x);
  /* ---------- the sea: Gerstner waves (direction, wavelength, amplitude, steepness) ---------- */
  const G=9.81, WAVES=[[.17,1,48,.42,.55],[-.32,1,31,.2,.5],[.82,.57,11,.085,.6],[.35,.94,5.3,.035,.5]].map(([dx,dz,L,A,Q])=>{ const l=Math.hypot(dx,dz), k=2*PI/L; return {dx:dx/l,dz:dz/l,k,w:Math.sqrt(G*k),A,Q:Q/(k*A*4)}; });
  C.WAVES=WAVES; C.time=0;
  /* ---------- the surf: waves that break on the bar at the west end of the bay ----------
     A wave rolls in every 14 s (a run of heights that repeats, like sets). Each shoals (grows) toward the bar, starts to break
     at its peak 84 m out and peels toward the town (+x) at 4.2 m/s, a quicker close-out the other way. Where it breaks the
     lip is thrown forward over the face and lands in the trough: behind the break point there is a barrel 7 m long (the lip
     takes that long to fall and the tube to fill), and behind the barrel whitewater: a lower bore of foam that runs on to
     the sand. Ahead of the break point the face is steepest and hollow (the pocket) and it flattens and drops along the
     shoulder. Across the crest: a long gentle back, a short concave face and a trough in front of it. The same function
     draws the sea (GPU, from uniforms set each frame) and carries the board (here, with the water's own speed in it); the
     lip that folds over is a mesh of its own (lipMesh), the one thing a height field can't draw. */
  const SURF={x0:-330,x1:-40,peak:-215,off0:150,offB:84,Hmax:3,offBk:12,c:5,peel:4.2,back:11,tube:7,period:14,dir:1,H:[1.9,2.4,2.8,2.1,2.6,2.2,3.0,2.0]};
  // a wave breaks where the water is about 1.3 times as deep as it is high: the biggest 84 m out, a 1.9 m one 71 m out
  SURF.breakOff=H=>SURF.offB-(SURF.Hmax-H)*SURF.offBk; SURF.tb=(SURF.off0-SURF.offB)/SURF.c; C.SURF=SURF;
  const shoreZd=x=>10/170*Math.cos(x/170)+4/53*Math.cos(x/53+1.3);   // the slope of the shoreline
  /* the waves in the water at time t (the last three launched): crest distance offshore, height with shoaling, peak, time since it broke */
  C.surfWaves=function(t,out){ out=out||[]; out.length=0; const S=SURF, n=Math.floor(t/S.period);
    for(let i=n;i>n-3;i--){ const tr=t-i*S.period, off=S.off0-S.c*tr; if(tr<0||off<3) continue; const H=S.H[((i%8)+8)%8];
      const ob=S.breakOff(H); out.push({i,tr,off,Hs:H*lerp(.3,1,smooth(S.off0,ob,off)),px:S.peak+((i*37)%21+21)%21-10,dtb:tr-(S.off0-ob)/S.c,ob}); }
    return out; };
  /* one wave at the point (x, off): the height and what the board needs to know (into o)
     a: along the crest from the peak; qa: ahead of the break point (- behind it); qb: the close-out the other way.
     brk: whitewater (behind the barrel); bar: the barrel (the lip thrown over the face); hol: how hollow the face is. */
  function surfOne(w,x,off,o){ const S=SURF; o.y=0; o.brk=0; o.foam=0; o.k=0; o.u=0; o.Hu=0; o.qa=1e3; o.bar=0; o.hol=0;
    const taper=smooth(S.x0,S.x0+40,x)*(1-smooth(S.x1-40,S.x1,x))*smooth(3,14,off); if(taper<=0) return o;
    const a=(x-w.px)*S.dir, br=w.dtb>0, db=Math.max(w.dtb,0), qa=a-S.peel*db, qb=a+S.back*db;
    const brk=br?smooth(1.5,-1.5,qa+S.tube)*smooth(-1.5,1.5,qb):0;
    const bar=br?smooth(1,-1,qa)*smooth(-1.5,1.5,qa+S.tube)*smooth(-1.5,1.5,qb):0;
    const hol=br?smooth(8,0,qa)*(1-brk):0;
    const k=br?Math.max(Math.exp(-Math.max(qa,0)/16),Math.exp(-Math.max(-qb,0)/10)):.45*smooth(-6,0,w.dtb)*Math.exp(-a*a/900);
    const ev=1+.07*Math.sin((x-w.px)*.11+w.px)+.04*Math.sin((x-w.px)*.27-.7*w.px);   // no crest is the same all along
    const Hu=w.Hs*taper*(.68+.32*k)*ev, Hb=w.Hs*taper*lerp(.55,.28,smooth(S.offB,15,w.off))*ev, u=off-w.off;
    const Lb=5.5*Hu+4, Lf=Hu*(3.4-2*k-.45*hol)+.4, pw=1.4+1.2*k+.8*hol, Lbb=4*Hb+3, Lfb=1.5*Hb+.5;
    let yu=u>=0?Hu*Math.exp(-(u*u)/(Lb*Lb)):(-u<Lf?Hu*Math.pow(1+u/Lf,pw):0);
    if(u<0){ const q=(u+1.15*Lf)/(.6*Lf+.5); yu-=.15*Hu*k*Math.exp(-q*q); }   // the trough: a steep face draws the water off the bottom in front of it
    const yb=u>=0?Hb*Math.exp(-(u*u)/(Lbb*Lbb)):(-u<Lfb?Hb*Math.pow(1+u/Lfb,1.3):0);
    const lip=(1-brk)*(br?smooth(5,0,qa):0)*smooth(.75,.97,yu/Math.max(Hu,.01))*(u<.4?1:0);
    o.y=lerp(yu,yb,brk); o.brk=brk*(u>-Lfb&&u<Lbb?1:0); o.foam=Math.max(brk*(u>-Lfb?Math.exp(-Math.max(u,0)/16):0),lip); o.k=k; o.u=u; o.Hu=Hu; o.Hb=Hb; o.qa=qa; o.Lf=Lf; o.pw=pw; o.bar=bar; o.hol=hol; o.taper=taper; return o; }
  const _sw=[], _so={}, _sb={};
  /* the surf at (x,z): height, and of the wave with the most there: its index, the board's place on it (u: + behind the crest),
     the local face height, how broken, how steep, how far ahead of the peel */
  function surfAt(x,z,t,o){ const off=shoreZ(x)-z; C.surfWaves(t,_sw); o.y=0; o.brk=0; o.foam=0; o.w=null; let best=-1;
    for(const w of _sw){ surfOne(w,x,off,_so); o.y+=_so.y; o.brk=Math.max(o.brk,_so.brk); o.foam=Math.max(o.foam,_so.foam);
      const m=_so.Hu>.05?_so.y/_so.Hu+(Math.abs(_so.u)<40?1:0):-1; if(m>best&&_so.Hu>.05&&Math.abs(_so.u)<45){ best=m; o.w=w; o.u=_so.u; o.Hu=_so.Hu; o.k=_so.k; o.qa=_so.qa; o.Lf=_so.Lf; o.wy=_so.y; o.wbrk=_so.brk; o.bar=_so.bar; } }
    return o; }
  C.surfAt=surfAt;
  // how much of the waves is left where the water is d metres deep (they die at the waterline)
  const ampAt=depth=>smooth(-.1,2.6,depth);
  const depthAt=(x,z)=>{ const d=z-shoreZ(x); return d<0?-seabed(-d):-land(x,d); };
  /* the sea surface at (x,z) and time t: height, the surface's vertical speed, its normal (slopes along x and z) */
  function surf(x0,z0,t,out){ const m=ampAt(depthAt(x0,z0)); let dx=0,dz=0,y=0,vy=0,sx=0,sz=0;
    for(const W of WAVES){ const th=W.k*(W.dx*x0+W.dz*z0)-W.w*t, c=Math.cos(th), s=Math.sin(th), A=W.A*m;
      dx+=W.Q*A*W.dx*c; dz+=W.Q*A*W.dz*c; y+=A*s; vy+=-A*W.w*c; sx+=A*W.k*W.dx*c; sz+=A*W.k*W.dz*c; }
    // swash: near the waterline the sea runs up the sand and back with the first swell
    const sw=1-m; if(sw>0){ const W=WAVES[0], th=W.k*(W.dx*x0+W.dz*z0)-W.w*t; y+=sw*.22*Math.sin(th); vy+=-sw*.22*W.w*Math.cos(th); }
    out.dx=dx; out.dz=dz; out.y=y; out.vy=vy; out.sx=sx; out.sz=sz; return out; }
  const _s={dx:0,dz:0,y:0,vy:0,sx:0,sz:0};
  /* the surface over the point (x,z): the waves carry each water particle in a small circle, so find the particle that is there */
  const _sx={}, _sz={};
  C.water=function(x,z,t,out){ t=t==null?C.time:t; out=out||{}; let x0=x, z0=z; for(let i=0;i<3;i++){ surf(x0,z0,t,_s); x0=x-_s.dx; z0=z-_s.dz; } surf(x0,z0,t,_s);
    out.y=_s.y; out.vy=_s.vy; out.nx=-_s.sx; out.nz=-_s.sz; out.depth=depthAt(x,z);
    // the surf (only near the spot): its height, its slope, how fast it rises under a point, and the water it carries shoreward
    out.brk=0; out.foam=0; out.ux=0; out.uz=0; out.sw=null;
    if(x>SURF.x0-5&&x<SURF.x1+5){ surfAt(x0,z0,t,_sb); if(_sb.w||_sb.y){ const e=.25, hx=surfAt(x0+e,z0,t,_sx).y, hz=surfAt(x0,z0+e,t,_sz).y, gx=(hx-_sb.y)/e, gz=(hz-_sb.y)/e;
      out.y+=_sb.y; out.nx-=gx; out.nz-=gz; out.brk=_sb.brk; out.foam=_sb.foam;
      // the crest moves shoreward at c: a point sees the surface rise at c times the slope along the shore normal
      const sd=shoreZd(x0), nl=Math.hypot(sd,1), nx=-sd/nl, nz=1/nl; out.vy+=-SURF.c*(gx*nx+gz*nz);
      // the water under the wave goes shoreward (shallow water: c·η/(depth+η)), all of it in the whitewater's bore
      // and near the top of a steep face, about to break, nearly as fast as the wave itself (that is what pitches the lip)
      const dep=Math.max(.4,depthAt(x0,z0)), fh=_sb.Hu>.1?_sb.wy/_sb.Hu:0, lipF=_sb.u<.5?_sb.k*smooth(.55,1,fh):0;
      const uw=Math.min(.95,Math.max(0,_sb.y)/(dep+Math.max(0,_sb.y))*1.15+_sb.brk*.55+lipF*.55)*SURF.c; out.ux=nx*uw; out.uz=nz*uw;
      if(_sb.w) out.sw={w:_sb.w,u:_sb.u,Hu:_sb.Hu,k:_sb.k,qa:_sb.qa,Lf:_sb.Lf,y:_sb.wy,brk:_sb.wbrk,bar:_sb.bar,nx,nz}; } }
    return out; };
  C.waterY=(x,z,t)=>C.water(x,z,t,_w).y; const _w={};
  /* where the sea draws the water that starts at (x0,z0): the swell carries it a little sideways and up (the surf's crest is
     defined at the undisplaced point, so this is where a crest, a lip or the foam on it really is) */
  const _sp={dx:0,dz:0,y:0,vy:0,sx:0,sz:0}, _sq={};
  C.surfPoint=function(x0,z0,o){ surf(x0,z0,C.time,_sp); o.x=x0+_sp.dx; o.z=z0+_sp.dz; o.y=_sp.y+surfAt(x0,z0,C.time,_sq).y; return o; };
  /* ---------- GLSL: the same sea ---------- */
  const GLSL_SURF=`
    uniform vec4 uSW[3]; float sFace=0.;   // how far up a wave's open face (0..1, steeper = more): the light through the water near the lip
    float surfOne(vec2 p,vec4 w,out float foam){ foam=0.; if(w.y<=0.) return 0.;
      float off=shoreZ(p.x)-p.y, taper=smoothstep(${SURF.x0.toFixed(1)},${(SURF.x0+40).toFixed(1)},p.x)*(1.-smoothstep(${(SURF.x1-40).toFixed(1)},${SURF.x1.toFixed(1)},p.x))*smoothstep(3.,14.,off); if(taper<=0.) return 0.;
      float a=(p.x-w.z)*${SURF.dir.toFixed(1)}, br=step(0.,w.w)*step(1e-4,w.w), db=max(w.w,0.), qa=a-${SURF.peel.toFixed(2)}*db, qb=a+${SURF.back.toFixed(2)}*db;
      float brk=br*smoothstep(1.5,-1.5,qa+${SURF.tube.toFixed(2)})*smoothstep(-1.5,1.5,qb);
      float hol=br*smoothstep(8.,0.,qa)*(1.-brk);
      float k=br>0.?max(exp(-max(qa,0.)/16.),exp(-max(-qb,0.)/10.)):.45*smoothstep(-6.,0.,w.w)*exp(-a*a/900.);
      float ev=1.+.07*sin((p.x-w.z)*.11+w.z)+.04*sin((p.x-w.z)*.27-.7*w.z);
      float Hu=w.y*taper*(.68+.32*k)*ev, Hb=w.y*taper*mix(.55,.28,smoothstep(${SURF.offB.toFixed(1)},15.,w.x))*ev, u=off-w.x;
      float Lb=5.5*Hu+4., Lf=Hu*(3.4-2.*k-.45*hol)+.4, pw=1.4+1.2*k+.8*hol, Lbb=4.*Hb+3., Lfb=1.5*Hb+.5;
      float yu=u>=0.?Hu*exp(-(u*u)/(Lb*Lb)):(-u<Lf?Hu*pow(1.+u/Lf,pw):0.);
      if(u<0.){ float q=(u+1.15*Lf)/(.6*Lf+.5); yu-=.15*Hu*k*exp(-q*q); }
      float yb=u>=0.?Hb*exp(-(u*u)/(Lbb*Lbb)):(-u<Lfb?Hb*pow(1.+u/Lfb,1.3):0.);
      float lip=(1.-brk)*br*smoothstep(5.,0.,qa)*smoothstep(.75,.97,yu/max(Hu,.01))*step(u,.4);
      foam=max(brk*(u>-Lfb?exp(-max(u,0.)/16.):0.),lip); sFace=max(sFace,(1.-brk)*(u<0.&&-u<Lf?(1.+u/Lf)*(.35+.65*k)*smoothstep(.4,1.2,Hu):0.)); return mix(yu,yb,brk); }
    float surfH(vec2 p,out float foam){ float f0,f1,f2; float h=surfOne(p,uSW[0],f0)+surfOne(p,uSW[1],f1)+surfOne(p,uSW[2],f2); foam=max(f0,max(f1,f2)); return h; }`;
  const GLSL_SEA=`
    uniform float uT;
    float shoreZ(float x){ return 10.*sin(x/170.)+4.*sin(x/53.+1.3); }
    float seabed(float a){ return max(-14.,-.045*a+.9*exp(-((a-65.)/14.)*((a-65.)/14.))-.035*max(0.,a-110.)); }
    float depthAt(vec2 p){ float d=p.y-shoreZ(p.x); return d<0.?-seabed(-d):-(.04*d); }
    void sea(vec2 p,out vec3 disp,out vec3 tx,out vec3 tz,out float crest){ float depth=depthAt(p), m=smoothstep(-.1,2.6,depth); disp=vec3(0.); tx=vec3(1.,0.,0.); tz=vec3(0.,0.,1.); crest=0.;
      ${WAVES.map((W,i)=>`{ vec2 D=vec2(${W.dx.toFixed(5)},${W.dz.toFixed(5)}); float k=${W.k.toFixed(5)}, A=${W.A.toFixed(4)}*m, Q=${W.Q.toFixed(4)}; float th=k*dot(D,p)-${W.w.toFixed(5)}*uT, c=cos(th), s=sin(th);
        disp+=vec3(Q*A*D.x*c,A*s,Q*A*D.y*c); tx+=vec3(-Q*A*k*D.x*D.x*s,A*k*D.x*c,-Q*A*k*D.x*D.y*s); tz+=vec3(-Q*A*k*D.x*D.y*s,A*k*D.y*c,-Q*A*k*D.y*D.y*s); crest+=${i<2?'1.':'.5'}*Q*A*k*s; }`).join('\n      ')}
      float sw=1.-m; float th0=${WAVES[0].k.toFixed(5)}*dot(vec2(${WAVES[0].dx.toFixed(5)},${WAVES[0].dz.toFixed(5)}),p)-${WAVES[0].w.toFixed(5)}*uT; disp.y+=sw*.22*sin(th0); }`+GLSL_SURF;
  C.GLSL_SEA=GLSL_SEA;
  /* ---------- the sky: dome and environment ---------- */
  const SKY={sun:new THREE.Vector3(.42,.5,-.76).normalize(),zen:new THREE.Color(.16,.38,.78),hor:new THREE.Color(.7,.83,.95),sunC:new THREE.Color(1,.93,.78)};
  C.SKY=SKY;
  function skyMaterial(){ return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{uSun:{value:SKY.sun},uZen:{value:SKY.zen},uHor:{value:SKY.hor},uSunC:{value:SKY.sunC},uT:{value:0}},
    vertexShader:'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*.99999; }',
    fragmentShader:`uniform vec3 uSun,uZen,uHor,uSunC; uniform float uT; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vn(p); p*=2.03; a*=.5; } return v; }
      void main(){ vec3 d=normalize(vDir); float h=max(d.y,0.);
        vec3 c=mix(uHor,uZen,pow(smoothstep(0.,.9,h),.6)); c=mix(c,uHor*1.05,smoothstep(.0,-.25,d.y));
        float sd=max(dot(d,uSun),0.); c+=uSunC*(pow(sd,700.)*7.+pow(sd,48.)*.35+pow(sd,6.)*.12);
        // fair-weather cumulus, thickest a little above the horizon, lit on the sun's side
        vec2 cp=d.xz/(d.y+.16)*1.6+vec2(uT*.004,0.); float cl=smoothstep(.52,.78,fbm(cp))*smoothstep(.02,.16,d.y)*(1.-smoothstep(.45,.85,d.y));
        vec3 cc=mix(vec3(.78,.82,.9),vec3(1.,.98,.95),.55+.45*sd); c=mix(c,cc,cl*.85);
        gl_FragColor=vec4(c,1.); }`}); }
  const skyMesh=new THREE.Mesh(new THREE.SphereGeometry(860,48,24),skyMaterial()); skyMesh.renderOrder=-10; skyMesh.frustumCulled=false;
  /* ---------- meshes ---------- */
  const grp=new THREE.Group(); grp.name='coast'; C.group=grp;
  // the land: a grid, fine on the beach and the promenade, coarser inland; colours by what the ground is
  function landMesh(){ const X0=-520, X1=520, NX=200, ds=[]; for(let d=-24;d<70;d+=1) ds.push(d); for(let d=70;d<200;d+=3) ds.push(d); for(let d=200;d<=760;d+=10) ds.push(d);
    const NZ=ds.length, pos=new Float32Array((NX+1)*NZ*3), col=new Float32Array((NX+1)*NZ*3), idx=[]; const c=new THREE.Color(), t=new THREE.Color();
    for(let i=0;i<=NX;i++){ const x=lerp(X0,X1,i/NX); for(let j=0;j<NZ;j++){ const d=ds[j], z=shoreZ(x)+d, y=d<0?seabed(-d):land(x,d), k=(i*NZ+j)*3; pos[k]=x; pos[k+1]=y; pos[k+2]=z;
        const n=hash2(i*7+3,j*13+1);
        if(d<-.5) c.setRGB(.55,.5,.38);                                                   // under the water (seen through the swash)
        else if(d<7) c.setRGB(.66,.58,.44).lerp(t.setRGB(.9,.81,.64),smooth(0,7,d));          // wet sand
        else if(d<PROM0-2) c.setRGB(.9,.8,.62).multiplyScalar(.95+.07*n);                    // dry sand
        else if(d<PROM1+1) c.setRGB(.84,.8,.74);                                            // the promenade
        else if(d<192) c.setRGB(.8,.77,.71).multiplyScalar(.96+.05*n);                       // the town
        else { const r=vnoise(x*.03,d*.03); c.setRGB(.76,.73,.68).lerp(t.setRGB(.55+.06*r,.6+.05*r,.45),.35*smooth(.55,.8,vnoise(x*.012,d*.012))); }   // the city's streets and squares, parks here and there
        c.convertSRGBToLinear(); col[k]=c.r; col[k+1]=c.g; col[k+2]=c.b;   // the palette is sRGB; vertex colours are linear
        if(i<NX&&j<NZ-1){ const a=i*NZ+j, b=(i+1)*NZ+j; idx.push(a,a+1,b,b,a+1,b+1); } } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0});
    m.onBeforeCompile=sh=>{ sh.vertexShader='varying vec3 vWp;\n'+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader='varying vec3 vWp;\nfloat h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }\n'
        +sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n { float g=vn(vWp.xz*7.)*.5+vn(vWp.xz*1.3)*.5; float rip=sin(vWp.x*2.1+vWp.z*.9+vn(vWp.xz*.5)*4.)*.5+.5; diffuseColor.rgb*=.9+.12*g+.04*rip*step(vWp.y,2.);'
          +'  float dd=vWp.z-(10.*sin(vWp.x/170.)+4.*sin(vWp.x/53.+1.3)); float pr=smoothstep('+(PROM0-.6).toFixed(2)+','+(PROM0-.2).toFixed(2)+',dd)*(1.-smoothstep('+(PROM1-1.5).toFixed(2)+','+(PROM1-1.1).toFixed(2)+',dd));'
          +'  if(pr>0.){ float w=dd+1.25*sin(vWp.x*.26)+.45*sin(vWp.x*.71+1.3); float band=step(.5,fract(w*.42));'
          +'   vec3 a=vec3(.62,.6,.57), b=vec3(.8,.76,.69); diffuseColor.rgb=mix(diffuseColor.rgb,mix(a,b,band)*(.94+.1*g),pr); } }'); };
    m.customProgramCacheKey=()=>'st-coast-land';
    const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.name='land'; return mesh; }
  // the sea: a grid that follows the camera, dense under it and sparse toward the horizon; the waves are made in its vertex shader.
  // The patch: a finer grid that follows a breaking wave (its rows along the crest, 9 cm apart across the face and the crest,
  // coarser in front and behind), where the sea's grid is too coarse for a steep face. Both draw the same water with the same
  // material; the sea leaves out what the patch covers.
  const PATCH={half:40,dx:.65,u0:-14,u1:16};
  function waterMaterial(patch){
    const m=new THREE.MeshStandardMaterial({color:0x1b5f7a,roughness:.18,metalness:0});
    m.onBeforeCompile=sh=>{ sh.uniforms.uT=SEA_U.uT; sh.uniforms.uCam=SEA_U.uCam; sh.uniforms.uSun={value:SKY.sun}; sh.uniforms.uZen={value:SKY.zen}; sh.uniforms.uHor={value:SKY.hor}; sh.uniforms.uSunC={value:SKY.sunC}; sh.uniforms.uDbg=SEA_U.uDbg;
      sh.uniforms.uSW=SEA_U.uSW; sh.uniforms.uPatch=SEA_U.uPatch;
      sh.vertexShader='uniform vec3 uCam; uniform vec4 uPatch;\nvarying vec3 vWp; varying vec2 vP0; varying float vDepth; varying float vCrest; varying float vFar; varying float vSurf; varying float vFace;\n'+GLSL_SEA+'\n'+sh.vertexShader
        .replace('#include <beginnormal_vertex>',`${patch?'vec3 wp0=vec3(uPatch.x+position.x,0.,shoreZ(uPatch.x+position.x)-uPatch.y-position.z);':'vec3 wp0=(modelMatrix*vec4(position,1.)).xyz;'} vec3 dsp, tx, tz; float crest; sea(wp0.xz,dsp,tx,tz,crest); vP0=wp0.xz;
          { float sf, sf1, sf2, e=${patch?'.08':'.3'}; sFace=0.; float h=surfH(wp0.xz,sf); float face=sFace; if(h!=0.||sf>0.){ float hx=surfH(wp0.xz+vec2(e,0.),sf1), hz=surfH(wp0.xz+vec2(0.,e),sf2); dsp.y+=h; tx.y+=(hx-h)/e; tz.y+=(hz-h)/e; } vSurf=sf; vFace=face; }
          float far=smoothstep(180.,420.,length(wp0.xz-uCam.xz)); dsp*=1.-far; tx=mix(tx,vec3(1.,0.,0.),far); tz=mix(tz,vec3(0.,0.,1.),far); vSurf*=1.-far;
          vec3 objectNormal=normalize(cross(tz,tx)); vDepth=depthAt(wp0.xz); vCrest=crest*(1.-far); vFar=far;`)
        .replace('#include <begin_vertex>',patch?'vec3 transformed=wp0+dsp;':'vec3 transformed=position+dsp;')
        .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader='uniform float uT; uniform vec3 uSun,uZen,uHor,uSunC; uniform vec4 uDbg, uPatch;\nvarying vec3 vWp; varying vec2 vP0; varying float vDepth; varying float vCrest; varying float vFar; varying float vSurf; varying float vFace;\nfloat h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }\n'+VEDGE+sh.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          float dep=max(vDepth,0.);
          vec3 deep=vec3(.004,.045,.095), mid=vec3(.012,.13,.19), shal=vec3(.05,.26,.27), sand=vec3(.4,.36,.24);
          vec3 wc=mix(shal,mid,smoothstep(.4,3.5,dep)); wc=mix(wc,deep,smoothstep(3.,14.,dep)); wc=mix(sand,wc,smoothstep(0.,.55,dep));
          wc=mix(wc,vec3(.06,.42,.42),pow(clamp(vFace,0.,1.),1.6)*.75*(1.-vFar));   // a wave's face lights up turquoise toward the lip
          // foam: the waterline's lace, the bar's broken water, whitecaps on steep crests
          float n1=vn(vWp.xz*.9+vec2(uT*.35,uT*.12)), n2=vn(vWp.xz*3.1-vec2(uT*.2,uT*.5));
          float shore=smoothstep(.55,.0,dep)*(.55+.45*sin(dep*9.-uT*1.6+n1*3.));
          float bar=smoothstep(2.6,2.1,dep)*smoothstep(1.2,2.0,dep)*smoothstep(.25,.6,vCrest+n1*.3);
          float caps=smoothstep(.42,.62,vCrest+n2*.25)*.65;
          float surfF=vSurf*(.62+.38*smoothstep(.25,.75,n1*.6+n2*.6));   // the surf's whitewater and its curling lip
          float foam=clamp(max(max(shore,max(bar,caps))*(.6+.4*n2),surfF),0.,1.)*(1.-vFar)*uDbg.x;
          // a wave's face: darker at its foot, lines of foam drawn down it from the lip
          float fc=clamp(vFace,0.,1.); wc*=mix(1.,.6,smoothstep(.0,.2,fc)*smoothstep(.6,.15,fc));   // deep blue-green at its foot, as in the photos
          // fine lines along the wave over the face (the ripples stretched as the water climbs it), and thin streaks drawn down from the lip
          wc*=1.+(vn(vec2(vWp.x*.22+uT*.04,fc*26.+vWp.x*.05))-.5)*.14*smoothstep(.08,.8,fc)*(1.-vFar);
          float strk=smoothstep(.78,.97,vn(vec2(vWp.x*5.5+vWp.z*.4,fc*3.2-uT*.3))*.7+vn(vec2(vWp.x*13.,fc*5.))*.3)*smoothstep(.45,.95,fc)*(1.-vFar);
          // whitewater isn't flat white: bubbles and holes in it, thinner foam showing the water; behind the bore it thins to lace
          float cell=vn(vWp.xz*3.7+vec2(uT*.5,uT*.9))*.55+vn(vWp.xz*9.3-vec2(uT*.7,0.))*.45; foam*=mix(1.,smoothstep(.18,.62,cell),.45*smoothstep(.3,1.,vSurf));
          if(vSurf>.01&&vSurf<.9){ float nn=vn(vWp.xz*.8+vec2(7.,uT*.05)), n3=vn(vWp.xz*4.3);   // lace: uneven strands that break up into patches, and blobs where they meet
            float e=vedge(vWp.xz*1.1+vec2(nn*1.7,n3*.6)+vec2(uT*.05,0.)), web=(1.-smoothstep(.02+.06*n3,.09+.16*nn,e))*smoothstep(.3,.62,nn+n3*.35);
            float lace=smoothstep(.85,.35,vSurf); foam=clamp(max(foam*(1.-lace),surfF*mix(1.,web*1.7,lace)),0.,1.); }
          diffuseColor.rgb=mix(wc,vec3(.95,.97,.98),max(foam,strk*.15)); fFoam=foam;`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          { float e=.35; vec2 q=vWp.xz*.55+vec2(uT*.11,uT*.07); float a=vn(q), b=vn(q+vec2(e,0.)), c=vn(q+vec2(0.,e)); vec2 q2=vWp.xz*1.9-vec2(uT*.23,uT*.17); float a2=vn(q2), b2=vn(q2+vec2(e,0.)), c2=vn(q2+vec2(0.,e));
            vec2 q3=vWp.xz*5.7+vec2(uT*.4,-uT*.33); float a3=vn(q3), b3=vn(q3+vec2(e,0.)), c3=vn(q3+vec2(0.,e)); float near=1.-smoothstep(12.,40.,length(vWp-cameraPosition));   // fine ripples close by
            vec3 pn=vec3((a-b)*.32+(a2-b2)*.2+(a3-b3)*.13*near,0.,(a-c)*.32+(a2-c2)*.2+(a3-c3)*.13*near)*(1.-vFar*.8); normal=normalize(normal+(viewMatrix*vec4(pn,0.)).xyz); }`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.65,fFoam);')
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          { // foam scatters the whole sky's light (bright even in the wave's shade); the thin top of a wave's face glows with the light through it
            vec3 vw=normalize(vWp-cameraPosition); float bl=pow(max(dot(vw,uSun),0.),3.);
            vec3 nw0=normalize(inverseTransformDirection(normal,viewMatrix)); float hd=pow(max(dot(-vw,nw0),0.),2.);
            totalEmissiveRadiance+=fFoam*vec3(.2,.22,.24)+(vec3(.04,.36,.3)*uSunC*pow(clamp(vFace,0.,1.),2.2)*(.1+.7*bl)+vec3(.012,.1,.095)*hd*smoothstep(0.,.5,vFace))*(1.-fFoam)*(1.-vFar); }`)
        .replace('#include <dithering_fragment>',`#include <dithering_fragment>
          { // the sky in the sea: the reflected ray's sky colour (the dome's gradient and the sun), weighted by Fresnel
            vec3 nw=normalize(inverseTransformDirection(normal,viewMatrix)), vw=normalize(vWp-cameraPosition), r=reflect(vw,nw); r.y=abs(r.y);
            vec3 sky=mix(uHor,uZen,pow(smoothstep(0.,.9,r.y),.6)); float sd=max(dot(r,uSun),0.); sky+=uSunC*(pow(sd,900.)*9.+pow(sd,60.)*.25);
            float fr=.02+.98*pow(1.-max(dot(-vw,nw),0.),5.); fr=mix(fr,.04,fFoam);
            gl_FragColor.rgb=mix(gl_FragColor.rgb,sky,clamp(fr,0.,1.)*(1.-vFar*.25)*uDbg.y); if(uDbg.z>.5) gl_FragColor.rgb=vec3(fFoam,clamp(vDepth/10.,0.,1.),vCrest*2.); }`)
        .replace('void main() {','float fFoam=0.;\nvoid main() {'+(patch?'':'\n if(uPatch.z>.5){ float pu=10.*sin(vP0.x/170.)+4.*sin(vP0.x/53.+1.3)-vP0.y-uPatch.y; if(abs(vP0.x-uPatch.x)<uPatch.w-.35&&pu>'+(PATCH.u0+.35).toFixed(2)+'&&pu<'+(PATCH.u1-.35).toFixed(2)+') discard; }')); };
    m.customProgramCacheKey=()=>patch?'st-sea-patch':'st-sea'; return m; }
  function seaMesh(){ const N=170, pos=new Float32Array((N+1)*(N+1)*3), idx=[]; const f=t=>700*(.06*t+.94*t*Math.abs(t)*Math.abs(t));
    for(let i=0;i<=N;i++) for(let j=0;j<=N;j++){ const k=(i*(N+1)+j)*3; pos[k]=f(i/N*2-1); pos[k+1]=0; pos[k+2]=f(j/N*2-1); if(i<N&&j<N){ const a=i*(N+1)+j, b=a+N+1; idx.push(a,a+1,b,a+1,b+1,b); } }   // facing up
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius=1e5;
    const mesh=new THREE.Mesh(g,waterMaterial(false)); mesh.receiveShadow=true; mesh.frustumCulled=false; mesh.name='sea'; return mesh; }
  function patchMesh(){ const xs=[], us=[]; for(let x=-PATCH.half;x<=PATCH.half+1e-6;x+=PATCH.dx) xs.push(x);
    for(let u=PATCH.u0;u<PATCH.u1-.05;){ us.push(u); const d=u<-4.8?-4.8-u:u>.7?u-.7:0; u+=.09+.48*(1-Math.exp(-d/2.4)); } us.push(PATCH.u1);
    const NX=xs.length, NU=us.length, pos=new Float32Array(NX*NU*3), idx=[];
    for(let i=0;i<NX;i++) for(let j=0;j<NU;j++){ const k=(i*NU+j)*3; pos[k]=xs[i]; pos[k+1]=0; pos[k+2]=us[j]; if(i<NX-1&&j<NU-1){ const a=i*NU+j, b=a+NU; idx.push(a,b,a+1,a+1,b,b+1); } }   // facing up (u grows offshore)
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(idx); g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e5);
    const mesh=new THREE.Mesh(g,waterMaterial(true)); mesh.receiveShadow=true; mesh.frustumCulled=false; mesh.name='surfPatch'; mesh.visible=false; mesh.userData.verts=NX*NU; return mesh; }
  // the distance to the nearest edge between cells (lacy foam)
  const VEDGE='vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }\nfloat vedge(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8.; for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)), r=g+h22(i+g)-f; float d=dot(r,r); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; } return sqrt(d2)-sqrt(d1); }\n';
  const NOISE='float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }\n';
  const SKYREFL=`{ vec3 nw=normalize(inverseTransformDirection(normal,viewMatrix)), vw=normalize(vWp-cameraPosition), r=reflect(vw,nw); float dn=r.y; r.y=abs(r.y);
            vec3 sky=mix(uHor,uZen,pow(smoothstep(0.,.9,r.y),.6)); float sd=max(dot(r,uSun),0.); sky+=uSunC*(pow(sd,900.)*9.+pow(sd,60.)*.25);
            sky=mix(sky,vec3(.03,.2,.21),smoothstep(.05,-.25,dn));   // reflected down (under the lip): the water, not the sky
            float fr=.02+.98*pow(1.-max(dot(-vw,nw),0.),5.); fr=mix(fr,.04,fFoam); gl_FragColor.rgb=mix(gl_FragColor.rgb,sky,clamp(fr,0.,1.)); }`;
  /* ---------- the lip ----------
     Where the wave breaks, its top is thrown forward over the face and falls into the trough in front of it; under it is the
     barrel. A height field can't fold over, so the lip is a mesh of its own, rebuilt each frame along the crest of the patch's
     wave: from 3.5 m ahead of the break point (where it starts to throw) to the end of the barrel (where it has collapsed into
     whitewater). Across, a thick curl: from the crest out and down along the outside to the tip and back along the inside.
     The lip falls on a ballistic arc in the wave's frame; the further behind the break point, the further it has fallen. */
  const LIP={NA:64,NS:14,ahead:3.5};
  function lipMaterial(){ const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.2,metalness:0,side:THREE.DoubleSide});
    m.onBeforeCompile=sh=>{ sh.uniforms.uT=SEA_U.uT; sh.uniforms.uSun={value:SKY.sun}; sh.uniforms.uZen={value:SKY.zen}; sh.uniforms.uHor={value:SKY.hor}; sh.uniforms.uSunC={value:SKY.sunC};
      sh.vertexShader='attribute vec3 aL; varying vec3 vL; varying vec3 vWp;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vL=aL;')
        .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader='uniform float uT; uniform vec3 uSun,uZen,uHor,uSunC; varying vec3 vL; varying vec3 vWp;\n'+NOISE+sh.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          // the face's turquoise (the top of the face), lighter where the lip is thin; foam at its edge and where it collapses
          vec3 wc=mix(vec3(.05,.35,.365),vec3(.07,.48,.44),vL.y*.7)*mix(1.,.78,vL.z); wc=mix(vec3(.018,.15,.2),wc,max(vL.z,smoothstep(0.,.3,vL.y)));
          float n=vn(vWp.xz*2.3+vec2(uT*.6,0.))*.6+vn(vWp.xz*7.+vec2(0.,uT*1.3))*.4;
          float foam=smoothstep(.3,.7,vL.x+(n-.5)*.55);
          // its rim is torn: holes and tongues of white where it feathers (as in the photos of a pitching lip), more as it collapses
          float rim=smoothstep(.42,.95,vL.x), tear=vn(vWp.xz*4.1+vec2(vWp.y*2.7,uT*2.3))*.65+vn(vWp.xz*11.+vec2(-uT*3.1,vWp.y*6.))*.35; if(rim>.01&&tear<rim*.62) discard;
          diffuseColor.rgb=mix(wc,vec3(.95,.97,.98),foam); fFoam=foam;`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.65,fFoam);')
        .replace('#include <aomap_fragment>','#include <aomap_fragment>\n reflectedLight.directSpecular*=.3;')   // the sun's glint on it: a thin sheet, not a polished band
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          { vec3 vw=normalize(vWp-cameraPosition); float bl=pow(max(dot(vw,uSun),0.),3.); totalEmissiveRadiance+=vec3(.04,.36,.3)*uSunC*(.2+.9*bl)*(.45+.55*vL.y)*(1.-fFoam)+fFoam*vec3(.2,.22,.24); }`)
        .replace('#include <dithering_fragment>','#include <dithering_fragment>\n'+SKYREFL.replace('clamp(fr,0.,1.)','clamp(fr*.32,0.,1.)'))
        .replace('void main() {','float fFoam=0.;\nvoid main() {'); };
    m.customProgramCacheKey=()=>'st-lip'; return m; }
  function lipMesh(){ const NA=LIP.NA, NR=2*(LIP.NS+1), n=(NA+1)*NR, g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3)); g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));
    g.setAttribute('aL',new THREE.BufferAttribute(new Float32Array(n*3),3));   // foam, how far out along the lip (thin), the inside
    const idx=[]; for(let i=0;i<NA;i++) for(let j=0;j<NR-1;j++){ const a=i*NR+j, b=a+NR; idx.push(a,b,a+1,a+1,b,b+1); } g.setIndex(idx); g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e5);
    const mesh=new THREE.Mesh(g,lipMaterial()); mesh.frustumCulled=false; mesh.castShadow=true; mesh.receiveShadow=true; mesh.visible=false; mesh.name='lip'; return mesh; }
  const _lo={}, _l0={dx:0,dz:0,y:0,vy:0,sx:0,sz:0}, _l1={dx:0,dz:0,y:0,vy:0,sx:0,sz:0};
  /* the lip's shape at a point along the crest (into o): how far it has been thrown (lam 0..1), the arc, the thickness */
  function lipAt(w,qa,o){ const S=SURF, db=Math.max(w.dtb,0), x=w.px+S.dir*(S.peel*db+qa); surfOne(w,x,w.off,_lo);
    const Hu=_lo.Hu, Lf=_lo.Lf, qb=(x-w.px)*S.dir+S.back*db;
    o.x=x; o.Hu=Hu; o.lam=w.dtb>0?smooth(1.5,-3.5,qa)*(1-smooth(-S.tube+1,-S.tube-1.5,qa))*smooth(-1.5,1.5,qb)*smooth(.5,1.1,Hu):0;
    o.X=1.45*Lf+.3; o.A=.3*o.X; o.tau=.17*Hu+.14; o.y0=Hu-o.tau*.48; o.yE=-.05*Hu; o.B=o.y0+o.A-o.yE; o.h0=-.1; o.Lf=Lf; return o; }
  C.lipAt=lipAt;
  const _la={};
  function lipUpdate(lip,w){ if(!w||w.dtb<=0){ lip.visible=false; return; }
    const S=SURF, NA=LIP.NA, NS=LIP.NS, NR=2*(NS+1), pos=lip.geometry.attributes.position.array, al=lip.geometry.attributes.aL.array; let any=false;
    for(let i=0;i<=NA;i++){ const qa=lerp(LIP.ahead,-(S.tube+1.5),i/NA), L=lipAt(w,qa,_la), x=L.x, zc=shoreZ(x)-w.off, lam=L.lam;
      // the swell under it: at the crest and where the tip is, so the lip stays on the water it is part of
      surf(x,zc,C.time,_l0); surf(x,zc+L.h0+L.X*lam,C.time,_l1);
      const collapse=smooth(-S.tube+2.5,-S.tube,qa), live=lam>.01?1:0;
      for(let j=0;j<=NS;j++){ const t=j/NS, s=lam*t, hc=L.h0+L.X*s, yc=L.y0+L.A*s-L.B*s*s, ty=L.A-2*L.B*s, tl=Math.hypot(L.X,ty), nh=-ty/tl, ny=L.X/tl, tau=L.tau*(1-.82*s)*live;
        const dx=lerp(_l0.dx,_l1.dx,t), dz=lerp(_l0.dz,_l1.dz,t), dy=lerp(_l0.y,_l1.y,t);
        for(let side=1;side>=-1;side-=2){ const k=side>0?i*NR+j:i*NR+(NR-1-j), h=hc+nh*tau*.5*side, y=yc+ny*tau*.5*side;
          pos[k*3]=x+dx; pos[k*3+1]=y+dy; pos[k*3+2]=zc+h+dz;
          al[k*3]=Math.min(1,smooth(.78,1,t)*(.25+.55*lam)+collapse*.85); al[k*3+1]=s; al[k*3+2]=side<0?1:0; } }
      if(live) any=true; }
    lip.visible=any; if(!any) return; const g=lip.geometry; g.attributes.position.needsUpdate=true; g.attributes.aL.needsUpdate=true; g.computeVertexNormals(); }
  /* ---------- whitewater: foam and spray over the height field's foam ----------
     Puffs of foam boil up where the barrel collapses (the foam ball) and along the front of the bore behind it, carried
     shoreward with it; spray flies up where the lip lands and off the top of the wave. Soft round sprites, lit like foam. */
  const FP={N:2400,i:0}; FP.pos=new Float32Array(FP.N*3); FP.vel=new Float32Array(FP.N*4); FP.life=new Float32Array(FP.N); FP.max=new Float32Array(FP.N); FP.size=new Float32Array(FP.N); FP.kind=new Float32Array(FP.N); FP.seed=new Float32Array(FP.N).map(()=>Math.random());
  const FOAM_U={uH:{value:400}};
  function foamPoints(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(FP.pos,3)); g.setAttribute('aLife',new THREE.BufferAttribute(FP.life,1)); g.setAttribute('aMax',new THREE.BufferAttribute(FP.max,1));
    g.setAttribute('aSize',new THREE.BufferAttribute(FP.size,1)); g.setAttribute('aSeed',new THREE.BufferAttribute(FP.seed,1)); g.setAttribute('aKind',new THREE.BufferAttribute(FP.kind,1));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uH:FOAM_U.uH,uSunC:{value:SKY.sunC}},
      vertexShader:`attribute float aLife; attribute float aMax; attribute float aSize; attribute float aSeed; attribute float aKind; uniform float uH; varying float vA; varying float vS; varying float vK;
        void main(){ float k=aMax>0.?clamp(aLife/aMax,0.,1.):0.; vA=k; vS=aSeed; vK=aKind; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=aMax>0.&&aLife>0.?aSize*(aKind>1.5?.6+1.4*(1.-k):.55+.75*(1.-k))*projectionMatrix[1][1]*uH/max(.5,-mv.z):0.; }`,
      fragmentShader:`uniform vec3 uSunC; varying float vA; varying float vS; varying float vK;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); float n=n2(d*4.5+vS*37.)*.6+n2(d*10.+vS*91.)*.4, edge=.5-.28*n; if(r>edge) discard;
          float a=smoothstep(edge,edge*.25,r)*smoothstep(0.,.35,vA)*smoothstep(1.,.85,vA)*(.55+.45*smoothstep(.3,.7,n2(d*16.+vS*13.)));
          vec3 c=mix(vec3(.84,.89,.92),vec3(1.),clamp(.55-d.y*1.2+.25*n,0.,1.))*mix(vec3(1.),uSunC,.12);
          gl_FragColor=vec4(c,a*(vK>1.5?.28:.85)); }`});
    const pts=new THREE.Points(g,m); pts.frustumCulled=false; pts.name='foam'; pts.renderOrder=2; return pts; }
  // kind: 0 a puff of foam (rises a little, slows), 1 spray (falls)
  function foamEmit(x,y,z,vx,vy,vz,size,life,kind){ const i=FP.i; FP.i=(FP.i+1)%FP.N; FP.kind[i]=kind; FP.pos[i*3]=x; FP.pos[i*3+1]=y; FP.pos[i*3+2]=z; FP.vel[i*4]=vx; FP.vel[i*4+1]=vy; FP.vel[i*4+2]=vz; FP.vel[i*4+3]=kind; FP.life[i]=life; FP.max[i]=life; FP.size[i]=size; }
  const _fw={}, _fl={}; let foamAcc=0;
  function foamUpdate(dt,pts,w){ const R=Math.random, S=SURF, cp=camera.position;
    // emit for the wave the patch is on (about 60 emissions a second, spread over what is near the camera)
    if(w&&w.dtb>0&&dt>0){ foamAcc+=dt; const db=w.dtb, c=S.c, sz=shoreZ(cp.x);
      const iv=1/(ST.Q&&ST.Q.lv<=1?30:60);   // fewer on a slow device
      while(foamAcc>iv){ foamAcc-=iv;
        // the foam ball where the barrel collapses: puffs boiling up the face to about the crest
        { const qa=-S.tube-R()*2.5, L=lipAt(w,qa,_fl); if(L.Hu>.5&&Math.abs(L.x-cp.x)<70) for(let k=0;k<4;k++){ const P=C.surfPoint(L.x+(R()-.5)*2.2,shoreZ(L.x)-w.off+L.Lf*(.15+R()*1.25),_fw);
          foamEmit(P.x,P.y+R()*L.Hu*.55,P.z,S.dir*S.peel*(.3+R()*.5),.4+R()*1.6,c*(.8+R()*.25),.7+R()*1.4,.8+R()*1.1,0); } }
        // the front of the bore behind it, back to where the other way closes out, near the camera
        { const qa0=-S.tube-2, qa1=Math.max(-S.tube-60,-(S.peel+S.back)*db); if(qa1<qa0) for(let k=0;k<3;k++){ const qa=lerp(qa0,qa1,R()), x=w.px+S.dir*(S.peel*db+qa);
          if(Math.abs(x-cp.x)<60){ surfOne(w,x,w.off,_fl); const Hb=_fl.Hb||1; if(Hb>.3){ const P=C.surfPoint(x,shoreZ(x)-w.off+(1.5*Hb+.5)*(R()*.9-.15),_fw);
            foamEmit(P.x,P.y+R()*Hb*.25,P.z,(R()-.5)*.6,.15+R()*.6,c*(.92+R()*.12),.45+R()*.9,.6+R()*.7,0); } } } }
        // spray where the lip lands in the barrel
        for(let k=0;k<4;k++){ const qa=-1-R()*(S.tube-2), L=lipAt(w,qa,_fl); if(L.lam>.7&&Math.abs(L.x-cp.x)<60){ const P=C.surfPoint(L.x,shoreZ(L.x)-w.off+L.h0+L.X*L.lam,_fw);
          foamEmit(P.x,P.y+.1,P.z,(R()-.5)*1.8,2.5+R()*4.5,c*(.5+R()*.5),.07+R()*.14,.6+R()*.6,1);
          if(k===0&&R()<.55) foamEmit(P.x,P.y+.3,P.z,(R()-.5),1.4+R()*2.2,c*(.55+R()*.3),1.1+R()*1.5,1.1+R()*.9,2); } }   // and the cloud of it hanging there
        // the plume blown back off the top of the wave (the wind over the lip: the spray goes out to sea), and drops off the crest
        for(let k=0;k<(R()<.5?1:2);k++){ const qa=-S.tube+R()*(S.tube+12), L=lipAt(w,qa,_fl); if(L.Hu>.9&&Math.abs(L.x-cp.x)<70){ const P=C.surfPoint(L.x+(R()-.5),shoreZ(L.x)-w.off,_fw);
          foamEmit(P.x,P.y+.15,P.z,(R()-.5)*.8,1.6+R()*1.6,c-3-R()*3,.5+R()*.9,1+R()*.8,2);
          foamEmit(P.x,P.y+.05,P.z,(R()-.5)*.6,1+R()*1.6,c-1.5-R()*2.5,.04+R()*.07,.5+R()*.5,1); } }
        // mist over the foam ball
        if(R()<.6){ const qa=-S.tube-R()*3, L=lipAt(w,qa,_fl); if(L.Hu>.5&&Math.abs(L.x-cp.x)<70){ const P=C.surfPoint(L.x+(R()-.5)*3,shoreZ(L.x)-w.off+L.Lf*(.3+R()*.9),_fw);
          foamEmit(P.x,P.y+L.Hu*(.4+R()*.6),P.z,S.dir*S.peel*.4,.6+R()*1.2,c*.8,1.6+R()*1.6,1.2+R()*.8,2); } } } }
    // move
    for(let i=0;i<FP.N;i++){ if(FP.life[i]<=0) continue; FP.life[i]-=dt; const k=i*4, p=i*3;
      const kd=FP.vel[k+3]; if(kd>.5&&kd<1.5&&FP.pos[p+1]<-.35){ FP.life[i]=0; continue; }
      if(kd>1.5){ const d=Math.exp(-1.2*dt); FP.vel[k]*=d; FP.vel[k+1]=FP.vel[k+1]*d-.4*dt; FP.vel[k+2]*=d; } else if(kd>.5){ FP.vel[k+1]-=9.81*dt; } else { FP.vel[k+1]*=Math.exp(-1.6*dt); FP.vel[k]*=Math.exp(-.6*dt); }
      FP.pos[p]+=FP.vel[k]*dt; FP.pos[p+1]+=FP.vel[k+1]*dt; FP.pos[p+2]+=FP.vel[k+2]*dt; }
    const g=pts.geometry; g.attributes.position.needsUpdate=true; g.attributes.aLife.needsUpdate=true; g.attributes.aMax.needsUpdate=true; g.attributes.aSize.needsUpdate=true; g.attributes.aKind.needsUpdate=true;
    FOAM_U.uH.value=renderer.getDrawingBufferSize(_dbs).y/2; }
  const _dbs=new THREE.Vector2();
  const SEA_U={uT:{value:0},uCam:{value:new THREE.Vector3()},uDbg:{value:new THREE.Vector4(1,1,0,0)},uSW:{value:[new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4()]},uPatch:{value:new THREE.Vector4(0,0,0,PATCH.half)}}; C.SEA_U=SEA_U;
  const _uw=[];
  /* the surf's waves for the GPU: crest offshore, height, peak, time since breaking */
  function surfUniforms(){ C.surfWaves(C.time,_uw); SEA_U.uSW.value.forEach((v,i)=>{ const w=_uw[i]; if(w) v.set(w.off,w.Hs,w.px,w.dtb); else v.set(0,0,0,0); }); }
  /* ---------- build, light, follow ---------- */
  let built=false, sea=null, patch=null, lip=null, foam=null, foamT=0;
  C.build=function(){ if(built) return; built=true;
    grp.add(skyMesh); grp.add(landMesh()); sea=seaMesh(); grp.add(sea); patch=patchMesh(); grp.add(patch); lip=lipMesh(); grp.add(lip); foam=foamPoints(); grp.add(foam); scene.add(grp);
    scene.background=SKY.hor.clone(); scene.fog=new THREE.Fog(SKY.hor.clone().lerp(new THREE.Color(1,1,1),.1),260,880);
    hemi.color.setRGB(.62,.76,1); hemi.groundColor.setRGB(.95,.86,.7); hemi.intensity=.5;
    sun.color.copy(SKY.sunC); sun.intensity=2.25;
    ST.gradeCfg={shadow:[.94,1.0,1.08],high:[1.06,1.01,.93],sat:1.14,contrast:1.06,vig:.24}; if(ST.applyGrade) ST.applyGrade(); };
  /* the patch goes on the wave the surfer is on (C.surfFocus: its index), or else on the surf wave nearest to where the camera
     looks, around where it looks along the crest */
  const _cf=new THREE.Vector3(); C.surfFocus=-1; C.patchWave=null;
  function patchUpdate(){ const cp=camera.position, P=SEA_U.uPatch.value; camera.getWorldDirection(_cf);
    const x=clamp(cp.x+_cf.x*18,SURF.x0-PATCH.half+12,SURF.x1+PATCH.half-12), zl=cp.z+_cf.z*12; let best=null, bd=1e9;
    for(const w of _uw){ if(w.Hs<.4||w.off<5) continue; const d=C.surfFocus===w.i?-1:Math.abs(shoreZ(x)-w.off-zl); if(d<bd){ bd=d; best=w; } }
    if(best&&bd<90&&Math.abs(cp.x-x)<160){ P.set(Math.round(x/PATCH.dx)*PATCH.dx,best.off,1,PATCH.half); C.patchWave=best; } else { P.z=0; C.patchWave=null; }
    patch.visible=P.z>.5; }
  /* every frame: the waves' clock, the sea under the camera, the sun's shadow box over the player */
  C.update=function(dt,focus){ C.time+=dt; SEA_U.uT.value=C.time; surfUniforms(); skyMesh.material.uniforms.uT.value=C.time; const cp=camera.position;
    if(sea){ const s=2.5; sea.position.set(Math.round(cp.x/s)*s,0,Math.round(cp.z/s)*s); SEA_U.uCam.value.copy(cp); }
    if(patch){ patchUpdate(); lipUpdate(lip,C.patchWave); const fdt=clamp(C.time-foamT,0,.1); foamT=C.time; foamUpdate(fdt,foam,C.patchWave); }   // the foam moves on the waves' clock
    skyMesh.position.copy(cp);
    const f=focus||cp, sd=SKY.sun; sun.position.set(f.x+sd.x*140,f.y+sd.y*140,f.z+sd.z*140); sun.target.position.set(f.x,f.y,f.z); sun.target.updateMatrixWorld(); };
  /* the world interface the shared modules expect (people stand on it, the rider's hands find the ground) */
  ST.World=Object.assign(ST.World||{},{groundY:(x,z)=>Math.max(groundY(x,z),-.2)});
  C._FP=FP;   // the whitewater's particles (for the debug view and the tests)
  ST.Coast=C;
})(window.ST);
