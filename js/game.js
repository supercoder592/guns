"use strict";
/* ============================================================================
   五行槍神錄 3D · Wuxing Strike
   3v3 連線寫實風 FPS（Three.js + PeerJS P2P，房主權威模擬，AI 補位）
   ============================================================================ */

/* ------------------------- 基本設定 ------------------------- */
const MATCH_MINUTES = 110;          // 賽事時長
const TEAM_SIZE = 3;                // 三對三
const RESPAWN_SEC = 4;
const TICK_STATE = 1 / 15;          // 快照頻率
const TICK_INPUT = 1 / 20;          // 輸入上傳頻率

const EL = {
  metal:{ glyph:'金', name:'金行', color:0xe8c84a, css:'#e8c84a', fx:'穿甲‧必爆', beats:'wood'  },
  wood: { glyph:'木', name:'木行', color:0x4ade80, css:'#4ade80', fx:'吸血‧回復', beats:'earth' },
  water:{ glyph:'水', name:'水行', color:0x38bdf8, css:'#38bdf8', fx:'緩速‧冰凍', beats:'fire'  },
  fire: { glyph:'火', name:'火行', color:0xff6b5e, css:'#ff6b5e', fx:'灼燒‧延燒', beats:'metal' },
  earth:{ glyph:'土', name:'土行', color:0xc99a4e, css:'#c99a4e', fx:'築牆‧震懾', beats:'water' },
};
function elemMult(a, d){
  if (!a || !d) return 1;
  if (EL[a].beats === d) return 1.7;
  if (EL[d].beats === a) return 0.6;
  return 1;
}
const CHARS = [
  { el:'metal', name:'白鋒‧斬鐵', skill:'金鐘罩',   skillCd:12, ultName:'金行奧義・萬刃歸宗',     ultSub:'MYRIAD BLADES RETURN' },
  { el:'wood',  name:'青藤‧生嵐', skill:'藤蔓縛地', skillCd:12, ultName:'木行奧義・世界樹之怒',   ultSub:'WRATH OF YGGDRASIL' },
  { el:'water', name:'寒淵‧洗川', skill:'凝冰領域', skillCd:12, ultName:'水行奧義・滄海萬川歸一', ultSub:'ALL RIVERS RETURN TO SEA' },
  { el:'fire',  name:'炎獄‧焚天', skill:'焰行者',   skillCd:8,  ultName:'火行奧義・焚天滅地鳳凰劫', ultSub:'PHOENIX CALAMITY' },
  { el:'earth', name:'磐嶽‧不動', skill:'大地壁壘', skillCd:8,  ultName:'土行奧義・山崩地裂鎮乾坤', ultSub:'MOUNTAIN CRUSHES HEAVEN' },
];
const GUNS = [
  { name:'靈息手槍',   en:'P-DAO 9mm',  dmg:30,  hs:2.0, mag:15, reload:1.6, rpm:420, spread:0.010, auto:false, pellets:1, range:70 },
  { name:'奔雷衝鋒槍', en:'LEI-9 SMG',  dmg:16,  hs:1.8, mag:32, reload:2.2, rpm:820, spread:0.030, auto:true,  pellets:1, range:45 },
  { name:'裂空突擊槍', en:'LK-47 AR',   dmg:27,  hs:2.2, mag:30, reload:2.4, rpm:600, spread:0.018, auto:true,  pellets:1, range:90 },
  { name:'崩嶽霰彈槍', en:'BY-12 SG',   dmg:9,   hs:1.5, mag:6,  reload:2.9, rpm:75,  spread:0.075, auto:false, pellets:8, range:26 },
  { name:'貫日狙擊槍', en:'GR-1 SNIPER',dmg:105, hs:2.0, mag:5,  reload:3.2, rpm:45,  spread:0.002, auto:false, pellets:1, range:400, zoom:true },
];
const BOT_NAMES = ['哨兵‧甲','哨兵‧乙','哨兵‧丙','傀兵‧子','傀兵‧丑','傀兵‧寅','鐵衛‧壹','鐵衛‧貳'];

const rand = (a,b)=> a + Math.random()*(b-a);
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
const now = ()=> performance.now()/1000;

/* ------------------------- 音效（WebAudio 合成） ------------------------- */
let AC = null;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function sfx(kind, vol=1){
  const ac = audio(); if(!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain(); g.connect(ac.destination);
  if (kind==='shot' || kind==='shot2'){
    const len = kind==='shot' ? 0.09 : 0.16;
    const buf = ac.createBuffer(1, ac.sampleRate*len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2.2);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value = kind==='shot'?2600:1400;
    src.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.5*vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+len);
    src.start(t);
  } else if (kind==='hit'){
    const o = ac.createOscillator(); o.type='square'; o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(700, t+0.06);
    o.connect(g); g.gain.setValueAtTime(0.16*vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.07);
    o.start(t); o.stop(t+0.08);
  } else if (kind==='boom'){
    const len = 0.7;
    const buf = ac.createBuffer(1, ac.sampleRate*len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 1.6);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(900,t); f.frequency.exponentialRampToValueAtTime(120,t+len);
    src.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.8*vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+len);
    src.start(t);
  } else if (kind==='reload'){
    const o = ac.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(300,t);
    o.connect(g); g.gain.setValueAtTime(0.12*vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
    o.start(t); o.stop(t+0.11);
  }
}

/* ------------------------- 玩家槽位模型 ------------------------- */
/* ctrl: 'local' | 'net' | 'bot' | 'empty' */
function mkSlot(i){
  return {
    idx:i, ctrl:'empty', peer:null, name:'', char:2, team: i<TEAM_SIZE?'red':'blue',
    hp:100, alive:true, respawnAt:0,
    pos:new THREE.Vector3(), ry:0, rx:0, moving:false, gun:2,
    kills:0, deaths:0, score:0, streak:0, ult:0,
    fx:{burn:0,burnSrc:-1,slow:0,root:0,stun:0,shield:0,regen:0,haste:0},
    skillCd:0,
    bot:null, avatar:null,
  };
}
let slots = [];
let myIdx = 0;
let isHost = false, netMode = 'solo';   // solo | host | guest
let peer = null, conns = [];            // host: conns[] ; guest: conns[0]
let started = false, matchT = MATCH_MINUTES*60, scores = {red:0, blue:0};

