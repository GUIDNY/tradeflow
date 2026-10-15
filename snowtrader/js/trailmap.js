/* Snow Trader: the resort trail map (SVG). Five runs, coloured like real pistes: green circle, blue square, red diamond,
   black double diamond, and the neon park. Tap a run to choose it; locked runs are greyed with a padlock. */
(function(ST){
  const {hash2}=ST;
  const COL={green:'#17b862',blue:'#2f79ff',red:'#e8283f',black:'#161922',park:'#d63bff'};
  // [start x,y, c1 x,y, c2 x,y, end x,y] per run id, drawn on a 1000x500 board
  const PATHS={
    bunny:[330,318, 300,360, 250,380, 170,462],
    bull:[468,132, 380,210, 440,320, 372,462],
    bear:[548,74, 500,190, 640,300, 566,462],
    ridge:[590,70, 680,150, 700,300, 812,462],
    park:[640,170, 790,230, 900,350, 936,462]};
  const LABEL={bunny:[262,300],bull:[330,160],bear:[430,62],ridge:[705,60],park:[800,160]};
  function bez(p,t){ const a=1-t; return [a*a*a*p[0]+3*a*a*t*p[2]+3*a*t*t*p[4]+t*t*t*p[6], a*a*a*p[1]+3*a*a*t*p[3]+3*a*t*t*p[5]+t*t*t*p[7]]; }
  function sym(diff,x,y,r,fill){ const c=COL[diff];
    if(diff==='green') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#fff" stroke-width="3"/>`;
    if(diff==='blue') return `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" rx="3" fill="${c}" stroke="#fff" stroke-width="3"/>`;
    if(diff==='black') return `<path d="M${x-r*.55} ${y-r} l${r*.8} ${r} l${-r*.8} ${r} l${-r*.8} ${-r}z M${x+r*.55} ${y-r} l${r*.8} ${r} l${-r*.8} ${r} l${-r*.8} ${-r}z" fill="${c}" stroke="#fff" stroke-width="2.5"/>`;
    return `<path d="M${x} ${y-r*1.15} L${x+r*1.15} ${y} L${x} ${y+r*1.15} L${x-r*1.15} ${y}z" fill="${c}" stroke="#fff" stroke-width="3"/>`; }
  function forest(){ let s=''; const bands=[[40,960,430,470],[120,520,330,430],[600,940,320,430],[300,640,250,330]]; let k=0;
    bands.forEach(([x0,x1,y0,y1],bi)=>{ const n=bi?34:60; for(let i=0;i<n;i++){ const x=x0+hash2(k,1)*(x1-x0), y=y0+hash2(k,2)*(y1-y0), h=10+hash2(k,3)*14; k++;
        // keep the runs clear
        let near=false; for(const id in PATHS){ for(let t=0;t<=1;t+=.08){ const p=bez(PATHS[id],t); if(Math.abs(p[0]-x)<26&&Math.abs(p[1]-y)<22) near=true; } } if(near) continue;
        s+=`<path d="M${x} ${y-h} L${x+h*.42} ${y} L${x-h*.42} ${y}z" fill="${hash2(k,4)<.5?'#1f6f55':'#18594a'}"/><path d="M${x} ${y-h} L${x+h*.2} ${y-h*.5} L${x-h*.2} ${y-h*.5}z" fill="#eaf4ff"/>`; } }); return s; }
  const FOREST=forest();
  function chalet(x,y,s){ return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-10" width="32" height="14" fill="#9b6a3c"/><path d="M-20 -9 L0 -26 L20 -9z" fill="#3c2f2c"/><path d="M-20 -9 L0 -26 L5 -22 L-14 -9z" fill="#fff"/><rect x="-4" y="-5" width="8" height="9" fill="#ffd27a"/></g>`; }
  function liftLine(x0,y0,x1,y1){ let s=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#222a38" stroke-width="2" stroke-dasharray="2 5"/>`; for(let i=1;i<6;i++){ const t=i/6; s+=`<rect x="${x0+(x1-x0)*t-3}" y="${y0+(y1-y0)*t-3}" width="6" height="6" rx="1" fill="#e0382c"/>`; } return s+`<circle cx="${x0}" cy="${y0}" r="5" fill="#222a38"/><circle cx="${x1}" cy="${y1}" r="5" fill="#222a38"/>`; }

  ST.TrailMap={ render(el,st,onPick){
    const tk=st.tracks; let svg=`<svg viewBox="0 14 1000 486" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="מפת מסלולים"><defs>
      <linearGradient id="tmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fa6ee"/><stop offset="1" stop-color="#dcecfa"/></linearGradient>
      <linearGradient id="tmSnow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe0f4"/></linearGradient>
      <linearGradient id="tmShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db6d8"/><stop offset="1" stop-color="#c3d4ea"/></linearGradient>
      <filter id="tmGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <rect width="1000" height="500" fill="url(#tmSky)"/>
      <path d="M0 330 L90 250 L170 300 L250 220 L330 290 L330 500 L0 500z" fill="#bfd3ec" opacity=".75"/><path d="M700 330 L790 240 L880 300 L960 230 L1000 270 L1000 500 L700 500z" fill="#b3c8e4" opacity=".8"/>
      <path d="M40 490 L250 250 L330 190 L430 104 L560 36 L604 200 L560 490z" fill="url(#tmSnow)"/>
      <path d="M560 36 L652 130 L762 214 L904 334 L972 490 L560 490 L604 200z" fill="url(#tmShade)"/>
      <path d="M560 36 L520 84 L548 96 L500 150 L540 160 L470 240 L520 250 L440 330z" fill="#8aa0c2" opacity=".35"/><path d="M560 36 L604 200 L640 150 L600 110z" fill="#7e96ba" opacity=".4"/>
      <path d="M0 470 H1000 V500 H0z" fill="#eef5ff"/>${FOREST}
      ${liftLine(470,474,520,128)}${liftLine(726,474,650,176)}
      <path d="M560 36 l0 -22 l16 6 l-16 6" fill="#ff3d6e" stroke="#222" stroke-width="1.2"/>
      ${chalet(160,472,1.1)}${chalet(556,476,1.2)}${chalet(922,474,1)}`;
    // runs
    tk.forEach((t,i)=>{ const p=PATHS[t.id]; if(!p) return; const lock=!st.unlocked(i), sel=i===st.sel; const col=lock?'#8a93a4':COL[t.diff]; const d=`M${p[0]} ${p[1]} C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`;
      const wd=t.diff==='bunny'||t.id==='bunny'?14:t.diff==='black'?7:t.diff==='red'?9:11;
      svg+=`<g class="run${sel?' sel':''}${lock?' lock':''}" data-i="${i}" style="cursor:pointer">`;
      if(sel) svg+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="${wd+14}" stroke-linecap="round" opacity=".55" filter="url(#tmGlow)"/>`;
      svg+=`<path d="${d}" fill="none" stroke="#fff" stroke-width="${wd+5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${wd}" stroke-linecap="round" ${t.diff==='park'&&!lock?'stroke-dasharray="1 0"':''}/>`;
      if(sel) svg+=`<path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 14" class="march" opacity=".95"/>`;
      if(t.diff==='park'&&!lock){ [.3,.55,.78].forEach(f=>{ const q=bez(p,f); svg+=`<path d="M${q[0]-9} ${q[1]+5} L${q[0]} ${q[1]-8} L${q[0]+9} ${q[1]+5}z" fill="#fff" stroke="${col}" stroke-width="2"/>`; }); }
      svg+=`<path d="${d}" fill="none" stroke="transparent" stroke-width="38" stroke-linecap="round"/>`;
      const l=LABEL[t.id]; const nm=(i+1)+' · '+t.name; const w=Math.max(96,nm.length*12+44);
      svg+=`<g transform="translate(${l[0]} ${l[1]})"><rect x="${-w/2}" y="-17" width="${w}" height="34" rx="17" fill="${sel?'#fff':'rgba(255,255,255,.92)'}" stroke="${col}" stroke-width="${sel?4:2.5}"/>${sym(lock?'blue':t.diff,-w/2+19,0,8)}${lock?`<text x="${-w/2+19}" y="5" font-size="13" text-anchor="middle">🔒</text>`:''}<text x="${12}" y="6" font-size="15" font-weight="800" text-anchor="middle" fill="#10131c" font-family="Rubik,sans-serif">${nm}</text></g>`;
      const b=st.best[t.id]; if(b){ svg+=`<text x="${l[0]}" y="${l[1]+34}" font-size="15" text-anchor="middle" fill="#ffb800" stroke="#fff" stroke-width=".6" font-weight="900">${'★'.repeat(b.stars)}${'☆'.repeat(3-b.stars)}</text>`; }
      svg+='</g>'; });
    svg+=`<text x="500" y="494" font-size="12" font-weight="700" text-anchor="middle" fill="#5d6c85" letter-spacing="3" font-family="Rubik,sans-serif">SNOW TRADER RESORT · TRAIL MAP</text></svg>`;
    el.innerHTML=svg; el.querySelectorAll('.run').forEach(g=>g.addEventListener('click',()=>onPick(+g.dataset.i)));
  }};
})(window.ST);
