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
  metal:  { glyph:'金', name:'金行', color:0xe8c84a, css:'#e8c84a', fx:'穿甲必爆‧彈落碎刃區', beats:['wood','wind'] },
  wood:   { glyph:'木', name:'木行', color:0x4ade80, css:'#4ade80', fx:'命中吸血‧彈落荊棘叢', beats:['earth'] },
  water:  { glyph:'水', name:'水行', color:0x38bdf8, css:'#38bdf8', fx:'命中緩速‧彈落霜凍地', beats:['fire'] },
  fire:   { glyph:'火', name:'火行', color:0xff6b5e, css:'#ff6b5e', fx:'命中灼燒‧彈落生火海', beats:['metal','ice'] },
  earth:  { glyph:'土', name:'土行', color:0xc99a4e, css:'#c99a4e', fx:'命中震懾‧彈落隆岩牆', beats:['water','thunder'] },
  ice:    { glyph:'冰', name:'冰行', color:0xbfeaff, css:'#bfeaff', fx:'命中疊凍‧彈落冰封地', beats:['wood'] },
  thunder:{ glyph:'雷', name:'雷行', color:0xc084fc, css:'#c084fc', fx:'連鎖閃電‧彈落雷場',   beats:['water'] },
  wind:   { glyph:'風', name:'風行', color:0x7ce8c4, css:'#7ce8c4', fx:'命中擊退‧彈落亂流域', beats:['dark'] },
  dark:   { glyph:'暗', name:'暗行', color:0x8b5cf6, css:'#a78bfa', fx:'命中蝕明‧彈落暗幕域', beats:['light'] },
  light:  { glyph:'光', name:'光行', color:0xfff3b8, css:'#fff3b8', fx:'光速彈道‧彈落聖域',   beats:['dark'] },
};
function elemMult(a, d){
  if (!a || !d) return 1;
  if (EL[a].beats.includes(d)) return 1.7;
  if (EL[d].beats.includes(a)) return 0.6;
  return 1;
}
const CHARS = [
  { el:'metal', name:'白鋒‧斬鐵', skill:'金鐘罩',   skillCd:12, ultName:'金行奧義・萬刃殲滅砲',   ultSub:'GATLING OF MYRIAD BLADES' },
  { el:'wood',  name:'青藤‧生嵐', skill:'藤蔓縛地', skillCd:12, ultName:'木行奧義・世界樹之怒',   ultSub:'WRATH OF YGGDRASIL' },
  { el:'water', name:'寒淵‧洗川', skill:'凝冰領域', skillCd:12, ultName:'水行奧義・滄海萬川歸一', ultSub:'ALL RIVERS RETURN TO SEA' },
  { el:'fire',  name:'炎獄‧焚天', skill:'焰行者',   skillCd:8,  ultName:'火行奧義・焚天滅地鳳凰劫', ultSub:'PHOENIX CALAMITY' },
  { el:'earth', name:'磐嶽‧不動', skill:'大地壁壘', skillCd:8,  ultName:'土行奧義・山崩地裂鎮乾坤', ultSub:'MOUNTAIN CRUSHES HEAVEN' },
  { el:'ice',   name:'霜牙‧凜冬', skill:'急凍領域', skillCd:11, ultName:'冰行奧義・千里冰封永凍劫', ultSub:'ABSOLUTE ZERO' },
  { el:'thunder',name:'紫電‧驚雷', skill:'落雷術',  skillCd:9,  ultName:'雷行奧義・九天玄雷滅世',   ultSub:'HEAVENLY THUNDER' },
  { el:'wind',  name:'疾風‧無蹤', skill:'罡風衝擊', skillCd:10, ultName:'風行奧義・九霄龍捲滅世颶', ultSub:'TEMPEST OF HOWLING SKY' },
  { el:'dark',  name:'影殤‧無明', skill:'暗影遁形', skillCd:14, ultName:'暗行奧義・永夜降臨滅明劫', ultSub:'ETERNAL NIGHT DESCENDS' },
  { el:'light', name:'聖輝‧曦臨', skill:'曦光聖域', skillCd:12, ultName:'光行奧義・審判之曦淨世光', ultSub:'RADIANT JUDGEMENT' },
];
const GUNS = [
  { name:'靈息手槍',   en:'P-DAO 9mm',  dmg:30,  hs:2.0, mag:15, reload:1.6, rpm:420, spread:0.010, auto:false, pellets:1, range:70 },
  { name:'奔雷衝鋒槍', en:'LEI-9 SMG',  dmg:16,  hs:1.8, mag:32, reload:2.2, rpm:820, spread:0.030, auto:true,  pellets:1, range:45 },
  { name:'裂空突擊槍', en:'LK-47 AR',   dmg:27,  hs:2.2, mag:30, reload:2.4, rpm:600, spread:0.018, auto:true,  pellets:1, range:90 },
  { name:'崩嶽霰彈槍', en:'BY-12 SG',   dmg:9,   hs:1.5, mag:6,  reload:2.9, rpm:75,  spread:0.075, auto:false, pellets:8, range:26 },
  { name:'貫日狙擊槍', en:'GR-1 SNIPER',dmg:105, hs:2.0, mag:5,  reload:3.2, rpm:45,  spread:0.002, auto:false, pellets:1, range:400, zoom:true, pierce:1 },
  // index 5：金系大招「萬刃殲滅砲」專用（不可手動切換）
  { name:'萬刃殲滅砲', en:'MYRIAD GATLING', dmg:15, hs:1.6, mag:999, reload:0, rpm:1100, spread:0.035, auto:true, pellets:1, range:80, pierce:3 },
];
const GUN_COUNT = 5;   // 玩家可持有的槍數（不含大招砲）
const BOT_NAMES = ['哨兵‧甲','哨兵‧乙','哨兵‧丙','傀兵‧子','傀兵‧丑','傀兵‧寅','鐵衛‧壹','鐵衛‧貳'];