/* ------------------------- 大廳 UI ------------------------- */
let selChar = 2;
const charRow = $('charRow');
CHARS.forEach((c,i)=>{
  const e = EL[c.el];
  const b = document.createElement('div');
  b.className = 'cbtn'+(i===selChar?' sel':''); b.style.color = e.css;
  b.innerHTML = `<div class="g">${e.glyph}</div><div class="n">${c.name.split('‧')[0]}</div>`;
  b.onclick = ()=>{ selChar = i;
    document.querySelectorAll('.cbtn').forEach((x,j)=> x.classList.toggle('sel', j===i));
    if (netMode==='guest' && conns[0]) send(conns[0], {t:'char', c:i});
    if (netMode==='host'){ slots[myIdx].char = i; roomBroadcast(); }
  };
  charRow.appendChild(b);
});
$('nameIpt').value = localStorage.getItem('wx_name') || '';
function myName(){
  const v = $('nameIpt').value.trim() || ('玩家'+Math.floor(Math.random()*900+100));
  try{ localStorage.setItem('wx_name', v); }catch(e){}
  return v.slice(0,10);
}
function roomCode5(){ const s='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let r=''; for(let i=0;i<5;i++) r+=s[Math.floor(Math.random()*s.length)]; return r; }

$('btnSolo').onclick = ()=>{ audio(); setupSlotsSolo(); startMatch(); };
$('btnCreate').onclick = ()=> hostRoom();
$('btnJoin').onclick = ()=> joinRoom($('codeIpt').value.trim().toUpperCase());
$('codeIpt').addEventListener('keydown', e=>{ if(e.key==='Enter') $('btnJoin').click(); });

function setupSlotsSolo(){
  netMode='solo'; isHost=true;
  slots = Array.from({length:TEAM_SIZE*2}, (_,i)=> mkSlot(i));
  myIdx = 0;
  const s = slots[0]; s.ctrl='local'; s.name=myName(); s.char=selChar;
  fillBots();
}
function fillBots(){
  let bn = 0;
  for (const s of slots) if (s.ctrl==='empty'){
    s.ctrl='bot'; s.name=BOT_NAMES[bn++ % BOT_NAMES.length];
    s.char = Math.floor(Math.random()*5);
    s.gun = [1,2,2,3,4][Math.floor(Math.random()*5)];
  }
}

/* ------------------------- 連線（PeerJS） ------------------------- */
function netFail(msg){
  $('netstat').classList.add('hidden');
  alert(msg + '\n\n將以單人模式（AI 補滿）繼續也可以：點「單人開戰」。');
  $('room').classList.add('hidden'); $('lobby').classList.remove('hidden');
}
function send(c, obj){ try{ c.send(obj); }catch(e){} }
function bcast(obj, except){ if(netMode==='host') for(const c of conns){ if(c!==except) send(c, obj); } }

function hostRoom(){
  audio();
  const code = roomCode5();
  $('netstat').classList.remove('hidden'); $('netstat').textContent = '正在建立房間…';
  netMode='host'; isHost=true;
  slots = Array.from({length:TEAM_SIZE*2}, (_,i)=> mkSlot(i));
  myIdx = 0;
  const s = slots[0]; s.ctrl='local'; s.name=myName(); s.char=selChar;
  peer = new Peer('wxgs-'+code, {debug:0});
  let opened = false;
  setTimeout(()=>{ if(!opened && netMode==='host' && !started) netFail('建立房間逾時：無法連上 P2P 信令伺服器（可能被防火牆阻擋）。'); }, 12000);
  peer.on('open', ()=>{
    opened = true;
    $('netstat').textContent = '房間已建立 · 房號 '+code;
    showRoom(code, true);
  });
  peer.on('error', e=>{
    if (String(e.type)==='unavailable-id'){ hostRoom(); return; }
    netFail('建立房間失敗（'+e.type+'）。可能是網路或防火牆阻擋 P2P。');
  });
  peer.on('connection', conn=>{
    conn.on('open', ()=>{
      if (started){ send(conn, {t:'busy'}); setTimeout(()=>conn.close(), 500); return; }
      conn.on('data', d=> hostOnData(conn, d));
      conn.on('close', ()=> hostDropPeer(conn));
      conn.on('error', ()=> hostDropPeer(conn));
    });
  });
}
function hostOnData(conn, d){
  if (!d || typeof d !== 'object') return;
  if (d.t==='hi'){
    // 指派到人數較少的隊
    const cnt = t=> slots.filter(s=>s.team===t && s.ctrl!=='empty').length;
    const team = cnt('red') <= cnt('blue') ? 'red' : 'blue';
    let slot = slots.find(s=> s.ctrl==='empty' && s.team===team) || slots.find(s=> s.ctrl==='empty');
    if (!slot){ send(conn, {t:'full'}); return; }
    slot.ctrl='net'; slot.peer=conn.peer; slot.name=String(d.name||'玩家').slice(0,10); slot.char=clamp(d.c|0,0,4);
    conns.push(conn); conn._idx = slot.idx;
    send(conn, {t:'you', idx:slot.idx});
    roomBroadcast();
  }
  else if (d.t==='char'){ const s=slots[conn._idx]; if(s&&!started){ s.char=clamp(d.c|0,0,4); roomBroadcast(); } }
  else if (d.t==='swap'){ if(!started) trySwap(conn._idx); }
  else if (d.t==='in'){ const s=slots[conn._idx]; if(s&&s.ctrl==='net'){
      s.pos.set(d.p[0],d.p[1],d.p[2]); s.ry=d.ry; s.rx=d.rx; s.moving=!!d.mv; s.gun=clamp(d.g|0,0,4); } }
  else if (d.t==='fire'){ bcast({t:'fire', i:conn._idx, o:d.o, e:d.e}, conn); remoteTracer(d.o, d.e, conn._idx); }
  else if (d.t==='hit'){ hostApplyHit(conn._idx, d.v|0, d.part, d.g|0, d.dist||10); }
  else if (d.t==='whit'){ hostWallHit(d.id, d.dmg||20); }
  else if (d.t==='skill'){ hostUseSkill(conn._idx, d); }
  else if (d.t==='ult'){ hostUseUlt(conn._idx); }
}
function hostDropPeer(conn){
  const i = conns.indexOf(conn); if(i>=0) conns.splice(i,1);
  const s = slots[conn._idx];
  if (!s || s.ctrl!=='net') return;
  if (started){ // 轉為 AI 補位
    s.ctrl='bot'; s.name = s.name+'(AI)'; s.bot=null;
    feed(`<span style="color:#8296b3">${s.name} 離線，AI 接管</span>`);
    bcast({t:'aitake', i:s.idx});
  } else {
    s.ctrl='empty'; s.name=''; s.peer=null;
    roomBroadcast();
  }
}
function trySwap(idx){
  const s = slots[idx]; if(!s) return;
  const other = s.team==='red'?'blue':'red';
  const dst = slots.find(x=> x.team===other && x.ctrl==='empty');
  if (!dst) return;
  // 交換槽位內容
  const keep = {ctrl:s.ctrl, peer:s.peer, name:s.name, char:s.char};
  s.ctrl='empty'; s.peer=null; s.name='';
  Object.assign(dst, keep);
  if (keep.ctrl==='local') myIdx = dst.idx;
  if (keep.ctrl==='net'){ const c=conns.find(c=>c.peer===keep.peer); if(c){ c._idx=dst.idx; send(c,{t:'you',idx:dst.idx}); } }
  roomBroadcast();
}
function roomBroadcast(){
  const pack = slots.map(s=> ({i:s.idx, c:s.ctrl, n:s.name, ch:s.char, tm:s.team}));
  bcast({t:'room', slots:pack});
  renderRoom();
}

function joinRoom(code){
  if (!/^[A-Z0-9]{5}$/.test(code)){ alert('房號需為 5 位英數字'); return; }
  audio();
  $('netstat').classList.remove('hidden'); $('netstat').textContent = '連線至房間 '+code+'…';
  netMode='guest'; isHost=false;
  peer = new Peer({debug:0});
  peer.on('error', e=> netFail('連線失敗（'+e.type+'）。請確認房號正確、房主在線。'));
  peer.on('open', ()=>{
    const conn = peer.connect('wxgs-'+code, {reliable:true});
    conns = [conn];
    let opened = false;
    setTimeout(()=>{ if(!opened) netFail('連線逾時。請確認房號正確、房主在線。'); }, 12000);
    conn.on('open', ()=>{
      opened = true;
      $('netstat').textContent = '已連上房間 '+code;
      send(conn, {t:'hi', name:myName(), c:selChar});
      showRoom(code, false);
    });
    conn.on('data', d=> guestOnData(d));
    conn.on('close', ()=>{
      if (started){ endMatch('房主已離線 · 戰鬥中止'); }
      else netFail('與房主的連線已中斷。');
    });
  });
}
function guestOnData(d){
  if (!d || typeof d !== 'object') return;
  if (d.t==='you'){ myIdx = d.idx; }
  else if (d.t==='room'){
    slots = Array.from({length:TEAM_SIZE*2}, (_,i)=> mkSlot(i));
    for(const p of d.slots){ const s=slots[p.i]; s.ctrl=p.c; s.name=p.n; s.char=p.ch; s.team=p.tm; }
    if (slots[myIdx]) slots[myIdx].ctrl='local';
    renderRoom();
  }
  else if (d.t==='full'){ netFail('房間已滿。'); }
  else if (d.t==='busy'){ netFail('該房間已開戰，無法加入。'); }
  else if (d.t==='start'){
    slots = Array.from({length:TEAM_SIZE*2}, (_,i)=> mkSlot(i));
    for(const p of d.slots){ const s=slots[p.i]; s.ctrl=p.c; s.name=p.n; s.char=p.ch; s.team=p.tm; s.gun=p.g; }
    slots[myIdx].ctrl='local';
    matchT = d.time;
    startMatch();
  }
  else if (d.t==='st'){ applySnapshot(d); }
  else if (d.t==='fire'){ remoteTracer(d.o, d.e, d.i); }
  else if (d.t==='ev'){ onGameEvent(d); }
  else if (d.t==='end'){ showEnd(d); }
}

/* ------------------------- 房間畫面 ------------------------- */
let roomCodeStr = '';
function showRoom(code, host){
  roomCodeStr = code;
  $('lobby').classList.add('hidden');
  $('room').classList.remove('hidden');
  $('roomCode').textContent = code;
  $('roomCode').onclick = ()=>{ try{ navigator.clipboard.writeText(code); $('roomCode').style.color='#4ade80';
    setTimeout(()=>$('roomCode').style.color='', 600); }catch(e){} };
  $('btnStart').classList.toggle('hidden', !host);
  $('roomHint').textContent = host ? '把房號告訴隊友；按「開始作戰」空位將由 AI 士兵補齊。' : '等待房主開始作戰…';
  $('btnStart').onclick = ()=>{
    fillBots();
    const pack = slots.map(s=> ({i:s.idx, c:s.ctrl==='local'?'net':s.ctrl, n:s.name, ch:s.char, tm:s.team, g:s.gun}));
    bcast({t:'start', slots:pack, time:matchT});
    startMatch();
  };
  $('btnSwap').onclick = ()=>{
    if (netMode==='host') trySwap(myIdx);
    else if (conns[0]) send(conns[0], {t:'swap'});
  };
  renderRoom();
}
function renderRoom(){
  if ($('room').classList.contains('hidden')) return;
  const mk = (team, box)=>{
    box.innerHTML='';
    for (const s of slots.filter(x=>x.team===team)){
      const d = document.createElement('div');
      if (s.ctrl==='empty'){ d.className='slot empty'; d.textContent='（空位 — 開戰時由 AI 補齊）'; }
      else {
        d.className='slot';
        const e = EL[CHARS[s.char].el];
        const tag = s.idx===myIdx?'你':(s.ctrl==='bot'?'AI':(s.idx===0?'房主':'玩家'));
        d.innerHTML = `<span class="cg" style="color:${e.css}">${e.glyph}</span><span>${s.name}</span><span class="tag">${tag}</span>`;
      }
      box.appendChild(d);
    }
  };
  mk('red', $('slotsRed')); mk('blue', $('slotsBlue'));
}

/* ============================================================================
   3D 世界
   ============================================================================ */
let renderer, scene, camera, sunLight;
const worldMeshes = [];   // 可被子彈打到的場景物
const colliders = [];     // AABB 移動碰撞 {x0,x1,y0,y1,z0,z1}
const wallsLive = new Map(); // 土牆 id -> {group, hp, colliders:[], meshes:[], dieAt}
let wallSeq = 0;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

function makeCanvasTex(draw, w=256, h=256, repeat=1){
  const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function noiseOver(ctx,w,h,alpha,n=900){
  for(let i=0;i<n;i++){ ctx.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()*alpha})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, rand(1,3), rand(1,3)); }
}
const TEX = {};
function buildTextures(){
  TEX.ground = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#6e6a62'; c.fillRect(0,0,w,h);
    // 大面積色斑（柏油/沙土混合感）
    for(let i=0;i<40;i++){
      c.fillStyle=`hsla(${rand(30,45)},${rand(8,16)}%,${rand(36,46)}%,${rand(.15,.4)})`;
      c.beginPath(); c.ellipse(Math.random()*w,Math.random()*h,rand(10,50),rand(8,36),Math.random()*3,0,7); c.fill();
    }
    noiseOver(c,w,h,0.08,1800);
    c.strokeStyle='rgba(45,42,38,0.35)'; c.lineWidth=1.5;
    c.strokeRect(0.5,0.5,w-1,h-1);
  }, 256, 256, 26);
  TEX.concrete = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#8b8880'; c.fillRect(0,0,w,h);
    noiseOver(c,w,h,0.12,2000);
    c.fillStyle='rgba(60,58,54,0.25)';
    for(let i=0;i<8;i++) c.fillRect(0, i*h/8, w, 2);
  }, 256, 256, 4);
  TEX.brick = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#7d5a48'; c.fillRect(0,0,w,h);
    const bw=42, bh=20;
    for(let y=0;y<h/bh;y++){
      for(let x=-1;x<w/bw+1;x++){
        const off = (y%2)*bw/2;
        c.fillStyle = `hsl(${rand(12,22)},${rand(30,42)}%,${rand(40,52)}%)`;
        c.fillRect(x*bw+off+1, y*bh+1, bw-2, bh-2);
      }
    }
    noiseOver(c,w,h,0.08,1200);
  }, 256, 256, 3);
  TEX.metal = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#4d5a63'; c.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=16){
      const g=c.createLinearGradient(x,0,x+16,0);
      g.addColorStop(0,'rgba(255,255,255,0.10)'); g.addColorStop(.5,'rgba(0,0,0,0.16)'); g.addColorStop(1,'rgba(255,255,255,0.06)');
      c.fillStyle=g; c.fillRect(x,0,16,h);
    }
    noiseOver(c,w,h,0.06,700);
    c.fillStyle='rgba(140,80,40,0.16)';
    for(let i=0;i<10;i++) c.fillRect(Math.random()*w, Math.random()*h, rand(6,26), rand(3,10));
  }, 256, 256, 1);
  TEX.wood = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#8a6a3c'; c.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=32){
      c.fillStyle=`hsl(${rand(28,36)},${rand(34,44)}%,${rand(34,44)}%)`;
      c.fillRect(0,y,w,30);
      c.strokeStyle='rgba(50,32,12,0.5)'; c.strokeRect(0,y,w,30);
    }
    c.strokeStyle='rgba(60,40,16,0.8)'; c.lineWidth=6; c.strokeRect(3,3,w-6,h-6);
    c.beginPath(); c.moveTo(0,0); c.lineTo(w,h); c.moveTo(w,0); c.lineTo(0,h); c.lineWidth=5; c.stroke();
    noiseOver(c,w,h,0.06,600);
  }, 256, 256, 1);
  TEX.plaster = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#a89f8d'; c.fillRect(0,0,w,h);
    noiseOver(c,w,h,0.09,1600);
    c.fillStyle='rgba(70,64,54,0.18)';
    for(let i=0;i<5;i++){ c.beginPath(); c.arc(Math.random()*w,Math.random()*h,rand(8,30),0,7); c.fill(); }
  }, 256, 256, 2);
  TEX.rock = makeCanvasTex((c,w,h)=>{
    c.fillStyle='#7a6647'; c.fillRect(0,0,w,h);
    noiseOver(c,w,h,0.16,2200);
    c.strokeStyle='rgba(40,32,20,0.6)'; c.lineWidth=2;
    for(let i=0;i<12;i++){ c.beginPath(); c.moveTo(Math.random()*w,Math.random()*h);
      c.lineTo(Math.random()*w,Math.random()*h); c.stroke(); }
  }, 256, 256, 1);
  TEX.camoR = camoTex('#7a3b32','#8f5a3a','#5c2e28','#3f2320');
  TEX.camoB = camoTex('#31506e','#3d6484','#26374b','#1d2c3c');
}
function camoTex(a,b,cc,d){
  return makeCanvasTex((c,w,h)=>{
    c.fillStyle=a; c.fillRect(0,0,w,h);
    for(const col of [b,cc,d]) for(let i=0;i<26;i++){
      c.fillStyle=col; c.beginPath();
      const x=Math.random()*w, y=Math.random()*h;
      c.ellipse(x,y,rand(10,34),rand(8,22),Math.random()*3,0,7); c.fill();
    }
    noiseOver(c,w,h,0.05,500);
  },256,256,1);
}

