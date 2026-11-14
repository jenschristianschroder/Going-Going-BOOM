export class BattleView {
  constructor(canvas,battle,players,viewerId,{onDone,muted=true,onHit}={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.battle=battle;this.players=players;this.viewerId=viewerId;this.onDone=onDone;this.onHit=onHit;this.started=performance.now();this.speed=1;this.elapsed=0;this.prev=this.started;this.stopped=false;this.lastEvent=-1;
    this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(canvas);this.measure();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);
  }
  measure(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  setSpeed(n){this.speed=n;}
  skip(){this.elapsed=this.battle.duration;}
  destroy(){this.stopped=true;cancelAnimationFrame(this.raf);this.resize.disconnect();}
  frame(now){if(this.stopped)return;this.elapsed+=Math.min(100,now-this.prev)*this.speed;this.prev=now;this.draw();if(this.elapsed>=this.battle.duration){if(!this.done){this.done=true;this.onDone?.();}}this.raf=requestAnimationFrame(this.frame);}
  draw(){
    const c=this.ctx,w=this.w,h=this.h;if(!w||!h)return;
    const progress=Math.min(1,this.elapsed/this.battle.duration);const events=this.battle.events;const index=Math.min(events.length-1,Math.floor(progress*events.length));
    const hp=index>=0?events[index].hp:this.battle.initial;
    if(index!==this.lastEvent&&index>=0){if(!this.reduced)this.onHit?.(events[index]);this.lastEvent=index;}
    c.clearRect(0,0,w,h);c.fillStyle='#eae9de';c.fillRect(0,0,w,h);
    c.strokeStyle='#d7d9c9';c.lineWidth=1;
    for(let x=20;x<w;x+=34){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=20;y<h;y+=34){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    const cx=w/2,cy=h/2+5,rx=Math.min(w*.36,310),ry=Math.min(h*.31,170);
    for(let j=0;j<3;j++){c.beginPath();c.ellipse(cx,cy,rx*(.55+j*.33),ry*(.55+j*.33),0,0,Math.PI*2);c.strokeStyle=j===2?'#c7ccba':'#d8dbcb';c.lineWidth=2;c.stroke();}
    c.save();c.translate(cx,cy);c.rotate(-.12);c.fillStyle='#d8ddc9';c.font=`900 ${w<500?38:58}px Arial`;c.textAlign='center';c.fillText('BOOM!',0,14);c.restore();
    const positions=this.players.map((p,i)=>{const a=-Math.PI/2+i*Math.PI*2/this.players.length;return {x:cx+Math.cos(a)*rx,y:cy+Math.sin(a)*ry};});
    // Replay every client from the same host-produced event stream.
    for(let j=Math.max(0,index-2);j<=index;j++){
      const e=events[j];if(!e)continue;const a=positions[this.players.findIndex(p=>p.id===e.from)],b=positions[this.players.findIndex(p=>p.id===e.to)];
      if(!a||!b)continue;const t=Math.min(1,((progress*events.length)-j)/2.5);if(t>=1)continue;
      c.globalAlpha=1-t;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=e.crit?'#e48a68':'#8e9b68';c.lineWidth=e.crit?4:2;c.setLineDash([7,8]);c.stroke();c.setLineDash([]);
      if(!this.reduced){c.fillStyle=e.crit?'#ed926e':'#b7ec5b';c.beginPath();c.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,e.crit?9:6,0,7);c.fill();}
      c.globalAlpha=1;
    }
    this.players.forEach((p,i)=>{
      const pos=positions[i],life=hp.find(f=>f.id===p.id)||this.battle.initial[i],max=this.battle.initial.find(f=>f.id===p.id).max;
      const dead=life.hp<=0;const you=p.id===this.viewerId;const radius=w<500?21:27;
      c.save();c.translate(pos.x,pos.y);if(!dead&&!this.reduced)c.translate(0,Math.sin(this.elapsed/250+i)*2);
      c.globalAlpha=dead?.35:1;
      c.fillStyle='#252624';c.globalAlpha=dead?.1:.15;c.beginPath();c.ellipse(0,radius+6,radius+4,7,0,0,7);c.fill();c.globalAlpha=dead?.35:1;
      if(you){c.beginPath();c.arc(0,0,radius+7,0,7);c.strokeStyle='#6c7946';c.lineWidth=2;c.setLineDash([4,4]);c.stroke();c.setLineDash([]);}
      c.fillStyle=p.color;c.strokeStyle='#2b2c27';c.lineWidth=3;c.beginPath();c.roundRect(-radius,-radius,radius*2,radius*1.75,10);c.fill();c.stroke();
      c.fillStyle='#31342d';c.beginPath();c.roundRect(-radius+7,-radius+9,radius*2-14,15,6);c.fill();
      c.strokeStyle='#f8f5e6';c.lineWidth=3;
      for(const x of [-7,7]){c.beginPath();if(dead){c.moveTo(x-2,-10);c.lineTo(x+2,-6);c.moveTo(x+2,-10);c.lineTo(x-2,-6);}else{c.moveTo(x,-10);c.lineTo(x,-6);}c.stroke();}
      c.strokeStyle='#272725';c.beginPath();c.moveTo(-8,radius*.75);c.lineTo(-10,radius+4);c.moveTo(8,radius*.75);c.lineTo(10,radius+4);c.stroke();
      c.fillStyle='#2d3029';c.font=`700 ${w<500?10:12}px Arial`;c.textAlign='center';c.fillText((you?'YOU':p.name.toUpperCase()).slice(0,17),0,radius+25);
      c.fillStyle='#ccd0c0';c.beginPath();c.roundRect(-32,radius+32,64,5,3);c.fill();c.fillStyle=life.hp/max<.3?'#df8c6f':'#77985d';c.beginPath();c.roundRect(-32,radius+32,Math.max(0,64*life.hp/max),5,3);c.fill();
      if(life.guard>0){c.fillStyle='#9b8bc4';c.fillRect(-32,radius+40,Math.min(64,life.guard/2),3);}
      c.restore();
    });
    const recent=events[index];if(recent&&progress<1){const p=positions[this.players.findIndex(p=>p.id===recent.to)];c.fillStyle=recent.crit?'#b34d32':'#32362b';c.font=`900 ${recent.crit?23:18}px Arial`;c.textAlign='center';c.fillText(`${recent.crit?'CRIT ':''}−${recent.amount}`,p.x,p.y-42);}
    c.fillStyle='#536046';c.font='600 11px monospace';c.textAlign='left';c.fillText(progress>=1?'BATTLE COMPLETE':`LIVE REPLAY  ·  ${Math.max(0,Math.ceil((this.battle.duration-this.elapsed)/1000))}s`,18,26);
    c.fillStyle='#a7b88b';c.fillRect(0,h-4,w*progress,4);
  }
}