const rand = (a,b)=> a + Math.random()*(b-a);
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
const now = ()=> performance.now()/1000;
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0;
if (IS_TOUCH) document.body.classList.add('touch');

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
  } else if (kind==='zap'){
    const len = 0.22;
    const buf = ac.createBuffer(1, ac.sampleRate*len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 3.5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=1800;
    src.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.55*vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+len);
    src.start(t);
  } else if (kind==='steam'){
    const len = 0.9;
    const buf = ac.createBuffer(1, ac.sampleRate*len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 1.2);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value=3800; f.Q.value=0.6;
    src.connect(f); f.connect(g);
    g.gain.setValueAtTime(0.3*vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+len);
    src.start(t);
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
    fx:{burn:0,burnSrc:-1,slow:0,root:0,stun:0,shield:0,regen:0,haste:0,gat:0,frz:0,frzT:0,blind:0,stealth:0},
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
function pickChar(i){
  selChar = i;
  document.querySelectorAll('.cbtn').forEach(x=> x.classList.toggle('sel', +x.dataset.ci===i));
  if (netMode==='guest' && conns[0]) send(conns[0], {t:'char', c:i});   // 房間中即時換屬性
  if (netMode==='host'){ slots[myIdx].char = i; roomBroadcast(); }
}
function buildCharRow(container){
  if (!container) return;
  CHARS.forEach((c,i)=>{
    const e = EL[c.el];
    const b = document.createElement('div');
    b.className = 'cbtn'+(i===selChar?' sel':''); b.style.color = e.css;
    b.dataset.ci = i;
    b.innerHTML = `<div class="g">${e.glyph}</div><div class="n">${c.name.split('‧')[0]}</div>`;
    b.onclick = ()=> pickChar(i);
    container.appendChild(b);
  });
}
buildCharRow($('charRow'));
buildCharRow($('charRowRoom'));   // 房間內也能換屬性（同大廳選單）
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
    s.char = Math.floor(Math.random()*CHARS.length);
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
    slot.ctrl='net'; slot.peer=conn.peer; slot.name=String(d.name||'玩家').slice(0,10); slot.char=clamp(d.c|0,0,CHARS.length-1);
    conns.push(conn); conn._idx = slot.idx;
    send(conn, {t:'you', idx:slot.idx});
    roomBroadcast();
  }
  else if (d.t==='char'){ const s=slots[conn._idx]; if(s&&!started){ s.char=clamp(d.c|0,0,CHARS.length-1); roomBroadcast(); } }
  else if (d.t==='swap'){ if(!started) trySwap(conn._idx); }
  else if (d.t==='in'){ const s=slots[conn._idx]; if(s&&s.ctrl==='net'){
      s.pos.set(d.p[0],d.p[1],d.p[2]); s.ry=d.ry; s.rx=d.rx; s.moving=!!d.mv; s.gun=clamp(d.g|0,0,4); } }
  else if (d.t==='fire'){ bcast({t:'fire', i:conn._idx, o:d.o, e:d.e}, conn); remoteTracer(d.o, d.e, conn._idx); }
  else if (d.t==='hit'){ hostApplyHit(conn._idx, d.v|0, d.part, d.g|0, d.dist||10); }
  else if (d.t==='whit'){ hostWallHit(d.id, d.dmg||20); }
  else if (d.t==='bhit'){ hostBarrelHit(conn._idx, d.id|0, d.dmg||20); }
  else if (d.t==='ghit'){ hostGroundHit(conn._idx, +d.x||0, +d.y||0, +d.z||0); }
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
  $('roomHint').textContent = host ? '把房號告訴隊友；等待期間可隨時更換屬性；按「開始作戰」空位將由 AI 士兵補齊。'
                                   : '等待房主開始作戰…（等待期間可隨時更換屬性）';
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
        d.className = 'slot'+(s.idx===myIdx?' mine':'');
        const e = EL[CHARS[s.char].el];
        const tag = s.idx===myIdx?'你':(s.ctrl==='bot'?'AI':(s.idx===0?'房主':'玩家'));
        d.innerHTML = `<span class="cg" style="color:${e.css}">${e.glyph}</span><span>${s.name}</span>`+
          `<span class="en" style="color:${e.css}">${e.name}</span><span class="tag">${tag}</span>`;
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
const barrels = new Map();   // 可引爆油桶 id -> {mesh, stripe, col, x, z, hp, dead}
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
  // 柔邊光暈貼圖（煙霧/火焰/火花用）
  const radialTex = stops=>{
    const cv = document.createElement('canvas'); cv.width=cv.height=128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64,64,2,64,64,64);
    for (const [o,col] of stops) g.addColorStop(o,col);
    c.fillStyle=g; c.fillRect(0,0,128,128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  TEX.flame = radialTex([[0,'rgba(255,245,190,1)'],[0.25,'rgba(255,180,60,0.95)'],[0.6,'rgba(255,90,30,0.55)'],[1,'rgba(255,60,20,0)']]);
  TEX.spark = radialTex([[0,'rgba(255,255,255,1)'],[0.3,'rgba(255,230,160,0.8)'],[1,'rgba(255,200,80,0)']]);
  // 寫實斑駁煙霧（多個柔邊圓斑疊加）
  {
    const cv = document.createElement('canvas'); cv.width=cv.height=128;
    const c = cv.getContext('2d');
    for (let i=0;i<16;i++){
      const x = 64+rand(-30,30), y = 64+rand(-30,30), r = rand(12,34);
      const g = c.createRadialGradient(x,y,1,x,y,r);
      const a = rand(.1,.3);
      g.addColorStop(0,`rgba(255,255,255,${a})`); g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g; c.fillRect(0,0,128,128);
    }
    TEX.puff = new THREE.CanvasTexture(cv); TEX.puff.colorSpace = THREE.SRGBColorSpace;
  }
  // 槍口火光（星芒）
  {
    const cv = document.createElement('canvas'); cv.width=cv.height=128;
    const c = cv.getContext('2d');
    c.translate(64,64);
    for (let i=0;i<8;i++){
      c.rotate(Math.PI/4);
      const g = c.createLinearGradient(0,0,58,0);
      g.addColorStop(0,'rgba(255,240,200,0.95)'); g.addColorStop(1,'rgba(255,180,80,0)');
      c.fillStyle=g;
      c.beginPath(); c.moveTo(0,-3.5); c.lineTo(rand(30,58),0); c.lineTo(0,3.5); c.closePath(); c.fill();
    }
    const g2 = c.createRadialGradient(0,0,1,0,0,20);
    g2.addColorStop(0,'rgba(255,255,240,1)'); g2.addColorStop(1,'rgba(255,200,120,0)');
    c.fillStyle=g2; c.beginPath(); c.arc(0,0,20,0,7); c.fill();
    TEX.flash = new THREE.CanvasTexture(cv); TEX.flash.colorSpace = THREE.SRGBColorSpace;
  }
  // 焦痕 / 彈孔
  {
    const cv = document.createElement('canvas'); cv.width=cv.height=64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32,32,2,32,32,30);
    g.addColorStop(0,'rgba(0,0,0,0.95)'); g.addColorStop(.5,'rgba(10,8,6,0.7)'); g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g; c.fillRect(0,0,64,64);
    for (let i=0;i<24;i++){ c.fillStyle=`rgba(0,0,0,${rand(.2,.6)})`;
      const a=Math.random()*Math.PI*2, r=rand(16,30);
      c.beginPath(); c.arc(32+Math.cos(a)*r,32+Math.sin(a)*r,rand(1,3),0,7); c.fill(); }
    TEX.scorch = new THREE.CanvasTexture(cv); TEX.scorch.colorSpace = THREE.SRGBColorSpace;
  }
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
      if (g.window){
        if (g.two){ // 上下雙排窗（供二樓夾層對外射擊）
          segs.push([g.from, g.to, 0, 1.05]); segs.push([g.from, g.to, 2.0, 2.8]); segs.push([g.from, g.to, 4.1, h]);
        } else {
          segs.push([g.from, g.to, 0, 1.05]); segs.push([g.from, g.to, 2.0, h]);
        }
      }
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
  const win2 = (at, wd=1.6)=> ({from:at-wd/2, to:at+wd/2, window:true, two:true});

  // 中央倉庫（大空間、南門+西門、北/東雙排窗——上排供二樓射擊）
  houseAA(0, 0, 26, 16, 4.6, matBrick, {
    s:[door(0, 6)], w:[door(0, 5)],
    n:[win2(-8,2.2), win2(0,2.2), win2(8,2.2)], e:[win2(-4,2), win2(4,2)],
  });
  box(3.4,1.3,1.6, matWood, -6, .65, 2);
  box(3.4,1.3,1.6, matWood,  6, .65, -2);
  box(1.3,1.3,1.3, matWood,  0, .65, -5);
  // ── 倉庫二樓夾層：北半部平台（頂面 2.2m）＋東側樓梯 ──
  box(25, 0.25, 6.5, matConc, 0, 2.075, -4.4);
  box(25, 0.45, 0.14, matPlaster, 0, 2.42, -1.2, true, false);  // 南緣矮護欄（視覺）
  for (let i=0;i<5;i++){ const sh = 0.42*(i+1);
    box(0.6, sh, 1.3, matConc, 7.2 + i*0.6, sh/2, -0.3); }       // 自動上階樓梯

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
  // 一般油桶
  const barrelG = new THREE.CylinderGeometry(0.42,0.42,1.1,10);
  const bmat = new THREE.MeshStandardMaterial({color:0x6a6f5a, roughness:.6, metalness:.3});
  for (const [x,z] of [[-10,-6],[12,12],[-20,-20],[22,-14],[-32,4],[34,6]]){
    const m = new THREE.Mesh(barrelG, bmat); m.position.set(x,.55,z);
    m.castShadow=m.receiveShadow=true; scene.add(m); worldMeshes.push(m);
    addCollider(x,z,0.9,0.9,1.1);
  }
  // 可引爆油桶（紅桶，打爆造成範圍傷害與衝擊波、可連鎖）
  const rmat = new THREE.MeshStandardMaterial({color:0xb03428, roughness:.5, metalness:.3});
  const smat = new THREE.MeshStandardMaterial({color:0xf2e28a, emissive:0x664410, emissiveIntensity:.4, roughness:.5});
  const bpos = [[-14,-2],[16,10],[-6,26],[6,-28],[-37,21],[38,-14],[-24,-34],[26,34],[44,10]];
  bpos.forEach(([x,z], i)=>{
    const id = i+1;
    const m = new THREE.Mesh(barrelG, rmat); m.position.set(x,.55,z);
    m.castShadow=m.receiveShadow=true; m.userData = {barrel:id};
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.16,10), smat);
    stripe.position.set(x,.8,z);
    scene.add(m); scene.add(stripe); worldMeshes.push(m);
    const col = {x0:x-.45,x1:x+.45,y0:0,y1:1.1,z0:z-.45,z1:z+.45};
    colliders.push(col);
    barrels.set(id, {mesh:m, stripe, col, x, z, hp:30, dead:false});
  });
  // 輪胎堆
  const tmat = new THREE.MeshStandardMaterial({color:0x1e2124, roughness:.95});
  for (const [x,z,n] of [[-18,18,3],[20,-8,2],[8,38,3],[-40,-20,2],[36,16,2]]){
    for (let i=0;i<n;i++){
      const t = new THREE.Mesh(new THREE.TorusGeometry(.55,.22,8,16), tmat);
      t.rotation.x = Math.PI/2; t.position.set(x, .24+i*.42, z);
      t.castShadow=t.receiveShadow=true; scene.add(t); worldMeshes.push(t);
    }
    addCollider(x, z, 1.5, 1.5, .4*n+.3);
  }
  // 斜靠棧板
  const pmat = new THREE.MeshStandardMaterial({map:TEX.wood, roughness:.9});
  for (const [x,z,ry] of [[-12,30,.5],[14,-16,-.7],[-34,-24,.3],[30,6,-.4]]){
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.6,.12), pmat);
    p.position.set(x,.75,z); p.rotation.set(-.35,ry,0);
    p.castShadow=p.receiveShadow=true; scene.add(p); worldMeshes.push(p);
  }

  /* ===== 加密度：散落掩體群（固定種子亂數，確保連線各端地圖一致） ===== */
  let mseed = 1337;
  const mrand = (a,b)=>{ mseed = (mseed*1664525 + 1013904223)>>>0; return a + (mseed/4294967296)*(b-a); };
  const matRockP = new THREE.MeshStandardMaterial({map:TEX.rock, roughness:.95});
  const clusters = [
    [-22,14],[22,-16],[-8,12],[8,-12],[-16,-26],[16,26],[-38,38],[38,-40],
    [-44,16],[44,-20],[-30,44],[30,-46],[-4,-14],[4,16],[24,44],[-24,-44],
    [50,18],[-50,-18],[-52,32],[52,-32],[-18,40],[18,-42],[10,-16],[-10,18],
    [34,34],[-34,-34],[46,2],[-46,8],[28,-8],[-28,10],
  ];
  for (const [cx,cz] of clusters){
    const kind = Math.floor(mrand(0,3));
    if (kind===0){ // 木箱組（可跳上）
      box(1.3,1.3,1.3, matWood, cx+mrand(-.5,.5), .65, cz+mrand(-.5,.5));
      if (mrand(0,1)<.7) box(1.3,1.3,1.3, matWood, cx+1.4, .65, cz+mrand(-.4,.4));
      if (mrand(0,1)<.45) box(1.3,1.3,1.3, matWood, cx+.7, 1.95, cz);
    } else if (kind===1){ // 護欄＋油桶
      const rot = mrand(0,1)<.5;
      box(rot?0.5:3.4, 1.05, rot?3.4:0.5, matJersey, cx, .52, cz);
      const bm = new THREE.Mesh(barrelG, bmat);
      bm.position.set(cx+(rot?1.2:0), .55, cz+(rot?0:1.2));
      bm.castShadow=bm.receiveShadow=true; scene.add(bm); worldMeshes.push(bm);
      addCollider(bm.position.x, bm.position.z, .9, .9, 1.1);
    } else { // 矮石牆＋碎石
      box(2.6, mrand(.9,1.3), 0.55, matRockP, cx, .55, cz);
      box(mrand(.5,.8), mrand(.35,.55), mrand(.5,.8), matRockP, cx+1.8, .25, cz+mrand(-.5,.5));
    }
  }
  // 廢墟旁瓦礫堆
  for (const [rx,rz] of [[-3.5,37],[4,43],[3.5,-37],[-4,-43],[-6,39],[6,-39]]){
    for (let i=0;i<3;i++)
      box(mrand(.5,.95), mrand(.35,.7), mrand(.5,.95), matRockP,
          rx+mrand(-.8,.8), mrand(.2,.4), rz+mrand(-.8,.8));
  }
  // 水管堆（橫置圓管×3 疊放）
  const pipeMat = new THREE.MeshStandardMaterial({color:0x7a8288, roughness:.5, metalness:.5});
  for (const [px,pz,rot] of [[-20,-36,0],[20,38,1]]){
    for (const [ox,oy] of [[-.5,.45],[.5,.45],[0,1.25]]){
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,4.6,12), pipeMat);
      pipe.rotation.z = rot? 0 : Math.PI/2;
      pipe.rotation.x = rot? Math.PI/2 : 0;
      pipe.position.set(px+(rot?ox:0), oy, pz+(rot?0:ox));
      pipe.castShadow = pipe.receiveShadow = true;
      scene.add(pipe); worldMeshes.push(pipe);
    }
    addCollider(px, pz, rot?1.9:4.6, rot?4.6:1.9, 1.7);
  }
  // 鷹架高台 ×2（樓梯上平台，制高點）
  const scaffold = (sx, sz)=>{
    box(3.2, 0.22, 3.2, matWood, sx, 2.09, sz);                  // 平台頂 2.2
    box(3.2, 0.42, 0.12, matWood, sx, 2.41, sz-1.55, true, false); // 護欄（視覺）
    box(3.2, 0.42, 0.12, matWood, sx, 2.41, sz+1.55, true, false);
    for (const [ox,oz] of [[-1.45,-1.45],[1.45,-1.45],[-1.45,1.45],[1.45,1.45]]){
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.12,2.1,.12), pipeMat);
      leg.position.set(sx+ox, 1.05, sz+oz);
      leg.castShadow = true; scene.add(leg); worldMeshes.push(leg);
    }
    for (let i=0;i<5;i++){ const sh = 0.42*(i+1);
      box(0.6, sh, 1.2, matWood, sx-1.9-(4-i)*0.6, sh/2, sz); }
  };
  scaffold(-18, -5);
  scaffold(18, -2);

  // 寫實天空：漸層天穹＋太陽
  {
    const cv = document.createElement('canvas'); cv.width=16; cv.height=256;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#54789e'); g.addColorStop(.42,'#93accd');
    g.addColorStop(.72,'#c8d2d4'); g.addColorStop(1,'#d8d2c2');
    c.fillStyle = g; c.fillRect(0,0,16,256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(340, 24, 16),
      new THREE.MeshBasicMaterial({map:t, side:THREE.BackSide, fog:false, depthWrite:false}));
    sky.renderOrder = -2;
    scene.add(sky);
    scene.background = null;
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.spark, color:0xfff2d0,
      transparent:true, blending:THREE.AdditiveBlending, fog:false, depthWrite:false}));
    sun.scale.set(70,70,1);
    sun.position.copy(sunLight.position).normalize().multiplyScalar(300);
    sun.renderOrder = -1;
    scene.add(sun);
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
  slot.avatar = {group:g, legL, legR, head, torso, vest, gunM:gun, parts:[head,torso,vest,legL,legR], hcv, htex, walk:0, lastHp:-1};
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
  // 分軸 AABB 碰撞（含 0.55m 內自動上階：樓梯/矮台階直接走上去）
  const tryAxis = (axis, delta)=>{
    pos[axis] += delta;
    for (const c of colliders){
      if (pos.x+half>c.x0 && pos.x-half<c.x1 && pos.z+half>c.z0 && pos.z-half<c.z1 &&
          pos.y < c.y1 && pos.y+height > c.y0){
        if (axis==='x' || axis==='z'){
          const stepUp = c.y1 - pos.y;
          if (stepUp > 0 && stepUp <= 0.55){ pos.y = c.y1; continue; }  // 自動上階
          if (axis==='x') pos.x = delta>0 ? c.x0-half : c.x1+half;
          else pos.z = delta>0 ? c.z0-half : c.z1+half;
        } else { // y
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
  const touchMove = IS_TOUCH && touchIn.moveId !== null;
  const touchMag = touchMove ? Math.hypot(touchIn.mvx, touchIn.mvy) : 0;
  let speed = 4.6;
  if ((keys.ShiftLeft || (touchMove && touchMag > 0.92)) && !me.zoomed) speed = 6.4; // 搖桿推到底=疾跑
  if (fx.slow>0) speed *= 0.6;
  if (fx.haste>0) speed *= 1.5;
  if (rooted) speed = 0;

  const f = new THREE.Vector3(-Math.sin(me.yaw),0,-Math.cos(me.yaw));
  const r = new THREE.Vector3(-f.z,0,f.x);   // 正確的右方向（原本鏡像，左右顛倒）
  const wish = new THREE.Vector3();
  if (keys.KeyW) wish.add(f);
  if (keys.KeyS) wish.sub(f);
  if (keys.KeyD) wish.add(r);
  if (keys.KeyA) wish.sub(r);
  if (touchMove && touchMag > 0.12){ wish.addScaledVector(f, -touchIn.mvy).addScaledVector(r, touchIn.mvx); }
  if (wish.lengthSq()>0){
    // 觸控為類比搖桿：推多少走多快；鍵盤為全速
    const analog = touchMove ? clamp((touchMag-0.12)/0.75, 0.15, 1) : 1;
    wish.normalize().multiplyScalar(speed * analog);
  }
  // 平滑加速
  me.vel.x += (wish.x-me.vel.x)*Math.min(1, dt*12);
  me.vel.z += (wish.z-me.vel.z)*Math.min(1, dt*12);
  me.vel.y -= 15*dt;
  const jumpQueued = touchJump > 0 && now()-touchJump < 0.4;
  if ((keys.Space || jumpQueued) && me.onGround && !rooted){ me.vel.y = 5.6; me.onGround=false; touchJump = 0; }
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
    const eff = slots[myIdx].fx.gat>0 ? GUNS[5] : GUNS[me.gun];
    if (!eff.auto) mouseDownL = false;
  }
  const targetFov = me.zoomed && GUNS[me.gun].zoom ? 22 : 74;
  camera.fov += (targetFov-camera.fov)*Math.min(1,dt*14);
  camera.updateProjectionMatrix();
  // 狙擊鏡遮罩：開鏡時隱藏槍模與準星，顯示鏡內視野
  const scoped = me.zoomed && GUNS[me.gun].zoom && camera.fov < 46;
  if (scoped !== me._scoped){
    me._scoped = scoped;
    $('scopeOv').classList.toggle('hidden', !scoped);
    $('xhair').style.display = scoped ? 'none' : '';
    if (viewmodel) viewmodel.visible = !scoped;
  }
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
  const gat = slots[myIdx].fx.gat > 0;             // 萬刃殲滅砲形態
  const g = gat ? GUNS[5] : GUNS[me.gun];
  if (me.fireCd > 0 || (!gat && me.reloading>0)) return;
  if (!gat && me.ammo <= 0){ startReload(); return; }
  me.fireCd = 60/g.rpm;
  if (!gat) me.ammo--;
  me.recoil += (gat?0.006 : (g.dmg>60?0.035:0.012)) * (me.zoomed?0.4:1);
  me.spreadHeat = Math.min(1.6, me.spreadHeat + (gat?0.05:0.28));
  sfx(g.pellets>1||g.dmg>60?'shot2':'shot', gat?.7:1);
  muzzleFlash();
  spawnCasing();
  const myEl = CHARS[slots[myIdx].char].el;
  const elColor = EL[myEl].color;
  const spread = g.spread * (me.zoomed&&g.zoom?0.15:1) * (1+me.spreadHeat);
  const origin = new THREE.Vector3(me.pos.x, EYE(), me.pos.z);
  const aimPitch = me.pitch + me.recoil;   // 子彈沿準星實際指向（含後座抬升）
  const pierceMax = g.pierce || 0;         // 貫穿掩體層數（狙擊1層、殲滅砲3層）
  for (let p=0; p<g.pellets; p++){
    const dir = new THREE.Vector3(0,0,-1)
      .applyEuler(new THREE.Euler(aimPitch + rand(-spread,spread), me.yaw + rand(-spread,spread), 0, 'YXZ'));
    raycaster.set(origin, dir);
    raycaster.far = g.range*1.6;
    const hits = raycaster.intersectObjects(shootTargets(), false);
    let end = origin.clone().addScaledVector(dir, g.range*1.6);
    let pierced = 0;
    for (const h of hits){
      const ud = h.object.userData || {};
      if (ud.slot !== undefined){
        showHitmark(ud.part==='head');
        sfx('hit');
        reportHit(ud.slot, ud.part, gat?5:me.gun, h.distance);
        const vs = slots[ud.slot];
        sparkBurst(h.point, vs ? EL[CHARS[vs.char].el].color : 0xff4444, 6, 2.5);
        spawnSmoke(h.point.x, h.point.y, h.point.z, {n:2, size:.5, color:0x883333, rise:.4, life:.6, grow:.5, opacity:.5, spread:.15});
        end = h.point;
        break;
      }
      if (ud.barrel !== undefined){
        reportBarrelHit(ud.barrel, g.dmg);
        sparkBurst(h.point, 0xffcc66, 8, 4);
        if (pierced < pierceMax){ pierced++; continue; }
        end = h.point; break;
      }
      if (ud.wallId !== undefined){
        reportWallHit(ud.wallId, g.dmg);
        impactElem(h.point, dir, myEl, true);
        if (pierced < pierceMax){ pierced++; continue; }
        end = h.point; break;
      }
      // 場景表面
      impactElem(h.point, dir, myEl, false);
      if (h.face){
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        addDecal(h.point, n, rand(.04,.07), 20);
      }
      if (p===0 && pierced===0) reportGroundHit(h.point);   // 場地改造只在第一層表面判定
      if (pierced < pierceMax){ pierced++; continue; }      // 貫穿：繼續往後找目標
      end = h.point; break;
    }
    const muzzle = camera.localToWorld(new THREE.Vector3(0.18, -0.16, -0.7));
    spawnBolt(muzzle, end, myEl);
    if (myEl==='metal' || myEl==='light' || gat) tracer(muzzle, end, gat?0xffe9a0:elColor);   // 飛刃/光矢/殲滅砲掠光
    netFire(origin, end);
  }
  if (!gat && me.ammo===0) startReload();
  updateAmmoUI();
}
/* 依屬性的彈著特效 */
function impactElem(point, dir, el, isRock){
  const c = EL[el].color;
  if (el==='metal'){
    sparkBurst(point, 0xffe9a0, 12, 5);
    if (Math.random()<0.35){ // 跳彈
      const ref = dir.clone().reflect(new THREE.Vector3(rand(-1,1),rand(.3,1),rand(-1,1)).normalize()).normalize();
      tracer(point, point.clone().addScaledVector(ref, rand(4,10)), 0xffe9a0);
    }
  } else if (el==='fire'){
    sparkBurst(point, 0xff9040, 8, 3.5);
    spawnSmoke(point.x, point.y, point.z, {flame:true, n:2, size:.7, rise:1, life:.4, grow:.8, opacity:.9, spread:.1});
  } else if (el==='water'){
    sparkBurst(point, 0x8fdcff, 8, 3);
    spawnDebris(point.x, point.y, point.z, 0x6fc8f0, 2, {min:.03,max:.07,spd:2.5,bounce:.15});
  } else if (el==='wood'){
    sparkBurst(point, 0x7dfa9e, 8, 3);
  } else if (el==='ice'){
    sparkBurst(point, 0xdff4ff, 10, 3.5);
    spawnDebris(point.x, point.y, point.z, 0xbfeaff, 3, {min:.03, max:.07, spd:3, bounce:.2});
  } else if (el==='thunder'){
    sparkBurst(point, 0xd8b4ff, 12, 5);
    const o = point.clone().add(new THREE.Vector3(rand(-1,1), rand(.2,1), rand(-1,1)));
    arcLine(point.clone(), o, .3, 0xd8b4ff);
  } else if (el==='wind'){
    sparkBurst(point, 0xbdf5e0, 8, 4);
    spawnSmoke(point.x, point.y, point.z, {n:2, size:.5, color:0xe4fff5, rise:.4, life:.5, grow:1.1, opacity:.4, spread:.12});
  } else if (el==='dark'){
    sparkBurst(point, 0x8b5cf6, 8, 3.5);
    spawnSmoke(point.x, point.y, point.z, {n:3, size:.6, color:0x150a26, rise:.5, life:.9, grow:.8, opacity:.8, spread:.12});
  } else if (el==='light'){
    sparkBurst(point, 0xfff8d8, 14, 5.5);
    spawnSmoke(point.x, point.y, point.z, {n:1, size:.7, color:0xfff3b8, add:true, rise:.3, life:.25, grow:1.4, opacity:.8, spread:.05});
  } else {
    sparkBurst(point, 0xd8c090, 6, 3);
    spawnSmoke(point.x, point.y, point.z, {n:2, size:.6, color:0xa08b62, rise:.6, life:.9, grow:.7, opacity:.5, spread:.15});
  }
  if (isRock || Math.random()<.4) spawnDebris(point.x, point.y, point.z, isRock?0x8a6a3c:0x777770, 2, {min:.03,max:.08,spd:3});
}
function reportBarrelHit(id, dmg){
  if (isHost) hostBarrelHit(myIdx, id, dmg);
  else if (conns[0]) send(conns[0], {t:'bhit', id, dmg});
}
function reportGroundHit(pt){
  if (isHost) hostGroundHit(myIdx, pt.x, pt.y, pt.z);
  else if (conns[0]) send(conns[0], {t:'ghit', x:+pt.x.toFixed(1), y:+pt.y.toFixed(1), z:+pt.z.toFixed(1)});
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
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending}));
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
  const s = slots[idx];
  const el = s ? CHARS[s.char].el : 'metal';
  const from = new THREE.Vector3(o[0],o[1],o[2]), to = new THREE.Vector3(e[0],e[1],e[2]);
  spawnBolt(from, to, el);
  if (el==='metal' || el==='light') tracer(from, to, EL[el].color);
  sparkBurst(from, 0xffd9a0, 3, 1.2);   // 遠端槍口火光
  const d = camera.position.distanceTo(from);
  if (d < 60) sfx('shot', clamp(1-d/60, .05, .6));
}
let flashLight = null, viewmodel = null, vmMats = [], muzzleSprite = null, muzzleT = 0;
function muzzleFlash(){
  if (flashLight){ flashLight.intensity = 3; }
  if (viewmodel) viewmodel.position.z = 0.09;
  if (muzzleSprite){
    muzzleSprite.visible = true;
    muzzleSprite.material.rotation = Math.random()*Math.PI*2;
    const s = rand(.22,.4);
    muzzleSprite.scale.set(s,s,1);
    muzzleT = now();
  }
  // 槍口硝煙
  if (Math.random()<.35 && camera){
    const mp = camera.localToWorld(new THREE.Vector3(0.18,-0.15,-0.72));
    spawnSmoke(mp.x, mp.y, mp.z, {n:1, size:.3, color:0xaeb2b6, rise:.5, life:.9, grow:.7, opacity:.3, spread:.03});
  }
}
function buildViewmodel(){
  viewmodel = new THREE.Group();
  camera.add(viewmodel);
  scene.add(camera);
  flashLight = new THREE.PointLight(0xffc873, 0, 7);
  flashLight.position.set(0.25, -0.2, -0.9);
  camera.add(flashLight);
  muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.flash, transparent:true,
    depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, color:0xffe2b0}));
  muzzleSprite.visible = false;
  camera.add(muzzleSprite);
  rebuildViewmodel();
}
function rebuildViewmodel(){
  while(viewmodel.children.length) viewmodel.remove(viewmodel.children[0]);
  const e = EL[CHARS[slots[myIdx]?.char ?? selChar].el];
  // 寫實槍材
  const M = {
    black: new THREE.MeshStandardMaterial({color:0x23272d, roughness:.5,  metalness:.35}),
    dark:  new THREE.MeshStandardMaterial({color:0x363c45, roughness:.55, metalness:.25}),
    steel: new THREE.MeshStandardMaterial({color:0x7b838c, roughness:.35, metalness:.3}),
    wood:  new THREE.MeshStandardMaterial({map:TEX.wood,  roughness:.75}),
    poly:  new THREE.MeshStandardMaterial({color:0x2e3237, roughness:.75, metalness:.05}),
    elem:  new THREE.MeshStandardMaterial({color:e.color, emissive:e.color, emissiveIntensity:1.1}),
  };
  const B = (w,h,d,mat,x,y,z,rx=0,rz=0)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); m.rotation.x = rx; m.rotation.z = rz;
    viewmodel.add(m); return m;
  };
  const C = (r,ln,mat,x,y,z)=>{
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,ln,10), mat);
    m.rotation.x = Math.PI/2; m.position.set(x,y,z);
    viewmodel.add(m); return m;
  };
  let len = 0.5;
  switch (me.gun){
    case 0: // 靈息手槍：滑套、擊錘、握把、扳機護弓、前後準星
      len = 0.3;
      B(.052,.05,.26, M.steel, 0,.045,-.12);        // 滑套
      B(.056,.016,.1,  M.black, 0,.02,-.2);          // 滑套鋸齒段
      B(.048,.04,.19, M.dark,  0,.0,-.1);            // 下槍身
      B(.044,.13,.062,M.poly,  0,-.07,-.005,.32);    // 握把（後傾）
      B(.012,.008,.055,M.dark, 0,-.033,-.085);       // 扳機護弓下緣
      B(.012,.03,.008, M.dark, 0,-.02,-.11);         // 護弓前柱
      B(.008,.016,.012,M.black,0,.078,-.245);        // 前準星
      B(.024,.012,.012,M.black,0,.076,-.015);        // 照門
      C(.009,.03, M.black, 0,.045,-.265);            // 槍口
      B(.012,.028,.02, M.steel,0,.06,.005,-.5);      // 擊錘
      break;
    case 1: // 奔雷衝鋒槍：MP5 造型——粗護木、彎彈匣、折疊托
      len = 0.48;
      B(.058,.068,.32, M.black, 0,.02,-.16);         // 機匣
      B(.064,.072,.15, M.poly,  0,.012,-.34);        // 粗護木
      C(.013,.12, M.dark, 0,.032,-.47);              // 槍管
      B(.01,.035,.012, M.black, 0,.08,-.42);         // 前準星柱
      B(.026,.026,.02, M.black, 0,.072,-.05);        // 照門座
      B(.034,.13,.05,  M.dark, 0,-.085,-.2,.3);      // 彎彈匣上段
      B(.034,.1,.05,   M.dark, 0,-.185,-.135,.55);   // 彎彈匣下段
      B(.04,.11,.05,   M.poly, 0,-.07,-.04,.3);      // 握把
      B(.014,.05,.12,  M.steel,0,.02,.05);           // 折疊托桿
      C(.007,.05, M.steel, .045,.045,-.12);          // 拉機柄
      break;
    case 2: // 裂空突擊槍：AK 造型——木護木、彎彈匣、槍口制退器
      len = 0.58;
      B(.056,.076,.26, M.black, 0,.02,-.18);         // 機匣
      B(.058,.056,.2,  M.wood,  0,.018,-.42);        // 木護木
      C(.011,.17, M.dark, 0,.032,-.6);               // 槍管
      C(.008,.2,  M.dark, 0,.058,-.44);              // 導氣管
      C(.015,.055,M.black,0,.032,-.68);              // 制退器
      B(.01,.05,.012, M.black, 0,.08,-.56);          // 前準星
      B(.024,.02,.05, M.black, 0,.075,-.12);         // 表尺照門
      B(.036,.14,.06, M.dark, 0,-.1,-.235,.4);       // 彎彈匣
      B(.04,.11,.05,  M.wood, 0,-.07,-.05,.28);      // 握把
      B(.05,.07,.16,  M.wood, 0,-.005,.06,-.06);     // 槍托
      break;
    case 3: // 崩嶽霰彈槍：泵動——雙管配置（槍管+彈倉管）、木質泵把
      len = 0.62;
      B(.058,.072,.2, M.black, 0,.018,-.14);         // 機匣
      C(.013,.42, M.dark, 0,.052,-.45);              // 上槍管
      C(.011,.36, M.dark, 0,.008,-.44);              // 下彈倉管
      B(.056,.058,.13, M.wood, 0,.005,-.4);          // 泵動護木
      B(.05,.08,.15,   M.wood, 0,-.01,.05,-.08);     // 槍托
      B(.008,.01,.01,  M.steel,0,.078,-.655);        // 珠狀準星
      B(.04,.1,.05,    M.wood, 0,-.068,-.03,.3);     // 握把
      break;
    case 4: // 貫日狙擊槍：栓動——長管、狙擊鏡組、槍栓、腳架
      len = 0.78;
      B(.052,.066,.26, M.black, 0,.015,-.18);        // 機匣
      C(.012,.5,  M.dark, 0,.04,-.56);               // 長槍管
      B(.03,.03,.06,   M.black, 0,.04,-.8);          // 制退器
      B(.05,.085,.2,   M.poly,  0,-.012,.06,-.05);   // 槍托
      B(.044,.026,.12, M.poly,  0,.052,.05);         // 貼腮板
      C(.026,.2,  M.black, 0,.115,-.13);             // 鏡身
      C(.035,.055,M.black, 0,.115,-.255);            // 物鏡
      C(.03,.05,  M.black, 0,.115,-.015);            // 目鏡
      B(.014,.045,.02, M.dark, 0,.085,-.19);         // 鏡架前
      B(.014,.045,.02, M.dark, 0,.085,-.07);         // 鏡架後
      C(.007,.05, M.steel, .05,.04,-.1);             // 槍栓
      B(.02,.02,.02,   M.steel, .075,.025,-.1);      // 栓柄球
      B(.008,.15,.008, M.dark, -.03,-.05,-.62,0,.35);// 腳架左
      B(.008,.15,.008, M.dark,  .03,-.05,-.62,0,-.35);// 腳架右
      break;
  }
  B(.044,.011,.05, M.elem, 0,.088,-.02);             // 屬性紋章（機匣頂）
  if (muzzleSprite){
    muzzleSprite.position.set(0.22, -0.19, -0.38-(len+0.1)*0.8);
    muzzleSprite.material.color = new THREE.Color(e.color).lerp(new THREE.Color(0xffffff), 0.55);
  }
  viewmodel.position.set(0.22,-0.2,-0.38);
  viewmodel.rotation.y = 0.05;
  viewmodel.rotation.x = 0.02;
  viewmodel.scale.setScalar(0.8);
  if (flashLight) flashLight.color.set(e.color);
}