function addCollider(x,z,w,d,h,y=0){ colliders.push({x0:x-w/2,x1:x+w/2,y0:y,y1:y+h,z0:z-d/2,z1:z+d/2}); }
function box(w,h,d, mat, x,y,z, shootable=true, collide=true, castShadow=true){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z);
  m.castShadow = castShadow; m.receiveShadow = true;
  scene.add(m);
  if (shootable) worldMeshes.push(m);
  if (collide) addCollider(x,z,w,d,h,y-h/2);
  return m;
}

function buildWorld(){
  renderer = new THREE.WebGLRenderer({canvas:$('c3d'), antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb2c4);
  scene.fog = new THREE.Fog(0x9fb2c4, 70, 240);

  camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.08, 500);

  const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x6b675e, 1.0);
  scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xfff2dd, 2.1);
  sunLight.position.set(55, 90, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left=-80; sc.right=80; sc.top=80; sc.bottom=-80; sc.far=250;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  // 反向補光（陰影面不至於死黑）
  const fill = new THREE.DirectionalLight(0xbccadd, 0.85);
  fill.position.set(-45, 55, -40);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x3a4048, 0.6));

  buildTextures();

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160,160),
    new THREE.MeshStandardMaterial({map:TEX.ground, roughness:0.94, metalness:0.02}));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
  scene.add(ground); worldMeshes.push(ground);

  const matBrick   = new THREE.MeshStandardMaterial({map:TEX.brick, roughness:0.9});
  const matConc    = new THREE.MeshStandardMaterial({map:TEX.concrete, roughness:0.92});
  const bigConcTex = TEX.concrete.clone(); bigConcTex.repeat.set(26, 2); bigConcTex.needsUpdate = true;
  const matConcBig = new THREE.MeshStandardMaterial({map:bigConcTex, roughness:0.92});
  const matPlaster = new THREE.MeshStandardMaterial({map:TEX.plaster, roughness:0.9});
  const matMetalR  = new THREE.MeshStandardMaterial({map:TEX.metal, roughness:0.6, metalness:0.2, color:0xb86b5c});
  const matMetalG  = new THREE.MeshStandardMaterial({map:TEX.metal, roughness:0.6, metalness:0.2, color:0x6e8a6a});
  const matMetalB  = new THREE.MeshStandardMaterial({map:TEX.metal, roughness:0.6, metalness:0.2, color:0x5d7a9a});
  const matWood    = new THREE.MeshStandardMaterial({map:TEX.wood, roughness:0.85});

  // 外牆
  const B = 60, WH = 7;
  box(2*B+4, WH, 2, matConcBig,  0, WH/2, -B);
  box(2*B+4, WH, 2, matConcBig,  0, WH/2,  B);
  box(2, WH, 2*B+4, matConcBig, -B, WH/2, 0);
  box(2, WH, 2*B+4, matConcBig,  B, WH/2, 0);

  /* ---- 牆段工具：沿軸建牆，gaps 可挖門洞（到地）或窗洞（1.05~2.0m） ---- */
  const wallRun = (axis, a0, a1, c, h, mat, gaps=[])=>{
    const segs = []; let cur = a0;
    for (const g of [...gaps].sort((p,q)=>p.from-q.from)){
      if (g.from > cur) segs.push([cur, g.from, 0, h]);
      if (g.window){ segs.push([g.from, g.to, 0, 1.05]); segs.push([g.from, g.to, 2.0, h]); }
      cur = g.to;
    }
    if (cur < a1) segs.push([cur, a1, 0, h]);
    for (const [s0,s1,y0,y1] of segs){
      const len = s1-s0, mid = (s0+s1)/2, hh = y1-y0;
      if (len <= 0.01 || hh <= 0.01) continue;
      if (axis==='x') box(len, hh, 0.55, mat, mid, y0+hh/2, c);
      else box(0.55, hh, len, mat, c, y0+hh/2, mid);
    }
  };
  /* ---- 房屋：四面牆 + 平頂/斜頂，doors/windows 依方位指定 ---- */
  const houseAA = (x, z, w, d, h, mat, opt={})=>{
    const N=z-d/2, S=z+d/2, W=x-w/2, E=x+w/2;
    wallRun('x', W, E, N, h, mat, opt.n||[]);
    wallRun('x', W, E, S, h, mat, opt.s||[]);
    wallRun('z', N, S, W, h, mat, opt.w||[]);
    wallRun('z', N, S, E, h, mat, opt.e||[]);
    if (opt.gable){
      const half = Math.hypot(d/2+0.5, 1.4), ang = Math.atan2(1.4, d/2+0.5);
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(w+1, 0.25, half), new THREE.MeshStandardMaterial({color:0x6e4a38, roughness:.9}));
      r1.position.set(x, h+0.7, z-(d/4+0.12)); r1.rotation.x = ang;
      const r2 = r1.clone(); r2.position.z = z+(d/4+0.12); r2.rotation.x = -ang;
      for (const r of [r1,r2]){ r.castShadow=r.receiveShadow=true; scene.add(r); worldMeshes.push(r); }
    } else {
      const roof = box(w+0.8, 0.35, d+0.8, matConc, x, h+0.18, z, true, false);
      roof.castShadow = true;
    }
  };
  const door = (at, wd=1.8)=> ({from:at-wd/2, to:at+wd/2});
  const win  = (at, wd=1.6)=> ({from:at-wd/2, to:at+wd/2, window:true});

  // 中央倉庫（大空間、南門+西門、東西各開窗）
  houseAA(0, 0, 26, 16, 4.6, matBrick, {
    s:[door(0, 6)], w:[door(0, 5)],
    n:[win(-8,2.2), win(0,2.2), win(8,2.2)], e:[win(-4,2), win(4,2)],
  });
  box(3.4,1.3,1.6, matWood, -6, .65, 2);
  box(3.4,1.3,1.6, matWood,  6, .65, -2);
  box(1.3,1.3,1.3, matWood,  0, .65, -5);

  // 民房 A（西北，斜頂、南門東窗）
  houseAA(-32, 27, 10, 8, 3.2, matPlaster, { s:[door(-32)], e:[win(27)], n:[win(-34,1.4)], gable:true });
  // 民房 B（東南，斜頂、北門西窗）
  houseAA(32, -27, 10, 8, 3.2, matPlaster, { n:[door(32)], w:[win(-27)], s:[win(30,1.4)], gable:true });
  // 磚屋 C（西南，穿堂雙門）
  houseAA(-27, -15, 8, 9, 3.4, matBrick, { n:[door(-27)], s:[door(-27)], e:[win(-15)] });
  // 磚屋 D（東北，西門北窗雙窗）
  houseAA(27, 13, 9, 10, 3.4, matBrick, { w:[door(13)], n:[win(24.5,1.6), win(29.5,1.6)], s:[door(27,1.6)] });
  // 廢墟斷牆（南北中線，半毀房屋輪廓）
  wallRun('x', -5, 5, 40, 1.6, matBrick, [door(0,2)]);
  wallRun('z', 36, 44, -5, 2.2, matBrick, [win(40,1.8)]);
  wallRun('x', -5, 5, -40, 1.6, matBrick, [door(1,2)]);
  wallRun('z', -44, -36, 5, 2.2, matBrick, [win(-40,1.8)]);

  // 貨櫃（含兩處疊櫃）
  const conts = [
    [-30,-30, 0, matMetalR], [-38, 8, 1, matMetalG], [20, -20, 1, matMetalB],
    [38, 24, 0, matMetalR], [-8, -30, 0, matMetalG], [10, 30, 1, matMetalB],
    [46, -8, 1, matMetalG], [-46, -2, 0, matMetalB], [16, -34, 0, matMetalR],
  ];
  for (const [x,z,rot,mat] of conts){
    const w = rot? 2.5 : 7.2, d = rot? 7.2 : 2.5;
    box(w, 2.7, d, mat, x, 1.35, z);
  }
  box(7.2, 2.7, 2.5, matMetalG, -30, 4.05, -30);   // 疊櫃
  box(2.5, 2.7, 7.2, matMetalR, 46, 4.05, -8);
  // 卡車（駕駛艙+貨斗）
  const truckAt = (x,z,mat)=>{
    box(2.2, 1.9, 2.4, matMetalB, x, 1.3, z-3.1);
    box(2.4, 0.7, 4.6, mat, x, .35+0.5, z+0.6, true, true);
    box(2.3, 1.6, 4.4, matWood, x, 2.0, z+0.6);
    for (const dz of [-2.9, 1.9]) for (const dx of [-1.05, 1.05]){
      const wl = new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,10),
        new THREE.MeshStandardMaterial({color:0x1c1e22, roughness:.9}));
      wl.rotation.z = Math.PI/2; wl.position.set(x+dx, .45, z+dz);
      wl.castShadow = true; scene.add(wl); worldMeshes.push(wl);
    }
  };
  truckAt(-10, 42, matMetalG);
  truckAt(12, -44, matMetalR);

  // 木箱群（可跳上）
  const crates = [[-16,8],[-14,9.4],[-15,8.6],[18,4],[19.3,4],[18.6,5.2],[2,-18],[3.3,-18],
    [-22,34],[-23.2,34.6],[36,-34],[-36,-36],[14,20],[42,36],[-42,32],[24,-6],[-20,-8],[6,14]];
  for (const [x,z] of crates) box(1.3,1.3,1.3, matWood, x+rand(-.1,.1), .65, z+rand(-.1,.1));
  const stacks = [[-15.5,8.9],[18.7,4.6],[-22.6,34.3],[24,-6.9]];
  for (const [x,z] of stacks) box(1.3,1.3,1.3, matWood, x, 1.95, z);

  // 混凝土護欄（中線推進路徑）
  const matJersey = new THREE.MeshStandardMaterial({map:TEX.concrete, roughness:.92, color:0xbdbdb5});
  const jerseys = [[-8,14,0],[10,-10,0],[-28,-28,1],[26,28,1],[0,22,0],[0,-24,0],
    [-18,-2,1],[18,2,1],[-2,34,0],[2,-34,0],[-40,18,0],[40,-18,0]];
  for (const [x,z,rot] of jerseys){
    const w = rot? 0.5 : 3.6, d = rot? 3.6 : 0.5;
    box(w, 1.05, d, matJersey, x, .52, z);
    box(rot?0.8:3.6, 0.3, rot?3.6:0.8, matJersey, x, .15, z, false, false);
  }
  // 沙包工事（弧形）
  const matSand = new THREE.MeshStandardMaterial({map:TEX.plaster, color:0xb09a68, roughness:1});
  const sandArc = (cx,cz,r,a0,a1)=>{
    for (let a=a0; a<=a1; a+=0.32){
      box(0.9, 0.85, 0.45, matSand, cx+Math.cos(a)*r, .42, cz+Math.sin(a)*r);
      box(0.7, 0.35, 0.5, matSand, cx+Math.cos(a)*r, .95, cz+Math.sin(a)*r, true, false);
    }
  };
  sandArc(-34, -8, 3.2, -0.6, 1.4);
  sandArc(34, 8, 3.2, Math.PI-0.6, Math.PI+1.4);
  sandArc(0, 12, 2.6, Math.PI*0.75, Math.PI*1.55);
  sandArc(0, -12, 2.6, -Math.PI*0.25, Math.PI*0.55);

  // 室內暖光（倉庫與各民房，門窗透出燈光）
  const lamp = (x,y,z,i=26,d=16)=>{
    const L = new THREE.PointLight(0xffd9a0, i, d, 1.6);
    L.position.set(x,y,z); scene.add(L);
  };
  lamp(-6, 3.8, 0); lamp(6, 3.8, 0);       // 倉庫
  lamp(-32, 2.6, 27); lamp(32, 2.6, -27);  // 民房 A/B
  lamp(-27, 2.7, -15); lamp(27, 2.7, 13);  // 磚屋 C/D
  // 兩座崗樓（基地地標）
  towerAt(-48,-48, matConc, 0xff5a4e);
  towerAt(48,48, matConc, 0x4ea1ff);
  // 桶
  const barrelG = new THREE.CylinderGeometry(0.42,0.42,1.1,10);
  const bmat = new THREE.MeshStandardMaterial({color:0x6a6f5a, roughness:.6, metalness:.3});
  for (const [x,z] of [[-10,-6],[12,12],[-20,-20],[22,-14],[-32,4],[34,6]]){
    const m = new THREE.Mesh(barrelG, bmat); m.position.set(x,.55,z);
    m.castShadow=m.receiveShadow=true; scene.add(m); worldMeshes.push(m);
    addCollider(x,z,0.9,0.9,1.1);
  }
}
function towerAt(x,z, mat, flagColor){
  box(4,5,4, mat, x, 2.5, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,3.4,6),
    new THREE.MeshStandardMaterial({color:0x888888, metalness:.6, roughness:.4}));
  pole.position.set(x, 6.7, z); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6,1),
    new THREE.MeshStandardMaterial({color:flagColor, side:THREE.DoubleSide, emissive:flagColor, emissiveIntensity:.25}));
  flag.position.set(x+0.85, 7.6, z); scene.add(flag);
}

