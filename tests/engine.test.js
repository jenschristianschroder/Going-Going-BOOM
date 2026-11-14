import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

test('solo requires an opponent; both duel and full 10-seat games work',()=>{
  const g=E.createGame({bots:0});assert.throws(()=>E.startGame(g),/Add a bot/);
  E.setBotCount(g,9);assert.equal(g.players.length,10);
  assert.throws(()=>E.addPlayer(g,{id:'extra',name:'Extra'}),/full/);
  E.startGame(g);assert.equal(g.market.length,5);assert.equal(new Set(g.market).size,5);
  assert.throws(()=>E.addPlayer(g,{id:'late',name:'Late'}),/started/);
});
test('bot counts respect human seats and preserve humans',()=>{
  const g=E.createGame({bots:0});E.addPlayer(g,{id:'guest',name:'Friend'});E.setBotCount(g,9);
  assert.equal(g.players.length,10);assert.equal(g.players.filter(p=>p.bot).length,8);assert.equal(g.players[1].name,'Friend');
});
test('bid validation rejects overspending, non-numbers, negatives, stale rounds and duplicates',()=>{
  const g=E.createGame({bots:1,seed:12});E.startGame(g);
  for(const bids of [[91,0,0],[-1,0,0],[1.5,0,0],['4',0,0],[NaN,0,0],[Infinity,0,0],[1,2]])assert.throws(()=>E.submitBid(g,'host',bids));
  assert.throws(()=>E.submitBid(g,'host',[0,0,0],g.sequence-1),/closed/);
  assert.throws(()=>E.submitBid(g,'stranger',[0,0,0]),/not found/);
  E.submitBid(g,'host',[20,30,40]);assert.throws(()=>E.submitBid(g,'host',[0,0,0]),/already locked/);
});
test('only winning bids spend money; no free items on a zero bid',()=>{
  const g=E.createGame({bots:1,seed:2});E.startGame(g);
  E.submitBid(g,'host',[15,10,0]);E.submitBid(g,'bot-0',[12,20,0]);E.resolveAuction(g);
  assert.equal(g.players[0].coins,75);assert.equal(g.players[1].coins,70);
  assert.deepEqual(g.players[0].inventory,[g.market[0]]);assert.deepEqual(g.players[1].inventory,[g.market[1]]);
  assert.equal(g.result[2].winner,null);assert.equal(g.phase,'reveal');
});
test('ties choose one of the tied highest bidders and charge only that player',()=>{
  const winners=new Set();for(let seed=1;seed<50;seed++){
    const g=E.createGame({bots:2,seed});E.startGame(g);E.submitBid(g,'host',[20,0,0]);E.submitBid(g,'bot-0',[20,0,0]);E.submitBid(g,'bot-1',[19,0,0]);E.resolveAuction(g);
    assert.equal(g.result[0].tied,true);assert.notEqual(g.result[0].winner,'bot-1');winners.add(g.result[0].winner);
    assert.equal(g.players.reduce((s,p)=>s+p.coins,0),250);
  }assert.equal(winners.size,2);
});
test('public snapshots reveal no private seed or opponents’ pending bids',()=>{
  const g=E.createGame({bots:2,seed:12345});E.startGame(g);E.fillBotBids(g);E.submitBid(g,'host',[1,2,3]);
  const v=E.publicView(g,'host');assert.equal(v.seed,undefined);assert.notEqual(v.id,'12345');assert.equal(v.bids,undefined);assert.deepEqual(v.myBid,[1,2,3]);assert.equal(v.locked.length,3);
  const outsider=E.publicView(g,'other');assert.equal(outsider.myBid,null);v.players[0].coins=999;assert.equal(g.players[0].coins,90);
  g.battle=E.simulateBattle(g.players,12345);assert.equal(E.publicView(g,'host').battle.seed,undefined);
});
test('online timeout passes missing bids; early resolution is rejected',()=>{
  const g=E.createGame({online:true,bots:0,seconds:25});E.addPlayer(g,{id:'guest',name:'Guest'});E.startGame(g,1000);
  assert.equal(g.deadline,26000);assert.throws(()=>E.resolveAuction(g,{timeout:true,now:25000}),/Waiting/);
  assert.throws(()=>E.submitBid(g,'host',[1,0,0],g.sequence,27000),/ended/);
  E.submitBid(g,'host',[1,0,0],g.sequence,2000);E.resolveAuction(g,{timeout:true,now:26000});
  assert.deepEqual(g.bids.guest,[0,0,0]);assert.equal(g.result[0].winner,'host');
});
test('disconnected guests get bot bids, but locked human bids are preserved',()=>{
  const g=E.createGame({bots:0});E.addPlayer(g,{id:'guest',name:'Guest'});E.startGame(g);
  E.submitBid(g,'guest',[1,2,3]);E.removePlayer(g,'guest');E.fillBotBids(g);assert.deepEqual(g.bids.guest,[1,2,3]);
  E.submitBid(g,'host',[0,0,0]);E.resolveAuction(g);E.advance(g);E.fillBotBids(g);assert.ok(Array.isArray(g.bids.guest));assert.equal(g.players.length,2);
});
test('every two matching items unlock a bonus, capped at four',()=>{
  const p={inventory:['ray','coil']};assert.equal(E.stats(p).attack,31);
  p.inventory=['ray','coil','battery','ufo'];assert.equal(E.stats(p).attack,52);
  p.inventory=['ray','coil','battery','ufo','orb','magnet'];assert.equal(E.stats(p).attack,71);
  p.inventory=['helmet','spring'];assert.equal(E.stats(p).health,170);
});
test('battle is deterministic and terminates with every fighter ranked once',()=>{
  const g=E.createGame({bots:9,seed:10});for(const p of g.players)p.inventory=['mushroom','ufo','potion','cactus','robot'];
  const a=E.simulateBattle(g.players,42),b=E.simulateBattle(g.players,42);assert.deepEqual(a,b);
  assert.equal(a.ranking.length,10);assert.equal(new Set(a.ranking.map(r=>r.id)).size,10);assert.ok(a.events.length<2000);
  assert.ok(a.events.every(e=>e.hp.every(f=>f.hp>=0&&f.guard>=0)));
});
test('complete 2, 4, and 10-player games preserve wallets, award points, and end after 5 battles',()=>{
  for(const bots of [1,3,9])for(const difficulty of ['chill','crafty','ruthless']){
    const g=E.createGame({bots,difficulty,seed:54321});E.startGame(g);let auctions=0,battles=0;
    for(let step=0;step<40&&g.phase!=='gameOver';step++){
      if(g.phase==='auction'){
        E.fillBotBids(g);E.submitBid(g,'host',E.botBid(g,g.players[0]));E.resolveAuction(g);auctions++;
        assert.ok(g.players.every(p=>p.coins>=0&&Number.isInteger(p.coins)));
      }else{if(g.phase==='battle')battles++;E.advance(g);}
    }
    assert.equal(g.phase,'gameOver');assert.equal(g.round,5);assert.equal(auctions,10);assert.equal(battles,5);
    assert.equal(g.players.reduce((sum,p)=>sum+p.score,0),5*((bots+1)*(bots+2)/2+2));
    assert.equal(g.players.reduce((sum,p)=>sum+p.wins,0),5);
    assert.throws(()=>E.advance(g),/Cannot advance/);
  }
});
test('a battle cannot award points twice',()=>{
  const g=E.createGame({bots:1,seed:1});E.startGame(g);
  for(let i=0;i<2;i++){E.submitBid(g,'host',[0,0,0]);E.submitBid(g,'bot-0',[0,0,0]);E.resolveAuction(g);E.advance(g);}
  E.advance(g);const score=g.players.reduce((n,p)=>n+p.score,0);E.advance(g);assert.equal(g.players.reduce((n,p)=>n+p.score,0),score);assert.equal(g.phase,'auction');
});