/* ------------------------- 主機端：傷害裁決 ------------------------- */
function hostApplyHit(attIdx, vicIdx, part, gunIdx, dist){
  const att = slots[attIdx], vic = slots[vicIdx];
  if (!att || !vic || !att.alive || !vic.alive || att.team===vic.team) return;
  if (vic.fx.shield > 0){ addUlt(att, 2); return; }
  const g = GUNS[clamp(gunIdx,0,5)];
  const aEl = CHARS[att.char].el, vEl = CHARS[vic.char].el;
  let dmg = g.dmg;
  const falloff = clamp(1 - Math.max(0, dist-g.range)/g.range, 0.35, 1);
  dmg *= falloff;
  if (part==='head') dmg *= g.hs;
  dmg *= elemMult(aEl, vEl);
  if (aEl==='metal' && Math.random()<0.2) dmg *= 1.5;      // 金：必爆機率
  if (aEl==='fire'){
    if (vic.fx.root > 0){                                   // 五行反應：木生火 → 爆燃
      vic.fx.root = 0; dmg += 25;
      const vp = vic.idx===myIdx ? me.pos : vic.pos;
      const ev = {t:'ev', k:'boomfx', x:+vp.x.toFixed(1), y:+(vp.y+1).toFixed(1), z:+vp.z.toFixed(1)};
      bcast(ev); onGameEvent(ev);
      for (const o of slots){
        if (o.ctrl==='empty' || !o.alive || o.team===att.team || o===vic) continue;
        const op = o.idx===myIdx ? me.pos : o.pos;
        if ((op.x-vp.x)**2+(op.z-vp.z)**2 < 25){
          o.fx.burn = Math.max(o.fx.burn, 3); o.fx.burnSrc = attIdx;
          hostDamage(o, 30*elemMult('fire', CHARS[o.char].el), att, false, '爆燃');
        }
      }
    }
    vic.fx.burn = 3; vic.fx.burnSrc = attIdx;               // 火：灼燒
  }
  if (aEl==='water'){
    vic.fx.slow = 2;                                        // 水：緩速
    if (vic.fx.burn > 0){                                   // 五行反應：水剋火 → 蒸汽熄滅+額外傷害
      vic.fx.burn = 0; dmg += 12;
      const vp = vic.idx===myIdx ? me.pos : vic.pos;
      hostSteam(vp.x, vp.z);
    }
  }
  if (aEl==='wood'){ hostHeal(att, dmg*0.15); }             // 木：吸血
  if (aEl==='earth' && Math.random()<0.15){ vic.fx.stun = Math.max(vic.fx.stun, 0.5); } // 土：震懾
  if (aEl==='ice'){                                          // 冰：疊凍，三層冰封
    if (vic.fx.burn > 0){ vic.fx.burn = 0; dmg += 10; }      // 冰滅火
    vic.fx.frz++; vic.fx.frzT = 4;
    if (vic.fx.frz >= 3){
      vic.fx.frz = 0; vic.fx.stun = Math.max(vic.fx.stun, 1.2); vic.fx.slow = Math.max(vic.fx.slow, 2.5);
      const vp = vic.idx===myIdx ? me.pos : vic.pos;
      const ev = {t:'ev', k:'frzfx', x:+vp.x.toFixed(1), y:+(vp.y+1).toFixed(1), z:+vp.z.toFixed(1)};
      bcast(ev); onGameEvent(ev);
    }
  }
  if (aEl==='fire' && vic.fx.frz > 0){ vic.fx.frz = 0; dmg += 15;  // 火融冰 → 蒸汽
    const vp = vic.idx===myIdx ? me.pos : vic.pos; hostSteam(vp.x, vp.z); }
  if (aEl==='wind'){                                         // 風：擊退
    const vp = vic.idx===myIdx ? me.pos : vic.pos;
    const ap = att.idx===myIdx ? me.pos : att.pos;
    const a = Math.atan2(vp.z-ap.z, vp.x-ap.x);
    if (vic.ctrl==='bot'){
      vic.pos.x = clamp(vic.pos.x + Math.cos(a)*1.0, -57, 57);
      vic.pos.z = clamp(vic.pos.z + Math.sin(a)*1.0, -57, 57);
    } else {
      const pe = {t:'ev', k:'push', i:vic.idx, x:+(Math.cos(a)*6).toFixed(1), z:+(Math.sin(a)*6).toFixed(1), y:1.5};
      bcast(pe); onGameEvent(pe);
    }
  }
  if (aEl==='dark'){ vic.fx.blind = Math.max(vic.fx.blind, 1.3); }   // 暗：蝕明（視野遭黑幕吞噬）
  if (aEl==='light' && vic.fx.blind > 0){ vic.fx.blind = 0; dmg += 12; } // 光：淨化暗蝕 → 聖光爆發
  if (aEl==='thunder'){                                      // 雷：連鎖閃電
    const vp = vic.idx===myIdx ? me.pos : vic.pos;
    const wet = vic.fx.slow > 0;                              // 潮濕/受寒 → 超導
    const chainP = wet ? 0.6 : 0.15;
    if (Math.random() < 0.08) vic.fx.stun = Math.max(vic.fx.stun, 0.35);  // 麻痺
    if (Math.random() < chainP){
      for (const o of slots){
        if (o.ctrl==='empty' || !o.alive || o.team===att.team || o===vic) continue;
        const op = o.idx===myIdx ? me.pos : o.pos;
        if ((op.x-vp.x)**2 + (op.z-vp.z)**2 < (wet?100:64)){
          hostDamage(o, (wet?24:dmg*0.5)*elemMult('thunder', CHARS[o.char].el), att, false, wet?'超導':'連鎖閃電');
          const ev = {t:'ev', k:'chain', a:[+vp.x.toFixed(1),1.3,+vp.z.toFixed(1)], b:[+op.x.toFixed(1),1.3,+op.z.toFixed(1)]};
          bcast(ev); onGameEvent(ev);
          if (!wet) break;                                    // 一般僅跳 1 個，超導全跳
        }
      }
    }
  }
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
function hostBarrelHit(attIdx, id, dmg){
  const b = barrels.get(id); if(!b || b.dead) return;
  b.hp -= dmg;
  if (b.hp <= 0) hostExplodeBarrel(attIdx, id);
}
/* ---- 子彈落點改造場地（依屬性；觸發率隨槍威力） ---- */
const miniWallQueue = [];   // 主機：土彈岩掩體的存量上限
function hostGroundHit(idx, x, y, z){
  const s = slots[idx]; if(!s || !s.alive) return;
  const el = CHARS[s.char].el;
  const g = GUNS[clamp(s.gun,0,4)];
  const chance = 0.10 + g.dmg*0.005;   // 手槍25% 衝鋒18% 突擊24% 霰彈15% 狙擊62%
  if (Math.random() > chance) return;
  x = clamp(x, -56, 56); z = clamp(z, -56, 56);
  if (el==='fire'){ hostAddZone('fire', x, z, 1.5, 3.5, idx); }
  else if (el==='water'){ hostAddZone('frost', x, z, 2.0, 4.5, idx); }
  else if (el==='wood'){ hostAddZone('bramble', x, z, 1.9, 6, idx); }
  else if (el==='metal'){ hostAddZone('shrapnel', x, z, 1.7, 5, idx); }
  else if (el==='ice'){ hostAddZone('ice', x, z, 2.0, 5, idx); }
  else if (el==='thunder'){ hostAddZone('shock', x, z, 1.8, 4.5, idx); }
  else if (el==='wind'){ hostAddZone('gale', x, z, 2.2, 4.5, idx); }
  else if (el==='dark'){ hostAddZone('gloom', x, z, 2.2, 5, idx); }
  else if (el==='light'){ hostAddZone('sanct', x, z, 2.0, 5, idx); }
  else if (el==='earth'){
    if (y > 1.6) return;                       // 打太高不隆起
    for (const o of slots){                    // 避免把人直接卡進石頭
      if (o.ctrl==='empty' || !o.alive) continue;
      const p = o.idx===myIdx ? me.pos : o.pos;
      if ((p.x-x)**2 + (p.z-z)**2 < 2.2) return;
    }
    const sp = idx===myIdx ? me.pos : s.pos;
    const wid = ++wallSeq;
    const ev = {t:'ev', k:'mwall', wid, x:+x.toFixed(1), z:+z.toFixed(1),
                ry:+Math.atan2(x-sp.x, z-sp.z).toFixed(2)};
    bcast(ev); onGameEvent(ev);
    miniWallQueue.push(wid);
    while (miniWallQueue.length > 8){          // 最多同時 8 座
      const old = miniWallQueue.shift();
      if (wallsLive.has(old)){ bcast({t:'ev', k:'wallgone', id:old}); removeWall(old); }
    }
  }
}
function hostExplodeBarrel(attIdx, id){
  const b = barrels.get(id); if(!b || b.dead) return;
  const att = slots[attIdx];
  const ev = {t:'ev', k:'barrel', id, a:attIdx};
  bcast(ev); onGameEvent(ev);   // 事件處理內會標記 dead 並播特效
  // 範圍傷害（火屬性）
  for (const o of slots){
    if (o.ctrl==='empty' || !o.alive) continue;
    const p = o.idx===myIdx ? me.pos : o.pos;
    const d = Math.hypot(p.x-b.x, p.z-b.z);
    if (d < 7.5){
      const dmg = 70*(1-d/9)*elemMult('fire', CHARS[o.char].el);
      o.fx.burn = Math.max(o.fx.burn, 2.5); o.fx.burnSrc = attIdx;
      if (o.ctrl==='bot'){ // 物理擊飛（AI）
        const a = Math.atan2(p.z-b.z, p.x-b.x);
        o.pos.x += Math.cos(a)*2.2; o.pos.z += Math.sin(a)*2.2;
        o.fx.stun = Math.max(o.fx.stun, .5);
      }
      hostDamage(o, dmg, att && att.team!==o.team ? att : null, false, '油桶爆炸');
    }
  }
  hostAddZone('fire', b.x, b.z, 2.6, 5, attIdx);
  // 連鎖引爆
  for (const [oid, ob] of barrels){
    if (ob.dead || oid===id) continue;
    if ((ob.x-b.x)**2 + (ob.z-b.z)**2 < 36)
      setTimeout(()=>{ if(started) hostExplodeBarrel(attIdx, oid); }, rand(200,420));
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
    hostAddZone('frost', d.p[0], d.p[2], 8, 6, idx);
  }
  else if (el==='fire'){
    s.fx.haste = 2;
    // 焰行者：衝刺路徑留下火場
    const f = new THREE.Vector3(d.dir[0],0,d.dir[2]).normalize();
    for (let i=1;i<=4;i++){
      const fx2 = clamp(d.p[0]+f.x*i*2.2, -56, 56), fz2 = clamp(d.p[2]+f.z*i*2.2, -56, 56);
      hostAddZone('fire', fx2, fz2, 1.6, 3.2, idx);
    }
  }
  else if (el==='ice'){
    // 急凍領域：周圍敵人重緩速+疊兩層凍，腳下留冰封地
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
      const op = o.idx===myIdx ? me.pos : o.pos;
      if ((op.x-d.p[0])**2 + (op.z-d.p[2])**2 < 100){
        o.fx.slow = 4; o.fx.frz = Math.min(o.fx.frz+2, 2); o.fx.frzT = 4;
      }
    }
    hostAddZone('ice', d.p[0], d.p[2], 6, 6, idx);
  }
  else if (el==='thunder'){
    // 落雷術：瞄準方向 12m 處天降落雷
    const f = new THREE.Vector3(d.dir[0],0,d.dir[2]).normalize();
    const lx = clamp(d.p[0]+f.x*12, -56, 56), lz = clamp(d.p[2]+f.z*12, -56, 56);
    ev.lx = +lx.toFixed(1); ev.lz = +lz.toFixed(1);
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
      const op = o.idx===myIdx ? me.pos : o.pos;
      if ((op.x-lx)**2 + (op.z-lz)**2 < 20){
        hostDamage(o, 45*elemMult('thunder', CHARS[o.char].el), s, false, '落雷');
        o.fx.stun = Math.max(o.fx.stun, 0.8);
      }
    }
    hostAddZone('shock', lx, lz, 2.5, 3, idx);
  }
  else if (el==='wind'){
    // 罡風衝擊：吹飛周圍敵人並自身加速
    s.fx.haste = 2;
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
      const op = o.idx===myIdx ? me.pos : o.pos;
      const dx = op.x-d.p[0], dz = op.z-d.p[2], dl = Math.hypot(dx,dz)||1;
      if (dl < 9){
        hostDamage(o, 15*elemMult('wind', CHARS[o.char].el), s, false, '罡風');
        if (o.ctrl==='bot'){
          o.pos.x = clamp(o.pos.x + dx/dl*3, -57, 57);
          o.pos.z = clamp(o.pos.z + dz/dl*3, -57, 57);
          o.fx.stun = Math.max(o.fx.stun, .35);
        } else {
          const pe = {t:'ev', k:'push', i:o.idx, x:+(dx/dl*11).toFixed(1), z:+(dz/dl*11).toFixed(1), y:3.5};
          bcast(pe); onGameEvent(pe);
        }
      }
    }
  }
  else if (el==='dark'){ s.fx.stealth = 3.5; }   // 暗影遁形：短暫匿蹤（敵人與 AI 皆不可見）
  else if (el==='light'){ hostAddZone('sanct', d.p[0], d.p[2], 5, 6, idx); }  // 曦光聖域：治療我方
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
    s.fx.gat = 8;   // 萬刃殲滅砲：8 秒加特林形態，子彈貫穿掩體
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
      for (const [tx,tz] of ev.targets) hostAddZone('fire', tx, tz, 2.4, 4.5, idx);
    }, 700);
  } else if (el==='earth'){
    for (const o of foes) if (o.pos.distanceTo(s.pos)<26){
      hostDamage(o, 70*elemMult('earth',CHARS[o.char].el), s, false, '山崩地裂');
      o.fx.stun = Math.max(o.fx.stun, 2.5);
    }
    ev.wid = ++wallSeq; // 環形岩陣（以 wid 起算 8 座）
    wallSeq += 7;
  } else if (el==='ice'){
    // 千里冰封：全場敵人冰封 3 秒
    for (const o of foes){
      hostDamage(o, 55*elemMult('ice',CHARS[o.char].el), s, false, '永凍');
      o.fx.stun = Math.max(o.fx.stun, 3); o.fx.slow = 5; o.fx.frz = 0;
      const op = o.idx===myIdx ? me.pos : o.pos;
      hostAddZone('ice', op.x, op.z, 2.5, 6, idx);
    }
  } else if (el==='thunder'){
    // 九天玄雷：三波天雷轟擊所有敵人
    const strike = ()=>{
      if (!started) return;
      const evb = {t:'ev', k:'boltset', pts:[]};
      for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team!==s.team){
        const op = o.idx===myIdx ? me.pos : o.pos;
        evb.pts.push([+op.x.toFixed(1), +op.z.toFixed(1)]);
        hostDamage(o, 55*elemMult('thunder',CHARS[o.char].el), s, false, '九天玄雷');
        o.fx.stun = Math.max(o.fx.stun, 0.9);
      }
      if (evb.pts.length){ bcast(evb); onGameEvent(evb); }
    };
    strike();
    setTimeout(strike, 800);
    setTimeout(strike, 1600);
  } else if (el==='wind'){
    // 九霄龍捲：全場敵人被捲向風眼、擊飛暈眩，留下巨型亂流域
    for (const o of foes){
      const op = o.idx===myIdx ? me.pos : o.pos;
      const dx = s.pos.x-op.x, dz = s.pos.z-op.z, dl = Math.hypot(dx,dz)||1;
      if (dl > 32) continue;
      hostDamage(o, 55*elemMult('wind',CHARS[o.char].el), s, false, '龍捲風暴');
      o.fx.stun = Math.max(o.fx.stun, 1.3);
      if (o.ctrl==='bot'){
        const pull = Math.min(dl-2, 6);
        if (pull > 0){
          o.pos.x = clamp(o.pos.x + dx/dl*pull, -57, 57);
          o.pos.z = clamp(o.pos.z + dz/dl*pull, -57, 57);
        }
      } else {
        const pe = {t:'ev', k:'push', i:o.idx, x:+(dx/dl*10).toFixed(1), z:+(dz/dl*10).toFixed(1), y:6};
        bcast(pe); onGameEvent(pe);
      }
    }
    hostAddZone('gale', s.pos.x, s.pos.z, 7, 6, idx);
  } else if (el==='dark'){
    // 永夜降臨：全場敵人陷入黑暗、自身長匿蹤，敵人腳下生暗幕
    s.fx.stealth = 5;
    for (const o of foes){
      hostDamage(o, 45*elemMult('dark',CHARS[o.char].el), s, false, '永夜');
      o.fx.blind = Math.max(o.fx.blind, 4);
      const op = o.idx===myIdx ? me.pos : o.pos;
      hostAddZone('gloom', op.x, op.z, 3, 6, idx);
    }
  } else if (el==='light'){
    // 審判之曦：全隊滿療＋再生，敵人受聖光審判並致盲
    for (const o of slots) if (o.ctrl!=='empty' && o.alive && o.team===s.team){
      hostHeal(o, 100); o.fx.regen = Math.max(o.fx.regen, 4); o.fx.blind = 0;
    }
    for (const o of foes){
      hostDamage(o, 55*elemMult('light',CHARS[o.char].el), s, false, '審判之曦');
      o.fx.blind = Math.max(o.fx.blind, 2.2);
    }
    hostAddZone('sanct', s.pos.x, s.pos.z, 6, 7, idx);
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
    if (d.el==='wood') spikeBurst(d.p[0], d.p[2], 0x2f9e57, 9, 1.5, 10, 1.7);  // 藤蔓破土
    if (d.el==='metal') sparkBurst(new THREE.Vector3(d.p[0], 1.3, d.p[2]), 0xffe9a0, 16, 4);
    if (d.el==='ice'){
      ringFX(new THREE.Vector3(d.p[0], .15, d.p[2]), 0xbfeaff, 10);
      spikeBurst(d.p[0], d.p[2], 0xd8f2ff, 10, 1.5, 9, 1.4);   // 冰晶隆起
    }
    if (d.el==='thunder' && d.lx !== undefined) lightningFX(d.lx, d.lz);   // 落雷
    if (d.el==='fire'){ /* 衝刺者本地處理 */ }
    if (d.el==='wind'){
      waveRing(d.p[0], d.p[2], 0xbdf5e0, 11, .7, 2.4);
      spawnSmoke(d.p[0], .6, d.p[2], {n:8, size:.9, color:0xe0fff4, rise:1.8, life:.7, grow:1, opacity:.4, spread:1.2});
    }
    if (d.el==='dark'){   // 遁形黑霧
      spawnSmoke(d.p[0], .8, d.p[2], {n:10, size:1.3, color:0x120823, rise:.9, life:1.3, grow:1, opacity:.8, spread:.7});
      sparkBurst(new THREE.Vector3(d.p[0], 1.2, d.p[2]), 0x8b5cf6, 10, 3);
      if (d.i===myIdx) centerMsg('遁 入 暗 影');
    }
    if (d.el==='light'){
      ringFX(new THREE.Vector3(d.p[0], .15, d.p[2]), 0xffe98a, 10);
      lightPillarFX(d.p[0], d.p[2], .8);
    }
  }
  else if (d.k==='ult'){
    const s = slots[d.i], c = CHARS[s.char], e = EL[c.el];
    ultCutin(c, e, s.idx===myIdx);
    if (c.el==='water'){
      ringFX(new THREE.Vector3(d.p[0],0.2,d.p[2]), 0x38bdf8, 60, 2.2);
      waveRing(d.p[0], d.p[2], 0x49c8ff, 46, 1.9, 4.5);
      waveRing(d.p[0], d.p[2], 0xbfeaff, 46, 2.3, 2.2);
      spawnSmoke(d.p[0], .5, d.p[2], {n:14, size:2.4, color:0xcfeaff, rise:2.4, life:1.6, grow:1.6, opacity:.6, spread:3});
    }
    if (c.el==='wood'){
      ringFX(new THREE.Vector3(d.p[0],0.2,d.p[2]), 0x4ade80, 30, 1.6);
      spikeBurst(d.p[0], d.p[2], 0x2f9e57, 18, 3, 20, 3.2);   // 世界樹根鞭破土
      sparkBurst(new THREE.Vector3(d.p[0], 1.5, d.p[2]), 0x7dfa9e, 20, 6);
    }
    if (c.el==='earth'){
      shakeCam(0.5);
      spikeBurst(d.p[0], d.p[2], 0x8a6a3c, 14, 4, 22, 2.6);   // 岩刺
      spawnSmoke(d.p[0], .4, d.p[2], {n:16, size:2.6, color:0xa08b62, rise:1.2, life:2.4, grow:1.8, opacity:.6, spread:6});
      spawnDebris(d.p[0], 1, d.p[2], 0x8a6a3c, 12, {spd:9});
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
    if (c.el==='metal'){ bladeOrbit(d.i, 6); }               // 環體飛劍演出
    if (c.el==='wind'){
      shakeCam(.35);
      waveRing(d.p[0], d.p[2], 0x9ff5dc, 40, 1.8, 4);
      waveRing(d.p[0], d.p[2], 0xe0fff4, 40, 2.4, 2);
      windVortexFX(d.p[0], d.p[2]);
    }
    if (c.el==='dark'){
      darkNovaFX(d.p[0], d.p[2]);
      spawnSmoke(d.p[0], .8, d.p[2], {n:14, size:2.4, color:0x0b0614, rise:1.4, life:2.4, grow:1.6, opacity:.85, spread:4});
    }
    if (c.el==='light'){
      const f = $('flash');
      f.style.transition='none'; f.style.opacity = .95;
      setTimeout(()=>{ f.style.transition='opacity 1.1s'; f.style.opacity=0; }, 80);
      waveRing(d.p[0], d.p[2], 0xffe98a, 48, 2, 4);
      lightPillarFX(d.p[0], d.p[2], 2.2);
      sparkBurst(new THREE.Vector3(d.p[0], 1.6, d.p[2]), 0xfff8d8, 24, 7);
    }
    if (c.el==='ice'){
      waveRing(d.p[0], d.p[2], 0xbfeaff, 50, 2, 3.5);
      spikeBurst(d.p[0], d.p[2], 0xd8f2ff, 24, 4, 26, 2.8);  // 全場冰晶
      spawnSmoke(d.p[0], .6, d.p[2], {n:16, size:2.6, color:0xe8f6ff, rise:1.2, life:2.4, grow:1.5, opacity:.6, spread:8});
    }
    if (c.el==='thunder'){ shakeCam(.4); sfx('zap'); }        // 天雷由 boltset 事件呈現
  }
  else if (d.k==='wallgone'){ removeWall(d.id); }
  else if (d.k==='mwall'){ spawnMiniWall(d.wid, d.x, d.z, d.ry); }
  else if (d.k==='aitake'){ const s=slots[d.i]; if(s){ s.ctrl='bot'; s.bot=null; } }
  else if (d.k==='zone'){ spawnZoneVis(d.id, d.kind, d.x, d.z, d.r, d.dur); }
  else if (d.k==='frzfx'){ iceShatterFX(d.x, d.y, d.z); }
  else if (d.k==='chain'){ arcLine(new THREE.Vector3(...d.a), new THREE.Vector3(...d.b), .6); sfx('zap', .4); }
  else if (d.k==='boltset'){ for (const [x,z] of d.pts) setTimeout(()=> lightningFX(x, z), rand(0,250)); }
  else if (d.k==='zoneend'){ const v=zoneVis.get(d.id); if(v){ v.until = 0; } }
  else if (d.k==='steam'){ steamFX(d.x, d.z); }
  else if (d.k==='push'){   // 風系擊退 / 龍捲牽引：本地玩家承受衝量
    if (d.i===myIdx && !me.dead){
      me.vel.x += d.x; me.vel.z += d.z; if (d.y) me.vel.y += d.y;
    }
  }
  else if (d.k==='boomfx'){ explosionFX(d.x, d.y, d.z, .7); }
  else if (d.k==='barrel'){
    const b = barrels.get(d.id);
    if (b && !b.dead){
      b.dead = true;
      scene.remove(b.mesh); scene.remove(b.stripe);
      const wi = worldMeshes.indexOf(b.mesh); if(wi>=0) worldMeshes.splice(wi,1);
      const ci = colliders.indexOf(b.col); if(ci>=0) colliders.splice(ci,1);
      explosionFX(b.x, .5, b.z, 1.4);
      spawnDebris(b.x, .8, b.z, 0xb03428, 8, {spd:9});
      // 衝擊波把自己震飛（本地物理）
      const dd = Math.hypot(me.pos.x-b.x, me.pos.z-b.z);
      if (dd < 8 && !me.dead){
        const a = Math.atan2(me.pos.z-b.z, me.pos.x-b.x);
        const kb = (1-dd/8)*14;
        me.vel.x += Math.cos(a)*kb; me.vel.z += Math.sin(a)*kb; me.vel.y += (1-dd/8)*7;
      }
    }
  }
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
function spawnMiniWall(id, x, z, ry){ // 土彈擊地隆起的單塊岩掩體
  if (wallsLive.has(id)) return;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({map:TEX.rock, roughness:.95});
  const h = 1.6;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, h, 0.75), mat);
  m.position.set(x, h/2, z); m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  m.userData = {wallId:id};
  group.add(m);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.5, .5, 5), mat);
  cap.position.set(x+rand(-.4,.4), h+.15, z+rand(-.3,.3)); cap.rotation.z = rand(-.3,.3);
  group.add(cap);
  scene.add(group);
  const c = {x0:x-1.0, x1:x+1.0, y0:0, y1:h, z0:z-1.0, z1:z+1.0};
  colliders.push(c);
  wallsLive.set(id, {group, meshes:[m], colliders:[c], hp:140, dieAt:now()+12});
  spawnSmoke(x, .3, z, {n:6, size:1.2, color:0xa08b62, rise:1, life:1.2, grow:1, opacity:.6, spread:.8});
  spawnDebris(x, .8, z, 0x8a6a3c, 4, {spd:4});
  const d = camera ? camera.position.distanceTo(new THREE.Vector3(x,1,z)) : 99;
  if (d < 40){ sfx('boom', clamp(.5-d/90,.05,.4)); shakeCam(clamp(.2-d/150,0,.2)); }
}
function removeWall(id){
  const w = wallsLive.get(id); if(!w) return;
  for (const m of w.meshes) spawnDebris(m.position.x, m.position.y, m.position.z, 0x8a6a3c, 4, {spd:4});
  scene.remove(w.group);
  for (const c of w.colliders){ const i=colliders.indexOf(c); if(i>=0) colliders.splice(i,1); }
  wallsLive.delete(id);
}