/* ------------------------- 人形替身 ------------------------- */
function nameSprite(name, teamCss, seeThrough){
  const cv = document.createElement('canvas'); cv.width=256; cv.height=80;
  const c = cv.getContext('2d');
  c.font = '700 30px "Noto Sans TC",sans-serif'; c.textAlign='center';
  c.fillStyle='rgba(0,0,0,0.55)';
  const w = c.measureText(name).width+26;
  c.beginPath(); c.roundRect(128-w/2, 6, w, 40, 8); c.fill();
  c.fillStyle=teamCss; c.fillText(name, 128, 36);
  const t = new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:t, depthTest:!seeThrough, transparent:true}));
  s.scale.set(2.2, 0.68, 1);
  return s;
}
function makeAvatar(slot){
  const g = new THREE.Group();
  const team = slot.team, camo = team==='red' ? TEX.camoR : TEX.camoB;
  const e = EL[CHARS[slot.char].el];
  const matBody = new THREE.MeshStandardMaterial({map:camo, roughness:.85});
  const matSkin = new THREE.MeshStandardMaterial({color:0xd7a684, roughness:.7});
  const matGear = new THREE.MeshStandardMaterial({color:0x22252a, roughness:.6, metalness:.3});
  const matElem = new THREE.MeshStandardMaterial({color:e.color, emissive:e.color, emissiveIntensity:.8, roughness:.4});

  const legL = new THREE.Mesh(new THREE.BoxGeometry(.17,.82,.19), matBody); legL.position.set(-.115,.41,0);
  const legR = legL.clone(); legR.position.x=.115;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.48,.62,.27), matBody); torso.position.y=1.13;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(.5,.42,.3), matGear); vest.position.y=1.16;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.155,12,10), matSkin); head.position.y=1.62;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(.175,12,8,0,Math.PI*2,0,Math.PI/2), matBody); helm.position.y=1.64;
  const padL = new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.2), matElem); padL.position.set(-.3,1.4,0);
  const padR = padL.clone(); padR.position.x=.3;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.5), matBody); armR.position.set(.2,1.28,.28);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.08,.12,.72), matGear); gun.position.set(.12,1.3,.5);
  for (const m of [legL,legR,torso,vest,head,helm,padL,padR,armR,gun]){ m.castShadow=true; m.receiveShadow=true; g.add(m); }
  head.userData = {slot:slot.idx, part:'head'};
  torso.userData = {slot:slot.idx, part:'body'};
  vest.userData = {slot:slot.idx, part:'body'};
  legL.userData = {slot:slot.idx, part:'body'};
  legR.userData = {slot:slot.idx, part:'body'};
  // 隊友名牌可透視、敵方名牌會被牆擋住（避免穿牆透視）
  const isAlly = slots[myIdx] && slot.team === slots[myIdx].team;
  const np = nameSprite(slot.name, team==='red'?'#ff8a7e':'#8ec4ff', isAlly); np.position.y=2.12; g.add(np);
  // 血條
  const hcv = document.createElement('canvas'); hcv.width=128; hcv.height=14;
  const htex = new THREE.CanvasTexture(hcv);
  const hbar = new THREE.Sprite(new THREE.SpriteMaterial({map:htex, depthTest:!isAlly, transparent:true}));
  hbar.scale.set(1.1,.12,1); hbar.position.y=1.92; g.add(hbar);
  g.visible = false;
  scene.add(g);
  slot.avatar = {group:g, legL, legR, head, torso, vest, parts:[head,torso,vest,legL,legR], hcv, htex, walk:0, lastHp:-1};
  updateHpBar(slot);
}
function updateHpBar(slot){
  const a = slot.avatar; if(!a) return;
  if (a.lastHp === slot.hp) return; a.lastHp = slot.hp;
  const c = a.hcv.getContext('2d');
  c.clearRect(0,0,128,14);
  c.fillStyle='rgba(0,0,0,.6)'; c.fillRect(0,0,128,14);
  c.fillStyle = slot.team==='red'?'#ff5a4e':'#4ea1ff';
  c.fillRect(2,2, 124*clamp(slot.hp/100,0,1), 10);
  a.htex.needsUpdate = true;
}

/* ------------------------- 本地玩家控制 ------------------------- */
const me = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw:0, pitch:0, onGround:true,
  gun:2, ammo:GUNS[2].mag, reloading:0, fireCd:0, recoil:0, spreadHeat:0,
  zoomed:false, bobT:0, dead:false,
};
const keys = {};
let locked = false;
let mouseDownL = false;

function eyeHeight(){ return 1.62; }
const EYE = ()=> me.pos.y + eyeHeight();

function spawnPoint(team){
  const base = team==='red' ? [-46,-44] : [46,44];
  return new THREE.Vector3(base[0]+rand(-4,4), 0, base[1]+rand(-4,4));
}
function respawnLocal(){
  const p = spawnPoint(slots[myIdx].team);
  me.pos.copy(p); me.vel.set(0,0,0);
  me.yaw = Math.atan2(-p.x, -p.z); // 面向場中央
  me.pitch = 0; me.dead=false;
  me.ammo = GUNS[me.gun].mag; me.reloading=0;
  $('deathScr').classList.add('hidden');
}

function collideMove(pos, vel, dt, half=0.36, height=1.8){
  // 分軸 AABB 碰撞
  const tryAxis = (axis, delta)=>{
    pos[axis] += delta;
    for (const c of colliders){
      if (pos.x+half>c.x0 && pos.x-half<c.x1 && pos.z+half>c.z0 && pos.z-half<c.z1 &&
          pos.y < c.y1 && pos.y+height > c.y0){
        if (axis==='x') pos.x = delta>0 ? c.x0-half : c.x1+half;
        else if (axis==='z') pos.z = delta>0 ? c.z0-half : c.z1+half;
        else { // y
          if (delta<0){ pos.y = c.y1; vel.y=0; return true; }
          else { pos.y = c.y0-height; vel.y=0; }
        }
      }
    }
    return false;
  };
  tryAxis('x', vel.x*dt);
  tryAxis('z', vel.z*dt);
  const landed = tryAxis('y', vel.y*dt);
  if (pos.y <= 0){ pos.y = 0; vel.y = 0; return true; }
  return landed;
}

function updateLocal(dt){
  const slot = slots[myIdx];
  if (me.dead){ return; }
  const fx = slot.fx;
  const rooted = fx.root>0 || fx.stun>0;
  let speed = 4.6;
  if (keys.ShiftLeft && !me.zoomed) speed = 6.4;
  if (fx.slow>0) speed *= 0.6;
  if (fx.haste>0) speed *= 1.5;
  if (rooted) speed = 0;

  const f = new THREE.Vector3(-Math.sin(me.yaw),0,-Math.cos(me.yaw));
  const r = new THREE.Vector3(f.z,0,-f.x);
  const wish = new THREE.Vector3();
  if (keys.KeyW) wish.add(f);
  if (keys.KeyS) wish.sub(f);
  if (keys.KeyD) wish.add(r);
  if (keys.KeyA) wish.sub(r);
  if (wish.lengthSq()>0) wish.normalize().multiplyScalar(speed);
  // 平滑加速
  me.vel.x += (wish.x-me.vel.x)*Math.min(1, dt*12);
  me.vel.z += (wish.z-me.vel.z)*Math.min(1, dt*12);
  me.vel.y -= 15*dt;
  if (keys.Space && me.onGround && !rooted){ me.vel.y = 5.6; me.onGround=false; }
  me.onGround = collideMove(me.pos, me.vel, dt);
  me.pos.x = clamp(me.pos.x, -58, 58);
  me.pos.z = clamp(me.pos.z, -58, 58);

  slot.pos.copy(me.pos); slot.ry = me.yaw; slot.rx = me.pitch;
  slot.moving = wish.lengthSq()>0.1;
  slot.gun = me.gun;

  // 攝影機
  me.bobT += dt * (slot.moving ? (keys.ShiftLeft?11:8) : 2);
  const bob = slot.moving ? Math.sin(me.bobT)*0.025 : 0;
  camera.position.set(me.pos.x, EYE()+bob, me.pos.z);
  camera.rotation.set(0,0,0);
  camera.rotateY(me.yaw);
  camera.rotateX(me.pitch + me.recoil);
  me.recoil *= Math.pow(0.001, dt);
  me.spreadHeat = Math.max(0, me.spreadHeat - dt*2.2);

  // 開火 / 換彈
  me.fireCd -= dt;
  if (me.reloading > 0){
    me.reloading -= dt;
    if (me.reloading <= 0){ me.ammo = GUNS[me.gun].mag; sfx('reload'); }
  } else if (mouseDownL && !rooted){
    tryFire();
    if (!GUNS[me.gun].auto) mouseDownL = false;
  }
  const targetFov = me.zoomed && GUNS[me.gun].zoom ? 26 : 74;
  camera.fov += (targetFov-camera.fov)*Math.min(1,dt*14);
  camera.updateProjectionMatrix();
}

