// Pure, host-authoritative rules. This module runs unchanged in the browser and Node tests.
export const VERSION = 1;
export const MAX_PLAYERS = 10;
export const ROUNDS = 5;
export const WAVES = 2;
export const COLORS = ['#caff61','#ff876d','#8eafff','#e7a0ef','#62dac9','#ffd46d','#c6b8ff','#ed719b','#89c4a1','#e3ac73'];
export const BOTS = ['Penny Pincher','Big Spender','Captain Chaos','Professor Boom','Lucky Charm','The Collector','Loose Change','Spark Plug','Last Bid'];
export const FACTIONS = {
  spark: { name:'Spark', color:'#beadff', bonus:'2 pieces: +8 attack · 4 pieces: +8 more', short:'Attack combo' },
  scrap: { name:'Scrap', color:'#f4bb7b', bonus:'2 pieces: +30 health · 4 pieces: +30 more', short:'Health combo' },
  wild: { name:'Wild', color:'#a7e6a3', bonus:'2 pieces: +12% critical chance · 4 pieces: +12% more', short:'Critical combo' },
};
export const ITEMS = [
  {id:'ray',name:'Pocket Death Ray',art:'ray',set:'spark',rarity:'Rare',value:32,attack:10,desc:'Small enough for a pocket. Bad enough for everyone.',effect:'+10 attack'},
  {id:'coil',name:'Questionable Coil',art:'coil',set:'spark',rarity:'Uncommon',value:25,speed:0.23,desc:'The warranty expired before it was invented.',effect:'+23% attack speed'},
  {id:'battery',name:'Spicy Battery',art:'battery',set:'spark',rarity:'Uncommon',value:24,attack:6,shield:10,desc:'Definitely do not lick the terminals.',effect:'+6 attack · +10 shield'},
  {id:'ufo',name:'Emotional Support UFO',art:'ufo',set:'spark',rarity:'Epic',value:39,attack:7,heal:3,desc:'It believes in you. And occasional abductions.',effect:'+7 attack · heal 3 each turn'},
  {id:'magnet',name:'Personal Space Magnet',art:'magnet',set:'spark',rarity:'Rare',value:30,shield:22,attack:4,desc:'Repels danger. Attracts terrible decisions.',effect:'+22 shield · +4 attack'},
  {id:'orb',name:'Unstable Little Orb',art:'orb',set:'spark',rarity:'Epic',value:43,attack:15,health:-10,desc:'A beautiful, incredibly bad investment.',effect:'+15 attack · −10 health'},
  {id:'pan',name:'Indestructible-ish Pan',art:'pan',set:'scrap',rarity:'Uncommon',value:24,armor:3,attack:3,desc:'Five stars for durability. One for cooking.',effect:'+3 armor · +3 attack'},
  {id:'rocket',name:'Discount Rocket',art:'rocket',set:'scrap',rarity:'Rare',value:32,attack:8,speed:0.1,desc:'All the thrust. Half the safety checks.',effect:'+8 attack · +10% attack speed'},
  {id:'toaster',name:'Revenge Toaster',art:'toaster',set:'scrap',rarity:'Rare',value:32,attack:6,thorns:4,desc:'The bread was only the beginning.',effect:'+6 attack · reflect 4 damage'},
  {id:'helmet',name:'Bucket of Confidence',art:'helmet',set:'scrap',rarity:'Uncommon',value:22,health:26,desc:'You cannot fear what you cannot see.',effect:'+26 health'},
  {id:'robot',name:'Very Small Bodyguard',art:'robot',set:'scrap',rarity:'Epic',value:40,health:20,armor:3,attack:3,desc:'Tiny suit. Enormous sense of duty.',effect:'+20 health · +3 armor · +3 attack'},
  {id:'spring',name:'Suspicious Sneakers',art:'spring',set:'scrap',rarity:'Rare',value:29,speed:0.18,health:14,desc:'For running directly toward your problems.',effect:'+18% attack speed · +14 health'},
  {id:'duck',name:'Extremely Angry Duck',art:'duck',set:'wild',rarity:'Rare',value:32,attack:7,crit:0.12,desc:'No thoughts. Only a deeply personal grudge.',effect:'+7 attack · +12% critical chance'},
  {id:'mushroom',name:'Forbidden Snack',art:'mushroom',set:'wild',rarity:'Uncommon',value:23,health:18,heal:2,desc:'The label just says “probably fine”.',effect:'+18 health · heal 2 each turn'},
  {id:'cactus',name:'Hug-Me-Not',art:'cactus',set:'wild',rarity:'Rare',value:30,thorns:6,health:12,desc:'Emotionally unavailable. Physically pointy.',effect:'Reflect 6 damage · +12 health'},
  {id:'eye',name:'Eye of Bad Ideas',art:'eye',set:'wild',rarity:'Epic',value:39,crit:0.25,attack:5,desc:'It sees the future. It refuses to elaborate.',effect:'+25% critical chance · +5 attack'},
  {id:'charm',name:'Lucky-ish Charm',art:'charm',set:'wild',rarity:'Uncommon',value:24,crit:0.15,shield:12,desc:'Results may vary. Dramatically.',effect:'+15% critical chance · +12 shield'},
  {id:'potion',name:'Bottled Bad Attitude',art:'potion',set:'wild',rarity:'Epic',value:40,attack:10,heal:3,desc:'Shake well. Hold grudges.',effect:'+10 attack · heal 3 each turn'},
];
export const itemById = id => ITEMS.find(i => i.id === id);
export function rng(seed) { let a=seed>>>0; return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
const clone = x => JSON.parse(JSON.stringify(x));
export function safeName(s) { return String(s || 'Bidder').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18) || 'Bidder'; }
export function createGame({name='You',bots=3,difficulty='crafty',online=false,seed=Date.now(),seconds=35}={}) {
  const g={version:VERSION,id:globalThis.crypto.randomUUID(),seed:seed>>>0,phase:'lobby',online,hostId:'host',round:0,wave:0,sequence:0,players:[],market:[],bids:{},result:null,battle:null,deadline:null,settings:{difficulty:['chill','crafty','ruthless'].includes(difficulty)?difficulty:'crafty',seconds:Math.min(90,Math.max(20,Number(seconds)||35))}};
  addPlayer(g,{id:'host',name,bot:false});
  setBotCount(g,Math.min(9,Math.max(0,Math.trunc(bots))));
  return g;
}
export function addPlayer(g,{id,name,bot=false}) {
  if(g.phase!=='lobby') throw new Error('This match has already started.');
  if(g.players.length>=MAX_PLAYERS) throw new Error('This room is full (10 players).');
  if(g.players.some(p=>p.id===id)) throw new Error('Player already joined.');
  const used=new Set(g.players.map(p=>p.color));
  g.players.push({id,name:safeName(name),bot,connected:true,color:COLORS.find(c=>!used.has(c)),coins:90,score:0,inventory:[],wins:0});
}
export function setBotCount(g,n) {
  if(g.phase!=='lobby') throw new Error('Bots can only be changed in the lobby.');
  const humans=g.players.filter(p=>!p.bot);
  n=Math.max(0,Math.min(MAX_PLAYERS-humans.length,Math.trunc(n)||0));
  g.players=humans;
  for(let i=0;i<n;i++) addPlayer(g,{id:`bot-${i}`,name:BOTS[i],bot:true});
}
export function removePlayer(g,id) {
  if(id===g.hostId) return;
  const p=g.players.find(p=>p.id===id); if(!p) return;
  if(g.phase==='lobby') g.players=g.players.filter(p=>p.id!==id);
  else p.connected=false;
}
export function stats(p) {
  const s={health:100,attack:13,armor:0,speed:1,crit:0.06,shield:0,heal:0,thorns:0,sets:{spark:0,scrap:0,wild:0}};
  for(const id of p.inventory) { const i=itemById(id); if(!i) continue; s.sets[i.set]++; for(const k of ['health','attack','armor','speed','crit','shield','heal','thorns']) s[k]+=i[k]||0; }
  s.attack+=Math.floor(Math.min(4,s.sets.spark)/2)*8;
  s.health+=Math.floor(Math.min(4,s.sets.scrap)/2)*30;
  s.crit+=Math.floor(Math.min(4,s.sets.wild)/2)*0.12;
  s.crit=Math.min(.75,s.crit); s.armor=Math.min(16,s.armor); s.speed=Math.min(2.5,s.speed); s.health=Math.max(40,s.health);
  return s;
}
function openAuction(g,now) {
  const random=rng(g.seed+g.round*1009+g.wave*7937);
  const pool=[...ITEMS].sort((a,b)=>a.id.localeCompare(b.id));
  for(let i=pool.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  g.market=pool.slice(0,Math.max(3,Math.ceil(g.players.length/2))).map(i=>i.id);
  g.phase='auction';g.bids={};g.result=null;g.battle=null;g.sequence++;
  g.deadline=g.online?now+g.settings.seconds*1000:null;
}
export function startGame(g,now=Date.now()) {
  if(g.phase!=='lobby') throw new Error('The match has already started.');
  if(g.players.length<2) throw new Error('Add a bot or invite another player.');
  g.round=1;g.wave=1;openAuction(g,now);
}
export function submitBid(g,id,bids,sequence=g.sequence,now=Date.now()) {
  if(g.phase!=='auction'||sequence!==g.sequence) throw new Error('That auction has closed.');
  if(g.deadline&&now>g.deadline) throw new Error('The bidding timer has ended.');
  const p=g.players.find(p=>p.id===id);if(!p) throw new Error('Player not found.');
  if(Object.hasOwn(g.bids,id)) throw new Error('Your bids are already locked.');
  if(!Array.isArray(bids)||bids.length!==g.market.length||bids.some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('Bids must be whole, positive coin amounts (or zero to pass).');
  if(bids.reduce((a,b)=>a+b,0)>p.coins) throw new Error('Your bids exceed your wallet.');
  g.bids[id]=[...bids];
}
export function botBid(g,p) {
  const random=rng(g.seed+g.sequence*3719+[...p.id].reduce((s,c)=>s+c.charCodeAt(0)*79,0));
  const st=stats(p); const difficulty=g.settings.difficulty;
  const budget=Math.floor(p.coins*(g.round===ROUNDS&&g.wave===WAVES?.95:difficulty==='chill'?.36:difficulty==='ruthless'?.7:.54));
  let left=budget; const bids=g.market.map(()=>0);
  const ranked=g.market.map((id,j)=>{const item=itemById(id);const count=st.sets[item.set];return {j,value:item.value*(difficulty==='chill'?.65:1)+(count%2===1?18:5)+random()*18};}).sort((a,b)=>b.value-a.value);
  const aggressive=p.name==='Big Spender'||p.name==='Captain Chaos';
  for(let k=0;k<ranked.length;k++) {
    const {j,value}=ranked[k];const amount=Math.min(left,Math.round(value*(.45+random()*.45)*(aggressive?1.15:1)));
    if(k===0||random()>.35) {bids[j]=amount;left-=amount;}
  }
  return bids;
}
export function fillBotBids(g) {
  if(g.phase!=='auction') return;
  for(const p of g.players) if((p.bot||!p.connected)&&!Object.hasOwn(g.bids,p.id)) g.bids[p.id]=botBid(g,p);
}
export function allLocked(g) { return g.phase==='auction'&&g.players.every(p=>Object.hasOwn(g.bids,p.id)); }
export function resolveAuction(g,{timeout=false,now=Date.now()}={}) {
  if(g.phase!=='auction') throw new Error('There is no auction to resolve.');
  if(!allLocked(g)&&!(timeout&&g.deadline&&now>=g.deadline)) throw new Error('Waiting for other bids.');
  for(const p of g.players) if(!Object.hasOwn(g.bids,p.id)) g.bids[p.id]=g.market.map(()=>0);
  const random=rng(g.seed+g.sequence*65537);
  g.result=g.market.map((item,j)=>{
    const offers=g.players.map(p=>({id:p.id,amount:g.bids[p.id][j]}));
    const highest=Math.max(...offers.map(o=>o.amount));
    const leaders=offers.filter(o=>o.amount===highest&&highest>0);
    const winner=leaders.length?leaders[Math.floor(random()*leaders.length)].id:null;
    if(winner){const p=g.players.find(p=>p.id===winner);p.coins-=highest;p.inventory.push(item);}
    return {item,winner,price:highest,tied:leaders.length>1,offers};
  });
  g.phase='reveal';g.deadline=null;
}
export function simulateBattle(players,seed) {
  const random=rng(seed);const fighters=players.map(p=>({id:p.id,...stats(p),hp:stats(p).health,guard:stats(p).shield,charge:random()*.4,damage:0}));
  const events=[];const eliminated=[];
  const hurt=(target,amount)=>{const guard=Math.min(target.guard,amount);target.guard-=guard;target.hp=Math.max(0,target.hp-(amount-guard));return amount;};
  const markDead=()=>{for(const f of fighters)if(f.hp<=0&&!eliminated.includes(f.id))eliminated.push(f.id);};
  // 80 ticks is a hard bound: overtime ramps up damage so no match can stall.
  for(let tick=0;tick<80&&fighters.filter(f=>f.hp>0).length>1;tick++) {
    const order=[...fighters]; // Shuffle explicitly for fair initiative.
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    for(const f of order) {
      if(f.hp<=0)continue;f.charge+=f.speed;
      if(f.heal)f.hp=Math.min(f.health,f.hp+f.heal);
      let attacks=Math.floor(f.charge);f.charge-=attacks;
      while(attacks-->0&&f.hp>0) {
        const targets=fighters.filter(x=>x.hp>0&&x.id!==f.id);if(!targets.length)break;
        const target=targets[Math.floor(random()*targets.length)];
        const crit=random()<f.crit;const amount=Math.max(2,Math.round(f.attack*(.85+random()*.3)*(crit?1.75:1)-target.armor+Math.max(0,tick-16)*2));
        hurt(target,amount);f.damage+=amount;
        if(target.thorns)hurt(f,target.thorns);
        markDead();
        events.push({tick,from:f.id,to:target.id,amount,crit,hp:fighters.map(x=>({id:x.id,hp:x.hp,guard:x.guard})),dead:target.hp<=0});
      }
    }
  }
  const survivors=fighters.filter(f=>f.hp>0).sort((a,b)=>b.hp/b.health-a.hp/a.health||b.damage-a.damage);
  const order=[...survivors.map(f=>f.id),...eliminated.reverse()];
  const ranking=order.map((id,i)=>({id,place:i+1,points:players.length-i+(i===0?2:0),damage:Math.round(fighters.find(f=>f.id===id).damage)}));
  return {seed,events,ranking,initial:fighters.map(f=>({id:f.id,hp:f.health,guard:f.shield,max:f.health})),duration:Math.min(19000,Math.max(7500,events.length*220))};
}
export function advance(g,now=Date.now()) {
  if(g.phase==='reveal') {
    if(g.wave<WAVES){g.wave++;openAuction(g,now);}
    else {g.battle=simulateBattle(g.players,g.seed+g.round*104729);g.phase='battle';g.battleStarted=now;g.deadline=null;}
  } else if(g.phase==='battle') {
    for(const r of g.battle.ranking){const p=g.players.find(p=>p.id===r.id);p.score+=r.points;if(r.place===1)p.wins++;}
    g.phase=g.round===ROUNDS?'gameOver':'roundEnd';
  } else if(g.phase==='roundEnd') {
    g.round++;g.wave=1;for(const p of g.players)p.coins+=55;openAuction(g,now);
  } else throw new Error('Cannot advance from this phase.');
}
export function leaderboard(g) { return [...g.players].sort((a,b)=>b.score-a.score||b.wins-a.wins||b.coins-a.coins||a.id.localeCompare(b.id)); }
export function publicView(g,id) {
  // Never transmit the seed, private bids, or bots' decisions before the reveal.
  const {seed,bids,...rest}=g;const out=clone(rest);
  if(out.battle)delete out.battle.seed;
  out.locked=Object.keys(bids);out.myBid=bids[id]?[...bids[id]]:null;out.viewerId=id;
  return out;
}