/* ============================================================
   迷你物理引擎（碎片 / 彈殼：重力、彈跳、AABB 碰撞、旋轉）
   ============================================================ */
const phys = [];
const MAX_PHYS = 130;
const debrisGeo = new THREE.BoxGeometry(1,1,1);
function spawnDebris(x,y,z, color, n, opt={}){
  for(let i=0;i<n;i++){
    if (phys.length>=MAX_PHYS){ const old=phys.shift(); scene.remove(old.mesh); }
    const s = rand(opt.min||.06, opt.max||.17);
    const m = new THREE.Mesh(debrisGeo, new THREE.MeshStandardMaterial({color, roughness:.9}));
    m.scale.set(s*rand(.6,1.5), s*rand(.6,1.5), s*rand(.6,1.5));
    m.position.set(x,y,z);
    m.castShadow = true;
    scene.add(m);
    const sp = opt.spd||6;
    const v = new THREE.Vector3(rand(-sp,sp), rand(sp*.7,sp*1.6), rand(-sp,sp));
    if (opt.vel) v.add(opt.vel);
    phys.push({mesh:m, v, av:new THREE.Vector3(rand(-10,10),rand(-10,10),rand(-10,10)),
      r:s*.6, bounce:opt.bounce??.42, die:now()+rand(2,3.6)});
  }
}
function spawnCasing(){
  if (!viewmodel) return;
  const p = new THREE.Vector3(0.28,-0.16,-0.45).applyMatrix4(camera.matrixWorld);
  if (phys.length>=MAX_PHYS){ const old=phys.shift(); scene.remove(old.mesh); }
  const m = new THREE.Mesh(debrisGeo, new THREE.MeshStandardMaterial({color:0xc9a227, metalness:.4, roughness:.4}));
  m.scale.set(.022,.022,.05);
  m.position.copy(p);
  scene.add(m);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  phys.push({mesh:m, v:right.multiplyScalar(rand(1.6,2.6)).add(new THREE.Vector3(0,rand(1.6,2.6),0)),
    av:new THREE.Vector3(rand(-20,20),rand(-20,20),rand(-20,20)), r:.03, bounce:.3, die:now()+2});
}
function physTick(dt){
  const t = now();
  for (let i=phys.length-1;i>=0;i--){
    const p = phys[i], m = p.mesh;
    p.v.y -= 22*dt;
    m.position.addScaledVector(p.v, dt);
    m.rotation.x += p.av.x*dt; m.rotation.y += p.av.y*dt; m.rotation.z += p.av.z*dt;
    if (m.position.y < p.r){
      m.position.y = p.r;
      if (Math.abs(p.v.y) > 1.2) p.v.y *= -p.bounce; else p.v.y = 0;
      p.v.x *= .72; p.v.z *= .72; p.av.multiplyScalar(.6);
    } else {
      // 側面撞硬物反彈（粗略）
      for (const c of colliders){
        if (m.position.x>c.x0-p.r && m.position.x<c.x1+p.r && m.position.z>c.z0-p.r && m.position.z<c.z1+p.r &&
            m.position.y>c.y0 && m.position.y<c.y1){
          const dx0=m.position.x-c.x0, dx1=c.x1-m.position.x, dz0=m.position.z-c.z0, dz1=c.z1-m.position.z;
          const mn=Math.min(dx0,dx1,dz0,dz1);
          if (mn===dx0){ m.position.x=c.x0-p.r; p.v.x=-Math.abs(p.v.x)*p.bounce; }
          else if (mn===dx1){ m.position.x=c.x1+p.r; p.v.x=Math.abs(p.v.x)*p.bounce; }
          else if (mn===dz0){ m.position.z=c.z0-p.r; p.v.z=-Math.abs(p.v.z)*p.bounce; }
          else { m.position.z=c.z1+p.r; p.v.z=Math.abs(p.v.z)*p.bounce; }
          break;
        }
      }
    }
    if (t > p.die){
      m.scale.multiplyScalar(0.82);
      if (m.scale.x < 0.008){ scene.remove(m); phys.splice(i,1); }
    }
  }
}