/* ------------------------- 射擊 ------------------------- */
const raycaster = new THREE.Raycaster();
function shootTargets(){
  const list = [...worldMeshes];
  for (const w of wallsLive.values()) list.push(...w.meshes);
  for (const s of slots){
    if (s.idx===myIdx || s.ctrl==='empty' || !s.alive || !s.avatar) continue;
    list.push(...s.avatar.parts);
  }
  return list;
}
function tryFire(){
  const g = GUNS[me.gun];
  if (me.fireCd > 0 || me.reloading>0) return;
  if (me.ammo <= 0){ startReload(); return; }
  me.fireCd = 60/g.rpm;
  me.ammo--;
  me.recoil += (g.dmg>60?0.035:0.012) * (me.zoomed?0.4:1);
  me.spreadHeat = Math.min(1.6, me.spreadHeat + 0.28);
  sfx(g.pellets>1||g.dmg>60?'shot2':'shot');
  muzzleFlash();
  const spread = g.spread * (me.zoomed&&g.zoom?0.15:1) * (1+me.spreadHeat);
  const origin = new THREE.Vector3(me.pos.x, EYE(), me.pos.z);
  for (let p=0; p<g.pellets; p++){
    const dir = new THREE.Vector3(0,0,-1)
      .applyEuler(new THREE.Euler(me.pitch + rand(-spread,spread), me.yaw + rand(-spread,spread), 0, 'YXZ'));
    raycaster.set(origin, dir);
    raycaster.far = g.range*1.6;
    const hits = raycaster.intersectObjects(shootTargets(), false);
    let end = origin.clone().addScaledVector(dir, g.range*1.6);
    if (hits.length){
      const h = hits[0];
      end = h.point;
      const ud = h.object.userData || {};
      if (ud.wallId !== undefined){
        reportWallHit(ud.wallId, g.dmg*g.pellets>40? g.dmg : g.dmg);
        impactFX(h.point, 0xc99a4e);
      } else if (ud.slot !== undefined){
        // 打中敵人
        showHitmark(ud.part==='head');
        sfx('hit');
        reportHit(ud.slot, ud.part, me.gun, h.distance);
        impactFX(h.point, 0xff4444);
      } else {
        impactFX(h.point, 0xbbbbbb);
      }
    }
    tracer(origin.clone().addScaledVector(dir,0.6).add(new THREE.Vector3(0,-0.12,0)), end);
    // 廣播開火（讓別人看到曳光）
    netFire(origin, end);
  }
  if (me.ammo===0) startReload();
  updateAmmoUI();
}
function startReload(){
  if (me.reloading>0 || me.ammo===GUNS[me.gun].mag) return;
  me.reloading = GUNS[me.gun].reload;
  sfx('reload');
}
function reportHit(victim, part, gun, dist){
  if (isHost) hostApplyHit(myIdx, victim, part, gun, dist);
  else if (conns[0]) send(conns[0], {t:'hit', v:victim, part, g:gun, dist});
}
function reportWallHit(id, dmg){
  if (isHost) hostWallHit(id, dmg);
  else if (conns[0]) send(conns[0], {t:'whit', id, dmg});
}
function netFire(o, e){
  const msg = {t:'fire', i:myIdx, o:[+o.x.toFixed(2),+o.y.toFixed(2),+o.z.toFixed(2)], e:[+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2)]};
  if (netMode==='host') bcast(msg);
  else if (netMode==='guest' && conns[0]) send(conns[0], msg);
}

/* 曳光與特效 */
const fxList = [];
function tracer(a, b, color=0xfff2c0){
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:0.9}));
  scene.add(line);
  fxList.push({obj:line, die:now()+0.07, mat:line.material});
}
function impactFX(p, color){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({color, transparent:true, opacity:0.95}));
  s.position.copy(p); s.scale.set(.22,.22,1);
  scene.add(s);
  fxList.push({obj:s, die:now()+0.12, mat:s.material});
}
function remoteTracer(o, e, idx){
  tracer(new THREE.Vector3(o[0],o[1],o[2]), new THREE.Vector3(e[0],e[1],e[2]));
  const d = camera.position.distanceTo(new THREE.Vector3(o[0],o[1],o[2]));
  if (d < 60) sfx('shot', clamp(1-d/60, .05, .6));
}
let flashLight = null, viewmodel = null, vmMats = [];
function muzzleFlash(){
  if (flashLight){ flashLight.intensity = 3; }
  if (viewmodel) viewmodel.position.z = 0.09;
}
function buildViewmodel(){
  viewmodel = new THREE.Group();
  camera.add(viewmodel);
  scene.add(camera);
  flashLight = new THREE.PointLight(0xffc873, 0, 7);
  flashLight.position.set(0.25, -0.2, -0.9);
  camera.add(flashLight);
  rebuildViewmodel();
}
function rebuildViewmodel(){
  while(viewmodel.children.length) viewmodel.remove(viewmodel.children[0]);
  const g = GUNS[me.gun];
  const matG = new THREE.MeshStandardMaterial({color:0x555d68, roughness:.55, metalness:.18});
  const matD = new THREE.MeshStandardMaterial({color:0x3d444e, roughness:.6, metalness:.15});
  const matW = new THREE.MeshStandardMaterial({map:TEX.wood, roughness:.8});
  const e = EL[CHARS[slots[myIdx]?.char ?? selChar].el];
  const matE = new THREE.MeshStandardMaterial({color:e.color, emissive:e.color, emissiveIntensity:1.2});
  const len = 0.3 + g.range/650;
  const body = new THREE.Mesh(new THREE.BoxGeometry(.055,.08,len), matG); body.position.set(0,0,-len/2);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.2,8), matD);
  barrel.rotation.x = Math.PI/2; barrel.position.set(0,.012,-len-.08);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.04,.1,.05), matW); grip.position.set(0,-.08,-.04);
  const mag  = new THREE.Mesh(new THREE.BoxGeometry(.035,.1,.045), matD); mag.position.set(0,-.08,-.17);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(.06,.012,.07), matE); trim.position.set(0,.045,-.2);
  viewmodel.add(body,barrel,grip,mag,trim);
  if (g.zoom){ const scope = new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,.14,8), matD);
    scope.rotation.x = Math.PI/2; scope.position.set(0,.065,-.26); viewmodel.add(scope); }
  viewmodel.position.set(0.22,-0.2,-0.38);
  viewmodel.rotation.y = 0.05;
  viewmodel.rotation.x = 0.02;
  viewmodel.scale.setScalar(0.8);
}

/* ------------------------- 主機端：傷害裁決 ------------------------- */
function hostApplyHit(attIdx, vicIdx, part, gunIdx, dist){
  const att = slots[attIdx], vic = slots[vicIdx];
  if (!att || !vic || !att.alive || !vic.alive || att.team===vic.team) return;
  if (vic.fx.shield > 0){ addUlt(att, 2); return; }
  const g = GUNS[clamp(gunIdx,0,4)];
  const aEl = CHARS[att.char].el, vEl = CHARS[vic.char].el;
  let dmg = g.dmg;
  const falloff = clamp(1 - Math.max(0, dist-g.range)/g.range, 0.35, 1);
  dmg *= falloff;
  if (part==='head') dmg *= g.hs;
  dmg *= elemMult(aEl, vEl);
  if (aEl==='metal' && Math.random()<0.2) dmg *= 1.5;      // 金：必爆機率
  if (aEl==='fire'){ vic.fx.burn = 3; vic.fx.burnSrc = attIdx; } // 火：灼燒
  if (aEl==='water'){ vic.fx.slow = 2; }                    // 水：緩速
  if (aEl==='wood'){ hostHeal(att, dmg*0.15); }             // 木：吸血
  if (aEl==='earth' && Math.random()<0.15){ vic.fx.stun = Math.max(vic.fx.stun, 0.5); } // 土：震懾
  hostDamage(vic, dmg, att, part==='head', g.name);
  addUlt(att, dmg*0.14);
}
function hostDamage(vic, dmg, att, hs=false, cause=''){
  if (!vic.alive || vic.fx.shield>0) return;
  vic.hp -= dmg;
  updateHpBar(vic);
  if (vic.idx===myIdx) hurtFeedback();
  if (vic.hp <= 0) hostKill(vic, att, hs, cause);
}
function hostHeal(s, v){ s.hp = clamp(s.hp+v, 0, 100); updateHpBar(s); }
function addUlt(s, v){ s.ult = clamp(s.ult+v, 0, 100); }
function hostKill(vic, att, hs, cause){
  vic.alive = false; vic.hp = 0; vic.deaths++;
  vic.streak = 0;
  vic.respawnAt = now() + RESPAWN_SEC;
  let pts = 0;
  if (att && att.team !== vic.team){
    att.kills++; att.streak++;
    pts = 100 + (att.streak-1)*20 + (hs?25:0);   // 擊殺越多（連殺）分數越高
    att.score += pts;
    scores[att.team]++;
    addUlt(att, 22);
  }
  const ev = {t:'ev', k:'kill', a:att?att.idx:-1, v:vic.idx, hs:!!hs, pts, cause,
              st: att?att.streak:0};
  bcast(ev); onGameEvent(ev);
}
function hostWallHit(id, dmg){
  const w = wallsLive.get(id); if(!w) return;
  w.hp -= dmg;
  if (w.hp <= 0){
    const ev = {t:'ev', k:'wallgone', id};
    bcast(ev); onGameEvent(ev);
  }
}

