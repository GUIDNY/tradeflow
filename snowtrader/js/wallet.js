/* Snow Rush · Surf Rush: one wallet for both worlds, and the plane between them.
   The coins a session earns (its score) go into one purse, whichever world they were earned in and whichever they are spent
   in: boards in the ski village, surfboards at the beach, plane tickets between the two. The first time this runs it adds up
   what each world's own save had kept (the two used to keep their own). A ticket takes the player to flight.html, which flies
   them to the other world (?arrive=1 there says they came by plane). No three.js: the opening menu uses it too. */
(function(){
  const KEY='rush.wallet.v1', OLD={snow:'snowtrader.v1',beach:'surfrush.v1'};
  const W={coins:0,flights:0,earned:0,mig:0,last:null};
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify({coins:W.coins,flights:W.flights,earned:W.earned,mig:W.mig,last:W.last})); }catch(e){} };
  try{ Object.assign(W,JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
  if(!W.mig){ let c=0; for(const k in OLD){ try{ const o=JSON.parse(localStorage.getItem(OLD[k])||'{}'); c+=Math.max(0,Math.round(+o.wallet||0)); }catch(e){} } W.coins+=c; W.mig=1; save(); }
  W.TICKET=750;                                   // coins, one way
  W.PLACES={beach:{code:'TLV',name:'חוף תל אביב',page:'beach.html',emoji:'🏖️'},snow:{code:'ALP',name:'כפר הסקי',page:'snow.html',emoji:'🏔️'}};
  W.set=v=>{ W.coins=Math.max(0,Math.round(v)); save(); };
  W.add=(n,why)=>{ n=Math.round(n||0); if(n>0) W.earned+=n; W.coins=Math.max(0,W.coins+n); W.last={n,why:why||'',t:Date.now()}; save(); return W.coins; };
  W.spend=(n,why)=>{ n=Math.round(n); if(W.coins<n) return false; W.coins-=n; W.last={n:-n,why:why||'',t:Date.now()}; save(); return true; };
  /* buy a ticket from one world to the other and go to the airport (false: not enough coins) */
  W.fly=function(from,to){ if(!W.PLACES[to]||!W.spend(W.TICKET,'ticket '+from+'-'+to)) return false; W.flights++; save();
    try{ sessionStorage.setItem('rush.flight',JSON.stringify({from,to,t:Date.now()})); }catch(e){}
    location.href='flight.html?from='+from+'&to='+to; return true; };
  /* a game's own save keeps 'wallet' as a window onto this one (old code that reads and writes save.wallet keeps working) */
  W.bind=function(obj){ delete obj.wallet; Object.defineProperty(obj,'wallet',{get:()=>W.coins,set:v=>W.set(v),enumerable:false,configurable:true}); return obj; };
  W.fmt=n=>Math.round(n).toLocaleString('en-US');
  /* the line under a session's score: what it put in the purse, what the purse holds, how far off a ticket to the other world is */
  W.note=function(earned,here){ const P=W.PLACES[here==='snow'?'beach':'snow'];
    return '🪙 '+(earned>0?'+'+W.fmt(earned)+' לארנק · ':'')+'בארנק '+W.fmt(W.coins)+' · ✈️ '+(W.coins>=W.TICKET?'יש מספיק לכרטיס ל'+P.name:'עוד '+W.fmt(W.TICKET-W.coins)+' לכרטיס ל'+P.name); };
  window.RushWallet=W;
})();