/* ---------- 煙霧 / 火花（billboard） ---------- */
const smokes = [];
const MAX_SMOKE = 100;
function spawnSmoke(x,y,z, opt={}){
  const n = opt.n||6;
  for (let i=0;i<n;i++){
    if (smokes.length>=MAX_SMOKE){ const old=smokes.shift(); scene.remove(old.sp); }
    const mat = new THREE.SpriteMaterial({map:opt.flame?TEX.flame:TEX.puff, transparent:true, depthWrite:false,
      color: opt.color??0xc8cdd2, blending: opt.flame||opt.add ? THREE.AdditiveBlending : THREE.NormalBlending});
    const sp = new THREE.Sprite(mat);
    const sc = rand(.5,1)* (opt.size||1.6);
    sp.scale.set(sc,sc,1);
    const spr = opt.spread??.8;
    sp.position.set(x+rand(-spr,spr), y+rand(0,spr*.7), z+rand(-spr,spr));
    scene.add(sp);
    smokes.push({sp, mat, rise:(opt.rise??1.1)*rand(.6,1.3), grow:(opt.grow??.8)*rand(.7,1.3),
      op:opt.opacity??.55, born:now(), life:(opt.life||2.2)*rand(.8,1.2),
      vx:rand(-.3,.3)+(opt.vx||0), vz:rand(-.3,.3)+(opt.vz||0)});
    mat.opacity = opt.opacity??.55;
  }
}
function smokeTick(dt){
  const t = now();
  for (let i=smokes.length-1;i>=0;i--){
    const s = smokes[i];
    const k = (t-s.born)/s.life;
    if (k>=1){ scene.remove(s.sp); smokes.splice(i,1); continue; }
    s.sp.position.y += s.rise*dt;
    s.sp.position.x += s.vx*dt; s.sp.position.z += s.vz*dt;
    s.sp.scale.x += s.grow*dt; s.sp.scale.y += s.grow*dt;
    s.mat.opacity = s.op*(1-k);
  }
}
function sparkBurst(p, color, n=8, spd=3){
  for(let i=0;i<n;i++){
    if (smokes.length>=MAX_SMOKE){ const old=smokes.shift(); scene.remove(old.sp); }
    const mat = new THREE.SpriteMaterial({map:TEX.spark, transparent:true, depthWrite:false,
      color, blending:THREE.AdditiveBlending});
    const sp = new THREE.Sprite(mat);
    const sc = rand(.1,.28);
    sp.scale.set(sc,sc,1); sp.position.copy(p);
    scene.add(sp);
    smokes.push({sp, mat, rise:rand(-1,2.4), grow:-sc*2.2, op:1, born:now(), life:rand(.18,.42),
      vx:rand(-spd,spd), vz:rand(-spd,spd)});
    mat.opacity = 1;
  }
}

/* ---------- 元素投射物：射出元素本身（火球/種子/水彈/飛刃/岩石） ---------- */
const bolts = [];
const MAX_BOLTS = 60;
const BOLT_SPEED = { metal:200, wood:140, water:150, fire:115, earth:135, ice:160, thunder:230, wind:180, dark:150, light:330 };
function spawnBolt(from, to, el){
  if (bolts.length >= MAX_BOLTS){ const old = bolts.shift(); scene.remove(old.group); }
  const group = new THREE.Group();
  let spinObj = null;
  const spin = new THREE.Vector3();
  const addGlow = (color, s)=>{
    const g = new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.spark, color,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
    g.scale.set(s, s, 1); group.add(g);
  };
  if (el==='metal'){         // 飛刃：旋轉的金屬刀刃
    const m = new THREE.Mesh(new THREE.BoxGeometry(.028,.11,.38),
      new THREE.MeshStandardMaterial({color:0xdfe4ea, emissive:0xe8c84a, emissiveIntensity:.55, metalness:.85, roughness:.2}));
    group.add(m); spinObj = m; spin.set(0,0,30);
    addGlow(0xffe9a0, .26);
  } else if (el==='wood'){   // 種子：褐殼綠芒、翻滾飛行
    const m = new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),
      new THREE.MeshStandardMaterial({color:0x7a5530, emissive:0x2f9e57, emissiveIntensity:.4, roughness:.7}));
    m.scale.set(1,.72,1.55);
    group.add(m); spinObj = m; spin.set(10,0,14);
    addGlow(0x7dfa9e, .24);
  } else if (el==='water'){  // 水彈：拉長的水滴
    const m = new THREE.Mesh(new THREE.SphereGeometry(.095,10,8),
      new THREE.MeshStandardMaterial({color:0xa8dcff, emissive:0x38bdf8, emissiveIntensity:.7,
        transparent:true, opacity:.85, roughness:.1}));
    m.scale.set(1,1,2.2);
    group.add(m); spinObj = m; spin.set(0,0,7);
    addGlow(0x9fe4ff, .3);
  } else if (el==='fire'){   // 火球：焰核＋拖尾焰
    const mk = s=>{ const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:TEX.flame,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
      sp.scale.set(s,s,1); return sp; };
    const head = mk(.55), tail = mk(.38), tail2 = mk(.26);
    tail.position.z = -.28; tail2.position.z = -.5;
    group.add(head, tail, tail2);
    group.userData.flames = [head, tail, tail2];
  } else if (el==='ice'){    // 冰晶錐：半透明冰稜自旋
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(.12),
      new THREE.MeshStandardMaterial({color:0xdff4ff, emissive:0x9fd8f0, emissiveIntensity:.55,
        transparent:true, opacity:.88, roughness:.1, metalness:.1}));
    m.scale.set(.7,.7,1.7);
    group.add(m); spinObj = m; spin.set(0,0,12);
    addGlow(0xbfeaff, .28);
  } else if (el==='thunder'){ // 電光彈：紫電核心高速竄行
    const m = new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),
      new THREE.MeshStandardMaterial({color:0xf2e8ff, emissive:0xc084fc, emissiveIntensity:1.4}));
    group.add(m);
    addGlow(0xd8b4ff, .4);
    addGlow(0xffffff, .16);
  } else if (el==='wind'){   // 風刃：高速自旋的氣旋環
    const m = new THREE.Mesh(new THREE.TorusGeometry(.11,.022,6,14),
      new THREE.MeshStandardMaterial({color:0xeafff6, emissive:0x7ce8c4, emissiveIntensity:.9,
        transparent:true, opacity:.75, roughness:.2}));
    group.add(m); spinObj = m; spin.set(0,0,34);
    addGlow(0xbdf5e0, .26);
  } else if (el==='dark'){   // 暗蝕彈：吞光黑核裹紫焰
    const core = new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),
      new THREE.MeshBasicMaterial({color:0x0b0614}));
    group.add(core); spinObj = core; spin.set(6,9,6);
    addGlow(0x8b5cf6, .42);
    addGlow(0x2a1650, .6);
  } else if (el==='light'){  // 聖光矢：近光速的白金射線
    const m = new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),
      new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xfff3b8, emissiveIntensity:1.8}));
    m.scale.set(1,1,4.2);
    group.add(m);
    addGlow(0xfff8d8, .45);
    addGlow(0xffffff, .2);
  } else {                    // 岩彈：翻滾的碎岩
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(.115),
      new THREE.MeshStandardMaterial({map:TEX.rock, roughness:.95}));
    group.add(m); spinObj = m; spin.set(15,11,9);
  }
  group.position.copy(from);
  group.lookAt(to);
  scene.add(group);
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  bolts.push({group, dir, el, speed:BOLT_SPEED[el]||150, left:dist, trailT:0, spinObj, spin});
}
function boltTrail(b){
  const p = b.group.position;
  if (smokes.length >= MAX_SMOKE) return;
  if (b.el==='fire'){
    spawnSmoke(p.x, p.y, p.z, {flame:true, n:1, size:.42, rise:.4, life:.26, grow:-.7, opacity:.95, spread:.04});
    if (Math.random()<.3) spawnSmoke(p.x, p.y, p.z, {n:1, size:.3, color:0x4a4d52, rise:.6, life:.8, grow:.6, opacity:.4, spread:.05});
  } else if (b.el==='water'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.3, color:0x9adcff, add:true, rise:-.2, life:.3, grow:.3, opacity:.4, spread:.03});
  } else if (b.el==='metal'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.16, color:0xffe9a0, add:true, rise:0, life:.16, grow:-.4, opacity:.85, spread:.02});
  } else if (b.el==='ice'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.26, color:0xe0f4ff, rise:-.15, life:.35, grow:.35, opacity:.5, spread:.04});
  } else if (b.el==='thunder'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.18, color:0xd8b4ff, add:true, rise:0, life:.14, grow:-.5, opacity:.95, spread:.05});
    if (Math.random()<.12){  // 竄電小弧
      const o = p.clone().add(new THREE.Vector3(rand(-.4,.4), rand(-.4,.4), rand(-.4,.4)));
      arcLine(p.clone(), o, .2, 0xd8b4ff);
    }
  } else if (b.el==='wood'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.2, color:0x7dfa9e, add:true, rise:.15, life:.28, grow:-.3, opacity:.6, spread:.05});
  } else if (b.el==='wind'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.28, color:0xd8fff0, rise:0, life:.3, grow:.5, opacity:.35, spread:.06});
  } else if (b.el==='dark'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.3, color:0x150a26, rise:.1, life:.5, grow:.6, opacity:.75, spread:.05});
    if (Math.random()<.25) spawnSmoke(p.x, p.y, p.z, {n:1, size:.14, color:0x8b5cf6, add:true, rise:0, life:.2, grow:-.3, opacity:.8, spread:.04});
  } else if (b.el==='light'){
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.22, color:0xfff8d8, add:true, rise:0, life:.13, grow:-.6, opacity:.95, spread:.02});
  } else {
    spawnSmoke(p.x, p.y, p.z, {n:1, size:.24, color:0xb59a6a, rise:.1, life:.4, grow:.5, opacity:.35, spread:.04});
  }
}
function boltsTick(dt){
  const t = now();
  for (let i=bolts.length-1;i>=0;i--){
    const b = bolts[i];
    const step = Math.min(b.speed*dt, b.left);
    b.group.position.addScaledVector(b.dir, step);
    b.left -= step;
    if (b.spinObj){
      b.spinObj.rotation.x += b.spin.x*dt;
      b.spinObj.rotation.y += b.spin.y*dt;
      b.spinObj.rotation.z += b.spin.z*dt;
    }
    const fl = b.group.userData.flames;
    if (fl){ // 火球焰片閃動
      fl[0].scale.setScalar(.5 + Math.sin(t*30+i)*.09);
      fl[1].scale.setScalar(.36 + Math.cos(t*26+i)*.07);
    }
    b.trailT -= dt;
    if (b.trailT <= 0){ b.trailT = 0.016; boltTrail(b); }
    if (b.left <= 0.01){ scene.remove(b.group); bolts.splice(i,1); }
  }
}

