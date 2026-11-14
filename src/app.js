import * as E from './engine.js';
import {art,icon,avatar} from './art.js';
import {BattleView} from './battle.js';
import {HostRoom,GuestRoom,validCode} from './network.js';

const $=s=>document.querySelector(s), app=$('#app'),dialog=$('#dialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage={get(k,f=null){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
let game=null,view=null,room=null,role='none',myId='host',code='',busy=false,disconnected=false;
let draft=[],draftSequence=-1,battleView=null,battleDone=false,battleKey='',muted=storage.get('boom-muted',true),audio=null;
let saved=storage.get('boom-save'),resumeAvailable=Boolean(saved?.version===E.VERSION&&saved.phase!=='gameOver'&&saved.phase!=='lobby');
let lastRenderPhase='',toastTimer;
let rejoinToken;
try{rejoinToken=sessionStorage.getItem('boom-token')||crypto.randomUUID();sessionStorage.setItem('boom-token',rejoinToken);}catch{rejoinToken=crypto.randomUUID();}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function beep(frequency=400,duration=.06){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.value=frequency;gain.gain.setValueAtTime(.045,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(gain);gain.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function me(){return view?.players.find(p=>p.id===myId);}
function button(action,label,classes='',extra=''){return `<button type="button" data-action="${action}" class="btn ${classes}" ${extra}>${label}</button>`;}
function header(){return `<header class="site-header"><button class="brand" data-action="home" aria-label="Going, Going, BOOM! home">${art('bomb')}<span>GOING, GOING,<strong>BOOM!</strong></span></button><div class="header-right">${role==='host'?'<span class="connection-pill"><i></i> HOSTING</span>':role==='guest'?`<span class="connection-pill ${disconnected?'offline':''}"><i></i> ${disconnected?'DISCONNECTED':'CONNECTED'}</span>`:'<span class="header-tag">A LITTLE FRIENDLY DESTRUCTION.</span>'}<button class="icon-btn" data-action="sound" aria-label="${muted?'Turn sound on':'Mute sound'}" aria-pressed="${!muted}">${icon(muted?'mute':'sound')}</button><button class="help-btn" data-action="help">${icon('help')}<span>How to play</span></button></div></header>`;}
function footer(){return '<footer class="site-footer"><span>BID. BUILD. BATTLE.</span><span>Made for friendly rivals. <span class="dot">✳</span></span></footer>';}
function render(){
  const active=document.activeElement;const focusId=active?.id;
  if(view?.phase!=='battle'){battleView?.destroy();battleView=null;battleKey='';}
  app.innerHTML=header()+(view?renderGame():renderHome())+footer();
  if(view?.phase==='battle')mountBattle();
  if(focusId&&document.getElementById(focusId))document.getElementById(focusId).focus({preventScroll:true});
  const phase=view?`${view.phase}-${view.sequence}-${view.round}`:'home';
  if(phase!==lastRenderPhase){window.scrollTo({top:0,behavior:'instant'});lastRenderPhase=phase;}
  updateCountdown();
}
function renderHome(){return `<main class="home"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> THE AUCTION IS ABOUT TO GET UGLY.</div><h1>GOING,<br>GOING,<br><span class="boom-word">BOOM!<span class="title-star">✳</span></span></h1><p class="hero-description">Big bids. Bad ideas. Beautiful chaos.<br>Turn questionable purchases into an unstoppable arsenal.</p><div class="hero-actions">${button('solo',`${icon('bolt')} Play solo ${icon('arrow')}`,'primary')}${button('online',`${icon('people')} Play with friends`,'secondary')}</div>${resumeAvailable?button('resume','↳ Continue your solo match','resume-btn'):''}<div class="hero-meta"><span>${icon('people')} 2–10 players</span><span>${icon('robot')} Solo with bots</span><span>5 rounds of mayhem</span></div></div><div class="hero-art" aria-label="Illustrated auction gadgets and a giant cartoon bomb"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="deco-star star-one">✳</span><span class="deco-star star-two">✦</span><div class="floating-card card-left"><div class="mini-tag">LOT 007 · RARE</div>${art('duck')}<strong>ANGRY DUCK</strong><span>Very bad attitude.</span></div><div class="floating-card card-right"><div class="mini-tag">LOT 013 · EPIC</div>${art('ray')}<strong>POCKET DEATH RAY</strong><span>Big pocket energy.</span></div><div class="bomb-pedestal"></div>${art('bomb','hero-bomb')}<div class="sold-sticker">SOLD!<span>NO REFUNDS.</span></div><div class="bid-float">${icon('coin')} 35 <span>GOING ONCE…</span></div></div></section><div class="ticker"><span>NO DOWNLOADS</span><b>✳</b><span>NO ACCOUNTS</span><b>✳</b><span>NO MERCY</span><b>✳</b><span>JUST ONE MORE ROUND</span><b>✳</b></div><section class="how-strip" aria-label="How it works"><article><span class="step-num">01</span><div><h2>Outbid.</h2><p>Secretly bid on gloriously questionable gear. Only the winner pays.</p></div></article><article><span class="step-num">02</span><div><h2>Outbuild.</h2><p>Collect matching gadgets. Stack bonuses. Make a terrible idea work.</p></div></article><article><span class="step-num">03</span><div><h2>Outlast.</h2><p>Let your arsenal do the talking. Most points after five battles wins.</p></div></article></section></main>`;}
function progress(){return `<div class="match-meta"><span>${view.online?`ROOM <b>${code}</b>`:'SOLO VS BOTS'}<span class="meta-sep">/</span>${view.phase==='lobby'?'THE WAITING ROOM':`ROUND <b>${String(view.round).padStart(2,'0')}</b> / 05`}</span>${view.phase==='lobby'?'':`<div class="round-dots" aria-label="Round ${view.round} of 5">${Array.from({length:5},(_,i)=>`<i class="${i<view.round?'active':''}"></i>`).join('')}</div>`}${button('leave','Leave','text-btn')}</div>`;}
function renderGame(){
  if(view.phase==='lobby')return `<main class="game-shell">${progress()}${lobby()}</main>`;
  const titles={auction:['Going once…','Spread your coins across the lots. Highest secret bid wins.'],reveal:['Going, going… SOLD!','Winners pay their bids. Everyone else keeps their coins.'],battle:['Let the bad ideas battle.','Your gear does the fighting. Your reputation is on the line.'],roundEnd:['A beautiful disaster.','Dust yourself off. There is more questionable shopping to do.'],gameOver:['Going, going… GLORY!','Five battles. Plenty of bad decisions. One champion.']};
  const [title,sub]=titles[view.phase];
  return `<main class="game-shell">${progress()}<div class="match-heading"><div><div class="eyebrow">${view.phase==='auction'||view.phase==='reveal'?`AUCTION ${view.wave} OF 2`:'THE BOOM ROOM'}</div><h1>${title}</h1><p>${sub}</p></div>${me()?`<div class="wallet"><span>YOUR WALLET</span><strong>${icon('coin')} ${me().coins}</strong></div>`:''}</div>${disconnected?`<div class="notice error">Connection lost. Your seat is being played by a bot. ${button('rejoin','Rejoin room','small')}</div>`:''}<div class="game-layout"><section class="play-area">${view.phase==='auction'?auction():view.phase==='reveal'?reveal():view.phase==='battle'?battle():results()}</section><aside class="sidebar">${roster()}${loadout()}</aside></div></main>`;
}
function lobby(){return `<section class="lobby panel"><div class="lobby-title"><div class="eyebrow">GOOD COMPANY. QUESTIONABLE PURCHASES.</div><h1>The auction opens soon.</h1><p>Invite your friends, add a few bots, and let the bidding begin.</p></div><div class="room-code-box"><span>YOUR ROOM CODE</span><div><strong>${code}</strong>${button('copy-code',icon('copy'),'icon-btn','aria-label="Copy room code"')}</div>${button('copy-link','Copy invite link '+icon('arrow'),'text-btn')}</div><div class="notice"><span class="badge">EXPERIMENTAL</span> Keep the host’s tab open. Use the same Wi-Fi if a connection fails.</div><div class="lobby-players">${view.players.map(p=>`<div class="lobby-player">${avatar(p,true)}<span><strong>${esc(p.name)}</strong><small>${p.id===view.hostId?'HOST':p.bot?'BOT · '+view.settings.difficulty.toUpperCase():'READY TO BID'}</small></span></div>`).join('')}${Array.from({length:Math.max(0,Math.min(3,10-view.players.length))},()=>'<div class="lobby-player empty">＋ <span>Open seat</span></div>').join('')}</div><p class="lobby-timer-summary">Auction timer: <strong>${view.settings.seconds} seconds</strong> per auction · Set by the host</p>${role==='host'?`<div class="lobby-controls"><label class="field">Bot opponents<select id="lobby-bots">${Array.from({length:11-view.players.filter(p=>!p.bot).length},(_,i)=>`<option value="${i}" ${i===view.players.filter(p=>p.bot).length?'selected':''}>${i} ${i===1?'bot':'bots'}</option>`).join('')}</select></label><label class="field">Bot difficulty<select id="lobby-difficulty">${difficultyOptions(view.settings.difficulty)}</select></label>${durationSlider('lobby-seconds',view.settings.seconds)}</div><div class="lobby-bottom"><span>${view.players.length}/10 seats filled · At least 2 needed</span>${button('start-online','Open the auction '+icon('arrow'),'primary',view.players.length<2?'disabled':'')}</div>`:'<div class="waiting"><span class="live-dot"></span> Waiting for the host to open the auction…</div>'}</section>`;}
function difficultyOptions(current='crafty'){return [['chill','Chill · learning the ropes'],['crafty','Crafty · knows a bargain'],['ruthless','Ruthless · bids to win']].map(([v,t])=>`<option value="${v}" ${v===current?'selected':''}>${t}</option>`).join('');}
function durationSlider(id,value=storage.get('boom-seconds',E.AUCTION_TIME.default)){
  const seconds=E.normalizeAuctionSeconds(value),{min,max,step}=E.AUCTION_TIME;
  return `<div class="field timer-field"><div class="timer-setting-label"><label for="${id}">Auction timer</label><output id="${id}-value" for="${id}">${seconds}s</output></div><input id="${id}" name="seconds" type="range" min="${min}" max="${max}" step="${step}" value="${seconds}" data-auction-time aria-valuetext="${seconds} seconds" aria-describedby="${id}-hint"><div class="timer-range-labels"><span>${min} sec</span><span>2 min</span></div><small id="${id}-hint">Per auction. Unlocked bids pass at zero.</small></div>`;
}
function auction(){
  if(draftSequence!==view.sequence){draft=view.market.map(()=>0);draftSequence=view.sequence;}
  const locked=Boolean(view.myBid),bids=locked?view.myBid:draft;
  return `<div class="auction-status"><span>${icon('people')} <b>${view.locked.length}</b> / ${view.players.length} bids locked</span><div class="auction-clock" id="auction-clock"><span id="countdown" role="timer" aria-live="off"></span><span id="countdown-label">TIME TO LOCK</span><div class="timer-track" aria-hidden="true"><i id="timer-fill"></i></div></div></div><div class="market" aria-label="Items for auction">${view.market.map((id,i)=>{
    const item=E.itemById(id),set=E.FACTIONS[item.set];return `<article class="loot-card ${locked?'locked':''}" style="--set-color:${set.color}"><div class="loot-visual"><div class="lot-label">LOT ${String((view.round-1)*10+(view.wave-1)*5+i+1).padStart(3,'0')}<span>${item.rarity}</span></div>${art(item.art)}</div><div class="loot-info"><span class="set-tag">✳ ${set.name.toUpperCase()}</span><h2>${item.name}</h2><p class="item-effect">${esc(item.effect)}</p><p class="item-flavor">${item.desc}</p></div><div class="bid-control"><span>${locked?'YOUR LOCKED BID':'YOUR BID'}</span><div class="stepper"><button data-action="bid-minus" data-index="${i}" aria-label="Decrease bid for ${item.name}" ${locked||disconnected?'disabled':''}>−</button><label class="bid-input-label">${icon('coin')}<input type="number" id="bid-${i}" data-bid="${i}" inputmode="numeric" min="0" max="${me()?.coins||0}" step="1" value="${bids[i]}" aria-label="Bid for ${item.name}" ${locked||disconnected?'disabled':''}></label><button data-action="bid-plus" data-index="${i}" aria-label="Increase bid for ${item.name}" ${locked||disconnected?'disabled':''}>＋</button></div></div></article>`;
  }).join('')}</div><div class="market-hint">${view.market.length>2?'<span class="mobile-hint">Swipe to see every lot →</span>':''}<span>Matching sets unlock bonuses. ${button('sets','See combos','inline-btn')}</span></div><div class="bid-bar"><div><span>${locked?'BIDS SEALED':'TOTAL BID'}</span><strong id="total-bid">${icon('coin')} ${bids.reduce((a,b)=>a+b,0)}<small> / ${me()?.coins||0}</small></strong></div><div class="bid-bar-actions">${!locked?button('clear-bids','Clear','text-btn'):''}${button('lock',locked?`${icon('check')} Bids locked`:`Lock my bids ${icon('arrow')}`,'primary',locked||disconnected?'disabled':'')}</div><span id="bid-error" class="bid-error" role="status">${locked?'Your bids stay secret until everyone is ready.':'Bid 0 on an item to pass. You can only lock once.'}</span></div>`;
}
function reveal(){return `<div class="reveal-grid">${view.result.map(r=>{const item=E.itemById(r.item),winner=view.players.find(p=>p.id===r.winner);return `<article class="sale-card"><div class="sale-art" style="--set-color:${E.FACTIONS[item.set].color}">${art(item.art)}<span class="sale-stamp ${winner?'':'unsold'}">${winner?'SOLD!':'PASSED'}</span></div><div class="sale-info"><h2>${item.name}</h2>${winner?`<p>${avatar(winner)} <strong>${winner.id===myId?'You':esc(winner.name)}</strong> <span>for ${r.price} coins</span></p>`:'<p>No bids. Back into the suspicious box.</p>'}${r.tied?'<small>Tied highest bids · winner picked randomly</small>':''}<details><summary>Reveal every bid</summary><div class="bid-receipt">${[...r.offers].sort((a,b)=>b.amount-a.amount).map(o=>`<div><span>${esc(view.players.find(p=>p.id===o.id)?.name)}</span><strong>${o.amount}</strong></div>`).join('')}</div></details></div></article>`;}).join('')}</div><div class="phase-next">${hostNext(view.wave<2?'Next auction':'To the battle!')}<span>${view.wave<2?'One more auction before things get explosive.':'All your gear stays equipped. Let’s see what it can do.'}</span></div>`;}
function battle(){return `<div class="battle-panel panel"><div class="battle-toolbar"><span><i class="live-dot"></i> AUTO BATTLE <small>ROUND ${view.round}</small></span><div>${button('speed','2× speed','small')}${button('skip-battle','Skip replay','text-btn')}</div></div><canvas id="battle-canvas" aria-label="Battle replay. The live event is described below."></canvas><div class="battle-caption" id="battle-caption" role="status" aria-live="polite">The battle is starting…</div></div><div class="phase-next"><div id="battle-next" ${battleDone?'':'hidden'}>${hostNext('See the results')}</div><span>Your gear fights automatically. No taps needed.</span></div>`;}
function hostNext(label){return role==='guest'?'<div class="waiting"><span class="live-dot"></span> Waiting for the host…</div>':button('advance',label+' '+icon('arrow'),'primary');}
function roster(){const sorted=E.leaderboard(view);return `<section class="side-panel"><div class="side-heading"><h2>The competition</h2><span>${view.players.length} PLAYERS</span></div><div class="roster">${sorted.map((p,i)=>`<div class="roster-row ${p.id===myId?'is-you':''}"><span class="rank">${i+1}</span>${avatar(p)}<div class="roster-name"><strong>${esc(p.name)}${p.id===myId?' <small>YOU</small>':''}</strong><span>${p.bot?'BOT':!p.connected?'BOT TAKEOVER':'PLAYER'}${view.phase==='auction'&&view.locked.includes(p.id)?' · LOCKED ✓':''}</span></div><strong class="score">${p.score}<small>PTS</small></strong></div>`).join('')}</div></section>`;}
function loadout(){const p=me();if(!p)return '';const st=E.stats(p);return `<section class="side-panel loadout"><div class="side-heading"><h2>Your arsenal</h2><span>${p.inventory.length} ITEMS</span></div><div class="stat-grid"><div><span>ATTACK</span><strong>${st.attack}</strong></div><div><span>HEALTH</span><strong>${st.health}</strong></div><div><span>CRIT</span><strong>${Math.round(st.crit*100)}%</strong></div></div><div class="set-list">${Object.entries(E.FACTIONS).map(([id,set])=>`<div title="${set.bonus}"><span style="color:${set.color}">✳</span><strong>${set.name}</strong><div class="set-pips">${[0,1,2,3].map(i=>`<i style="--set-color:${set.color}" class="${st.sets[id]>i?'active':''}"></i>`).join('')}</div><small>${st.sets[id]>=2?'ACTIVE':`${st.sets[id]}/2`}</small></div>`).join('')}</div>${p.inventory.length?`<div class="inventory">${p.inventory.map(id=>{const item=E.itemById(id);return `<button data-action="item" data-item="${id}" title="${item.name}: ${item.effect}" aria-label="Inspect ${item.name}">${art(item.art)}</button>`;}).join('')}</div>`:'<p class="empty-inventory">A clean slate. A dangerous amount of potential.<br><b>Win a lot to start your collection.</b></p>'}</section>`;}
function results(){const final=view.phase==='gameOver',ranked=final?E.leaderboard(view):view.battle.ranking.map(r=>({...view.players.find(p=>p.id===r.id),roundPoints:r.points,place:r.place}));const winner=ranked[0];return `<section class="results panel"><div class="winner-top"><span class="winner-star">✳</span>${avatar(winner,true)}<span class="winner-star">✳</span></div><div class="eyebrow">${final?'THE AUCTION CHAMPION':'LAST BIDDER STANDING'}</div><h2>${winner.id===myId?'That’s you. Nicely done.':esc(winner.name)+' takes it!'}</h2><p>${final?'Most points wins. Ties break by battle wins, then coins saved.':`+${ranked[0].roundPoints} points. Everyone returns for the next round.`}</p><div class="results-table">${ranked.map((p,i)=>`<div class="result-row ${p.id===myId?'is-you':''}"><span>${i+1}</span>${avatar(p)}<strong>${esc(p.name)}${p.id===myId?' <small>YOU</small>':''}</strong><span>${final?`${p.wins} ${p.wins===1?'win':'wins'}`:`+${p.roundPoints} pts`}</span><b>${p.score}<small> TOTAL</small></b></div>`).join('')}</div><div class="phase-next">${final?(role==='guest'?'<span>Thanks for playing! The host can start a rematch.</span>':button('rematch','One more round? '+icon('arrow'),'primary')):hostNext(`Round ${view.round+1} · +55 coins`)}${button('leave',final?'Back to the lobby':'Leave match','text-btn')}</div></section>`;}
function mountBattle(){
  const key=`${view.id}-${view.round}`;const elapsed=battleView?.elapsed||0;
  battleView?.destroy();
  if(battleKey!==key){battleDone=false;battleKey=key;}
  if(!battleDone)$('#battle-next')?.setAttribute('hidden','');
  battleView=new BattleView($('#battle-canvas'),view.battle,view.players,myId,{onHit:e=>{const from=view.players.find(p=>p.id===e.from),to=view.players.find(p=>p.id===e.to);if($('#battle-caption'))$('#battle-caption').textContent=`${from.name} hits ${to.name} for ${e.amount}${e.crit?' — critical hit!':'.'}`;},onDone:()=>{battleDone=true;$('#battle-next')?.removeAttribute('hidden');const winner=view.players.find(p=>p.id===view.battle.ranking[0].id);if($('#battle-caption'))$('#battle-caption').textContent=`${winner.name} wins the round!`;beep(620,.15);}});
  battleView.elapsed=elapsed;
  if(battleDone)battleView.skip();
}
function openDialog(html){dialog.innerHTML=`<button class="dialog-close icon-btn" data-action="close-dialog" aria-label="Close dialog">${icon('close')}</button>${html}`;if(!dialog.open)dialog.showModal();}
function soloDialog(){openDialog(`<div class="eyebrow">YOUR TABLE. YOUR RULES.</div><h2 id="dialog-title">A little solo chaos.</h2><p>Take on bot bidders. No connection needed.</p><form id="solo-form"><label class="field">Your name<input id="player-name" name="name" maxlength="18" value="${esc(storage.get('boom-name','You'))}" autocomplete="nickname" required></label><div class="form-grid"><label class="field">Bot opponents<select name="bots">${Array.from({length:9},(_,i)=>`<option value="${i+1}" ${i===2?'selected':''}>${i+1} ${i?'bots':'bot'}</option>`).join('')}</select></label><label class="field">Difficulty<select name="difficulty">${difficultyOptions()}</select></label></div>${durationSlider('solo-seconds')}<div class="mini-rules"><span>90 starting coins</span><span>5 battles</span><span>Timed auctions</span></div><button class="btn primary full" type="submit">Let’s make bad investments ${icon('arrow')}</button></form>`);}
function onlineDialog(join=false){openDialog(`<div class="eyebrow">BETTER WITH FRIENDLY RIVALS.</div><h2 id="dialog-title">Bring the whole table.</h2><p>2–10 players. Friends, bots, or a chaotic mix.</p><span class="badge">ONLINE MULTIPLAYER · EXPERIMENTAL</span><div class="tabs"><button data-action="host-tab" class="${!join?'active':''}">Create room</button><button data-action="join-tab" class="${join?'active':''}">Join room</button></div><form id="${join?'join':'host'}-form"><label class="field">Your name<input id="player-name" name="name" maxlength="18" value="${esc(storage.get('boom-name','You'))}" autocomplete="nickname" required></label>${join?`<label class="field">Room code<input class="code-input" name="code" placeholder="ABCDEF" maxlength="6" value="${esc(code)}" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>`:durationSlider('host-seconds')}<p class="form-note">Keep the host’s tab open during play. Internet is needed to connect; the same Wi-Fi usually works best.</p><p id="form-error" class="form-error" role="alert"></p><button class="btn primary full" type="submit">${join?'Take a seat':'Create a room'} ${icon('arrow')}</button></form>`);}
function helpDialog(){openDialog(`<div class="eyebrow">THE RULES OF QUESTIONABLE COMMERCE.</div><h2 id="dialog-title">Bid. Build. BOOM.</h2><ol class="help-steps"><li><b>Secretly bid.</b> You start with 90 coins. Split bids across the items; 0 means pass. Lock once. Highest bid wins and only the winner pays. Ties are random.</li><li><b>Build combinations.</b> Every item stays equipped. Two matching Spark, Scrap, or Wild items unlock a bonus; four double it.</li><li><b>Watch the battle.</b> After two auctions, everyone fights automatically. Gear changes attack, health, armor, speed, and special effects.</li><li><b>Keep coming back.</b> Everyone plays all five rounds. Earn points for placement; the winner gets 2 extra. Get 55 more coins each new round.</li></ol><p class="form-note">Most points wins. Final ties break by battle wins, then saved coins. Choose 10–120 seconds per auction. Unlocked bids time out to 0; auctions close early when everyone locks. Disconnected guests are covered by bots. The host must stay connected.</p>${button('close-dialog','Got it. Let’s cause trouble.','primary full')}`);}
function combosDialog(){openDialog(`<div class="eyebrow">THE WHOLE IS MORE DANGEROUS.</div><h2 id="dialog-title">Make it a matching set.</h2><div class="combo-guide">${Object.entries(E.FACTIONS).map(([id,s])=>`<div style="--set-color:${s.color}"><span>✳</span><section><h3>${s.name}</h3><p>${s.bonus}</p></section></div>`).join('')}</div><p>All collected items are automatically equipped. Bonuses cap at four pieces per set.</p>`);}
function sync(){
  if(!game)return;
  view=E.publicView(game,myId);
  saveSolo();
  if(role==='host')for(const p of game.players)if(!p.bot&&p.id!==myId)room?.send(p.id,{type:'state',state:E.publicView(game,p.id),serverTime:Date.now()});
  render();
}
function saveSolo(){
  if(role!=='solo'||!game)return;
  const auctionRemainingMs=game.phase==='auction'&&game.deadline?Math.max(0,game.deadline-Date.now()):null;
  storage.set('boom-save',{...game,auctionRemainingMs});
  resumeAvailable=!['gameOver','lobby'].includes(game.phase);
}
function resolveIfReady(){if(game?.phase==='auction'){E.fillBotBids(game);if(E.allLocked(game))E.resolveAuction(game);else if(game.deadline&&Date.now()>=game.deadline)E.resolveAuction(game,{timeout:true});}}
function startSolo(form){cleanup();const name=E.safeName(form.get('name'));storage.set('boom-name',name);role='solo';myId='host';game=E.createGame({name,bots:Number(form.get('bots')),difficulty:form.get('difficulty'),seconds:form.get('seconds'),seed:crypto.getRandomValues(new Uint32Array(1))[0]});storage.set('boom-seconds',game.settings.seconds);E.startGame(game);E.fillBotBids(game);dialog.close();sync();beep(450,.1);}
async function createRoom(name,seconds){
  cleanup();role='host';myId='host';game=E.createGame({name,bots:0,online:true,seconds,seed:crypto.getRandomValues(new Uint32Array(1))[0]});storage.set('boom-seconds',game.settings.seconds);
  room=new HostRoom({onJoin:(id,name,rejoin)=>{
    const p=game.players.find(p=>p.id===id);
    if(rejoin&&p){p.connected=true;sync();return id;}
    E.addPlayer(game,{id,name});sync();beep(500);return id;
  },onLeave:id=>{E.removePlayer(game,id);resolveIfReady();sync();},onAction:(id,action)=>{
    try{if(action.type==='bid'){E.submitBid(game,id,action.bids,action.sequence);resolveIfReady();}sync();}catch(e){room.send(id,{type:'error',message:e.message});}
  },onError:toast});
  code=await room.open();dialog.close();sync();
}
async function joinRoom(name,roomCode){
  cleanup();role='guest';code=roomCode;disconnected=false;
  room=new GuestRoom({onWelcome:d=>{myId=d.playerId;code=d.code;},onState:s=>{if(s?.version!==E.VERSION||!Array.isArray(s.players)||s.players.length>10)return;view=s;disconnected=false;dialog.close();render();},onDisconnect:m=>{disconnected=true;toast(m);render();},onError:message=>{toast(message);if(view)render();}});
  await room.join(code,name,rejoinToken);dialog.close();
}
function cleanup(){saveSolo();room?.close();room=null;battleView?.destroy();battleView=null;battleKey='';battleDone=false;game=null;view=null;role='none';myId='host';draftSequence=-1;disconnected=false;}
function leave(){cleanup();dialog.close();saved=storage.get('boom-save');resumeAvailable=Boolean(saved?.version===E.VERSION&&!['gameOver','lobby'].includes(saved.phase));render();}
function requestLeave(){if(!view)return;openDialog(`<h2 id="dialog-title">Leaving already?</h2><p>${role==='host'?'You are the host. Leaving will close the room for everyone.':role==='solo'?'Your solo match is saved on this device. You can continue it later.':'A bot will cover your seat. You can rejoin this room while the host keeps it open.'}</p><div class="dialog-actions">${button('close-dialog','Keep playing','secondary')}${button('confirm-leave','Leave match','primary')}</div>`);}
function updateBid(index,value){if(view?.phase!=='auction'||view.myBid||disconnected||auctionExpired())return;draft[index]=Math.max(0,Math.min(me().coins,Math.trunc(Number(value))||0));const input=$(`#bid-${index}`);if(input&&Number(input.value)!==draft[index])input.value=draft[index];updateBidTotals();}
function updateBidTotals(){const total=draft.reduce((a,b)=>a+b,0);const wallet=me()?.coins||0;const over=total>wallet;$('#total-bid').innerHTML=`${icon('coin')} ${total}<small> / ${wallet}</small>`;$('#total-bid').classList.toggle('over-budget',over);$('#bid-error').textContent=over?`That’s ${total-wallet} coins over your budget.`:'Bid 0 on an item to pass. You can only lock once.';$('#bid-error').classList.toggle('error-text',over);$('[data-action="lock"]').disabled=over||disconnected||auctionExpired();}
function auctionRemaining(){return Math.max(0,(view?.deadline||0)+((role==='guest'?room?.clockOffset:0)||0)-Date.now());}
function auctionExpired(){return view?.phase==='auction'&&Boolean(view.deadline)&&auctionRemaining()===0;}
function updateCountdown(){
  if(!view?.deadline||view.phase!=='auction')return;
  const remainingMs=auctionRemaining(),remaining=Math.ceil(remainingMs/1000),el=$('#countdown');
  if(!el)return;
  el.textContent=`${remaining}s`;
  $('#auction-clock').classList.toggle('urgent',remaining<=10);
  $('#countdown-label').textContent=remaining===0?'BIDDING CLOSED':view.myBid?'TIME TO REVEAL':'TIME TO LOCK';
  $('#timer-fill').style.width=`${Math.min(100,remainingMs/(view.settings.seconds*1000)*100)}%`;
  if(remaining===0){
    document.querySelectorAll('[data-bid],[data-action="bid-minus"],[data-action="bid-plus"],[data-action="clear-bids"],[data-action="lock"]').forEach(input=>input.disabled=true);
    $('#bid-error').textContent='Time’s up. Waiting for the auction results.';
  }
}
document.addEventListener('input',e=>{
  if(e.target.matches('[data-bid]'))updateBid(Number(e.target.dataset.bid),e.target.value);
  if(e.target.matches('[data-auction-time]')){
    const seconds=E.normalizeAuctionSeconds(e.target.value);
    document.getElementById(`${e.target.id}-value`).value=`${seconds}s`;
    e.target.setAttribute('aria-valuetext',`${seconds} seconds`);
  }
});
document.addEventListener('change',e=>{
  if(role!=='host'||game?.phase!=='lobby')return;
  try{if(e.target.id==='lobby-bots')E.setBotCount(game,Number(e.target.value));if(e.target.id==='lobby-difficulty')game.settings.difficulty=e.target.value;if(e.target.id==='lobby-seconds'){E.setAuctionSeconds(game,e.target.value);storage.set('boom-seconds',game.settings.seconds);}sync();}catch(err){toast(err.message);}
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!['solo-form','host-form','join-form'].includes(form.id))return;e.preventDefault();if(busy)return;
  const data=new FormData(form);if(form.id==='solo-form')return startSolo(data);
  const name=E.safeName(data.get('name'));const target=String(data.get('code')||'').toUpperCase().replace(/\s/g,'');
  if(form.id==='join-form'&&!validCode(target)){$('#form-error').textContent='Enter a valid six-character room code.';return;}
  storage.set('boom-name',name);busy=true;const btn=form.querySelector('[type="submit"]');btn.disabled=true;const label=btn.innerHTML;btn.textContent='Connecting…';
  try{if(form.id==='host-form')await createRoom(name,data.get('seconds'));else await joinRoom(name,target);}catch(err){cleanup();render();const error=$('#form-error');if(error)error.textContent=err.message;else toast(err.message);}finally{busy=false;btn.disabled=false;btn.innerHTML=label;}
});
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action;
  if(busy&&['solo','online','host-tab','join-tab','close-dialog'].includes(action))return;
  try{
    if(action==='solo')soloDialog();
    if(action==='online'||action==='host-tab')onlineDialog(false);
    if(action==='join-tab')onlineDialog(true);
    if(action==='close-dialog'){if(busy)return;dialog.close();}
    if(action==='help')helpDialog();
    if(action==='sets')combosDialog();
    if(action==='sound'){muted=!muted;storage.set('boom-muted',muted);el.innerHTML=icon(muted?'mute':'sound');el.setAttribute('aria-label',muted?'Turn sound on':'Mute sound');el.setAttribute('aria-pressed',String(!muted));beep(550,.12);}
    if(action==='home'&&view||action==='leave')requestLeave();
    if(action==='confirm-leave')leave();
    if(action==='resume'){const s=storage.get('boom-save');if(s?.version!==E.VERSION)throw new Error('That save is no longer compatible. Start a new match.');cleanup();game=s;role='solo';myId='host';game.settings.seconds=E.normalizeAuctionSeconds(game.settings.seconds);if(game.phase==='auction'){const duration=game.settings.seconds*1000;game.deadline=Date.now()+(Number.isFinite(game.auctionRemainingMs)?Math.max(0,Math.min(duration,game.auctionRemainingMs)):duration);}delete game.auctionRemainingMs;resolveIfReady();sync();}
    if(action==='bid-minus'||action==='bid-plus'){const i=Number(el.dataset.index);updateBid(i,draft[i]+(action==='bid-plus'?5:-5));beep(250+(draft[i]||0)*3,.025);}
    if(action==='clear-bids'){draft.fill(0);draft.forEach((_,i)=>updateBid(i,0));}
    if(action==='lock'){
      if(auctionExpired())throw new Error('The bidding timer has ended.');
      if(role==='guest'){room.send({type:'bid',bids:[...draft],sequence:view.sequence});el.disabled=true;el.textContent='Sending bids…';}
      else{E.submitBid(game,myId,draft,view.sequence);resolveIfReady();sync();}beep(520,.1);
    }
    if(action==='start-online'){E.startGame(game);E.fillBotBids(game);sync();}
    if(action==='advance'&&role!=='guest'){E.advance(game);resolveIfReady();sync();beep(350,.07);}
    if(action==='speed'){const fast=battleView.speed===1;battleView.setSpeed(fast?2:1);el.textContent=fast?'1× speed':'2× speed';el.classList.toggle('selected',fast);}
    if(action==='skip-battle')battleView?.skip();
    if(action==='copy-code'||action==='copy-link'){const link=new URL(location.href);link.search='';link.hash='';link.searchParams.set('room',code);await copy(action==='copy-code'?code:link.href);toast(action==='copy-code'?'Room code copied.':'Invite link copied.');}
    if(action==='item'){const item=E.itemById(el.dataset.item);openDialog(`<div class="item-dialog-art" style="--set-color:${E.FACTIONS[item.set].color}">${art(item.art)}</div><span class="eyebrow">${item.rarity} · ${E.FACTIONS[item.set].name}</span><h2 id="dialog-title">${item.name}</h2><p><b>${item.effect}</b></p><p>${item.desc}</p>`);}
    if(action==='rejoin'){const name=me()?.name||storage.get('boom-name','You');await joinRoom(name,code);}
    if(action==='rematch'){
      if(role==='solo'){const settings=game.settings,name=me().name,bots=game.players.length-1;cleanup();role='solo';game=E.createGame({name,bots,difficulty:settings.difficulty,seconds:settings.seconds,seed:crypto.getRandomValues(new Uint32Array(1))[0]});E.startGame(game);E.fillBotBids(game);sync();}
      else if(role==='host'){const players=game.players.filter(p=>p.bot||p.connected);const settings=game.settings;game=E.createGame({name:me().name,bots:0,online:true,seed:crypto.getRandomValues(new Uint32Array(1))[0]});game.settings=settings;game.players=[];for(const p of players)E.addPlayer(game,{id:p.id,name:p.name,bot:p.bot});sync();}
    }
  }catch(err){toast(err.message);if(action==='lock'&&role==='guest'){el.disabled=false;el.innerHTML='Lock my bids '+icon('arrow');}}
});
async function copy(text){try{await navigator.clipboard.writeText(text);}catch{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)throw new Error('Copy is unavailable. Select the room code to copy it.');}}
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
setInterval(()=>{updateCountdown();if(game?.phase==='auction'&&game.deadline&&Date.now()>=game.deadline){E.fillBotBids(game);E.resolveAuction(game,{timeout:true});sync();}},250);
window.addEventListener('pagehide',saveSolo);
window.addEventListener('beforeunload',e=>{saveSolo();if(role==='host'&&view){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveSolo();if(!document.hidden&&role==='guest'&&!disconnected){try{room.send({type:'sync'});}catch{}}});
render();
const invitation=new URLSearchParams(location.search).get('room');if(invitation&&validCode(invitation.toUpperCase())){code=invitation.toUpperCase();onlineDialog(true);}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
