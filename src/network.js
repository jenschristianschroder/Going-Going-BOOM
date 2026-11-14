import { NETWORK } from './config.js';
const PROTOCOL=1;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(){const bytes=crypto.getRandomValues(new Uint8Array(6));return [...bytes].map(n=>alphabet[n%alphabet.length]).join('');}
export function validCode(s){return /^[A-HJ-NP-Z2-9]{6}$/.test(s);}
let loading;
async function loadPeer(){
  if(window.Peer)return;
  if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('../vendor/peerjs.min.js',import.meta.url).href;s.onload=resolve;s.onerror=()=>{loading=null;reject(new Error('The connection library could not load. Try refreshing.'));};document.head.append(s);});
  await loading;
}
async function options(){
  let iceServers=NETWORK.iceServers;
  if(NETWORK.turnCredentialsUrl){const r=await fetch(NETWORK.turnCredentialsUrl,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('The relay service is unavailable.');const data=await r.json();if(!Array.isArray(data.iceServers))throw new Error('Invalid relay configuration.');iceServers=[...iceServers,...data.iceServers];}
  return {...NETWORK.peerOptions,debug:0,config:{iceServers}};
}
export function friendlyError(e){
  if(e.type==='peer-unavailable')return 'Room not found. Check the code and ask the host to keep their tab open.';
  if(e.type==='unavailable-id')return 'That room code is busy. Please create another room.';
  if(e.type==='network'||e.type==='server-error'||e.type==='socket-error')return 'The room service could not connect. Check your internet connection, then try again.';
  if(e.type==='webrtc')return 'The direct connection failed. Try the same Wi-Fi; some networks need a TURN relay.';
  return e.message||'Connection interrupted. Please try again.';
}
async function openPeer(id){
  await loadPeer();const config=await options();
  return new Promise((resolve,reject)=>{const peer=new window.Peer(id,config);const timeout=setTimeout(()=>{peer.destroy();reject(new Error('Room service timed out. Solo play is still available.'));},15000);peer.once('open',()=>{clearTimeout(timeout);resolve(peer);});peer.once('error',e=>{clearTimeout(timeout);peer.destroy();reject(new Error(friendlyError(e)));});});
}
export class HostRoom {
  constructor({onJoin,onLeave,onAction,onError}){Object.assign(this,{onJoin,onLeave,onAction,onError});this.connections=new Map();this.identities=new Map();this.closed=false;this.pending=new Set();}
  async open(){
    this.code=roomCode();this.peer=await openPeer(`ggboom-v1-${this.code}`);
    this.peer.on('connection',c=>this.accept(c));
    this.peer.on('error',e=>this.onError(friendlyError(e)));
    this.peer.on('disconnected',()=>{if(!this.closed){this.onError('Room discovery disconnected. Existing players can continue.');try{this.peer.reconnect();}catch{}}});
    return this.code;
  }
  accept(c){
    if(this.closed)return c.close();
    const m=c.metadata||{};
    if(m.protocol!==PROTOCOL||typeof m.token!=='string'||m.token.length<16||m.token.length>100||this.pending.size>15){c.on('open',()=>{c.send({type:'rejected',message:'Invalid connection or room busy.'});setTimeout(()=>c.close(),100);});return;}
    this.pending.add(c);const handshake=setTimeout(()=>{this.pending.delete(c);c.close();},12000);
    let playerId=null;let windowStart=0;let messages=0;
    c.on('open',()=>{
      clearTimeout(handshake);this.pending.delete(c);
      try{
        const existing=this.identities.get(m.token);
        playerId=this.onJoin(existing||`p-${crypto.randomUUID()}`,m.name,Boolean(existing));
        const old=this.connections.get(playerId);this.connections.set(playerId,c);if(old&&old!==c)old.close();
        this.identities.set(m.token,playerId);c.send({type:'welcome',playerId,code:this.code,protocol:PROTOCOL});
        this.onAction(playerId,{type:'sync'});
      }catch(e){c.send({type:'rejected',message:e.message});setTimeout(()=>c.close(),250);}
    });
    c.on('data',data=>{
      const now=Date.now();if(now-windowStart>1000){windowStart=now;messages=0;}if(++messages>20)return;
      if(!playerId||this.connections.get(playerId)!==c||!data||typeof data!=='object')return;
      if(data.type==='ping')return c.send({type:'pong',at:data.at});
      if(data.type==='bid'&&(!Array.isArray(data.bids)||data.bids.length>5))return;
      if(['bid','sync','ready'].includes(data.type))this.onAction(playerId,data);
    });
    c.on('close',()=>{clearTimeout(handshake);this.pending.delete(c);if(playerId&&this.connections.get(playerId)===c){this.connections.delete(playerId);this.onLeave(playerId);}});
    c.on('error',()=>{c.close();});
  }
  send(id,data){const c=this.connections.get(id);if(c?.open){try{c.send(data);}catch{c.close();}}}
  close(){this.closed=true;for(const c of this.connections.values()){try{c.send({type:'ended'});}catch{}c.close();}for(const c of this.pending)c.close();this.connections.clear();this.peer?.destroy();}
}
export class GuestRoom {
  constructor({onState,onWelcome,onDisconnect,onError}){Object.assign(this,{onState,onWelcome,onDisconnect,onError});this.closed=false;}
  async join(code,name,token){
    if(!validCode(code))throw new Error('Enter the six-letter room code.');
    this.peer=await openPeer(undefined);
    return new Promise((resolve,reject)=>{
      let settled=false;const fail=message=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error(message));}else if(!this.closed)this.onError(message);};
      const timeout=setTimeout(()=>{fail('Could not reach the host. Keep both tabs open and try the same Wi-Fi. Some networks need a relay.');this.close();},20000);
      this.connection=this.peer.connect(`ggboom-v1-${code}`,{reliable:true,serialization:'json',metadata:{protocol:PROTOCOL,name,token}});
      this.peer.on('error',e=>fail(friendlyError(e)));
      this.connection.on('error',e=>fail(friendlyError(e)));
      this.connection.on('data',data=>{
        if(!data||typeof data!=='object')return;
        if(data.type==='welcome'){clearTimeout(timeout);settled=true;this.playerId=data.playerId;this.onWelcome(data);resolve(data);this.heartbeat=setInterval(()=>this.send({type:'ping',at:Date.now()}),5000);}
        if(data.type==='state'){this.clockOffset=Date.now()-data.serverTime;this.onState(data.state);}
        if(data.type==='error')this.onError(data.message);
        if(data.type==='rejected'){fail(data.message);this.close();}
        if(data.type==='ended'){this.close();this.onDisconnect('The host ended the room.');}
      });
      this.connection.on('close',()=>{clearInterval(this.heartbeat);if(!this.closed){if(!settled)fail('The host closed the connection.');else this.onDisconnect('Connection lost. Rejoin with the same name and code to recover your seat.');}});
    });
  }
  send(data){if(!this.connection?.open)throw new Error('You are disconnected. Rejoin the room to continue.');this.connection.send(data);}
  close(){this.closed=true;clearInterval(this.heartbeat);this.connection?.close();this.peer?.destroy();}
}