/* ---------- 彈孔 / 焦痕貼花 ---------- */
const decals = [];
function addDecal(p, n, size, life=25, color=0x151412, opacity=.8){
  const m = new THREE.Mesh(new THREE.CircleGeometry(size, 12),
    new THREE.MeshBasicMaterial({map:TEX.scorch, transparent:true, opacity, depthWrite:false, color, polygonOffset:true, polygonOffsetFactor:-2}));
  m.position.copy(p).addScaledVector(n, 0.015);
  m.lookAt(p.clone().add(n));
  scene.add(m);
  decals.push({m, die:now()+life, mat:m.material, op:opacity});
  if (decals.length > 50){ const o = decals.shift(); scene.remove(o.m); }
}
function decalsTick(){
  const t = now();
  for (let i=decals.length-1;i>=0;i--){
    const d = decals[i];
    const left = d.die - t;
    if (left <= 0){ scene.remove(d.m); decals.splice(i,1); }
    else if (left < 2) d.mat.opacity = d.op * left/2;
  }
}

/* ---------- 動態特效（大招 / 波動 / 藤蔓 / 岩刺） ---------- */
const specials = [];
function addSpecial(life, update, cleanup){
  specials.push({born:now(), life, update, cleanup});
}
function specialsTick(dt){
  const t = now();
  for (let i=specials.length-1;i>=0;i--){
    const s = specials[i];
    const k = (t-s.born)/s.life;
    if (k>=1){ if(s.cleanup) s.cleanup(); specials.splice(i,1); continue; }
    s.update(dt, k);
  }
}
function spikeBurst(x, z, color, count, rMin, rMax, hMax){ // 地面竄出尖刺（藤蔓/岩刺）
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color, roughness:.8});
  for (let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2, r = rand(rMin, rMax);
    const h = rand(hMax*.5, hMax);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(.18,.45), h, 6), mat);
    cone.position.set(x+Math.cos(a)*r, 0, z+Math.sin(a)*r);
    cone.rotation.z = rand(-.25,.25); cone.rotation.x = rand(-.25,.25);
    cone.userData.h = h;
    cone.scale.y = 0.01; cone.castShadow = true;
    group.add(cone);
  }
  scene.add(group);
  addSpecial(2.4, (dt,k)=>{
    const g = k<.2 ? k/.2 : (k>.75 ? 1-(k-.75)/.25 : 1);
    for (const c of group.children){ c.scale.y = Math.max(0.01, g); c.position.y = c.userData.h*g/2; }
  }, ()=> scene.remove(group));
}
function waveRing(x, z, color, maxR, life=1.6, h=5){ // 環形水牆/衝擊波
  const geo = new THREE.CylinderGeometry(1, 1, h, 40, 1, true);
  const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:.5,
    side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, h/2, z);
  scene.add(m);
  addSpecial(life, (dt,k)=>{
    const r = 1 + maxR*k;
    m.scale.set(r, 1, r);
    mat.opacity = .5*(1-k);
  }, ()=> scene.remove(m));
}
function bladeOrbit(idx, dur=6){ // 金大招：環體飛劍（純視覺，傷害由主機 tick）
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xfff3c4, emissive:0xe8c84a, emissiveIntensity:.7, metalness:.3, roughness:.3});
  const blades = [];
  for (let i=0;i<10;i++){
    const b = new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.14), mat);
    blades.push(b); group.add(b);
  }
  const L = new THREE.PointLight(0xe8c84a, 18, 10, 1.8); group.add(L);
  scene.add(group);
  addSpecial(dur, (dt,k)=>{
    const s = slots[idx]; if(!s) return;
    const p = idx===myIdx ? me.pos : s.pos;
    group.position.set(p.x, p.y+1.2, p.z);
    const t = now()*3.4;
    blades.forEach((b,i)=>{
      const a = t + i/10*Math.PI*2;
      const r = 1.6 + Math.sin(t*.7+i)*0.4;
      b.position.set(Math.cos(a)*r, Math.sin(t*1.3+i*2)*.5, Math.sin(a)*r);
      b.rotation.set(a, a*1.3, a*.7);
    });
  }, ()=> scene.remove(group));
}

function windVortexFX(x, z){ // 風大招：旋捲上升的龍捲氣旋
  const group = new THREE.Group();
  const streaks = [];
  const mat = new THREE.MeshBasicMaterial({color:0xd8fff0, transparent:true, opacity:.55,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  for (let i=0;i<16;i++){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rand(1.2,2.4), rand(.12,.3)), mat);
    m.userData = {a:Math.random()*Math.PI*2, r:rand(1,5), h:rand(.3,7), w:rand(2.5,4.5)};
    group.add(m); streaks.push(m);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  addSpecial(3.2, (dt,k)=>{
    const fade = k>.75 ? 1-(k-.75)/.25 : 1;
    mat.opacity = .55*fade;
    for (const m of streaks){
      const u = m.userData;
      u.a += u.w*dt; u.h += 2.2*dt; if (u.h > 9) u.h -= 9;
      const r = u.r * (0.35 + u.h/9);
      m.position.set(Math.cos(u.a)*r, u.h, Math.sin(u.a)*r);
      m.rotation.y = -u.a;
    }
    if (Math.random()<.5) spawnSmoke(x+rand(-2,2), rand(0,1), z+rand(-2,2),
      {n:1, size:1, color:0xe4fff5, rise:3, life:.8, grow:.9, opacity:.35, spread:.3});
  }, ()=> scene.remove(group));
  sfx('steam', 1);
}
function darkNovaFX(x, z){ // 暗大招：吞噬光明的黑暗新星
  const mat = new THREE.MeshBasicMaterial({color:0x07030e, transparent:true, opacity:.75, depthWrite:false});
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
  dome.position.set(x, .5, z);
  scene.add(dome);
  addSpecial(1.6, (dt,k)=>{
    const r = 1 + 26*k;
    dome.scale.setScalar(r);
    mat.opacity = .75*(1-k);
    if (Math.random()<.5){
      const a = Math.random()*Math.PI*2, rr = r*.9;
      const p1 = new THREE.Vector3(x+Math.cos(a)*rr, rand(.2,2.5), z+Math.sin(a)*rr);
      arcLine(p1, p1.clone().add(new THREE.Vector3(rand(-1.5,1.5), rand(-.5,1.5), rand(-1.5,1.5))), .5, 0x8b5cf6);
    }
  }, ()=> scene.remove(dome));
  shakeCam(.35); sfx('boom', .7);
}
function lightPillarFX(x, z, scale=1){ // 光柱天降
  const mat = new THREE.MeshBasicMaterial({color:0xfff6cf, transparent:true, opacity:.8,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.1*scale, 1.5*scale, 30, 20, 1, true), mat);
  pil.position.set(x, 15, z);
  scene.add(pil);
  const L = new THREE.PointLight(0xffe9a0, 40*scale, 18*scale, 1.6);
  L.position.set(x, 2, z); scene.add(L);
  addSpecial(1.2, (dt,k)=>{
    mat.opacity = .8*(1-k);
    pil.scale.x = pil.scale.z = 1+k*.6;
    L.intensity = 40*scale*(1-k);
  }, ()=>{ scene.remove(pil); scene.remove(L); });
}

/* ---------- 爆炸 / 蒸汽 ---------- */
function explosionFX(x, y, z, scale=1){
  addDecal(new THREE.Vector3(x, .02, z), new THREE.Vector3(0,1,0), 1.7*scale, 18, 0x0d0c0a, .85); // 地面燒痕
  waveRing(x, z, 0xffc890, 9*scale, .5, 1.2);                                                     // 衝擊波
  sparkBurst(new THREE.Vector3(x,y+.4,z), 0xffd080, 14, 6*scale);
  spawnSmoke(x, y+.3, z, {flame:true, n:8, size:2.4*scale, rise:2, life:.5, grow:2.5, opacity:.95, spread:.7*scale});
  spawnSmoke(x, y+.8, z, {n:10, size:2.6*scale, color:0x555a5e, rise:2.2, life:2.6, grow:1.6, opacity:.6, spread:1.1*scale});
  spawnDebris(x, y+.5, z, 0x4a4a44, Math.round(8*scale), {spd:8*scale});
  const L = new THREE.PointLight(0xffa040, 60*scale, 20*scale, 1.6);
  L.position.set(x, y+1, z); scene.add(L);
  addSpecial(.4, (dt,k)=>{ L.intensity = 60*scale*(1-k); }, ()=> scene.remove(L));
  const d = camera ? camera.position.distanceTo(new THREE.Vector3(x,y,z)) : 99;
  sfx('boom', clamp(1.2 - d/50, .1, 1));
  shakeCam(clamp(.6 - d/40, 0, .6));
}
function arcLine(a, b, jag=0.5, color=0xd8b4ff){
  // 鋸齒閃電弧線
  const pts = [a.clone()];
  const segs = 7;
  for (let i=1;i<segs;i++){
    const p = a.clone().lerp(b, i/segs);
    p.x += rand(-jag,jag); p.y += rand(-jag,jag); p.z += rand(-jag,jag);
    pts.push(p);
  }
  pts.push(b.clone());
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color, transparent:true, opacity:.95, blending:THREE.AdditiveBlending}));
  scene.add(line);
  fxList.push({obj:line, die:now()+0.14, mat:line.material});
}
function lightningFX(x, z){
  // 天雷落地：主幹+白芯+落點爆閃
  const top = new THREE.Vector3(x+rand(-3,3), 28, z+rand(-3,3));
  const hit = new THREE.Vector3(x, 0, z);
  arcLine(top, hit, 1.3, 0xc084fc);
  arcLine(top, hit, 0.5, 0xffffff);
  sparkBurst(new THREE.Vector3(x,.6,z), 0xd8b4ff, 14, 6);
  spawnSmoke(x, .5, z, {add:true, n:4, size:1.6, color:0xc9a8ff, rise:1.6, life:.4, grow:1.5, opacity:.7, spread:.4});
  const L = new THREE.PointLight(0xc084fc, 50, 16, 1.6);
  L.position.set(x, 2, z); scene.add(L);
  addSpecial(.25, (dt,k)=>{ L.intensity = 50*(1-k)*(Math.random()<.5?1:.4); }, ()=> scene.remove(L));
  const d = camera ? camera.position.distanceTo(hit) : 99;
  sfx('zap', clamp(1.1-d/50, .1, 1));
  shakeCam(clamp(.35-d/60, 0, .35));
}
function iceShatterFX(x, y, z){
  sparkBurst(new THREE.Vector3(x,y,z), 0xdff4ff, 16, 5);
  spawnDebris(x, y, z, 0xbfeaff, 6, {min:.04, max:.1, spd:5, bounce:.2});
  spawnSmoke(x, y, z, {n:4, size:1, color:0xe8f6ff, rise:.6, life:1, grow:.8, opacity:.55, spread:.4});
  sfx('hit', .8);
}
function steamFX(x, z){
  spawnSmoke(x, .5, z, {n:16, size:2.8, color:0xe8eef2, rise:1.8, life:3.6, grow:1.4, opacity:.7, spread:1.4});
  sfx('steam', .8);
}