/* ------------------------- 技能 / 大招 ------------------------- */
function localSkill(){
  const s = slots[myIdx];
  if (me.dead || (isHost && s.skillCd > 0)) return;
  if (isHost) s.skillCd = CHARS[s.char].skillCd;
  const dir = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(me.pitch, me.yaw, 0, 'YXZ'));
  const data = {t:'skill', dir:[+dir.x.toFixed(3),+dir.y.toFixed(3),+dir.z.toFixed(3)],
                p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2)]};
  if (isHost) hostUseSkill(myIdx, data);
  else if (conns[0]) send(conns[0], data);
  // 火系衝刺為本地位移
  if (CHARS[s.char].el==='fire'){
    const f = new THREE.Vector3(dir.x,0,dir.z).normalize();
    me.vel.x += f.x*16; me.vel.z += f.z*16;
    s.fx.haste = 2;
  }
}
function hostUseSkill(idx, d){
  const s = slots[idx]; if(!s || !s.alive) return;
  const el = CHARS[s.char].el;
  const ev = {t:'ev', k:'skill', i:idx, el, p:d.p, dir:d.dir};
  if (el==='earth'){
    // 大地壁壘：三段岩牆
    ev.wid = ++wallSeq;
    const p = new THREE.Vector3(d.p[0],0,d.p[2]);
    const f = new THREE.Vector3(d.dir[0],0,d.dir[2]).normalize();
    const c = p.clone().addScaledVector(f, 5.5);
    c.x = clamp(c.x,-55,55); c.z = clamp(c.z,-55,55);
    ev.wx = +c.x.toFixed(2); ev.wz = +c.z.toFixed(2);
    ev.wry = Math.atan2(f.x, f.z);
  }
  else if (el==='metal'){ s.fx.shield = 4; }
  else if (el==='wood'){
    hostHeal(s, 30);
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
      if (o.pos.distanceTo(s.pos) < 12){ o.fx.root = 2.2; }
    }
  }
  else if (el==='water'){
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
      if (o.pos.distanceTo(s.pos) < 14){ o.fx.slow = 4; }
    }
  }
  else if (el==='fire'){ s.fx.haste = 2; }
  bcast(ev); onGameEvent(ev);
}
function localUlt(){
  const s = slots[myIdx];
  if (me.dead || s.ult < 100) return;
  if (isHost) hostUseUlt(myIdx);
  else if (conns[0]) send(conns[0], {t:'ult'});
}
function hostUseUlt(idx){
  const s = slots[idx]; if(!s || !s.alive || s.ult<100) return;
  s.ult = 0;
  const el = CHARS[s.char].el;
  const ev = {t:'ev', k:'ult', i:idx, el, p:[+s.pos.x.toFixed(1),+s.pos.y.toFixed(1),+s.pos.z.toFixed(1)]};
  const foes = slots.filter(o=> o.ctrl!=='empty' && o.alive && o.team!==s.team);
  if (el==='metal'){
    s.fx.bladeT = 6; s.fx.bladeTick = 0;
  } else if (el==='wood'){
    hostHeal(s, 100); s.fx.regen = 5;
    for (const o of foes) if (o.pos.distanceTo(s.pos)<28){ o.fx.root = 3; }
  } else if (el==='water'){
    for (const o of foes){ hostDamage(o, 60*elemMult('water',CHARS[o.char].el), s, false, '滄海萬川'); o.fx.slow = 5; }
  } else if (el==='fire'){
    ev.targets = foes.map(o=> [+o.pos.x.toFixed(1), +o.pos.z.toFixed(1)]);
    setTimeout(()=>{ if(!started) return;
      for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
        hostDamage(o, 85*elemMult('fire',CHARS[o.char].el), s, false, '鳳凰劫');
        o.fx.burn = 4; o.fx.burnSrc = idx;
      }
    }, 700);
  } else if (el==='earth'){
    for (const o of foes) if (o.pos.distanceTo(s.pos)<26){
      hostDamage(o, 70*elemMult('earth',CHARS[o.char].el), s, false, '山崩地裂');
      o.fx.stun = Math.max(o.fx.stun, 2.5);
    }
    ev.wid = ++wallSeq; // 環形岩陣（以 wid 起算 8 座）
    wallSeq += 7;
  }
  bcast(ev); onGameEvent(ev);
}

/* 事件（所有端共用的表現層 + 部分邏輯） */
function onGameEvent(d){
  if (d.k==='kill'){
    const a = slots[d.a], v = slots[d.v];
    const an = a? `<b style="color:${a.team==='red'?'#ff8a7e':'#8ec4ff'}">${a.name}</b>` : '戰場';
    const vn = `<b style="color:${v.team==='red'?'#ff8a7e':'#8ec4ff'}">${v.name}</b>`;
    feed(`${an} ${d.hs?'💀爆頭':'✖'} ${vn}`);
    if (!isHost){ // 來賓端同步計分（主機端已在 hostKill 累計）
      if (a){ a.kills++; a.score += d.pts||0; a.streak = d.st||0; }
      v.deaths++; v.streak = 0;
    }
    v.alive = false; v.hp = 0;
    if (v.avatar){ v.avatar.group.visible = false; }
    deathPuff(v.pos, v.team);
    if (d.v === myIdx){
      me.dead = true;
      $('deathScr').classList.remove('hidden');
      let sec = RESPAWN_SEC;
      $('respawnTxt').textContent = `${sec} 秒後重返戰場…`;
      const iv = setInterval(()=>{ sec--; if(sec<=0){ clearInterval(iv); } else $('respawnTxt').textContent = `${sec} 秒後重返戰場…`; }, 1000);
    }
    if (d.a === myIdx){
      const st = d.st || slots[myIdx].streak;
      if (st>=2) centerMsg(st>=5?'超 神！':st>=4?'四連殺！':st>=3?'三連殺！':'雙殺！');
      sfx('hit');
    }
  }
  else if (d.k==='skill'){
    const s = slots[d.i], e = EL[d.el];
    if (d.el==='earth' && d.wid !== undefined){
      spawnEarthWall(d.wid, d.wx, d.wz, d.wry);
    }
    if (d.el==='metal' && s.avatar){ /* 罩子由狀態渲染 */ }
    if (d.el==='wood' || d.el==='water'){
      ringFX(new THREE.Vector3(d.p[0], 0.15, d.p[2]), d.el==='wood'?0x4ade80:0x38bdf8, d.el==='wood'?12:14);
    }
    if (d.el==='fire'){ /* 衝刺者本地處理 */ }
  }
  else if (d.k==='ult'){
    const s = slots[d.i], c = CHARS[s.char], e = EL[c.el];
    ultCutin(c, e, s.idx===myIdx);
    if (c.el==='water'){ ringFX(new THREE.Vector3(d.p[0],0.2,d.p[2]), 0x38bdf8, 60, 2.2); }
    if (c.el==='wood'){ ringFX(new THREE.Vector3(d.p[0],0.2,d.p[2]), 0x4ade80, 30, 1.6); }
    if (c.el==='earth'){
      shakeCam(0.5);
      if (d.wid !== undefined){
        for (let i=0;i<8;i++){
          const a = i/8*Math.PI*2;
          spawnEarthWall(d.wid+i, d.p[0]+Math.cos(a)*6, d.p[2]+Math.sin(a)*6, -a);
        }
      }
    }
    if (c.el==='fire' && d.targets){
      sfx('boom');
      for (const [x,z] of d.targets) setTimeout(()=> meteorFX(x,z), rand(400,900));
    }
    if (c.el==='metal'){ /* 持續斬擊由 host tick */ }
  }
  else if (d.k==='wallgone'){ removeWall(d.id); }
  else if (d.k==='aitake'){ const s=slots[d.i]; if(s){ s.ctrl='bot'; s.bot=null; } }
}

/* 土牆 */
function spawnEarthWall(id, x, z, ry){
  if (wallsLive.has(id)) return;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({map:TEX.rock, roughness:.95});
  const meshes = [], cols = [];
  const right = new THREE.Vector3(Math.cos(ry),0,-Math.sin(ry));
  for (let i=-1;i<=1;i++){
    const cx = x + right.x*i*1.7, cz = z + right.z*i*1.7;
    const h = 2.1 + Math.abs(i)*-0.25;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, h, 0.8), mat);
    m.position.set(cx, h/2, cz);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    m.userData = {wallId:id};
    group.add(m); meshes.push(m);
    const c = {x0:cx-1.0, x1:cx+1.0, y0:0, y1:h, z0:cz-1.0, z1:cz+1.0};
    colliders.push(c); cols.push(c);
  }
  scene.add(group);
  wallsLive.set(id, {group, meshes, colliders:cols, hp:260, dieAt:now()+20});
  sfx('boom', .35); shakeCam(0.16);
}
function removeWall(id){
  const w = wallsLive.get(id); if(!w) return;
  scene.remove(w.group);
  for (const c of w.colliders){ const i=colliders.indexOf(c); if(i>=0) colliders.splice(i,1); }
  wallsLive.delete(id);
}

/* 特效 */
function ringFX(p, color, maxR, life=1){
  const geo = new THREE.RingGeometry(0.6, 1, 48);
  const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.75, side:THREE.DoubleSide});
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI/2; m.position.copy(p);
  scene.add(m);
  fxList.push({obj:m, die:now()+life, mat, ring:{maxR, t0:now(), life}});
}
function meteorFX(x, z){
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.8,10,8),
    new THREE.MeshBasicMaterial({color:0xffa040}));
  m.position.set(x, 30, z);
  scene.add(m);
  fxList.push({obj:m, mat:m.material, die:now()+2, meteor:{x,z}});
}
function deathPuff(p, team){
  for(let i=0;i<8;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({color: team==='red'?0xff5a4e:0x4ea1ff, transparent:true, opacity:.85}));
    s.position.set(p.x+rand(-.4,.4), p.y+rand(.3,1.6), p.z+rand(-.4,.4));
    s.scale.set(.3,.3,1);
    scene.add(s);
    fxList.push({obj:s, mat:s.material, die:now()+rand(.3,.7)});
  }
  sfx('boom', .3);
}
let camShake = 0;
function shakeCam(v){ camShake = Math.max(camShake, v); }

/* ------------------------- AI（僅主機模擬） ------------------------- */
const NAV = [];
for (const x of [-44,-28,-12,0,12,28,44]) for (const z of [-44,-28,-12,0,12,28,44])
  if (Math.abs(x)>16 || Math.abs(z)>10) NAV.push([x,z]);
NAV.push([0,12],[0,-12],[-10,0],[10,0]);

