import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {HostRoom,validCode,roomCode,friendlyError} from '../src/network.js';
class Connection extends EventEmitter { constructor(token='a'.repeat(32)){super();this.metadata={protocol:1,name:'Guest',token};this.open=true;this.sent=[];}send(data){this.sent.push(data);}close(){this.open=false;this.emit('close');} }
test('room codes are unambiguous, six characters, and validated',()=>{for(let i=0;i<100;i++)assert.ok(validCode(roomCode()));for(const bad of ['','ABC','AAAAAAA','ABC0DE','ABC1DE','ABIODE','<html>'])assert.equal(validCode(bad),false);});
test('host binds actions to the connection, ignoring spoofed player IDs and oversized bids',()=>{
  const actions=[];const host=new HostRoom({onJoin:()=> 'actual-guest',onLeave:()=>{},onAction:(id,action)=>actions.push({id,action}),onError:()=>{}});host.code='ABCDEF';
  const c=new Connection();host.accept(c);c.emit('open');c.emit('data',{type:'bid',id:'host',bids:[10,0,0],sequence:1});
  assert.equal(actions.at(-1).id,'actual-guest');const count=actions.length;c.emit('data',{type:'bid',bids:new Array(50).fill(0)});c.emit('data',{type:'advance'});assert.equal(actions.length,count);host.close();
});
test('rejoining the same token replaces the old connection without marking the seat disconnected',()=>{
  const left=[];const joins=[];const host=new HostRoom({onJoin:(id,name,rejoin)=>{joins.push(rejoin);return 'guest';},onLeave:id=>left.push(id),onAction:()=>{},onError:()=>{}});
  const a=new Connection(),b=new Connection();host.accept(a);a.emit('open');host.accept(b);b.emit('open');
  assert.deepEqual(joins,[false,true]);assert.equal(left.length,0);assert.equal(host.connections.get('guest'),b);
  b.close();assert.deepEqual(left,['guest']);host.close();
});
test('friendly network errors give actionable recovery instructions',()=>{assert.match(friendlyError({type:'peer-unavailable'}),/Room not found/);assert.match(friendlyError({type:'webrtc'}),/Wi-Fi/);});
