/* Rush Air: the flight between the ski village and the beach (flight.html?from=beach&to=snow).
   A boarding pass; then about twenty seconds in the air: the plane rolls down the runway of the airport it leaves (sand, or
   snow), rotates and climbs into the clouds; above them it cruises in the sun over a sea of cloud, contrails behind the
   engines, the camera going round it; then it comes down through the deck near its edge (a few bumpy white seconds inside
   the cloud) and the destination opens up ahead under a clear sky:
   - the beach: Tel Aviv's seafront from the sea, as the planes coming in see it: the surf in lines on the beach and round
     the breakwaters, the promenade, the row of hotels, the white city behind them and the towers further in (the three
     Azrieli towers among them), Jaffa on its hill to the right, the old port and the power station's chimney to the left;
   - the snow: a valley between peaks of snow and rock, forest on its lower slopes with the runs cut through it and the
     lifts up them, the village on the valley floor.
   Gear down, a white fade, and the town, where the player arrives (?arrive=1). A tap on 'skip' lands at once. Sound: the
   engines (filtered noise) and the cabin chime. */
(function(){
  const q=new URLSearchParams(location.search), W=window.RushWallet;
  const PL=W?W.PLACES:{beach:{code:'TLV',name:'חוף תל אביב',page:'beach.html'},snow:{code:'ALP',name:'כפר הסקי',page:'snow.html'}};
  const to=PL[q.get('to')]?q.get('to'):'snow', from=PL[q.get('from')]&&q.get('from')!==to?q.get('from'):(to==='snow'?'beach':'snow');
  const A=PL[from], B=PL[to], $=s=>document.querySelector(s), PI=Math.PI, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t, smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const no=to==='snow'?'RX 204':'RX 117'; $('#pNo').textContent=no; $('#pFrom').textContent=A.code; $('#pTo').textContent=B.code; $('#pFromN').textContent=A.name; $('#pToN').textContent=B.name;
  $('#hFl').textContent=no+' · '+A.code+' ✈ '+B.code; { const d=new Date(); $('#pTime').textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  /* ---------- renderer, sky ---------- */
  const canvas=$('#c'), renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(55,1,4,60000);
  // the sun: over the sea behind the plane in the afternoon (the seafront in its light), or high on the left over the mountains
  const SUN=(to==='beach'?new THREE.Vector3(-.36,.4,-.84):new THREE.Vector3(.62,.5,-.3)).normalize(), skyC={zen:new THREE.Color(.13,.33,.72),hor:new THREE.Color(.72,.84,.96)};
  scene.fog=new THREE.Fog(skyC.hor.clone(),3000,26000);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(50000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{uSun:{value:SUN},uZen:{value:skyC.zen},uHor:{value:skyC.hor}},
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*.99999; }',
    fragmentShader:'uniform vec3 uSun,uZen,uHor; varying vec3 vD; void main(){ vec3 d=normalize(vD); float h=max(d.y,0.); vec3 c=mix(uHor,uZen,pow(smoothstep(0.,.8,h),.55)); c=mix(c,uHor*.95,smoothstep(0.,-.2,d.y)); float s=max(dot(d,uSun),0.); c+=vec3(1.,.93,.8)*(pow(s,900.)*8.+pow(s,40.)*.35+pow(s,5.)*.1); gl_FragColor=vec4(c,1.); }'}));
  scene.add(sky);
  const hemi=new THREE.HemisphereLight(0xcfe3ff,0x8a7a60,.75), sun=new THREE.DirectionalLight(0xfff1dc,2.2); sun.position.copy(SUN).multiplyScalar(1000); scene.add(hemi,sun,sun.target);
  /* ---------- the plane: a twin-engined airliner in the Rush Air livery ---------- */
  function livery(){ const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d'); g.fillStyle='#f7f9fc'; g.fillRect(0,0,1024,256);
    const gr=g.createLinearGradient(0,0,1024,0); gr.addColorStop(0,'#13b6e0'); gr.addColorStop(.6,'#0b4f8a'); gr.addColorStop(1,'#0b2545'); g.fillStyle=gr; g.fillRect(0,168,1024,40); g.fillStyle='#ffc83a'; g.fillRect(0,210,1024,8);
    g.fillStyle='#1b2a3a'; for(let x=90;x<930;x+=21) g.fillRect(x,108,11,15);   // windows
    g.fillRect(880,96,16,52); g.fillRect(140,96,16,52);   // doors
    g.fillStyle='#0b2545'; g.font='bold 70px Anton, Impact, sans-serif'; g.fillText('RUSH AIR',360,78);
    const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t; }
  function wingGeo(span,root,tip,sweep,thick){ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(span,-sweep); s.lineTo(span,-sweep-tip); s.lineTo(0,-root); s.lineTo(0,0);
    const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:true,bevelThickness:thick*.4,bevelSize:thick*.4,bevelSegments:2}); g.rotateX(PI/2); g.translate(0,thick/2,0); return g; }
  const plane=new THREE.Group(), white=new THREE.MeshStandardMaterial({color:0xf3f6fa,roughness:.35,metalness:.15}), grey=new THREE.MeshStandardMaterial({color:0xb9c2cc,roughness:.4,metalness:.5}), dark=new THREE.MeshStandardMaterial({color:0x22262e,roughness:.6});
  { const body=new THREE.Mesh(new THREE.CylinderGeometry(2,2,30,32,1,true),new THREE.MeshStandardMaterial({map:livery(),roughness:.35,metalness:.12})); body.rotation.x=PI/2; body.rotation.y=PI/2; plane.add(body);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(2,32,16,0,PI*2,0,PI/2),white); nose.rotation.x=PI/2; nose.scale.set(1,1.9,1); nose.position.z=15; plane.add(nose);
    const cock=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,1.4),dark); cock.position.set(0,.95,16.4); cock.rotation.x=-.45; plane.add(cock);
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(2,.45,9,32,1,true),white); tail.rotation.x=-PI/2; tail.position.set(0,.85,-19.5); tail.scale.set(1,1,1); plane.add(tail);
    for(const sd of [-1,1]){ const w=new THREE.Mesh(wingGeo(15.5,6.5,1.9,7.5,.5),white); w.scale.x=sd; w.position.set(sd*1.6,-.9,3.2); w.rotation.z=sd*.08; plane.add(w);
      const tipf=new THREE.Mesh(new THREE.BoxGeometry(.15,1.8,1.6),new THREE.MeshStandardMaterial({color:0x13b6e0,roughness:.4})); tipf.position.set(sd*17.1,.35,-5.8); tipf.rotation.z=-sd*.15; plane.add(tipf);
      const st=new THREE.Mesh(wingGeo(6,3.2,1.2,3.2,.3),white); st.scale.x=sd; st.position.set(sd*.6,.9,-19.6); plane.add(st);
      const eng=new THREE.Group(); const nac=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.05,4.6,24,1,true),grey); nac.rotation.x=PI/2; eng.add(nac);
      const intake=new THREE.Mesh(new THREE.CircleGeometry(1.2,24),dark); intake.position.z=2.3; eng.add(intake); const lip=new THREE.Mesh(new THREE.TorusGeometry(1.22,.1,8,24),grey); lip.position.z=2.3; eng.add(lip);
      const pyl=new THREE.Mesh(new THREE.BoxGeometry(.35,1.1,3),grey); pyl.position.set(0,1.1,-.3); eng.add(pyl); eng.position.set(sd*6,-2.1,4.3); plane.add(eng);
      const nav=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),new THREE.MeshBasicMaterial({color:sd<0?0xff2a2a:0x2aff6a})); nav.position.set(sd*17.2,-.3,-5.2); plane.add(nav); }
    const finS=new THREE.Shape(); finS.moveTo(0,0); finS.lineTo(-7.5,8.6); finS.lineTo(-10.5,8.6); finS.lineTo(-7.2,0); finS.lineTo(0,0);
    const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(finS,{depth:.4,bevelEnabled:true,bevelThickness:.15,bevelSize:.15,bevelSegments:2}),new THREE.MeshStandardMaterial({color:0x13b6e0,roughness:.35,metalness:.1}));
    fin.rotation.y=-PI/2; fin.position.set(.2,1.4,-15.5); plane.add(fin);
    const logo=new THREE.Mesh(new THREE.CircleGeometry(1.6,24),new THREE.MeshStandardMaterial({color:0xffc83a,roughness:.4,side:THREE.DoubleSide})); logo.rotation.y=PI/2; logo.position.set(.45,6.2,-20.3); plane.add(logo);
    // the gear (up after take-off, down again for the landing)
    plane.userData.gear=[]; for(const [x,z] of [[0,12],[-3,1],[3,1]]){ const g=new THREE.Group(); const leg=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,2,6),grey); leg.position.y=-1; g.add(leg); const wh=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.5,12),dark); wh.rotation.z=PI/2; wh.position.y=-2.1; g.add(wh); g.position.set(x,-1.6,z); plane.add(g); plane.userData.gear.push(g); }
  }
  plane.traverse(o=>{ if(o.isMesh){ o.castShadow=false; } }); scene.add(plane);
  // contrails: two ribbons of points behind the engines, fading
  const TR=160, trail={pos:new Float32Array(TR*2*3),age:new Float32Array(TR*2),i:0};
  const trGeo=new THREE.BufferGeometry(); trGeo.setAttribute('position',new THREE.BufferAttribute(trail.pos,3)); trGeo.setAttribute('aAge',new THREE.BufferAttribute(trail.age,1));
  const trMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOn:{value:0}},vertexShader:'attribute float aAge; varying float vA; uniform float uOn; void main(){ vA=clamp(1.-aAge/6.,0.,1.)*uOn; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(6.+aAge*16.)*600./max(10.,-mv.z); }',
    fragmentShader:'varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float a=smoothstep(.5,.0,length(d))*vA*.55; if(a<.01) discard; gl_FragColor=vec4(1.,1.,1.,a); }'});
  const trPts=new THREE.Points(trGeo,trMat); trPts.frustumCulled=false; scene.add(trPts); trail.age.fill(99);
  /* ---------- the departure airport: the runway on sand or snow ---------- */
  const airport=new THREE.Group(); scene.add(airport);
  { const snowy=from==='snow', ground=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000),new THREE.MeshStandardMaterial({color:snowy?0xeef3fa:0xd9c49a,roughness:.95})); ground.rotation.x=-PI/2; ground.position.y=-.05; airport.add(ground);
    const c=document.createElement('canvas'); c.width=128; c.height=2048; const g=c.getContext('2d'); g.fillStyle='#3a3d42'; g.fillRect(0,0,128,2048); g.fillStyle='#f2f2f2';
    for(let y=60;y<2048;y+=90) g.fillRect(61,y,6,46); for(let k=0;k<6;k++){ g.fillRect(10+k*9,8,5,40); g.fillRect(70+k*9,8,5,40); g.fillRect(10+k*9,2000,5,40); g.fillRect(70+k*9,2000,5,40); } g.fillRect(3,0,3,2048); g.fillRect(122,0,3,2048);
    const tx=new THREE.CanvasTexture(c); tx.anisotropy=8; tx.encoding=THREE.sRGBEncoding; const rw=new THREE.Mesh(new THREE.PlaneGeometry(45,3000),new THREE.MeshStandardMaterial({map:tx,roughness:.9})); rw.rotation.x=-PI/2; rw.position.set(0,.02,1300); airport.add(rw);
    for(let k=0;k<6;k++){ const b=new THREE.Mesh(new THREE.BoxGeometry(60+k*10,10+k*3,30),new THREE.MeshStandardMaterial({color:snowy?0xd8dce4:0xece6da,roughness:.8})); b.position.set(-140-k*40,5+k*1.5,-120+k*160); airport.add(b); }
    const tw=new THREE.Mesh(new THREE.CylinderGeometry(4,5,34,12),new THREE.MeshStandardMaterial({color:0xe9e6df})); tw.position.set(-110,17,400); airport.add(tw); const cab=new THREE.Mesh(new THREE.CylinderGeometry(7,6,6,12),new THREE.MeshStandardMaterial({color:0x2c4a63,roughness:.2,metalness:.4})); cab.position.set(-110,37,400); airport.add(cab);
    // far off: mountains (the snow) or the city by the sea (the beach)
    for(let k=0;k<26;k++){ const a=k/26*PI*2, r=4200+Math.sin(k*7.3)*600;
      if(snowy){ const m=new THREE.Mesh(new THREE.ConeGeometry(900+Math.sin(k*3.1)*300,1200+Math.sin(k*5.7)*500,7),new THREE.MeshStandardMaterial({color:0xf4f7fb,roughness:.9,flatShading:true})); m.position.set(Math.cos(a)*r,500,Math.sin(a)*r+1300); airport.add(m); }
      else if(Math.sin(a)<.2){ const m=new THREE.Mesh(new THREE.BoxGeometry(60,80+Math.abs(Math.sin(k*5.3))*160,60),new THREE.MeshStandardMaterial({color:0xf2efe8,roughness:.7})); m.position.set(Math.cos(a)*2600,60,Math.sin(a)*2600+1300); airport.add(m); } }
  }
  /* ---------- the cloud deck (above it the cruise; through it the descent; it breaks up before the destination) ---------- */
  const DECK=1800, CLEAR=to==='beach'?3300:3500, cloudU={uT:{value:0},uSun:{value:SUN},uOff:{value:new THREE.Vector2()},uClear:{value:CLEAR}};
  const deck=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000,1,1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:cloudU,fog:false,
    vertexShader:'varying vec2 vP; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vP=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader:`uniform float uT,uClear; uniform vec3 uSun; uniform vec2 uOff; varying vec2 vP; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<6;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
      void main(){ vec2 p=(vP+uOff)*.00042; float d=fbm(p), d2=fbm(p*3.1+5.);
        float cov=smoothstep(.42,.62,d*.75+d2*.35)*(1.-smoothstep(uClear-1600.,uClear+400.,vW.z)); vec3 lit=mix(vec3(.72,.76,.84),vec3(1.,.99,.97),smoothstep(.3,.9,d2+.25)); float dist=length(vW.xz-cameraPosition.xz);
        float fade=1.-smoothstep(14000.,26000.,dist); vec3 c=mix(lit,vec3(.78,.86,.95),smoothstep(6000.,22000.,dist)); if(cameraPosition.y<vW.y) c*=.72;
        gl_FragColor=vec4(c,cov*fade*.97); }`}));
  deck.rotation.x=-PI/2; deck.position.y=DECK; scene.add(deck);
  // puffs on the deck: big soft cumulus heads (sprites), up to where it breaks up
  const PUFF=160, puffPos=new Float32Array(PUFF*3), puffSz=new Float32Array(PUFF); for(let i=0;i<PUFF;i++){ puffPos[i*3]=(Math.random()-.5)*16000; puffPos[i*3+1]=DECK+80+Math.random()*260; puffPos[i*3+2]=-3000+Math.random()*(CLEAR+2700); puffSz[i]=500+Math.random()*900; }
  const puffGeo=new THREE.BufferGeometry(); puffGeo.setAttribute('position',new THREE.BufferAttribute(puffPos,3)); puffGeo.setAttribute('aS',new THREE.BufferAttribute(puffSz,1));
  const puffs=new THREE.Points(puffGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uH:{value:400}},
    vertexShader:'attribute float aS; uniform float uH; varying float vF; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vF=smoothstep(26000.,9000.,-mv.z); gl_PointSize=aS*uH/max(1.,-mv.z); }',
    fragmentShader:'varying float vF; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); float a=smoothstep(.5,.15,r)*vF*.8; if(a<.01) discard; vec3 c=mix(vec3(.8,.84,.9),vec3(1.),smoothstep(.2,-.3,d.y)); gl_FragColor=vec4(c,a); }'}));
  puffs.frustumCulled=false; scene.add(puffs);
  /* ---------- the destination: ahead, past the edge of the clouds ---------- */
  const dest=new THREE.Group(); scene.add(dest);
  // the beach: its shore runs across the route at about ZS (north is +x, so Jaffa's headland lies to the right of the approach);
  // the snow: the valley runs along the route, its village at ZV on a floor FLOOR m up
  const ZS=4900, ZV=6600, FLOOR=300;
  const shoreZ=x=>ZS+40*Math.sin(x/900)+18*Math.sin(x/260+1)-280*Math.exp(-Math.pow((x+3300)/650,2));
  const SHORE='float shoreZ(float x){ return '+ZS.toFixed(1)+'+40.*sin(x/900.)+18.*sin(x/260.+1.)-280.*exp(-pow((x+3300.)/650.,2.)); }';
  const xc=z=>260*Math.sin((z-ZV)/2300);   // the middle of the snow valley
  let seed=11; const R=()=>(seed=seed*16807%2147483647)/2147483647;   // the same town on every flight
  const hsh=(x,z)=>{ const s=Math.sin(x*12.9898+z*78.233)*43758.5453; return s-Math.floor(s); }, vn=(x,z)=>{ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi, u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf); return lerp(lerp(hsh(xi,zi),hsh(xi+1,zi),u),lerp(hsh(xi,zi+1),hsh(xi+1,zi+1),u),v); };
  const box1=new THREE.BoxGeometry(1,1,1); box1.translate(0,.5,0); { const ia=Array.from(box1.index.array); box1.setIndex(ia.slice(0,18).concat(ia.slice(24))); box1.clearGroups(); }   // no floor (never seen)
  /* buildings: one box instanced, its walls given floors and bays of a window texture in metres (the uv from the instance's
     size, so a tower has more floors, not taller windows), its roof plain; frustum culling off (the instances spread far) */
  function Blocks(tex,bay,floor,rough,metal,n){ const m=new THREE.MeshStandardMaterial({map:tex,roughness:rough,metalness:metal});
    m.onBeforeCompile=s=>{ s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#ifdef USE_UV
      vec3 sc=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      vUv=normal.y>.5?vec2(.02,.98):vec2((abs(normal.x)>.5?position.z*sc.z:position.x*sc.x)/${bay.toFixed(2)},position.y*sc.y/${floor.toFixed(2)});
      #endif`); }; m.customProgramCacheKey=()=>'blocks'+bay+'/'+floor;   // the same patch with other sizes: its own program
    const im=new THREE.InstancedMesh(box1,m,n), o=new THREE.Object3D(); im.count=0; im.frustumCulled=false; im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3);   // (setColorAt would size it by the count, 0 here)
    im.add2=(x,y,z,w,d,h,c,ry)=>{ if(im.count>=n) return; o.position.set(x,y,z); o.rotation.set(0,ry||0,0); o.scale.set(w,h,d); o.updateMatrix(); im.setMatrixAt(im.count,o.matrix); im.setColorAt(im.count,c); im.count++; };
    return im; }
  function cellTex(kind){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
    if(kind==='res'){ g.fillStyle='#f1ede5'; g.fillRect(0,0,64,64); g.fillStyle='#4a5662'; g.fillRect(9,14,46,25); g.fillStyle='#8a96a0'; g.fillRect(9,14,46,4); g.fillStyle='#fff'; g.fillRect(0,39,64,9); g.fillStyle='#b8b2a7'; g.fillRect(0,48,64,4); }   // a ribbon window, the balcony under it
    else { const gr=g.createLinearGradient(0,0,0,64); gr.addColorStop(0,'#8fb0c8'); gr.addColorStop(1,'#567892'); g.fillStyle=gr; g.fillRect(0,0,64,64); g.fillStyle='#e3eaf0'; g.fillRect(0,0,3,64); g.fillRect(0,0,64,3); g.fillStyle='#41596d'; g.fillRect(3,53,61,8); }   // glass, mullions, a spandrel
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t; }
  let seaU=null;
  if(to==='beach') beachDest(); else snowDest();
  dest.visible=false;
  /* the seafront. Streets run along the shore (at offsets o inland) and across it (leaning a little north as they go in, as
     Tel Aviv's do): a place on the grid is (x' where its street leaves the shore, o), in the world (x'+LEAN*o, shoreZ+o) */
  function beachDest(){
    const LEAN=.12, at=(xp,o)=>{ const x=xp+LEAN*o; return [x,shoreZ(x)+o]; }, RY=Math.atan(LEAN), C=(r,g,b)=>new THREE.Color(r,g,b);
    const PAR=[124]; for(let o=240;o<8600;){ PAR.push(o); o+=o<3300?110+R()*50:170+R()*80; }
    const CROSS=[]; for(let x=-5600;x<5600;){ CROSS.push(x); x+=100+R()*55; }
    const AYALON=[3230,3420], yarkonX=o=>3420+LEAN*o+260*Math.sin(o/700);   // the motorway's band; the river (x at o): it leaves the shore at 3420 and wanders in
    // the sea: the swell running in to the shore, the sky in it, green-blue over the sand near the beach, the surf in lines
    const BW=[-930,-470,-20,1480,1930,2380].map(x=>new THREE.Vector2(x,shoreZ(x)-150));   // breakwaters, 150 m out
    seaU=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uT:{value:0},uSun:{value:SUN},uZen:{value:skyC.zen},uHor:{value:skyC.hor},uBW:{value:BW}}]);
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(80000,44000),new THREE.ShaderMaterial({uniforms:seaU,fog:true,
      vertexShader:`varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uT; uniform vec3 uSun,uZen,uHor; uniform vec2 uBW[6]; varying vec3 vW;
        #include <fog_pars_fragment>
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        ${SHORE}
        void main(){ float d=shoreZ(vW.x)-vW.z; vec2 p=vW.xz;   // d: metres out from the shore
          // the surface's slope: the swell coming in, a cross sea, a chop; patchy
          vec2 g=vec2(.04,1.)*cos(dot(p,vec2(.04,1.))*.05+uT*1.1)*.05+vec2(.55,.83)*cos(dot(p,vec2(.55,.83))*.12+uT*1.7)*.03+vec2(-.8,.6)*cos(dot(p,vec2(-.8,.6))*.27+uT*2.4)*.02;
          g*=.5+n(p*.003)+.5*n(p*.011);
          vec3 N=normalize(vec3(-g.x,1.,-g.y)), V=normalize(cameraPosition-vW), Rf=reflect(-V,N);
          float F=.02+.98*pow(1.-max(dot(N,V),0.),5.);
          vec3 sky=mix(uHor,uZen,pow(smoothstep(0.,.8,max(Rf.y,0.)),.55));
          vec3 w=mix(vec3(.3,.7,.68),vec3(.09,.42,.55),smoothstep(20.,260.,d)); w=mix(w,vec3(.05,.27,.42),smoothstep(300.,2500.,d));
          vec3 c=mix(w,sky,F); float s=max(dot(Rf,uSun),0.); c+=vec3(1.,.93,.8)*(pow(s,400.)*4.+pow(s,40.)*.12);
          // white water: the wash on the sand, the lines of the surf breaking in, foam round the breakwaters
          float fo=(1.-smoothstep(0.,10.,d))*.85;
          for(int i=0;i<3;i++){ float fi=float(i), L=22.+fi*34.+5.*sin(vW.x*.011+fi*2.1+uT*.35), wd=3.+fi*1.4; fo=max(fo,(1.-smoothstep(0.,wd,abs(d-L)))*(.35+.65*n(vec2(vW.x*.025+fi*7.,uT*.25)))*(1.-fi*.25)); }
          for(int i=0;i<6;i++){ vec2 b=uBW[i]; float e=length(vec2(max(abs(vW.x-b.x)-55.,0.),vW.z-b.y)); fo=max(fo,(1.-smoothstep(3.,14.,e))*(.45+.55*n(vec2(vW.x*.05,vW.z*.05+uT*.3)))); }
          c=mix(c,vec3(.93,.96,.97),clamp(fo,0.,1.));
          gl_FragColor=vec4(c,1.);
          #include <fog_fragment>
        }`}));
    sea.rotation.x=-PI/2; sea.position.set(0,0,ZS+400-22000); dest.add(sea);
    const rock=new THREE.MeshStandardMaterial({color:0x5d5952,roughness:1});
    for(const b of BW){ const m=new THREE.Mesh(new THREE.BoxGeometry(110,3,9),rock); m.position.set(b.x,.5,b.y); dest.add(m); }
    // the marina (by Gordon beach): two arms of rock out into the sea round its basin, its boats
    { const x0=720, x1=1010, z0=shoreZ(860); for(const [x,z,w,d] of [[x0,z0-90,10,190],[(x0+x1)/2+30,z0-185,x1-x0-60,10],[x1,z0-70,10,150]]){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,3,d),rock); m.position.set(x,.5,z); dest.add(m); }
      const bt=new THREE.InstancedMesh(box1,new THREE.MeshStandardMaterial({color:0xf6f6f2,roughness:.5}),70), o=new THREE.Object3D(); bt.frustumCulled=false;
      for(let i=0;i<70;i++){ o.position.set(x0+20+(i%10)*25,0,z0-40-Math.floor(i/10)*18); o.rotation.y=PI/2; o.scale.set(4,2.5,11); o.updateMatrix(); bt.setMatrixAt(i,o.matrix); } dest.add(bt); }
    // boats out at sea
    for(let i=0;i<9;i++){ const b=new THREE.Mesh(box1,new THREE.MeshStandardMaterial({color:0xfbfbf8,roughness:.5})), x=-3500+R()*7000, z=ZS-500-R()*2500; b.position.set(x,0,z); b.scale.set(5,3,16); b.rotation.y=R()*PI; dest.add(b); }
    // the land: the town's map painted on one plane, the sea cut out of it along the shore; plain land round it into the haze
    const X0=-6000, LW=12000, Z0=ZS-420, LD=9000;
    const land=new THREE.Mesh(new THREE.PlaneGeometry(LW,LD),new THREE.MeshStandardMaterial({map:cityMap(),alphaTest:.5,roughness:.95}));
    land.rotation.x=-PI/2; land.position.set(X0+LW/2,1.5,Z0+LD/2); dest.add(land);
    const haze=new THREE.MeshStandardMaterial({color:0xb7b4ab,roughness:1}), sandM=new THREE.MeshStandardMaterial({color:0xe6d3a8,roughness:1});
    const far=new THREE.Mesh(new THREE.PlaneGeometry(80000,36000),haze); far.rotation.x=-PI/2; far.position.set(0,1.5,Z0+LD+18000); dest.add(far);
    const ribbon=(xa,xb,za,zb,y,n,mat)=>{ const p=[], idx=[]; for(let i=0;i<=n;i++){ const x=lerp(xa,xb,i/n); p.push(x,y,za(x),x,y,zb(x)); } for(let i=0;i<n;i++){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setIndex(idx); g.computeVertexNormals(); const m=new THREE.Mesh(g,mat); dest.add(m); return m; };
    for(const [xa,xb] of [[-40000,X0],[X0+LW,40000]]){ ribbon(xa,xb,x=>shoreZ(x)-3,x=>shoreZ(x)+80,1.5,90,sandM); ribbon(xa,xb,x=>shoreZ(x)+80,()=>Z0+LD,1.5,90,haze); }
    /* the buildings */
    const res=Blocks(cellTex('res'),4,3.2,.85,0,14000), gls=Blocks(cellTex('glass'),3.6,3.8,.25,.35,600); dest.add(res,gls);
    const tint=()=>{ const r=R(); return r<.55?C(.97,.96,.93):r<.75?C(.95,.91,.83):r<.9?C(.88,.89,.9):C(.93,.85,.76); }, gtint=()=>C(.85+R()*.15,.9+R()*.1,.95+R()*.05);
    const put=(xp,o,w,d,h,glass,c)=>{ const [x,z]=at(xp,o); (glass?gls:res).add2(x,1.5,z,w,d,h,c||(glass?gtint():tint()),RY); };
    // the hotels along the promenade, from Charles Clore park to the old port (the marina and Independence park between them)
    for(let xp=-1680;xp<2750;){ if(xp>690&&xp<1030){ xp=1030; continue; } if(xp>1260&&xp<1640){ xp=1640; continue; }
      const tall=R()<.42, w=tall?24+R()*16:40+R()*34, d=16+R()*10, h=tall?72+R()*58:30+R()*42, o=150+R()*40;
      put(xp+w/2,o+d/2,w,d,h,R()<.28); xp+=w+14+R()*48; }
    // the city on its blocks: low and white near the sea, taller further in; towers here and there, more of them past the motorway
    for(let i=1;i<PAR.length-1;i++) for(let j=0;j<CROSS.length-1;j++){ const oa=PAR[i]+9, ob=PAR[i+1]-9, xa=CROSS[j]+8, xb=CROSS[j+1]-8, om=(oa+ob)/2, xm=(xa+xb)/2;
      if(ob>AYALON[0]&&oa<AYALON[1]) continue; if(Math.abs(xm+LEAN*om-yarkonX(om))<380) continue;   // the motorway, the Yarkon park
      const [wx,wz]=at(xm,om); if(Math.hypot(wx+3300,wz-shoreZ(-3300)-250)<720) continue; if(wx>X0+LW-300||wx<X0+300) continue;   // old Jaffa is built apart; the map's edges
      const out=om>AYALON[1], mid=om>1700, cell=out?56:mid?36:27;
      if(R()<(out?.1:.05)) continue;                                                           // a park, a school yard
      if(R()<(out?.09:mid?.05:.025)){ put(xm,om,22+R()*16,22+R()*16,out?70+R()*110:45+R()*70,R()<.6); continue; }   // a tower on the block
      for(let a=xa;a<xb-cell*.6;a+=cell) for(let b=oa;b<ob-cell*.6;b+=cell){ const edge=a===xa||b===oa||a+cell>=xb-cell*.6||b+cell>=ob-cell*.6; if(!edge&&R()<.6) continue; if(R()<.12) continue;
        const w=cell*(.62+R()*.3), d=cell*(.6+R()*.3), h=out?14+R()*22:mid?12+R()*12:10+R()*8; put(a+cell/2,b+cell/2,w,d,h,false); } }
    // the towers: the three Azrieli towers (round, triangle, square) and Sarona; the old Shalom tower; Ramat Gan's cluster past them
    const glassTex=cellTex('glass'), gmat=new THREE.MeshStandardMaterial({map:glassTex,roughness:.2,metalness:.4});
    const tower=(geo,xp,o,h,circ)=>{ const g=geo.clone(); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*circ/3.6,uv.getY(i)*h/3.8); const m=new THREE.Mesh(g,gmat); const [x,z]=at(xp,o); m.position.set(x,1.5+h/2,z); dest.add(m); return m; };
    tower(new THREE.CylinderGeometry(25,25,187,32,1),130,3520,187,157);
    tower(new THREE.CylinderGeometry(33,33,169,3,1),230,3600,169,171).rotation.y=.4;
    put(330,3520,42,42,154,true); put(20,3640,46,40,238,true); put(-850,880,38,38,142,true);
    for(let i=0;i<16;i++) put(600+R()*1200,4250+R()*1100,26+R()*18,26+R()*18,110+R()*130,R()<.75);
    for(let i=0;i<10;i++) put(-200+R()*900,3480+R()*420,24+R()*14,24+R()*14,90+R()*90,R()<.7);
    // Jaffa on its hill: old stone houses, St Peter's belfry, the clock tower, the sea mosque's minaret; its little port
    { const jx=-3300, jz=shoreZ(-3300)+250, hill=new THREE.Mesh(new THREE.SphereGeometry(340,40,12,0,PI*2,0,PI/2),new THREE.MeshStandardMaterial({color:0xc9b38c,roughness:1}));
      hill.scale.y=34/340; hill.position.set(jx,0,jz); dest.add(hill);
      const stone=Blocks(cellTex('res'),3.5,3.4,.95,0,700); dest.add(stone); const sc=()=>C(.86+R()*.06,.74+R()*.06,.55+R()*.06);
      for(let i=0;i<620;i++){ const a=R()*PI*2, r=Math.sqrt(R())*(i<300?330:900), x=jx+Math.cos(a)*r, z=jz+Math.sin(a)*r; if(z<shoreZ(x)+15) continue;
        const hy=r<340?34*Math.sqrt(1-(r/340)**2):0; stone.add2(x,hy+1,z,9+R()*12,9+R()*12,6+R()*9,sc(),R()*PI); }
      stone.add2(jx-60,34,jz-40,16,40,16,C(.9,.82,.66),.3); stone.add2(jx-70,34,jz-70,9,9,40,C(.9,.82,.66),.3);   // St Peter's: the nave, the belfry
      stone.add2(jx+240,1.5,jz+260,6,6,27,C(.88,.8,.64),0);                                                    // the clock tower
      const mn=new THREE.Mesh(new THREE.CylinderGeometry(2,2.4,30,10),new THREE.MeshStandardMaterial({color:0xe8e0cc})); mn.position.set(jx+120,16,jz-210); dest.add(mn);
      const pb=new THREE.Mesh(new THREE.BoxGeometry(12,3,260),rock); pb.position.set(jx+420,.5,shoreZ(jx+420)-120); pb.rotation.y=-.5; dest.add(pb); }
    // the old port: its hangars on the deck; the Reading power station north of the Yarkon's mouth, its tall chimney
    for(let i=0;i<9;i++){ const x=2900+i*68, z=shoreZ(x)+60+R()*80; res.add2(x,1.5,z,52,26,9+R()*5,C(.86,.87,.88),RY); }
    { const x=3820, z=shoreZ(x)+170; res.add2(x,1.5,z,100,52,34,C(.84,.85,.86),RY); const ch=new THREE.Mesh(new THREE.CylinderGeometry(4.5,6.5,150,16),new THREE.MeshStandardMaterial({color:0xd9dcde,roughness:.6})); ch.position.set(x+20,76,z+10); dest.add(ch);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,14,16),new THREE.MeshStandardMaterial({color:0xb03a2e,roughness:.6})); top.position.set(x+20,144,z+10); dest.add(top); }
    // the town's map: blocks, streets (wide ones darker), boulevards and parks with their trees, the Yarkon, the beach, the promenade
    function cityMap(){ const cw=2048, c=document.createElement('canvas'); c.width=c.height=cw; const g=c.getContext('2d'), kx=cw/LW, kz=cw/LD, px=x=>(x-X0)*kx, pz=z=>(z-Z0)*kz;
      const band=(xa,xb,oa,ob,fill)=>{ g.fillStyle=fill; g.beginPath(); for(let x=xa;x<=xb;x+=25) g.lineTo(px(x),pz(shoreZ(x)+oa)); for(let x=xb;x>=xa;x-=25) g.lineTo(px(x),pz(shoreZ(x)+ob)); g.closePath(); g.fill(); };
      const line=(pts,w,stroke)=>{ g.strokeStyle=stroke; g.lineWidth=Math.max(1,w*kx); g.lineCap='round'; g.lineJoin='round'; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(px(p[0]),pz(p[1])):g.moveTo(px(p[0]),pz(p[1]))); g.stroke(); };
      const dot=(x,z,r,fill)=>{ g.fillStyle=fill; g.beginPath(); g.arc(px(x),pz(z),Math.max(.9,r*kx),0,PI*2); g.fill(); };
      const gridLine=(xp,o0,o1)=>{ const p=[]; for(let o=o0;o<=o1;o+=120) p.push(at(xp,o)); return p; }, parLine=(o)=>{ const p=[]; for(let x=X0;x<=X0+LW;x+=60) p.push([x,shoreZ(x)+o]); return p; };
      g.fillStyle='#d4ccbd'; g.fillRect(0,0,cw,cw);
      band(-4300,-2350,0,1000,'#cbb894'); for(let i=0;i<220;i++){ const x=-2450-R()*1800, o=R()*950, a=R()*PI; line([[x,shoreZ(x)+o],[x+Math.cos(a)*90,shoreZ(x)+o+Math.sin(a)*90]],7,'#b29d7a'); }   // old Jaffa's lanes
      for(const o of PAR) line(parLine(o),R()<.3?22:12,'#9d9890');
      for(const xp of CROSS) line(gridLine(xp,124,LD),R()<.25?20:11,'#9d9890');
      line(parLine((AYALON[0]+AYALON[1])/2),150,'#7d7a74'); line(parLine((AYALON[0]+AYALON[1])/2),18,'#8aa06a');   // the Ayalon motorway, the trains in its middle
      // parks: along the Yarkon, Independence park, Charles Clore park; boulevards (Rothschild, Ben Gurion, Chen) with trees
      { const p=[]; for(let o=-30;o<=LD;o+=60){ const x=yarkonX(o); p.push([x,shoreZ(x)+o]); } line(p,760,'#a3b47c'); line(p,44,'#54857a'); }
      band(1260,1640,110,260,'#9fb57a'); band(-2520,-1700,30,230,'#9fb57a');
      for(const [a,b] of [[at(-1400,700),at(-450,1950)],[at(880,130),at(930,1150)],[at(250,700),at(1300,1500)]]){ line([a,b],30,'#8fa86c'); for(let k=0;k<40;k++){ const f=k/40; dot(lerp(a[0],b[0],f),lerp(a[1],b[1],f),5,'#5f7d46'); } }
      { const [x,z]=at(560,1000); g.fillStyle='#c6c1b6'; g.fillRect(px(x-75),pz(z-50),150*kx,100*kz); const [cx,cz]=at(200,650); dot(cx,cz,40,'#b9b4aa'); dot(cx,cz,22,'#8fa86c'); }   // Rabin square, Dizengoff circle
      for(let i=0;i<2600;i++){ const xp=-2500+R()*7800, o=130+R()*6000, [x,z]=at(xp,o); dot(x,z,3.4,R()<.5?'#7c9358':'#6c844c'); }   // the street trees
      // the beach, its wet edge, the promenade and the road behind it; Jaffa's rocks; the old port's deck
      band(X0,X0+LW,-6,86,'#ecd8ae'); band(X0,X0+LW,-6,9,'#d0bb92'); band(X0,X0+LW,86,101,'#ebe5d9'); band(X0,X0+LW,101,124,'#85827d');
      band(-4300,-2560,-6,70,'#b3a284'); band(2860,3560,-6,150,'#b9a991');
      // the sea, cut out
      g.globalCompositeOperation='destination-out'; g.beginPath(); g.moveTo(0,0); for(let x=X0;x<=X0+LW;x+=20) g.lineTo(px(x),pz(shoreZ(x))); g.lineTo(cw,0); g.closePath(); g.fill(); g.globalCompositeOperation='source-over';
      const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t; }
  }
  /* the ski valley: a height field (finer across the valley than far up the mountains), snow, rock where it is steep, forest on
     the lower slopes with runs cut through it, lifts up them, chalets, hotels and a church on the floor */
  function snowDest(){
    const NX=240, NZ=220, SZ=30000, z0=ZV-SZ/2, dz=SZ/NZ, xs=new Float32Array(NX+1); for(let i=0;i<=NX;i++){ const t=i/NX*2-1; xs[i]=Math.sign(t)*15000*Math.pow(Math.abs(t),1.7); }
    const ridge=(x,z)=>{ let h=0, a=1, f=1/3400, w=1; for(let k=0;k<6;k++){ let n=1-Math.abs(vn(x*f+k*17.3,z*f-k*9.1)*2-1); n*=n; h+=a*n*w; w=clamp(n*1.8,0,1); a*=.5; f*=2.03; } return h; };
    const H=(x,z)=>{ const d=Math.abs(x-xc(z)), up=Math.max(smooth(380,2700,d),smooth(ZV+2600,ZV+5400,z)); return FLOOR+16*vn(x/230,z/230)+up*(ridge(x,z)*2100+Math.min(d,6000)*.08); };
    const NV=(NX+1)*(NZ+1), pos=new Float32Array(NV*3), hs=new Float32Array(NV);
    for(let j=0;j<=NZ;j++) for(let i=0;i<=NX;i++){ const k=j*(NX+1)+i, x=xs[i], z=z0+j*dz, h=H(x,z); hs[k]=h; pos[k*3]=x; pos[k*3+1]=h; pos[k*3+2]=z; }
    const idx=[]; for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const a=j*(NX+1)+i, b=a+1, c=a+NX+1, d=c+1; idx.push(a,c,b,b,c,d); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    // the height of the ground as drawn (between the grid's points), and how level it is there
    const gH=(x,z)=>{ const t=Math.sign(x)*Math.pow(Math.min(1,Math.abs(x)/15000),1/1.7), fi=clamp((t+1)/2*NX,0,NX-1e-3), i=Math.floor(fi), fz=clamp((z-z0)/dz,0,NZ-1e-3), j=Math.floor(fz), u=clamp((x-xs[i])/(xs[i+1]-xs[i]),0,1), v=fz-j, k=j*(NX+1)+i;
      return lerp(lerp(hs[k],hs[k+1],u),lerp(hs[k+NX+1],hs[k+NX+2],u),v); };
    const level=(x,z)=>{ const a=(gH(x+25,z)-gH(x-25,z))/50, b=(gH(x,z+25)-gH(x,z-25))/50; return 1/Math.sqrt(1+a*a+b*b); };
    // the runs: down the east side from the ridge to the village, two on the west side
    const vx=xc(ZV), runs=[]; for(let k=0;k<7;k++){ const east=k<5, s=east?1:-1, zb=ZV-700+(east?k:k-4)*380, xb=xc(zb)+s*(250+R()*60), zt=zb+(k%3-1)*300-150, xt=xc(zt)+s*(2100+R()*500), p=[];
      for(let q=0;q<=24;q++){ const f=q/24; p.push([lerp(xt,xb,f)+Math.sin(f*PI*2+k)*110*f*(1-f)*4,lerp(zt,zb,f)+Math.sin(f*PI*3+k*2)*90*f*(1-f)*4]); }
      const bb=[Math.min(xt,xb)-260,Math.max(xt,xb)+260,Math.min(zt,zb)-260,Math.max(zt,zb)+260]; runs.push({p,bb}); }
    const onRun=(x,z,r)=>{ for(const {p,bb} of runs){ if(x<bb[0]||x>bb[1]||z<bb[2]||z>bb[3]) continue; for(let s=0;s<p.length-1;s++){ const ax=p[s][0], az=p[s][1], ex=p[s+1][0]-ax, ez=p[s+1][1]-az, t=clamp(((x-ax)*ex+(z-az)*ez)/(ex*ex+ez*ez),0,1), qx=ax+ex*t-x, qz=az+ez*t-z; if(qx*qx+qz*qz<r*r) return true; } } return false; };
    const forest=(x,z,y,ny)=>{ const top=FLOOR+1100+300*vn(x/1700+5,z/1700); return smooth(FLOOR+30,FLOOR+110,y)*(1-smooth(top-150,top,y))*smooth(.78,.88,ny)*smooth(.3,.48,vn(x/420+3,z/420+7)); };
    const nr=g.attributes.normal.array, cols=new Float32Array(NV*3), c=new THREE.Color(), SNOW=new THREE.Color(.84,.87,.93), ROCK=new THREE.Color(.11,.105,.11), WOOD=new THREE.Color(.4,.46,.45);
    for(let k=0;k<NV;k++){ const x=pos[k*3], z=pos[k*3+2], y=hs[k], ny=nr[k*3+1]; c.copy(SNOW);
      const rk=(1-smooth(.42,.66,ny+.18*(vn(x/160,z/160)-.5)))*smooth(FLOOR+250,FLOOR+600,y); if(rk>0) c.lerp(ROCK,clamp(rk*1.15,0,1));   // rock where it is too steep for snow to stay (cliffs, ridges)
      const fo=forest(x,z,y,ny); if(fo>0&&!onRun(x,z,50)) c.lerp(WOOD,fo*.6);
      cols[k*3]=c.r; cols[k*3+1]=c.g; cols[k*3+2]=c.b; }
    g.setAttribute('color',new THREE.BufferAttribute(cols,3));
    dest.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88})));
    // the forest: dark firs where the slopes are wooded, none on the runs
    const cone=new THREE.ConeGeometry(1,1,6); cone.translate(0,.5,0); const NT=12000, trees=new THREE.InstancedMesh(cone,new THREE.MeshStandardMaterial({roughness:.9,flatShading:true}),NT), o=new THREE.Object3D(), tc=new THREE.Color(); let nt=0; trees.frustumCulled=false;
    for(let tries=0;tries<90000&&nt<NT;tries++){ const z=lerp(ZV-6500,ZV+4500,R()), x=xc(z)+(R()*2-1)*4200, y=gH(x,z); if(R()>forest(x,z,y,level(x,z))||onRun(x,z,42)) continue;
      const s=.75+R()*.6; o.position.set(x,y-2,z); o.scale.set(6.5*s,22*s,6.5*s); o.rotation.y=R()*6; o.updateMatrix(); trees.setMatrixAt(nt,o.matrix); trees.setColorAt(nt,tc.setRGB(.08+R()*.05,.18+R()*.07,.12+R()*.05)); nt++; }
    trees.count=nt; dest.add(trees);
    // the lifts: cables on pylons up beside four of the runs
    const lm=new THREE.LineBasicMaterial({color:0x23272d});
    for(const k of [0,2,4,5]){ const p=runs[k].p, a=p[p.length-1], b=p[0], dx=b[0]-a[0], dz2=b[1]-a[1], L=Math.hypot(dx,dz2), sx=-dz2/L*70, sz=dx/L*70, pts=[];
      for(let f=0;f<=1.0001;f+=1/Math.ceil(L/90)){ const x=a[0]+dx*f+sx, z=a[1]+dz2*f+sz; pts.push(new THREE.Vector3(x,gH(x,z)+14,z)); }
      dest.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lm)); }
    // the village: chalets of dark wood under white roofs along its street, hotels, a church with its spire; the road down the valley
    const walls=new THREE.InstancedMesh(box1,new THREE.MeshStandardMaterial({roughness:.85}),260), roofs=new THREE.InstancedMesh(prism(),new THREE.MeshStandardMaterial({color:0xf3f6fb,roughness:.7}),260); walls.frustumCulled=roofs.frustumCulled=false; walls.count=roofs.count=0; for(const m of [walls,roofs]) m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(260*3),3);
    const WOODC=new THREE.Color(.4,.25,.15), WHITE=new THREE.Color(.92,.9,.86), RF=new THREE.Color(1,1,1), RD=new THREE.Color(.17,.15,.14);   // a roof under snow, or cleared
    const chalet=(x,z,w,d,h,rh,ry,wc)=>{ const y=gH(x,z)-.6, i=walls.count; if(i>=260) return; o.position.set(x,y,z); o.rotation.set(0,ry,0); o.scale.set(w,h,d); o.updateMatrix(); walls.setMatrixAt(i,o.matrix); walls.setColorAt(i,wc); walls.count++;
      o.position.y=y+h; o.scale.set(w,rh,d); o.updateMatrix(); roofs.setMatrixAt(i,o.matrix); roofs.setColorAt(i,R()<.45?RD:RF); roofs.count++; };
    for(let z=ZV-1150;z<ZV+1000;z+=38) for(let ox=-380;ox<=380;ox+=38){ if(Math.abs(ox)<24||R()<.3) continue; const zz=z+R()*12, x=xc(zz)+ox+R()*12, big=R()<.14;
      if(onRun(x,zz,40)) continue; chalet(x,zz,big?40:15+R()*9,big?18:11+R()*6,big?16:7+R()*4,big?8:4.5+R()*3,(R()<.5?0:PI/2)+(R()-.5)*.25,big||R()<.25?WHITE:WOODC); }
    dest.add(walls,roofs);
    { const x=vx-60, z=ZV-80, y=gH(x,z); chalet(x,z,26,13,11,6,0,WHITE); const tw=new THREE.Mesh(box1,new THREE.MeshStandardMaterial({color:0xece8e0,roughness:.8})); tw.scale.set(6,30,6); tw.position.set(x+16,y,z); dest.add(tw);
      const sp=new THREE.Mesh(new THREE.ConeGeometry(4.6,16,4),new THREE.MeshStandardMaterial({color:0x2f4a44,roughness:.6})); sp.rotation.y=PI/4; sp.position.set(x+16,y+38,z); dest.add(sp); }
    { const pts=[]; for(let z=ZV-8000;z<=ZV+1200;z+=60){ const x=xc(z)+16; pts.push(x-5,gH(x-5,z)+.7,z,x+5,gH(x+5,z)+.7,z); } const ix=[]; for(let i=0;i<pts.length/6-1;i++){ const a=i*2; ix.push(a,a+2,a+1,a+1,a+2,a+3); }
      const rg=new THREE.BufferGeometry(); rg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); rg.setIndex(ix); rg.computeVertexNormals(); dest.add(new THREE.Mesh(rg,new THREE.MeshStandardMaterial({color:0x6d6864,roughness:.9}))); }
  }
  // a gabled roof: the ridge along x at the top, the eaves at the bottom (instanced over the chalets' walls)
  function prism(){ const a=.58, b=.6, P=[[-a,0,-b],[-a,1,0],[a,1,0],[-a,0,-b],[a,1,0],[a,0,-b], [a,0,b],[a,1,0],[-a,1,0],[a,0,b],[-a,1,0],[-a,0,b], [a,0,b],[a,0,-b],[a,1,0],[-a,0,-b],[-a,0,b],[-a,1,0]];
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P.flat(),3)); g.computeVertexNormals(); return g; }
  /* ---------- sound: the engines and the chime ---------- */
  let AC=null, engG=null, engF=null;
  function audio(){ if(AC) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); const b=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate), d=b.getChannelData(0); let last=0; for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; last=(last+.02*w)/1.02; d[i]=last*3.5; }
      const s=AC.createBufferSource(); s.buffer=b; s.loop=true; engF=AC.createBiquadFilter(); engF.type='lowpass'; engF.frequency.value=380; engG=AC.createGain(); engG.gain.value=0; s.connect(engF); engF.connect(engG); engG.connect(AC.destination); s.start();
      const o=AC.createOscillator(), og=AC.createGain(); o.type='sawtooth'; o.frequency.value=92; og.gain.value=.012; o.connect(og); og.connect(engF); o.start(); } catch(e){ AC=null; } }
  function chime(){ if(!AC) return; const t=AC.currentTime; [[988,0],[784,.42]].forEach(([f,d])=>{ const o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0,t+d); g.gain.linearRampToValueAtTime(.12,t+d+.02); g.gain.exponentialRampToValueAtTime(.001,t+d+1.2); o.connect(g); g.connect(AC.destination); o.start(t+d); o.stop(t+d+1.3); }); }
  const engine=(level,cut)=>{ if(!engG) return; const t=AC.currentTime; engG.gain.setTargetAtTime(level,t,.4); engF.frequency.setTargetAtTime(cut,t,.6); };
  /* ---------- the flight ---------- */
  const T={roll:6.5,cruise:13.5,desc:22.5}; let t=0, started=false, done=false, lastT=0;
  // the descent ends low over the sea short of the beach, or over the valley floor short of the village; the camera looks out at FOCUS
  const END_Y=to==='beach'?380:FLOOR+560, FOCUS=to==='beach'?new THREE.Vector3(-150,60,ZS+700):new THREE.Vector3(xc(ZV),FLOOR+150,ZV);
  const P=new THREE.Vector3(), Q=new THREE.Quaternion(), _e=new THREE.Euler(), cam=new THREE.Vector3(), look=new THREE.Vector3(), camS=new THREE.Vector3(), lookS=new THREE.Vector3();
  const mistEl=$('#mist'); let mist=0;
  function say(s){ const e=$('#say'); if(e.textContent===s&&e.classList.contains('on')) return; e.textContent=s; e.classList.toggle('on',!!s); }
  function fade(on){ $('#white').style.opacity=on?1:0; }
  let flashT=-1;
  function frame(dt){ t+=dt; cloudU.uT.value=t; if(seaU) seaU.uT.value=t;
    const port=innerWidth<innerHeight; let pitch=0, roll=0, phase;
    if(t<T.roll){ phase='roll'; dest.visible=false; airport.visible=true; const u=t, z=u<4.2?.5*16*u*u:.5*16*4.2*4.2+67*(u-4.2)+12*(u-4.2)*(u-4.2), y=u<4.2?0:Math.pow(u-4.2,2)*7.5; pitch=-smooth(3.8,4.6,u)*.2; P.set(0,3.6+y,z);
      plane.userData.gear.forEach(g=>g.visible=u<5.6); engine(.32+.3*smooth(0,1.5,u),300+900*smooth(0,3,u));
      // the camera: beside the runway, then behind as it climbs
      const k=smooth(2.6,5.4,u); cam.set(lerp(-34,-18,k),lerp(4,P.y+10,k),lerp(P.z+30,P.z-55,k)); look.set(P.x,P.y+1.5,P.z+lerp(6,30,k));
      if(u>5.6&&flashT<0){ flashT=t; fade(true); } if(u>T.roll-.35) say(''); else if(u<2.5) say('ממריאים מ'+A.name); }
    else if(t<T.cruise){ phase='cruise'; if(flashT>0&&t-flashT>.6){ fade(false); flashT=0; } airport.visible=false; dest.visible=true;
      const u=t-T.roll; P.set(Math.sin(u*.3)*30,DECK+620+Math.sin(u*.7)*12,u*240); roll=Math.sin(u*.35)*.08; engine(.24,620); trMat.uniforms.uOn.value=1;
      const a=lerp(-.9,1.4,smooth(0,T.cruise-T.roll,u)), r=(70+18*Math.sin(u*.6))*(port?1.55:1);   // further off on an upright screen (narrow) cam.set(P.x+Math.sin(a)*r,P.y+16+10*Math.sin(u*.45),P.z+Math.cos(a)*r); look.copy(P).add(new THREE.Vector3(0,0,8));
      if(u>1&&u<5) say('בגובה שיוט מעל העננים ☁️'); else say(''); if(u>.2&&u<.4) chime(); }
    else { phase='desc'; const u=t-T.cruise, D=T.desc-T.cruise, z0=(T.cruise-T.roll)*240; dest.visible=true; airport.visible=false;
      P.set(Math.sin(u*.3)*30,lerp(DECK+620,END_Y,smooth(0,D*.84,u)),z0+235*u-5*u*u);
      pitch=.1*Math.sin(PI*smooth(0,D*.7,u))-.05*smooth(D*.7,D,u); roll=-.12*Math.sin(PI*smooth(0,D,u)); engine(.18,420); trMat.uniforms.uOn.value=Math.max(0,1-u/2);
      plane.userData.gear.forEach(g=>g.visible=u>D-2.8);
      // the camera: above the deck, behind the plane looking down past it; below the deck, higher behind it, looking out at the destination
      const k=smooth(DECK+150,DECK-300,P.y), sx=port?.35:1; cam.set(P.x+lerp(18,-30,k)*sx,P.y+lerp(22,44,k),P.z+lerp(-70,-84,k)); look.set(P.x,P.y-10,P.z+140).lerp(FOCUS,.55*k);
      if(u>.4&&u<2.2) say('נא להדק חגורות 💺'); else if(u>D*.42) say('נוחתים ב'+B.name+' '+(to==='beach'?'☀️':'❄️')); else say('');
      if(u>D-1.3&&!done) fade(true); if(u>=D) land(); }
    // the plane: along its path, nose up or down, banking
    _e.set(pitch,0,roll,'YXZ'); Q.setFromEuler(_e); plane.position.copy(P); plane.quaternion.copy(Q);
    // contrails behind the engines
    for(const sd of [-1,1]){ const i=trail.i; trail.i=(trail.i+1)%(TR*2); trail.pos[i*3]=P.x+sd*6; trail.pos[i*3+1]=P.y-2.1; trail.pos[i*3+2]=P.z-6; trail.age[i]=0; }
    for(let i=0;i<TR*2;i++) trail.age[i]+=dt; trGeo.attributes.position.needsUpdate=true; trGeo.attributes.aAge.needsUpdate=true;
    // the camera: smoothed, and cut straight there at a change of scene
    const cut=!camS.lengthSq()||phase!==frame.ph; frame.ph=phase; if(cut){ camS.copy(cam); lookS.copy(look); } else { camS.lerp(cam,1-Math.exp(-dt*4)); lookS.lerp(look,1-Math.exp(-dt*6)); }
    // inside the cloud: white all round, and a little bumpy
    mist=phase==='desc'?smooth(DECK+430,DECK+200,camS.y)*smooth(DECK-280,DECK-40,camS.y):0; if(mistEl) mistEl.style.opacity=(mist*.94).toFixed(3);
    camera.position.set(camS.x+Math.sin(t*23)*1.6*mist,camS.y+Math.sin(t*31+1)*1.3*mist,camS.z); camera.lookAt(lookS); sky.position.copy(camera.position);
    cloudU.uOff.value.set(0,0); sun.position.copy(P).addScaledVector(SUN,1000); sun.target.position.copy(P);
    const pr=clamp(t/T.desc,0,1); $('#prog i').style.left=(pr*100)+'%'; }
  function land(){ if(done) return; done=true; fade(true); engine(0,200);
    setTimeout(()=>{ try{ sessionStorage.removeItem('rush.flight'); }catch(e){} location.replace(B.page+'?arrive=1'); },650); }
  function resize(){ const w=innerWidth, h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov=w<h?72:55; camera.updateProjectionMatrix(); puffs.material.uniforms.uH.value=h*renderer.getPixelRatio()/2; }
  addEventListener('resize',resize); resize();
  function loop(now){ requestAnimationFrame(loop); const dt=Math.min(.05,(now-lastT)/1000||0); lastT=now; if(started&&!done) frame(dt); renderer.render(scene,camera); }
  function start(){ if(started) return; started=true; audio(); chime(); $('#pass').classList.add('go'); $('#hud').classList.add('on'); }
  $('#board').onclick=start; setTimeout(start,9000);   // no tap: it boards by itself
  $('#skip').onclick=()=>{ audio(); land(); };
  // the first frame under the pass: the plane on the runway
  frame(0); requestAnimationFrame(loop);
  window.FLIGHT={get t(){ return t; },get phase(){ return frame.ph; },get mist(){ return mist; },start,land,from,to,T,
    stats(){ let inst=0, meshes=0; dest.traverse(o=>{ if(o.isInstancedMesh) inst+=o.count; if(o.isMesh) meshes++; }); return {inst,meshes,calls:renderer.info.render.calls,tris:renderer.info.render.triangles}; }};
  window.__step=dt=>{ if(started&&!done) frame(dt); };   // the tests step the flight's clock
})();