/* ---------- 元素區域（火場/寒霜/泥沼）：主機裁決，全端渲染 ---------- */
const hzones = new Map();       // 主機邏輯 id -> {kind,x,z,r,until,src}
const zoneVis = new Map();      // 各端視覺 id -> {group, kind, until, flames}
const smokeBlockers = [];       // 主機：蒸汽遮蔽 AI 視線 {mesh, until}
let zoneSeq = 0;
function hostAddZone(kind, x, z, r, dur, src){
  // 五行反應
  if (kind==='fire'){
    for (const [id,zn] of hzones){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 >= (zn.r+r)**2) continue;
      if (zn.kind==='frost' || zn.kind==='ice'){ hostSteam((x+zn.x)/2, (z+zn.z)/2); return; }  // 水/冰滅火成蒸汽
      if (zn.kind==='bramble'){ hostEndZone(id); r += 1.1; dur += 1.5; }    // 木生火：荊棘引燃火勢更旺
    }
  }
  if (kind==='ice'){
    for (const [id,zn] of hzones) if (zn.kind==='fire'){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 < (zn.r+r)**2){ hostEndZone(id); hostSteam(zn.x, zn.z); }      // 冰封撲滅火場
    }
  }
  if (kind==='bramble'){
    for (const [id,zn] of hzones) if (zn.kind==='fire'){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 < (zn.r+r)**2){ hostAddZoneRaw('fire', x, z, r, 4, src); return; } // 荊棘落入火場直接燒起來
    }
  }
  if (kind==='frost'){
    for (const [id,zn] of hzones) if (zn.kind==='fire'){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 < (zn.r+r)**2){ hostEndZone(id); hostSteam(zn.x, zn.z); }     // 寒潮撲滅火場
    }
    for (const [wid,w] of wallsLive){                                       // 水+土 → 泥沼
      const c = w.colliders[0]; if(!c) continue;
      const wx=(c.x0+c.x1)/2, wz=(c.z0+c.z1)/2;
      if ((wx-x)**2+(wz-z)**2 < (r+2)**2) hostAddZoneRaw('mud', wx, wz, 3.2, 9, src);
    }
  }
  if (kind==='gale'){
    for (const [id,zn] of [...hzones]){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 >= (zn.r+r)**2) continue;
      if (zn.kind==='fire'){ hostAddZoneRaw('fire', x, z, r, 4, src); return; }        // 風助火勢：火場向亂流處蔓延
      if (zn.kind==='gloom'){ hostEndZone(id); }                                       // 罡風吹散暗幕
      if (zn.kind==='frost' || zn.kind==='ice'){ hostAddZoneRaw('frost', x, z, r+1.5, dur+1.5, src); return; } // 風雪成暴
    }
  }
  if (kind==='gloom'){
    for (const [id,zn] of [...hzones]) if (zn.kind==='sanct'){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 < (zn.r+r)**2){ hostEndZone(id); return; }        // 光暗相剋：互相湮滅
    }
  }
  if (kind==='sanct'){
    for (const [id,zn] of [...hzones]) if (zn.kind==='gloom'){
      const d2 = (zn.x-x)**2 + (zn.z-z)**2;
      if (d2 < (zn.r+r)**2){ hostEndZone(id); return; }        // 光暗相剋：互相湮滅
    }
  }
  hostAddZoneRaw(kind, x, z, r, dur, src);
}
function hostAddZoneRaw(kind, x, z, r, dur, src){
  if (hzones.size >= 36) hostEndZone(hzones.keys().next().value);  // 區域總量上限
  const id = ++zoneSeq;
  hzones.set(id, {kind, x, z, r, until:now()+dur, src});
  if (kind==='gloom'){   // 暗幕遮蔽 AI 視線（同蒸汽）
    const blocker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,1.6), 8, 6));
    blocker.position.set(x, 1.4, z); blocker.visible = false;
    scene.add(blocker);
    smokeBlockers.push({mesh:blocker, until:now()+dur});
  }
  const ev = {t:'ev', k:'zone', id, kind, x:+x.toFixed(1), z:+z.toFixed(1), r, dur};
  bcast(ev); onGameEvent(ev);
}
function hostEndZone(id){
  if (!hzones.delete(id)) return;
  const ev = {t:'ev', k:'zoneend', id};
  bcast(ev); onGameEvent(ev);
}
function hostSteam(x, z){
  const ev = {t:'ev', k:'steam', x:+x.toFixed(1), z:+z.toFixed(1)};
  bcast(ev); onGameEvent(ev);
  const blocker = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6));
  blocker.position.set(x, 1.5, z); blocker.visible = false;
  scene.add(blocker);
  smokeBlockers.push({mesh:blocker, until:now()+6});
}
function spawnZoneVis(id, kind, x, z, r, dur){
  if (zoneVis.has(id)) return;
  const group = new THREE.Group();
  const flames = [];
  if (kind==='fire'){
    for (let i=0;i<Math.max(3, Math.round(r*2));i++){
      const mat = new THREE.SpriteMaterial({map:TEX.flame, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending});
      const sp = new THREE.Sprite(mat);
      sp.position.set(x+rand(-r*.7,r*.7), .6, z+rand(-r*.7,r*.7));
      sp.scale.set(1.2,1.5,1);
      group.add(sp); flames.push(sp);
    }
    const L = new THREE.PointLight(0xff7830, 14, r*5, 1.8);
    L.position.set(x, 1.2, z); group.add(L);
  } else if (kind==='frost'){
    const ring = new THREE.Mesh(new THREE.RingGeometry(r*.85, r, 40),
      new THREE.MeshBasicMaterial({color:0x7dd8ff, transparent:true, opacity:.5, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(x, .06, z);
    group.add(ring);
    const ice = new THREE.MeshStandardMaterial({color:0xbfe8ff, emissive:0x38bdf8, emissiveIntensity:.35, roughness:.2});
    for (let i=0;i<7;i++){
      const a = Math.random()*Math.PI*2, rr = rand(r*.2, r*.9);
      const c = new THREE.Mesh(new THREE.ConeGeometry(rand(.12,.3), rand(.5,1.2), 5), ice);
      c.position.set(x+Math.cos(a)*rr, .3, z+Math.sin(a)*rr);
      c.rotation.set(rand(-.4,.4), 0, rand(-.4,.4));
      group.add(c);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 36),
      new THREE.MeshBasicMaterial({color:0x9fd8f0, transparent:true, opacity:.16, depthWrite:false}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .04, z);
    group.add(disc);
  } else if (kind==='mud'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshStandardMaterial({color:0x4a3a24, roughness:1, transparent:true, opacity:.9}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .05, z);
    group.add(disc);
  } else if (kind==='bramble'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshStandardMaterial({color:0x1e3d26, roughness:1, transparent:true, opacity:.85}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .05, z);
    group.add(disc);
    const vm = new THREE.MeshStandardMaterial({color:0x2f9e57, roughness:.8});
    for (let i=0;i<8;i++){
      const a = Math.random()*Math.PI*2, rr = rand(r*.15, r*.85);
      const c = new THREE.Mesh(new THREE.ConeGeometry(rand(.08,.18), rand(.5,1.1), 5), vm);
      c.position.set(x+Math.cos(a)*rr, .3, z+Math.sin(a)*rr);
      c.rotation.set(rand(-.5,.5), 0, rand(-.5,.5));
      c.castShadow = true;
      group.add(c);
    }
  } else if (kind==='ice'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshStandardMaterial({color:0xcfeaf8, roughness:.15, metalness:.1, transparent:true, opacity:.75}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .05, z);
    group.add(disc);
    const im = new THREE.MeshStandardMaterial({color:0xe4f6ff, emissive:0x9fd8f0, emissiveIntensity:.4,
      transparent:true, opacity:.85, roughness:.1});
    for (let i=0;i<9;i++){
      const a = Math.random()*Math.PI*2, rr = rand(r*.15, r*.85);
      const c = new THREE.Mesh(new THREE.ConeGeometry(rand(.1,.24), rand(.5,1.3), 5), im);
      c.position.set(x+Math.cos(a)*rr, .3, z+Math.sin(a)*rr);
      c.rotation.set(rand(-.4,.4), 0, rand(-.4,.4));
      c.castShadow = true;
      group.add(c);
    }
  } else if (kind==='shock'){
    const ring = new THREE.Mesh(new THREE.RingGeometry(r*.8, r, 32),
      new THREE.MeshBasicMaterial({color:0xc084fc, transparent:true, opacity:.55, side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(x, .06, z);
    group.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({color:0x8a5fd0, transparent:true, opacity:.18, depthWrite:false}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .04, z);
    group.add(disc);
  } else if (kind==='gale'){
    const ring = new THREE.Mesh(new THREE.RingGeometry(r*.75, r, 36),
      new THREE.MeshBasicMaterial({color:0x9ff5dc, transparent:true, opacity:.4, side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(x, .07, z);
    group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(r*.35, r*.5, 30),
      new THREE.MeshBasicMaterial({color:0xd8fff0, transparent:true, opacity:.3, side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    ring2.rotation.x = -Math.PI/2; ring2.position.set(x, .5, z);
    group.add(ring2);
    group.userData.spinRings = [ring, ring2];
  } else if (kind==='gloom'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({color:0x0b0614, transparent:true, opacity:.88, depthWrite:false}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .05, z);
    group.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r*.85, r, 32),
      new THREE.MeshBasicMaterial({color:0x8b5cf6, transparent:true, opacity:.45, side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(x, .08, z);
    group.add(ring);
  } else if (kind==='sanct'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 30),
      new THREE.MeshBasicMaterial({color:0xfff3b8, transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .05, z);
    group.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r*.88, r, 36),
      new THREE.MeshBasicMaterial({color:0xffe98a, transparent:true, opacity:.6, side:THREE.DoubleSide,
        blending:THREE.AdditiveBlending, depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.set(x, .08, z);
    group.add(ring);
    const L = new THREE.PointLight(0xffe9a0, 10, r*4, 1.8);
    L.position.set(x, 1.5, z); group.add(L);
  } else if (kind==='shrapnel'){
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({color:0x8a7a3a, transparent:true, opacity:.25, depthWrite:false}));
    disc.rotation.x = -Math.PI/2; disc.position.set(x, .04, z);
    group.add(disc);
    const sm = new THREE.MeshStandardMaterial({color:0xfff3c4, emissive:0xe8c84a, emissiveIntensity:.6, metalness:.4, roughness:.3});
    for (let i=0;i<7;i++){
      const a = Math.random()*Math.PI*2, rr = rand(r*.1, r*.85);
      const c = new THREE.Mesh(new THREE.ConeGeometry(rand(.05,.1), rand(.4,.8), 4), sm);
      c.position.set(x+Math.cos(a)*rr, .25, z+Math.sin(a)*rr);
      c.rotation.set(rand(-.7,.7), rand(0,3), rand(-.7,.7));
      group.add(c);
    }
  }
  scene.add(group);
  zoneVis.set(id, {group, kind, until:now()+dur, flames, x, z, r});
}
function zoneVisTick(){
  const t = now();
  for (const [id,v] of zoneVis){
    if (t > v.until+.5){ scene.remove(v.group); zoneVis.delete(id); continue; }
    if (v.kind==='fire'){
      for (const sp of v.flames){
        sp.scale.y = 1.3 + Math.sin(t*13 + sp.position.x*7)*.45;
        sp.scale.x = 1.1 + Math.cos(t*11 + sp.position.z*5)*.3;
      }
      if (Math.random()<.15) spawnSmoke(v.x+rand(-v.r*.5,v.r*.5), 1.1, v.z+rand(-v.r*.5,v.r*.5),
        {n:1, size:1.1, color:0x494c50, rise:1.4, life:1.8, grow:.9, opacity:.4});
      if (Math.random()<.25) spawnSmoke(v.x+rand(-v.r*.6,v.r*.6), .4, v.z+rand(-v.r*.6,v.r*.6),   // 火星飄升
        {n:1, size:.12, color:0xffb060, add:true, rise:2.2, life:.9, grow:-.08, opacity:.95, spread:.05});
    }
    if (v.kind==='shrapnel' && Math.random()<.08)
      sparkBurst(new THREE.Vector3(v.x+rand(-v.r,v.r), .3, v.z+rand(-v.r,v.r)), 0xffe9a0, 2, 1.5);
    if (v.kind==='shock' && Math.random()<.12){
      const a = new THREE.Vector3(v.x+rand(-v.r,v.r), .1, v.z+rand(-v.r,v.r));
      arcLine(a, a.clone().add(new THREE.Vector3(rand(-1,1), rand(.4,1.4), rand(-1,1))), .3, 0xd8b4ff);
    }
    if (v.kind==='bramble' && Math.random()<.04)
      sparkBurst(new THREE.Vector3(v.x+rand(-v.r,v.r), .5, v.z+rand(-v.r,v.r)), 0x7dfa9e, 2, 1);
    if (v.kind==='gale'){
      const sr = v.group.userData.spinRings;
      if (sr){ sr[0].rotation.z += .12; sr[1].rotation.z -= .2; }
      if (Math.random()<.3){   // 環繞氣旋的風縷
        const a = t*4 + rand(0,6.3);
        spawnSmoke(v.x+Math.cos(a)*v.r*.7, rand(.2,1.2), v.z+Math.sin(a)*v.r*.7,
          {n:1, size:.5, color:0xe0fff4, rise:1.6, life:.6, grow:.6, opacity:.35, spread:.06});
      }
    }
    if (v.kind==='gloom' && Math.random()<.25)   // 黑霧升騰
      spawnSmoke(v.x+rand(-v.r*.6,v.r*.6), .3, v.z+rand(-v.r*.6,v.r*.6),
        {n:1, size:1, color:0x120823, rise:.8, life:1.6, grow:.8, opacity:.75, spread:.2});
    if (v.kind==='sanct' && Math.random()<.2)    // 金色光塵飄升
      spawnSmoke(v.x+rand(-v.r*.7,v.r*.7), .2, v.z+rand(-v.r*.7,v.r*.7),
        {n:1, size:.14, color:0xffe9a0, add:true, rise:1.6, life:1.1, grow:-.05, opacity:.95, spread:.05});
  }
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
  const col = team==='red'?0xff5a4e:0x4ea1ff;
  sparkBurst(new THREE.Vector3(p.x, p.y+1.1, p.z), col, 12, 4);
  spawnDebris(p.x, p.y+1, p.z, col, 5, {spd:5, min:.05, max:.12});          // 裝備碎片
  spawnDebris(p.x, p.y+1.2, p.z, 0xd7a684, 3, {spd:4, min:.04, max:.09});   // 物理飛散
  spawnSmoke(p.x, p.y+.8, p.z, {n:5, size:1.2, color:0x777a80, rise:1, life:1.6, grow:.9, opacity:.5, spread:.5});
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
    if (o.fx.stealth>0) continue;   // 暗影遁形：AI 找不到匿蹤者
    const d = o.pos.distanceTo(s.pos);
    if (d<td){ td=d; target=o; }
  }
  let seeTarget = false;
  if (fx.blind>0 && s.fx.gat<=0) target = null;   // 蝕明：AI 暫時失明
  if (target && td < 55){
    tmpV.set(s.pos.x, s.pos.y+1.55, s.pos.z);
    tmpV2.set(target.pos.x, target.pos.y+1.3, target.pos.z).sub(tmpV);
    const dist = tmpV2.length();
    raycaster.set(tmpV, tmpV2.normalize());
    raycaster.far = dist;
    const blockers = [...worldMeshes];
    for (const w of wallsLive.values()) blockers.push(...w.meshes);
    for (const sb of smokeBlockers) blockers.push(sb.mesh);   // 蒸汽/煙霧擋 AI 視線
    seeTarget = raycaster.intersectObjects(blockers, false).length === 0;
    if (s.fx.gat > 0) seeTarget = true;   // 殲滅砲：貫穿掩體無視遮蔽
  }

  let speed = 4.0 * (fx.slow>0?0.6:1) * (fx.haste>0?1.4:1);
  const mv = new THREE.Vector3();
  if (seeTarget){
    // 反應延遲：剛看到目標需 0.45~0.95 秒才開始射擊
    if (!b.hadLOS){ b.hadLOS = true; b.aimDelay = rand(.45,.95); }
    b.aimDelay -= dt;
    // 對準
    const want = Math.atan2(-(target.pos.x-s.pos.x), -(target.pos.z-s.pos.z));
    let dy = want - s.ry;
    while (dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2;
    s.ry += clamp(dy, -2.6*dt, 2.6*dt);
    s.rx = clamp(Math.atan2((target.pos.y+1.25)-(s.pos.y+1.55), td), -.5,.5);
    // 橫移 + 距離控制
    b.strafe += dt;
    const g = GUNS[s.gun];
    const ideal = g.pellets>1 ? 9 : g.zoom ? 30 : 16;
    const fwd = new THREE.Vector3(-Math.sin(s.ry),0,-Math.cos(s.ry));
    const rgt = new THREE.Vector3(-fwd.z,0,fwd.x);
    mv.addScaledVector(fwd, clamp((td-ideal)*0.25, -1, 1));
    mv.addScaledVector(rgt, Math.sin(b.strafe*1.7));
    // 開槍
    b.fireCd -= dt;
    if (b.reload > 0){ b.reload -= dt; if(b.reload<=0) b.ammo = g.mag; }
    else if (Math.abs(dy) < 0.15 && b.fireCd<=0 && b.aimDelay<=0){
      const gat = s.fx.gat > 0;
      b.fireCd = gat ? 0.09 : 60/g.rpm * (g.auto? rand(1.5,2.3) : rand(1.7,2.6));
      if (!gat){ b.ammo--; if (b.ammo<=0) b.reload = g.reload; }
      botShoot(s, target, td, gat ? GUNS[5] : g, gat);
    }
    // 技能
    if (s.skillCd<=0 && Math.random()<dt*0.25){ hostUseSkill(s.idx, {
      dir:[-Math.sin(s.ry),0,-Math.cos(s.ry)], p:[s.pos.x,s.pos.y,s.pos.z]}); s.skillCd = CHARS[s.char].skillCd; }
    if (s.ult>=100 && td<20 && Math.random()<dt*0.5) hostUseUlt(s.idx);
    b.wp = null;
  } else {
    b.hadLOS = false;
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
function botShoot(s, target, dist, g, gat=false){
  // 由 AI 準度決定是否命中
  const o = [s.pos.x, s.pos.y+1.5, s.pos.z];
  const err = 0.5 + dist*0.05;
  const hitP = clamp((gat?0.26:0.36) - dist*0.007 - (target.moving?0.12:0), 0.04, 0.4);
  const aim = new THREE.Vector3(target.pos.x+rand(-err,err), target.pos.y+1.2+rand(-err*0.4,err*0.4), target.pos.z+rand(-err,err));
  const ev = {t:'fire', i:s.idx, o:[+o[0].toFixed(1),+o[1].toFixed(1),+o[2].toFixed(1)],
              e:[+aim.x.toFixed(1),+aim.y.toFixed(1),+aim.z.toFixed(1)]};
  bcast(ev); remoteTracer(ev.o, ev.e, s.idx);
  if (Math.random()<0.10) hostGroundHit(s.idx, aim.x+rand(-2,2), 0.3, aim.z+rand(-2,2)); // AI 也會改造場地
  for (let p=0;p<g.pellets;p++){
    if (Math.random() < hitP){
      const part = Math.random()<0.06 ? 'head':'body';
      hostApplyHit(s.idx, target.idx, part, gat?5:s.gun, dist);
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
    for (const k of ['slow','root','stun','shield','regen','haste','gat','blind','stealth']) if (fx[k]>0) fx[k]-=dt;
    if (fx.frzT>0){ fx.frzT-=dt; if (fx.frzT<=0) fx.frz = 0; }   // 凍層衰減
    if (fx.burn>0){
      fx.burn-=dt;
      if (s.alive){ hostDamage(s, 6*dt, slots[fx.burnSrc], false, '灼燒'); }
    }
    if (fx.regen>0 && s.alive) hostHeal(s, 12*dt);
    if (s.skillCd>0) s.skillCd-=dt;
    addUlt(s, dt*0.8);
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
  // 元素區域：效果與到期
  for (const [id,zn] of hzones){
    if (t > zn.until){ hostEndZone(id); continue; }
    for (const o of slots){
      if (o.ctrl==='empty' || !o.alive) continue;
      const src = slots[zn.src];
      const p = o.idx===myIdx ? me.pos : o.pos;
      if ((p.x-zn.x)**2 + (p.z-zn.z)**2 > zn.r*zn.r) continue;
      if (zn.kind==='sanct'){   // 聖域：治療施放者的隊伍並淨化蝕明
        if (src && o.team===src.team){ hostHeal(o, 10*dt); o.fx.blind = 0; }
        continue;
      }
      if (src && o.team === src.team) continue;   // 其餘區域只影響施放者的敵隊
      if (zn.kind==='fire'){ o.fx.burn = Math.max(o.fx.burn, .8); o.fx.burnSrc = zn.src; }
      else if (zn.kind==='frost'){ o.fx.slow = Math.max(o.fx.slow, .5); }
      else if (zn.kind==='mud'){ o.fx.slow = Math.max(o.fx.slow, .5); }
      else if (zn.kind==='bramble'){ o.fx.slow = Math.max(o.fx.slow, .5); hostDamage(o, 5*dt, slots[zn.src], false, '荊棘'); }
      else if (zn.kind==='shrapnel'){ hostDamage(o, 8*dt, slots[zn.src], false, '碎刃'); }
      else if (zn.kind==='ice'){ o.fx.slow = Math.max(o.fx.slow, .7); hostDamage(o, 3*dt, slots[zn.src], false, '冰封'); }
      else if (zn.kind==='shock'){ hostDamage(o, 10*dt, slots[zn.src], false, '雷場');
        if (Math.random() < dt*0.7) o.fx.stun = Math.max(o.fx.stun, 0.3); }
      else if (zn.kind==='gale'){   // 亂流：把敵人往外推、干擾行動
        o.fx.slow = Math.max(o.fx.slow, .4);
        const dx = p.x-zn.x, dz = p.z-zn.z, dl = Math.hypot(dx,dz)||1;
        if (o.ctrl==='bot'){
          o.pos.x = clamp(o.pos.x + dx/dl*2.4*dt, -57, 57);
          o.pos.z = clamp(o.pos.z + dz/dl*2.4*dt, -57, 57);
        } else if (o.idx===myIdx && !me.dead){
          me.vel.x += dx/dl*9*dt; me.vel.z += dz/dl*9*dt;
        }
      }
      else if (zn.kind==='gloom'){ o.fx.blind = Math.max(o.fx.blind, .5); }
    }
  }
  // 蒸汽視線遮蔽到期
  for (let i=smokeBlockers.length-1;i>=0;i--){
    if (t > smokeBlockers[i].until){ scene.remove(smokeBlockers[i].mesh); smokeBlockers.splice(i,1); }
  }
  // 賽事計時
  matchT -= dt;
  if (matchT <= 0){ hostEndMatch(); }
}
function snapshotTick(){
  const pl = slots.map(s=> s.ctrl==='empty' ? 0 : [
    +s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2),
    +s.ry.toFixed(3), +s.rx.toFixed(3),
    Math.round(s.hp), s.alive?1:0, s.gun, s.moving?1:0,
    (s.fx.burn>0?1:0)|(s.fx.slow>0?2:0)|(s.fx.root>0?4:0)|(s.fx.stun>0?8:0)|(s.fx.shield>0?16:0)|(s.fx.haste>0?32:0)|(s.fx.gat>0?64:0)|(s.fx.blind>0?128:0)|(s.fx.stealth>0?256:0),
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
    s.fx.stun = fb&8?1:0; s.fx.shield = fb&16?1:0; s.fx.haste = fb&32?1:0; s.fx.gat = fb&64?1:0;
    s.fx.blind = fb&128?1:0; s.fx.stealth = fb&256?1:0;
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
  if (IS_TOUCH){ $('touchUI').classList.add('on'); updateTouchGunUI(); }
  else $('pauseHint').classList.remove('hidden');
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
  for (const [w,h,l,t] of [[2,6,12,0],[2,6,12,20],[6,2,0,12],[6,2,20,12]]){
    const s = document.createElement('span');
    s.style.cssText = `width:${w}px;height:${h}px;left:${l}px;top:${t}px`;
    x.appendChild(s);
  }
}
buildXhair();
function updateAmmoUI(){
  if (slots[myIdx] && slots[myIdx].fx.gat > 0){
    $('ammo').innerHTML = '∞';
    $('gunname').textContent = GUNS[5].name+' · '+GUNS[5].en;
    return;
  }
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
  // 暗系蝕明：黑幕吞噬視野
  const dov = $('darkOv');
  if (dov) dov.style.opacity = s.fx.blind>0 ? 1 : 0;
  const cu = $('chipUlt');
  cu.textContent = s.fx.gat>0 ? 'Q · 殲滅砲全開！' : (s.ult>=100 ? 'Q · 大招就緒！' : `Q · 大招 ${Math.floor(s.ult)}%`);
  cu.classList.toggle('charged', s.ult>=100 || s.fx.gat>0);
  const gatOn = s.fx.gat>0;
  if (gatOn !== updateHUD._gat){ updateHUD._gat = gatOn; updateAmmoUI(); }
  // 觸控按鈕冷卻回饋
  if (IS_TOUCH){
    const bs = $('btnSkillT'), bu = $('btnUltT');
    if (bs) bs.style.opacity = cd>0 ? .38 : 1;
    const rdy = s.ult>=100 || gatOn;
    if (bu){ bu.style.opacity = rdy ? 1 : .5;
      bu.style.boxShadow = rdy ? '0 0 16px rgba(232,121,249,.85)' : 'none'; }
  }
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
  if (e.code==='KeyE') doSkill();
  if (e.code==='KeyQ') localUlt();
  if (e.code.startsWith('Digit')){
    const i = +e.code.slice(5)-1;
    if (i < GUN_COUNT && GUNS[i]) switchGun(i);
  }
});
function switchGun(i){
  if (i===me.gun) return;
  me.gun=i; me.ammo=GUNS[i].mag; me.reloading=0; me.zoomed=false;
  rebuildViewmodel(); updateAmmoUI(); updateTouchGunUI();
}
function updateTouchGunUI(){
  if (!IS_TOUCH) return;
  const zb = $('btnZoomT');
  if (zb) zb.style.opacity = GUNS[me.gun].zoom ? 1 : .45;   // 鏡鈕常駐，非狙擊時變暗
  const gb = $('btnGunT');
  if (gb) gb.textContent = ['手槍','衝鋒','突擊','霰彈','狙擊'][me.gun] || '換槍';
}
function doSkill(){
  if (isHost) localSkill();
  else { const s=slots[myIdx]; if (localSkillCd<=0 && !me.dead){ localSkillCd = CHARS[s.char].skillCd; localSkill(); } }
}
addEventListener('keyup', e=>{ keys[e.code]=false; if(e.code==='Tab') $('board').classList.add('hidden'); });
addEventListener('mousemove', e=>{
  if (!locked || !started) return;
  const sens = 0.0023 * (me.zoomed?0.45:1);
  me.yaw   -= e.movementX * sens;
  me.pitch = clamp(me.pitch - e.movementY*sens, -1.45, 1.45);
});
addEventListener('mousedown', e=>{
  if (!started || IS_TOUCH) return;
  if (!locked){ $('c3d').requestPointerLock && $('c3d').requestPointerLock(); return; }
  if (e.button===0) mouseDownL = true;
  if (e.button===2) me.zoomed = !me.zoomed && GUNS[me.gun].zoom;
});

/* ---------- 手機觸控：左半搖桿移動、右半滑動瞄準、按鈕操作 ---------- */
const touchIn = { moveId:null, aimId:null, bx:0, by:0, lx:0, ly:0, mvx:0, mvy:0 };
let touchJump = 0;   // 觸控跳躍排隊時間戳
if (IS_TOUCH){
  const cv = $('c3d');
  const joyB = $('joyBase'), joyK = $('joyKnob');
  cv.addEventListener('touchstart', e=>{
    if (!started) return;
    e.preventDefault();
    for (const t of e.changedTouches){
      if (t.clientX < innerWidth*0.45 && touchIn.moveId===null){
        touchIn.moveId = t.identifier;
        touchIn.bx = t.clientX; touchIn.by = t.clientY;
        joyB.style.display = joyK.style.display = 'block';
        joyB.style.left = joyK.style.left = t.clientX+'px';
        joyB.style.top  = joyK.style.top  = t.clientY+'px';
      } else if (touchIn.aimId===null){
        touchIn.aimId = t.identifier;
        touchIn.lx = t.clientX; touchIn.ly = t.clientY;
      }
    }
  }, {passive:false});
  cv.addEventListener('touchmove', e=>{
    if (!started) return;
    e.preventDefault();
    for (const t of e.changedTouches){
      if (t.identifier === touchIn.moveId){
        let dx = t.clientX-touchIn.bx, dy = t.clientY-touchIn.by;
        const len = Math.hypot(dx,dy), max = 52;
        if (len > max){
          // 底座跟隨手指滑移（超出範圍時），方向切換更順手
          touchIn.bx += dx/len*(len-max);
          touchIn.by += dy/len*(len-max);
          joyB.style.left = touchIn.bx+'px';
          joyB.style.top  = touchIn.by+'px';
          dx = dx/len*max; dy = dy/len*max;
        }
        touchIn.mvx = dx/max; touchIn.mvy = dy/max;
        joyK.style.left = (touchIn.bx+dx)+'px';
        joyK.style.top  = (touchIn.by+dy)+'px';
      } else if (t.identifier === touchIn.aimId){
        const sens = 0.0045 * (me.zoomed?0.45:1);
        me.yaw   -= (t.clientX-touchIn.lx)*sens;
        me.pitch  = clamp(me.pitch-(t.clientY-touchIn.ly)*sens, -1.45, 1.45);
        touchIn.lx = t.clientX; touchIn.ly = t.clientY;
      }
    }
  }, {passive:false});
  const endT = e=>{
    for (const t of e.changedTouches){
      if (t.identifier === touchIn.moveId){
        touchIn.moveId = null; touchIn.mvx = touchIn.mvy = 0;
        joyB.style.display = joyK.style.display = 'none';
      }
      if (t.identifier === touchIn.aimId) touchIn.aimId = null;
    }
  };
  cv.addEventListener('touchend', endT);
  cv.addEventListener('touchcancel', endT);
  // 按鈕（含按壓回饋、震動、失敗紅閃）
  const buzz = ms=>{ try{ navigator.vibrate && navigator.vibrate(ms); }catch(_){} };
  const press = el=>{ el.classList.add('pressed'); setTimeout(()=> el.classList.remove('pressed'), 140); };
  const deny  = el=>{ el.classList.add('deny'); buzz([30,40,30]); setTimeout(()=> el.classList.remove('deny'), 260); };
  const bind = (id, down, up)=>{
    const el = $(id);
    el.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      press(el);
      const ok = down();
      if (ok === false) deny(el); else buzz(12);
    }, {passive:false});
    const endH = e=>{ e.preventDefault(); if (up) up(); };
    el.addEventListener('touchend', endH, {passive:false});
    el.addEventListener('touchcancel', endH, {passive:false});
  };
  // 開火鈕：按住連射、拖曳同時轉視角（觸控事件會持續回到起始元素）
  const fb = $('btnFireT');
  const fireT = { id:null, lx:0, ly:0 };
  fb.addEventListener('touchstart', e=>{
    e.preventDefault(); e.stopPropagation();
    const t = e.changedTouches[0];
    fireT.id = t.identifier; fireT.lx = t.clientX; fireT.ly = t.clientY;
    mouseDownL = true;
    if (started && !me.dead) tryFire();   // 按下瞬間立即射擊，快速點按不漏發
    fb.classList.add('pressed');
    try{ navigator.vibrate && navigator.vibrate(10); }catch(_){}
  }, {passive:false});
  fb.addEventListener('touchmove', e=>{
    e.preventDefault();
    for (const t of e.changedTouches){
      if (t.identifier !== fireT.id) continue;
      const sens = 0.0045 * (me.zoomed?0.45:1);
      me.yaw   -= (t.clientX-fireT.lx)*sens;
      me.pitch  = clamp(me.pitch-(t.clientY-fireT.ly)*sens, -1.45, 1.45);
      fireT.lx = t.clientX; fireT.ly = t.clientY;
    }
  }, {passive:false});
  const fireEnd = e=>{
    for (const t of e.changedTouches) if (t.identifier === fireT.id){
      fireT.id = null; mouseDownL = false; fb.classList.remove('pressed');
    }
  };
  fb.addEventListener('touchend', fireEnd);
  fb.addEventListener('touchcancel', fireEnd);
  bind('btnSkillT', ()=>{
    const cd = isHost ? slots[myIdx].skillCd : localSkillCd;
    if (me.dead || cd > 0) return false;   // 冷卻中：紅閃提示
    doSkill();
  });
  bind('btnUltT', ()=>{
    if (me.dead || slots[myIdx].ult < 100) return false;   // 未集滿：紅閃提示
    localUlt();
  });
  bind('btnJumpT', ()=>{
    touchJump = now();   // 排隊 0.4 秒內有效，不會被幀間吃掉
  });
  bind('btnGunT', ()=> switchGun((me.gun+1)%GUN_COUNT));
  bind('btnZoomT', ()=>{
    if (!GUNS[me.gun].zoom) return false;   // 非狙擊槍：紅閃提示
    me.zoomed = !me.zoomed;
  });
}
addEventListener('mouseup', e=>{ if(e.button===0) mouseDownL=false; });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('pointerlockchange', ()=>{
  locked = document.pointerLockElement === $('c3d');
  if (started && !IS_TOUCH) $('pauseHint').classList.toggle('hidden', locked);
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
    // 匿蹤者對敵隊隱形（隊友仍可見）
    const hiddenFromMe = s.fx.stealth>0 && slots[myIdx] && s.team!==slots[myIdx].team;
    a.group.visible = s.alive && !hiddenFromMe;
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
    a.gunM.scale.z = [0.55,0.85,1,1.15,1.5][s.gun] || 1;   // 依武器調整槍長
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
      if (Math.random()<.5) spawnSmoke(f.obj.position.x, f.obj.position.y, f.obj.position.z,
        {n:1, size:.9, color:0x54575c, rise:.2, life:1.1, grow:.8, opacity:.5, spread:.2});
      if (f.obj.position.y <= 0.5){
        ringFX(new THREE.Vector3(f.meteor.x,0.2,f.meteor.z), 0xff8040, 8, 0.7);
        explosionFX(f.meteor.x, .3, f.meteor.z, 1.2);
        scene.remove(f.obj); fxList.splice(i,1); continue;
      }
    }
    if (tn > f.die){ scene.remove(f.obj); fxList.splice(i,1); }
    else if (!f.ring && !f.meteor && f.mat) f.mat.opacity *= 0.86;
  }
  if (flashLight) flashLight.intensity *= 0.75;
  if (viewmodel) viewmodel.position.z += (0-viewmodel.position.z)*Math.min(1,dt*14);

  // 物理 / 煙霧 / 彈丸 / 貼花 / 動態特效 / 元素區域
  physTick(dt);
  smokeTick(dt);
  boltsTick(dt);
  decalsTick();
  specialsTick(dt);
  zoneVisTick();
  if (muzzleSprite && muzzleSprite.visible && now()-muzzleT > 0.05) muzzleSprite.visible = false;

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