function botThink(s, dt){
  if (!s.bot) s.bot = {wp:null, aimErr:1, strafe:Math.random()*6, fireCd:0, thinkCd:0, reload:0, ammo:GUNS[s.gun].mag};
  const b = s.bot;
  const fx = s.fx;
  if (fx.stun>0 || fx.root>0){ s.moving=false; return; }
  b.thinkCd -= dt;

  // 找目標
  let target=null, td=1e9;
  for (const o of slots){
    if (o.ctrl==='empty' || !o.alive || o.team===s.team) continue;
    const d = o.pos.distanceTo(s.pos);
    if (d<td){ td=d; target=o; }
  }
  let seeTarget = false;
  if (target && td < 55){
    tmpV.set(s.pos.x, s.pos.y+1.55, s.pos.z);
    tmpV2.set(target.pos.x, target.pos.y+1.3, target.pos.z).sub(tmpV);
    const dist = tmpV2.length();
    raycaster.set(tmpV, tmpV2.normalize());
    raycaster.far = dist;
    const blockers = [...worldMeshes];
    for (const w of wallsLive.values()) blockers.push(...w.meshes);
    seeTarget = raycaster.intersectObjects(blockers, false).length === 0;
  }

  let speed = 4.0 * (fx.slow>0?0.6:1) * (fx.haste>0?1.4:1);
  const mv = new THREE.Vector3();
  if (seeTarget){
    // 對準
    const want = Math.atan2(-(target.pos.x-s.pos.x), -(target.pos.z-s.pos.z));
    let dy = want - s.ry;
    while (dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2;
    s.ry += clamp(dy, -3.2*dt, 3.2*dt);
    s.rx = clamp(Math.atan2((target.pos.y+1.25)-(s.pos.y+1.55), td), -.5,.5);
    // 橫移 + 距離控制
    b.strafe += dt;
    const g = GUNS[s.gun];
    const ideal = g.pellets>1 ? 9 : g.zoom ? 30 : 16;
    const fwd = new THREE.Vector3(-Math.sin(s.ry),0,-Math.cos(s.ry));
    const rgt = new THREE.Vector3(fwd.z,0,-fwd.x);
    mv.addScaledVector(fwd, clamp((td-ideal)*0.25, -1, 1));
    mv.addScaledVector(rgt, Math.sin(b.strafe*1.7));
    // 開槍
    b.fireCd -= dt;
    if (b.reload > 0){ b.reload -= dt; if(b.reload<=0) b.ammo = g.mag; }
    else if (Math.abs(dy) < 0.15 && b.fireCd<=0){
      b.fireCd = 60/g.rpm * (g.auto? rand(1,1.6) : rand(1.2,2));
      b.ammo--;
      if (b.ammo<=0){ b.reload = g.reload; }
      botShoot(s, target, td, g);
    }
    // 技能
    if (s.skillCd<=0 && Math.random()<dt*0.25){ hostUseSkill(s.idx, {
      dir:[-Math.sin(s.ry),0,-Math.cos(s.ry)], p:[s.pos.x,s.pos.y,s.pos.z]}); s.skillCd = CHARS[s.char].skillCd; }
    if (s.ult>=100 && td<20 && Math.random()<dt*0.5) hostUseUlt(s.idx);
    b.wp = null;
  } else {
    // 沒視野：走向目標附近或亂逛
    if (!b.wp || b.thinkCd<=0){
      b.thinkCd = rand(2,5);
      if (target && Math.random()<0.75) b.wp = [target.pos.x+rand(-8,8), target.pos.z+rand(-8,8)];
      else b.wp = NAV[Math.floor(Math.random()*NAV.length)];
    }
    const dx = b.wp[0]-s.pos.x, dz = b.wp[1]-s.pos.z;
    if (dx*dx+dz*dz < 4){ b.wp=null; }
    else {
      const want = Math.atan2(-dx, -dz);
      let dy = want - s.ry;
      while (dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2;
      s.ry += clamp(dy, -2.4*dt, 2.4*dt);
      mv.set(-Math.sin(s.ry),0,-Math.cos(s.ry));
    }
  }
  if (mv.lengthSq()>0){
    mv.normalize().multiplyScalar(speed);
    const vel = new THREE.Vector3(mv.x, -8, mv.z);
    collideMove(s.pos, vel, dt, 0.36, 1.8);
    s.pos.x = clamp(s.pos.x, -57, 57);
    s.pos.z = clamp(s.pos.z, -57, 57);
    s.moving = true;
    // 卡牆自救：想走卻沒位移 → 換路線
    const moved = (s.pos.x-(b.px??s.pos.x))**2 + (s.pos.z-(b.pz??s.pos.z))**2;
    b.stuckT = moved < (speed*dt*0.25)**2 ? (b.stuckT||0)+dt : 0;
    if (b.stuckT > 1.2){
      b.stuckT = 0; b.thinkCd = rand(2,4);
      b.wp = NAV[Math.floor(Math.random()*NAV.length)];
      s.ry += rand(-1.6, 1.6);
    }
    b.px = s.pos.x; b.pz = s.pos.z;
  } else s.moving = false;
}
function botShoot(s, target, dist, g){
  // 由 AI 準度決定是否命中
  const o = [s.pos.x, s.pos.y+1.5, s.pos.z];
  const err = 0.5 + dist*0.05;
  const hitP = clamp(0.62 - dist*0.008 - (target.moving?0.14:0), 0.06, 0.6);
  const aim = new THREE.Vector3(target.pos.x+rand(-err,err), target.pos.y+1.2+rand(-err*0.4,err*0.4), target.pos.z+rand(-err,err));
  const ev = {t:'fire', i:s.idx, o:[+o[0].toFixed(1),+o[1].toFixed(1),+o[2].toFixed(1)],
              e:[+aim.x.toFixed(1),+aim.y.toFixed(1),+aim.z.toFixed(1)]};
  bcast(ev); remoteTracer(ev.o, ev.e, s.idx);
  for (let p=0;p<g.pellets;p++){
    if (Math.random() < hitP){
      const part = Math.random()<0.12 ? 'head':'body';
      hostApplyHit(s.idx, target.idx, part, s.gun, dist);
    }
  }
}

/* ------------------------- 主機模擬 tick ------------------------- */
function hostTick(dt){
  const t = now();
  for (const s of slots){
    if (s.ctrl==='empty') continue;
    // 狀態效果
    const fx = s.fx;
    for (const k of ['slow','root','stun','shield','regen','haste']) if (fx[k]>0) fx[k]-=dt;
    if (fx.burn>0){
      fx.burn-=dt;
      if (s.alive){ hostDamage(s, 6*dt, slots[fx.burnSrc], false, '灼燒'); }
    }
    if (fx.regen>0 && s.alive) hostHeal(s, 12*dt);
    if (s.skillCd>0) s.skillCd-=dt;
    addUlt(s, dt*0.8);
    // 金大招：持續斬擊
    if (fx.bladeT>0 && s.alive){
      fx.bladeT-=dt; fx.bladeTick-=dt;
      if (fx.bladeTick<=0){
        fx.bladeTick=0.45;
        let best=null,bd=1e9;
        for (const o of slots) if (o.ctrl!=='empty'&&o.alive&&o.team!==s.team){
          const d=o.pos.distanceTo(s.pos); if(d<26&&d<bd){bd=d;best=o;}
        }
        if (best){
          hostDamage(best, 26*elemMult('metal',CHARS[best.char].el), s, false, '萬刃歸宗');
          const ev={t:'fire', i:s.idx, o:[+s.pos.x.toFixed(1), +(s.pos.y+1.6).toFixed(1), +s.pos.z.toFixed(1)],
                    e:[+best.pos.x.toFixed(1), +(best.pos.y+1.2).toFixed(1), +best.pos.z.toFixed(1)]};
          bcast(ev); remoteTracer(ev.o, ev.e, s.idx);
        }
      }
    }
    // 重生
    if (!s.alive && t >= s.respawnAt && s.respawnAt>0){
      s.alive = true; s.hp = 100; s.respawnAt = 0;
      const p = spawnPoint(s.team);
      s.pos.copy(p);
      updateHpBar(s);
      if (s.idx===myIdx){ respawnLocal(); }
      if (s.ctrl==='bot') s.bot = null;
    }
    if (s.ctrl==='bot' && s.alive) botThink(s, dt);
  }
  // 土牆到期
  for (const [id,w] of wallsLive){ if (t > w.dieAt || w.hp<=0){ bcast({t:'ev',k:'wallgone',id}); removeWall(id); } }
  // 賽事計時
  matchT -= dt;
  if (matchT <= 0){ hostEndMatch(); }
}
function snapshotTick(){
  const pl = slots.map(s=> s.ctrl==='empty' ? 0 : [
    +s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2),
    +s.ry.toFixed(3), +s.rx.toFixed(3),
    Math.round(s.hp), s.alive?1:0, s.gun, s.moving?1:0,
    (s.fx.burn>0?1:0)|(s.fx.slow>0?2:0)|(s.fx.root>0?4:0)|(s.fx.stun>0?8:0)|(s.fx.shield>0?16:0)|(s.fx.haste>0?32:0),
    Math.round(s.ult),
  ]);
  bcast({t:'st', time:Math.round(matchT), r:scores.red, b:scores.blue, pl});
}
function applySnapshot(d){
  matchT = d.time; scores.red = d.r; scores.blue = d.b;
  for (let i=0;i<slots.length;i++){
    const s = slots[i], p = d.pl[i];
    if (!p){ continue; }
    const wasAlive = s.alive;
    s.hp = p[5]; s.alive = !!p[6]; s.ult = p[10];
    const fb = p[9];
    s.fx.burn = fb&1?1:0; s.fx.slow = fb&2?1:0; s.fx.root = fb&4?1:0;
    s.fx.stun = fb&8?1:0; s.fx.shield = fb&16?1:0; s.fx.haste = fb&32?1:0;
    if (i === myIdx){
      if (s.alive && p[5] < s._lastHp) hurtFeedback();
      s._lastHp = p[5];
      if (!wasAlive && s.alive){ respawnLocal(); me.pos.set(p[0],p[1],p[2]); }
      if (!s.alive && !me.dead){ /* host already sent kill ev */ }
      updateHpBar(s);
      continue;
    }
    if (s.ctrl==='empty') continue;
    // 平滑移動目標
    s._tp = s._tp || new THREE.Vector3();
    s._tp.set(p[0],p[1],p[2]);
    s._try = p[3]; s._trx = p[4];
    s.gun = p[7]; s.moving = !!p[8];
    if (!wasAlive && s.alive) s.pos.set(p[0],p[1],p[2]);
    updateHpBar(s);
  }
}

/* ------------------------- 開戰 / 結束 ------------------------- */
function startMatch(){
  $('lobby').classList.add('hidden');
  $('room').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('netstat').classList.toggle('hidden', netMode==='solo');
  if (!scene) { buildWorld(); buildViewmodel(); }
  started = true;
  matchT = MATCH_MINUTES*60;
  scores = {red:0, blue:0};
  for (const s of slots){
    if (s.ctrl==='empty') continue;
    s.hp = 100; s.alive = true;
    s.pos.copy(spawnPoint(s.team));
    if (s.idx !== myIdx) makeAvatar(s);
  }
  slots[myIdx].gun = me.gun;
  respawnLocal();
  rebuildViewmodel();
  const e = EL[CHARS[slots[myIdx].char].el];
  $('elemtag').innerHTML = `<span style="color:${e.css}">${e.glyph} ${e.name} · ${e.fx}</span>`;
  $('chipSkill').textContent = 'E · '+CHARS[slots[myIdx].char].skill;
  centerMsg('作戰開始 — '+(slots[myIdx].team==='red'?'赤焰隊':'蒼瀾隊'));
  $('pauseHint').classList.remove('hidden');
  updateAmmoUI();
  lastFrame = now();
  requestAnimationFrame(frame);
}
function hostEndMatch(){
  const data = {t:'end', r:scores.red, b:scores.blue, board: slots.filter(s=>s.ctrl!=='empty')
    .map(s=>({n:s.name, tm:s.team, ch:s.char, k:s.kills, d:s.deaths, sc:s.score}))};
  bcast(data);
  showEnd(data);
}
function endMatch(msg){
  started = false;
  $('endScr').classList.remove('hidden');
  $('endTitle').textContent = msg;
  $('endBoard').innerHTML = '';
  document.exitPointerLock && document.exitPointerLock();
}
function showEnd(d){
  started = false;
  document.exitPointerLock && document.exitPointerLock();
  $('hud').classList.add('hidden');
  $('deathScr').classList.add('hidden');
  $('pauseHint').classList.add('hidden');
  $('endScr').classList.remove('hidden');
  const win = d.r===d.b ? null : (d.r>d.b?'red':'blue');
  const myTeam = slots[myIdx].team;
  $('endTitle').textContent = win===null ? '平 手' : (win===myTeam ? '勝 利' : '敗 北');
  $('endTitle').style.color = win===null ? '#e9edf3' : win==='red'?'#ff5a4e':'#4ea1ff';
  $('endBoard').innerHTML = boardHTML(d.board, d.r, d.b);
}
function boardHTML(rows, r, b){
  rows = [...rows].sort((a,x)=> x.sc-a.sc);
  let h = `<div style="text-align:center;font-size:22px;margin-bottom:12px">
    <b style="color:#ff5a4e">赤焰 ${r}</b> ： <b style="color:#4ea1ff">蒼瀾 ${b}</b></div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><th style="text-align:left;color:#7d90ad;padding:4px 12px">玩家</th><th style="color:#7d90ad">行</th>
    <th style="color:#7d90ad">擊殺</th><th style="color:#7d90ad">死亡</th><th style="color:#7d90ad">分數</th></tr>`;
  for (const p of rows){
    const e = EL[CHARS[p.ch].el];
    h += `<tr><td style="padding:5px 12px;color:${p.tm==='red'?'#ff8a7e':'#8ec4ff'}">${p.n}</td>
      <td style="text-align:center;color:${e.css};font-weight:900">${e.glyph}</td>
      <td style="text-align:center">${p.k}</td><td style="text-align:center">${p.d}</td>
      <td style="text-align:center;font-weight:700">${p.sc}</td></tr>`;
  }
  return h+'</table>';
}

/* ------------------------- HUD ------------------------- */
function buildXhair(){
  const x = $('xhair');
  x.innerHTML = '';
  for (const [w,h,l,t] of [[2,10,21,0],[2,10,21,34],[10,2,0,21],[10,2,34,21]]){
    const s = document.createElement('span');
    s.style.cssText = `width:${w}px;height:${h}px;left:${l}px;top:${t}px`;
    x.appendChild(s);
  }
}
buildXhair();
function updateAmmoUI(){
  const g = GUNS[me.gun];
  $('ammo').innerHTML = (me.reloading>0?'--':me.ammo) + `<small> / ${g.mag}</small>`;
  $('gunname').textContent = g.name+' · '+g.en;
}
function showHitmark(hs){
  const h = $('hitmark');
  h.style.opacity = 1;
  h.querySelectorAll('span').forEach(s=> s.style.background = hs?'#ff5a4e':'#fff');
  clearTimeout(h._t); h._t = setTimeout(()=> h.style.opacity=0, 90);
}
function hurtFeedback(){
  const v = $('vign');
  v.style.opacity = 1;
  clearTimeout(v._t); v._t = setTimeout(()=> v.style.opacity=0, 350);
  shakeCam(0.1);
}
function feed(html){
  const kf = $('killfeed');
  const d = document.createElement('div');
  d.className='kf'; d.innerHTML = html;
  kf.prepend(d);
  while (kf.children.length>6) kf.removeChild(kf.lastChild);
  setTimeout(()=>{ d.style.opacity=0; d.style.transition='opacity .5s'; setTimeout(()=>d.remove(), 600); }, 5200);
}
function centerMsg(txt){
  const c = $('centerMsg');
  c.textContent = txt; c.style.opacity=1;
  clearTimeout(c._t); c._t = setTimeout(()=> c.style.opacity=0, 1800);
}
function ultCutin(c, e, mine){
  const cut = $('ultcut');
  $('ulttext').textContent = '「'+c.ultName+'」';
  $('ulttext').style.color = e.css;
  $('ultsub').textContent = c.ultSub;
  cut.classList.remove('show'); void cut.offsetWidth; cut.classList.add('show');
  const f = $('flash');
  f.style.transition='none'; f.style.opacity= mine?0.8:0.35;
  setTimeout(()=>{ f.style.transition='opacity .7s'; f.style.opacity=0; }, 60);
  shakeCam(mine?0.5:0.25);
  sfx('boom', .8);
}
function fmtTime(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function updateHUD(){
  const s = slots[myIdx];
  $('tRed').textContent = scores.red; $('tBlue').textContent = scores.blue;
  $('timer').textContent = fmtTime(matchT);
  $('hpfill').style.width = clamp(s.hp,0,100)+'%';
  $('hplabel').textContent = 'HP '+Math.max(0,Math.ceil(s.hp));
  $('ultfill').style.width = clamp(s.ult,0,100)+'%';
  const cs = $('chipSkill');
  const cd = isHost ? s.skillCd : localSkillCd;
  cs.textContent = 'E · '+CHARS[s.char].skill + (cd>0 ? ` ${cd.toFixed(1)}s` : '');
  cs.classList.toggle('ready', cd<=0);
  const cu = $('chipUlt');
  cu.textContent = s.ult>=100 ? 'Q · 大招就緒！' : `Q · 大招 ${Math.floor(s.ult)}%`;
  cu.classList.toggle('charged', s.ult>=100);
  if (netMode!=='solo') $('netstat').textContent =
    (netMode==='host'?'房主 · ':'') + '房間 '+roomCodeStr+' · '+slots.filter(x=>x.ctrl==='net').length+' 位連線玩家';
}
let localSkillCd = 0; // guest 端的技能 CD 本地顯示
function renderBoard(){
  const rows = slots.filter(s=>s.ctrl!=='empty').map(s=>({n:s.name,tm:s.team,ch:s.char,k:s.kills,d:s.deaths,sc:s.score}));
  $('boardBody').innerHTML = boardHTML(rows, scores.red, scores.blue);
}

/* ------------------------- 輸入 ------------------------- */
addEventListener('keydown', e=>{
  keys[e.code] = true;
  if (!started) return;
  if (e.code==='Tab'){ e.preventDefault(); $('board').classList.remove('hidden'); renderBoard(); }
  if (e.code==='KeyR') startReload();
  if (e.code==='KeyE'){
    if (isHost) localSkill();
    else { const s=slots[myIdx]; if (localSkillCd<=0 && !me.dead){ localSkillCd = CHARS[s.char].skillCd; localSkill(); } }
  }
  if (e.code==='KeyQ') localUlt();
  if (e.code.startsWith('Digit')){
    const i = +e.code.slice(5)-1;
    if (GUNS[i] && i!==me.gun){ me.gun=i; me.ammo=GUNS[i].mag; me.reloading=0; me.zoomed=false; rebuildViewmodel(); updateAmmoUI(); }
  }
});
addEventListener('keyup', e=>{ keys[e.code]=false; if(e.code==='Tab') $('board').classList.add('hidden'); });
addEventListener('mousemove', e=>{
  if (!locked || !started) return;
  const sens = 0.0023 * (me.zoomed?0.45:1);
  me.yaw   -= e.movementX * sens;
  me.pitch = clamp(me.pitch - e.movementY*sens, -1.45, 1.45);
});
addEventListener('mousedown', e=>{
  if (!started) return;
  if (!locked){ $('c3d').requestPointerLock && $('c3d').requestPointerLock(); return; }
  if (e.button===0) mouseDownL = true;
  if (e.button===2) me.zoomed = !me.zoomed && GUNS[me.gun].zoom;
});
addEventListener('mouseup', e=>{ if(e.button===0) mouseDownL=false; });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('pointerlockchange', ()=>{
  locked = document.pointerLockElement === $('c3d');
  if (started) $('pauseHint').classList.toggle('hidden', locked);
});
$('pauseHint').onclick = ()=>{ $('c3d').requestPointerLock && $('c3d').requestPointerLock();
  if (!document.pointerLockElement) $('pauseHint').classList.add('hidden'); };
addEventListener('resize', ()=>{
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

/* ------------------------- 主迴圈 ------------------------- */
let lastFrame = 0, accState = 0, accInput = 0;
function frame(){
  if (!started) return;
  requestAnimationFrame(frame);
  const t = now();
  const dt = Math.min(t-lastFrame, 0.05);
  lastFrame = t;

  updateLocal(dt);
  if (!isHost) localSkillCd = Math.max(0, localSkillCd-dt);
  if (isHost){
    hostTick(dt);
    accState += dt;
    if (accState >= TICK_STATE && netMode==='host'){ accState=0; snapshotTick(); }
  } else {
    accInput += dt;
    if (accInput >= TICK_INPUT && conns[0]){
      accInput = 0;
      send(conns[0], {t:'in', p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2)],
        ry:+me.yaw.toFixed(3), rx:+me.pitch.toFixed(3), mv:slots[myIdx].moving?1:0, g:me.gun});
    }
  }

  // 更新替身
  for (const s of slots){
    if (s.ctrl==='empty' || s.idx===myIdx || !s.avatar) continue;
    const a = s.avatar;
    a.group.visible = s.alive;
    if (!s.alive) continue;
    if (!isHost && s._tp){
      s.pos.lerp(s._tp, Math.min(1, dt*12));
      s.ry += (s._try-s.ry)*Math.min(1, dt*12);
    }
    a.group.position.copy(s.pos);
    a.group.rotation.y = s.ry;
    a.walk += dt * (s.moving?9:0);
    const sw = s.moving ? Math.sin(a.walk)*0.55 : 0;
    a.legL.rotation.x = sw; a.legR.rotation.x = -sw;
    // 狀態光環
    if (s.fx.shield>0){
      if (!a.shieldM){
        a.shieldM = new THREE.Mesh(new THREE.SphereGeometry(1.1,16,12),
          new THREE.MeshBasicMaterial({color:0xe8c84a, transparent:true, opacity:0.22, side:THREE.DoubleSide}));
        a.shieldM.position.y = 1.1; a.group.add(a.shieldM);
      }
      a.shieldM.visible = true;
    } else if (a.shieldM) a.shieldM.visible = false;
  }

  // 特效壽命
  const tn = now();
  for (let i=fxList.length-1;i>=0;i--){
    const f = fxList[i];
    if (f.ring){
      const k = (tn-f.ring.t0)/f.ring.life;
      const r = 0.6 + f.ring.maxR*k;
      f.obj.scale.set(r,r,1);
      f.mat.opacity = 0.75*(1-k);
    }
    if (f.meteor){
      f.obj.position.y -= 55 * 0.016;
      if (f.obj.position.y <= 0.5){
        ringFX(new THREE.Vector3(f.meteor.x,0.2,f.meteor.z), 0xff8040, 8, 0.7);
        sfx('boom',.5); shakeCam(0.3);
        scene.remove(f.obj); fxList.splice(i,1); continue;
      }
    }
    if (tn > f.die){ scene.remove(f.obj); fxList.splice(i,1); }
    else if (!f.ring && !f.meteor && f.mat) f.mat.opacity *= 0.86;
  }
  if (flashLight) flashLight.intensity *= 0.75;
  if (viewmodel) viewmodel.position.z += (0-viewmodel.position.z)*Math.min(1,dt*14);

  // 鏡頭震動
  if (camShake > 0.001){
    camera.position.x += rand(-camShake,camShake)*0.4;
    camera.position.y += rand(-camShake,camShake)*0.4;
    camShake *= Math.pow(0.0005, dt);
  }

  updateHUD();
  renderer.render(scene, camera);
}

/* guest 使用的技能僅送請求；CD 顯示本地維護 */
