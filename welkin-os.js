'use strict';
/* ============================================================
   WELKIN OS — 0. utilities & shell
   ============================================================ */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
/* failure-proof element binding: a missing element or a device-specific error must never kill the wiring chain */
function bind(sel,evt,fn){try{const el=$(sel);if(el)el.addEventListener(evt,fn);}catch(e){}}
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeOutQuad=t=>t*(2-t);
const easeOutQuint=t=>1-Math.pow(1-t,5);
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
if(!String.prototype.padStart){String.prototype.padStart=function(t,p){p=String(p==null?' ':p);let str=String(this);while(str.length<t){str=p+str;}return str;};}
const pad7=n=>String(Math.max(0,Math.floor(n))).padStart(7,'0');
const mmss=s=>{s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const rand=(a,b)=>a+Math.random()*(b-a);
const FONT_D="'Bahnschrift SemiCondensed','Bahnschrift','Arial Narrow','Segoe UI',sans-serif";
const FONT_M="'Consolas','Cascadia Mono','SF Mono',monospace";

/* ---------- 图片格式降级：AVIF → WebP ----------
   仓库里每张图都并存放了 X.avif 和 X.webp。AVIF 体积小得多，但 Safari/iOS 要
   16.1、Edge 要 121 才认，老手机和老 Edge 直接白图。开机探一次解码能力，
   不支持就把所有 .avif 引用换成同名 .webp；地址栏 ?img=webp / ?img=avif 可强制。
   探测结果还会写进 <html data-img="avif|webp">，CSS 里那两张纯背景曲绘靠它选格式。 */
const AVIF_PROBE='data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
let IMG_CAN_AVIF=false;
const IMG_PROBE=new Promise(resolve=>{
  let settled=false;
  const done=ok=>{
    if(settled)return;settled=true;IMG_CAN_AVIF=ok;
    try{document.documentElement.dataset.img=ok?'avif':'webp';}catch(e){}
    resolve(ok);
  };
  let forced='';
  try{forced=(new URLSearchParams(location.search).get('img')||'').toLowerCase();}catch(e){}
  if(forced==='webp'||forced==='noavif'){done(false);return;}
  if(forced==='avif'){done(true);return;}
  let probe=null;
  try{probe=new Image();}catch(e){done(false);return;}
  probe.onload=()=>done(true);
  probe.onerror=()=>done(false);
  try{probe.src=AVIF_PROBE;}catch(e){done(false);return;}
  setTimeout(()=>done(false),1500);
});
/* 只换扩展名，不动目录和大小写；data:/blob:/http 外链一律原样返回 */
function imgUrl(u){
  const s=u==null?'':String(u);
  if(!s||IMG_CAN_AVIF)return s;
  return s.replace(/\.avif\b/gi,'.webp');
}

const room=$('#room');
const cityCanvas=$('#city');
const cityCtx=cityCanvas.getContext('2d');
const phoneScreen=$('#phoneScreen');
const phoneBoot=$('#phoneBoot');
const phoneRig=$('#phoneRig');
const bgm=$('#bgm');

const loadingLayer=$('#loading');
const loginLayer=$('#login');
const wakeLayer=$('#wake');
const songScreen=$('#songScreen');
const chapterScreen=$('#chapterScreen');
const songSelectScreen=$('#songSelectScreen');
const prologueScreen=$('#prologueScreen');
const exScreen=$('#exScreen');
const songLoading=$('#songLoading');
const navBase=$('#navBase');
const lobbyBgm=$('#lobbyBgm');
const imApp=$('#imApp');
const settingsApp=$('#settingsApp');
const gameWrap=$('#gameWrap');
const gameHud=$('#gameHud');
const pauseLayer=$('#pauseLayer');
const resultLayer=$('#resultLayer');
const wipeEl=$('#wipe');
const hud=$('#gameHud');

let state='BOOT';
let settingsReturn='PHONE';
const PERF_LITE=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||Math.min(window.innerWidth||999,window.innerHeight||999)<820;
document.body.classList.toggle('perf-lite',PERF_LITE);
/* crash diary: record the last uncaught error / rejection so a UI freeze can be diagnosed later */
try{
  window.addEventListener('error',e=>{
    try{localStorage.setItem('welkin_os_last_error',JSON.stringify({t:Date.now(),m:String(e.message||''),f:String(e.filename||'').split('/').pop()+':'+(e.lineno||0)}));}catch(x){}
  });
  window.addEventListener('unhandledrejection',e=>{
    try{localStorage.setItem('welkin_os_last_error',JSON.stringify({t:Date.now(),m:'rej:'+String((e.reason&&e.reason.message)||e.reason||'')}));}catch(x){}
  });
}catch(e){}

/* ============================================================
   1. settings / user / best
   ============================================================ */
const SET_KEY='welkin_os_settings_v1';
const DEFAULT_SETTINGS={speed:1,dim:45,volume:85,hit:true,ui:true,early:true,motion:false,perfMode:'auto',hitVol:85,inputOffset:0,trackSkin:0,keySkin:0,mirror:false};
let settings=Object.assign({},DEFAULT_SETTINGS);
try{
  const raw=localStorage.getItem(SET_KEY);
  if(raw){const o=JSON.parse(raw);if(o&&typeof o==='object')settings=Object.assign({},DEFAULT_SETTINGS,o);}
}catch(e){}
settings.speed=clamp(Number(settings.speed)||1,0.5,1.5);
settings.dim=clamp(Number(settings.dim)||0,0,80);
settings.volume=clamp(Number(settings.volume)||0,0,100);
settings.hitVol=clamp(Number(settings.hitVol)||0,0,100);
settings.inputOffset=clamp(Number(settings.inputOffset)||0,-150,150);
settings.trackSkin=clamp(Math.floor(Number(settings.trackSkin)||0),0,20);
/* 上限先按旧的 7 套留到 6：老存档里的 3/4/5/6 要等 ensureAccount 按新表重排，
   这里先截断会把「旧 5=圣铠」压成 4，重排后就认错皮肤了。 */
settings.keySkin=clamp(Math.floor(Number(settings.keySkin)||0),0,6);
settings.hit=!!settings.hit;settings.ui=!!settings.ui;settings.early=!!settings.early;settings.motion=!!settings.motion;settings.mirror=!!settings.mirror;
if(settings.perfMode!=='low'&&settings.perfMode!=='high'&&settings.perfMode!=='ultra')settings.perfMode='auto';
/* Track skin is pinned in its own slot. settings is rewritten/saved in several
   places; a stale save used to be able to put trackSkin back to 0 between songs,
   which made the lanes silently revert to the default skin. */
const TRACK_SKIN_KEY='welkin_os_track_skin_v1';
function readTrackSkinValue(v){
  const n=Math.floor(Number(v));
  return (Number.isFinite(n)&&n>=0&&n<21)?n:null;
}
let activeTrackSkin=readTrackSkinValue(settings.trackSkin);
try{
  const savedSkin=readTrackSkinValue(localStorage.getItem(TRACK_SKIN_KEY));
  if(savedSkin!==null)activeTrackSkin=savedSkin;
}catch(e){}
if(activeTrackSkin===null)activeTrackSkin=0;
settings.trackSkin=activeTrackSkin;
try{if(localStorage.getItem(TRACK_SKIN_KEY)===null)localStorage.setItem(TRACK_SKIN_KEY,String(activeTrackSkin));}catch(e){}
function getTrackSkin(){
  let list=[];
  try{list=TRACK_SKINS;}catch(e){}
  if(!list.length||activeTrackSkin<0||activeTrackSkin>=list.length)activeTrackSkin=0;
  if(!isTrackUnlocked(activeTrackSkin))activeTrackSkin=0;
  return list[activeTrackSkin]||list[0]||{name:'WELKIN',a:[34,228,255],b:[120,220,255],col:'solid',div:'line',dim:1};
}
function setTrackSkin(i){
  const n=Math.floor(Number(i));
  activeTrackSkin=((Number.isFinite(n)?n:0)%21+21)%21;
  if(!isTrackUnlocked(activeTrackSkin))activeTrackSkin=0;
  settings.trackSkin=activeTrackSkin;
  try{localStorage.setItem(TRACK_SKIN_KEY,String(activeTrackSkin));}catch(e){}
  saveSettings();
}
/* ---- 音符（按键）皮肤 --------------------------------------------------------
   默认 = 最初那套原皮肤（轮廓与配色一版不动，只做两处改动：长条玻璃亮度抬一点点、
   长条底部加金色多押提示）；
   白昼 / 晨曦 = 下午那 10 套里挑出来的第 4、9 套，各有各的轮廓。
   配色只有原来游戏里那几种：蓝键、金押、终结白、碎点金——不引入新颜色。 */
const NOTE_SKINS=[
  {name:'默认',classic:true,shape:'round',
   hold:{body:['rgba(13,23,30,.92)','rgba(20,36,46,.88)','rgba(11,18,23,.94)'],
         edge:'rgba(113,240,255,.82)',cap:['#f4ffff','#bffcff','#148eb0']}},
  {name:'白昼',classic:false,shape:'ring',
   blue:{top:'#ffffff',mid:'#b8e8ff',bot:'#4fa6d8',edge:[235,250,255],edgeA:.95,glow:[125,211,252],glowA:.4},
   hold:{body:['rgba(110,160,190,.72)','rgba(200,232,248,.70)','rgba(92,140,176,.76)'],
         edge:'rgba(200,246,255,.80)',cap:['#ffffff','#d8f4ff','#4fa6d8']}},
  {name:'晨曦',classic:false,shape:'chamfer',
   blue:{top:'#fff9f0',mid:'#a8dcf8',bot:'#4a8fc0',edge:[240,250,255],edgeA:.92,glow:[56,189,248],glowA:.4},
   hold:{body:['rgba(104,148,172,.74)','rgba(196,224,242,.72)','rgba(84,126,158,.78)'],
         edge:'rgba(220,248,255,.80)',cap:['#fff9f0','#cfeafc','#4a8fc0']}},
  /* —— 皇室奢华两套：蓝键仍蓝、黄键仍金、押键金括号，只升材质与轮廓 —— */
  {name:'蓝宝',classic:false,shape:'gem',
   blue:{top:'#eafaff',mid:'#35a0e8',bot:'#0c4f8f',edge:[200,246,255],edgeA:.95,glow:[80,200,255],glowA:.45,rim:'#eafcff',rim2:'#07273f'},
   hold:{body:['rgba(12,26,46,.92)','rgba(30,58,96,.88)','rgba(8,18,34,.95)'],
         edge:'rgba(170,240,255,.85)',cap:['#eafaff','#c4efff','#0c4f8f']}},
  {name:'圣铠',classic:false,shape:'arch',
   blue:{top:'#f4f6ff',mid:'#3a6ea8',bot:'#12263f',edge:[214,228,255],edgeA:.95,glow:[120,180,255],glowA:.4,rim:'#eef2ff',rim2:'#0a1a30'},
   hold:{body:['rgba(14,24,38,.94)','rgba(26,44,66,.90)','rgba(9,16,26,.95)'],
         edge:'rgba(160,212,255,.82)',cap:['#f4f6ff','#c8d8f2','#12263f']}}
];
function noteSkinCount(){return NOTE_SKINS.length;}
function getNoteSkin(){
  const i=clamp(Math.floor(Number(settings&&settings.keySkin)||0),0,NOTE_SKINS.length-1);
  if(!isNoteUnlocked(i))return NOTE_SKINS[0];
  return NOTE_SKINS[i]||NOTE_SKINS[0];
}
function setNoteSkin(i){
  const n=Math.floor(Number(i))||0,c=NOTE_SKINS.length;
  let idx=((n%c)+c)%c;
  if(!isNoteUnlocked(idx))idx=0;
  settings.keySkin=idx;
  saveSettings();
  refreshNoteSkin();
}
/* 换肤：重建音符精灵 + 立刻重绘当前画面，不让游戏停在旧皮肤上 */
function refreshNoteSkin(){
  try{layoutGame();}catch(e){}
  if(state==='GAME'||state==='PAUSED'||state==='RESUMING'){try{drawGame(0);}catch(e){}}
  syncNoteSkinUI();
  renderNoteSkinPreview();
}
function getNoteSkinIndex(){return clamp(Math.floor(Number(settings&&settings.keySkin)||0),0,NOTE_SKINS.length-1);}
function syncNoteSkinUI(){
  const el=$('#vNoteSkin');
  if(!el)return;
  const i=clamp(Math.floor(Number(settings&&settings.keySkin)||0),0,NOTE_SKINS.length-1);
  el.textContent=getNoteSkin().name+'  '+(i+1)+'/'+NOTE_SKINS.length;
}
/* Settings 里的按键皮肤小预览：直接用真正的音符精灵缩着画，所见即所得 */
function renderNoteSkinPreview(){
  const cv=$('#noteSkinPreview');
  if(!cv)return;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height,SK=getNoteSkin();
  if(!spr.note){try{buildGameSprites();}catch(e){}}
  c.clearRect(0,0,W,H);
  c.fillStyle='#04070d';c.fillRect(0,0,W,H);
  const track=c.createLinearGradient(0,0,0,H);
  track.addColorStop(0,'rgba(6,16,29,0)');track.addColorStop(.55,'rgba(9,22,39,.5)');track.addColorStop(1,'rgba(11,28,48,.72)');
  c.fillStyle=track;c.fillRect(W*.03,0,W*.94,H);
  const jy=H*.66;
  c.fillStyle='rgba(240,253,255,.85)';c.fillRect(W*.03,jy+26,W*.94,2);
  // 终结键已不在谱面里出现（只保留音符、不再画白色外壳），第 4 格改画黄键：
  // 用 spr.break，因此默认 / 白昼 / 晨曦各组显示的都是本组自己的黄键皮肤。
  const items=[[.12,spr.note],[.33,spr.chord],[.54,spr.multi],[.75,spr.break]];
  for(const it of items){
    const sp=it[1];if(!sp)continue;
    const sc=Math.min(1,86/sp.w);
    c.drawImage(sp.c,W*it[0]-sp.w*sc/2,jy-sp.h*sc/2,sp.w*sc,sp.h*sc);
  }
  const hx=W*.92,hw=20,top=jy-46,bot=jy+46;
  const hg=c.createLinearGradient(0,top,0,bot);
  hg.addColorStop(0,SK.hold.body[0]);hg.addColorStop(.45,SK.hold.body[1]);hg.addColorStop(1,SK.hold.body[2]);
  c.fillStyle=hg;c.fillRect(hx-hw,top,hw*2,bot-top);
  c.strokeStyle=SK.hold.edge;c.lineWidth=2;
  c.beginPath();c.moveTo(hx-hw+1,top);c.lineTo(hx-hw+1,bot);c.moveTo(hx+hw-1,top);c.lineTo(hx+hw-1,bot);c.stroke();
  const capH=10;
  const capGrad=c.createLinearGradient(0,top,0,top+capH);
  capGrad.addColorStop(0,SK.hold.cap[0]);capGrad.addColorStop(.45,SK.hold.cap[1]);capGrad.addColorStop(1,SK.hold.cap[2]);
  c.fillStyle=capGrad;c.fillRect(hx-hw*1.03,top,hw*2.06,capH);
  c.fillStyle='rgba(220,245,255,.55)';c.font='10px '+FONT_M;c.textAlign='center';c.textBaseline='middle';
  c.fillText(SK.name,W*.5,H-9);
}
function saveSettings(){settings.trackSkin=activeTrackSkin;try{localStorage.setItem(SET_KEY,JSON.stringify(settings));}catch(e){}}

const LAST_USER_KEY='welkin_os_last_name';
function readUser(){
  try{
    let raw=localStorage.getItem('welkin_os_user');
    if(!raw)raw=localStorage.getItem('rhythm_user');
    if(!raw){
      const last=localStorage.getItem(LAST_USER_KEY);
      if(last&&last.trim())return {name:last.trim().slice(0,10),avatar:''};
      return null;
    }
    const u=JSON.parse(raw);
    if(!u||typeof u.name!=='string'||!u.name.trim()){
      const last=localStorage.getItem(LAST_USER_KEY);
      if(last&&last.trim())return {name:last.trim().slice(0,10),avatar:''};
      return null;
    }
    const name=u.name.trim().slice(0,10);
    try{localStorage.setItem(LAST_USER_KEY,name);}catch(e){}
    return {name,avatar:typeof u.avatar==='string'?u.avatar:''};
  }catch(e){
    try{
      const last=localStorage.getItem(LAST_USER_KEY);
      if(last&&last.trim())return {name:last.trim().slice(0,10),avatar:''};
    }catch(e2){}
    return null;
  }
}
let user=readUser();

const BEST_MAP_KEY='welkin_os_best_map_v1';
function emptyBest(){return {score:0,acc:0,ap:false,fc:false,combo:0,rank:'—'};}
function readBestMap(){
  try{
    const o=JSON.parse(localStorage.getItem(BEST_MAP_KEY)||'{}');
    if(o&&typeof o==='object')return o;
  }catch(e){}
  return {};
}
function getBestFor(id){return bestMap[id]||emptyBest();}
function saveBestFor(id,b){
  bestMap[id]={score:b.score|0,acc:b.acc||0,ap:!!b.ap,fc:!!b.fc,combo:b.combo|0,rank:b.rank||'—'};
  try{localStorage.setItem(BEST_MAP_KEY,JSON.stringify(bestMap));}catch(e){}
}
let bestMap=readBestMap();
let best=emptyBest();

/* ============================================================
   1b. ACCOUNT + STORE（苍穹星 · 皇室抽奖 · 皮肤解锁）
   ============================================================ */
/* 账号体系：稳定 accountId，与 operator 名称彻底解耦。改 operator / 重新登录
   都绝不触碰任何进度、货币、皮肤。全部数据（进度 + 苍穹星 + 皮肤 + 解锁）归入
   一套账号档案，永久保留，不随名字变化、不被覆盖。 */
const ACCT_KEY='welkin_os_account_v1';
const STORE_FLAG_KEY='welkin_os_store_v1_init';
const CURR_GRANT_KEY='welkin_os_store_v2_currency';
const STAR_COST_ONE=67, STAR_COST_TEN=666;
function genId(){return 'WK-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,8).toUpperCase();}
function freshAccount(){return {id:'',currency:666,unlockedNote:[0],unlockedTrack:[0],phone:false,lobby:false,scenery:false,phoneui:false,phoneOn:false,lobbyOn:false,sceneryOn:false,phoneuiOn:false,lobbyMusic:false,lobbyMusicOn:false};}
let account=freshAccount();
function loadAccount(){
  try{
    const o=JSON.parse(localStorage.getItem(ACCT_KEY)||'null');
    if(o&&typeof o==='object'){
      account=Object.assign(freshAccount(),o);
      if(!account.id)account.id=genId();
      if(!Array.isArray(account.unlockedNote))account.unlockedNote=[0];
      if(!Array.isArray(account.unlockedTrack))account.unlockedTrack=[0];
      if(!account.unlockedNote.includes(0))account.unlockedNote.unshift(0);
      if(!account.unlockedTrack.includes(0))account.unlockedTrack.unshift(0);
      account.currency=Math.max(0,Math.floor(Number(account.currency)||0));
      saveAccount();
      return;
    }
  }catch(e){}
  account=freshAccount();account.id=genId();saveAccount();
}
function saveAccount(){try{localStorage.setItem(ACCT_KEY,JSON.stringify(account));}catch(e){}}
function isNoteUnlocked(i){const n=Math.floor(Number(i));if(n<=0)return true;return account.unlockedNote.includes(n);}
function isTrackUnlocked(i){const n=Math.floor(Number(i));if(n<=0)return true;return account.unlockedTrack.includes(n);}
function unlockedNoteList(){return account.unlockedNote.slice().sort((a,b)=>a-b);}
function unlockedTrackList(){return account.unlockedTrack.slice().sort((a,b)=>a-b);}
/* 冠冕 / 星冠两套皮肤已彻底删除（NOTE_SKINS 从 7 套减到 5 套），旧存档里的序号要
   跟着重排，否则老玩家手里的蓝宝会变成圣铠：旧 4（蓝宝）→3、旧 5（圣铠）→4，
   旧 3（冠冕）/ 旧 6（星冠）直接丢掉。存档码 v2 及更早的码也走同一张表。 */
const LEGACY_NOTE_IDX_MAP={0:0,1:1,2:2,4:3,5:4};
const LEGACY_NOTE_IDX_KEY='welkin_os_note_idx_v2';
function remapLegacyNoteList(list){
  const out=[];
  for(const v of (Array.isArray(list)?list:[])){
    const m=LEGACY_NOTE_IDX_MAP[Math.floor(Number(v))];
    if(m!==undefined&&!out.includes(m))out.push(m);
  }
  if(!out.includes(0))out.unshift(0);
  return out;
}
function remapLegacyKeySkin(v){
  const m=LEGACY_NOTE_IDX_MAP[Math.floor(Number(v))||0];
  return m===undefined?0:m;
}
function applySkins(){
  try{
    document.body.classList.toggle('sss-phone',!!account.phoneOn);
    document.body.classList.toggle('sss-lobby',!!account.lobbyOn);
    document.body.classList.toggle('sss-scenery',!!account.sceneryOn);
    document.body.classList.toggle('sss-phoneui',!!account.phoneuiOn);
  }catch(e){}
}
function ensureAccount(){
  loadAccount();
  /* 一次性迁移：冠冕 / 星冠删除后，旧存档的按键皮肤解锁序号重排 */
  let noteIdxMigrated=false;
  try{noteIdxMigrated=localStorage.getItem(LEGACY_NOTE_IDX_KEY)==='1';}catch(e){}
  if(!noteIdxMigrated){
    account.unlockedNote=remapLegacyNoteList(account.unlockedNote);
    settings.keySkin=remapLegacyKeySkin(settings.keySkin);
    try{localStorage.setItem(LEGACY_NOTE_IDX_KEY,'1');}catch(e){}
    saveAccount();saveSettings();
  }
  /* 一次性迁移：按键皮肤 / 轨道皮肤进入奖池 → 所有玩家恢复默认并锁住 */
  let migrated=false;
  try{migrated=localStorage.getItem(STORE_FLAG_KEY)==='1';}catch(e){}
  if(!migrated){
    activeTrackSkin=0;settings.trackSkin=0;settings.keySkin=0;
    try{localStorage.setItem(TRACK_SKIN_KEY,'0');}catch(e){}
    saveSettings();
    account.unlockedNote=[0];account.unlockedTrack=[0];
    try{localStorage.setItem(STORE_FLAG_KEY,'1');}catch(e){}
    saveAccount();
  }
  /* 一次性补发：所有玩家初始 666 苍穹星（老账号不足 666 的补到 666，绝不回扣） */
  let granted=false;
  try{granted=localStorage.getItem(CURR_GRANT_KEY)==='1';}catch(e){}
  if(!granted){
    if(account.currency<666)account.currency=666;
    try{localStorage.setItem(CURR_GRANT_KEY,'1');}catch(e){}
    saveAccount();
  }
  if(!isTrackUnlocked(activeTrackSkin)){activeTrackSkin=0;settings.trackSkin=0;}
  if(!isNoteUnlocked(getNoteSkinIndex())){settings.keySkin=0;}
  applySkins();
}

/* ---- 苍穹星获取算法 ----------------------------------------------------------
   「难度定基数、评级定折扣、AP / 全连定倍数」：

   难度基准 B（= 该曲 AP 能拿到的苍穹星）：Lv.2 = 670，Lv.20 = 67000，中间指数插值。
       低难曲整体抬高：Lv.2 是旧值的 10 倍，越往上越回落，Lv.20 仍是 67000 封顶。
   结算（都在 B 的基础上算）：
       AP   = B
       全连 = B ÷ 2          （不看评级：只要全连就按这个给）
       普通 = B ÷ 5 × 评级系数（SSS 1.0 / S .85 / A .7 / B .5 / C .3）
   例：Lv.2  AP 670 / 全连 335 / SSS 134 / B 67 / C 40
       Lv.20 AP 67000 / 全连 33500 / SSS 13400
   难度越高 B 越大，高难曲的同档评级一定压过低难曲；低难曲的 AP（B）也仍压得住
   高一档的全连（0.645B）。0 分不给，单次封顶 67000。 */
const STAR_AP_LV_LO=670;       /* Lv.2 的 AP 值 */
const STAR_AP_LV_HI=67000;     /* Lv.20 的 AP 值（也是单次封顶） */
const STAR_LV_LO=2, STAR_LV_HI=20;
const STAR_MULT_AP=5, STAR_MULT_FC=2.5;   /* AP ×5 / 全连 ×2.5（相对基准值） */
const STAR_CAP=67000;                     /* 单次结算封顶 */
const STAR_RANK_SCALE={SSS:1.0,S:0.85,A:0.7,B:0.5,C:0.3};
/* 难度基准（= 该曲 AP 能拿到的苍穹星） */
function starAPFor(level){
  const L=clamp(Math.floor(Number(level)||STAR_LV_LO),STAR_LV_LO,STAR_LV_HI);
  return STAR_AP_LV_LO*Math.pow(STAR_AP_LV_HI/STAR_AP_LV_LO,(L-STAR_LV_LO)/(STAR_LV_HI-STAR_LV_LO));
}
function stardustFor(level,rank,isAP,isFC,score){
  if(!score||score<=0)return 0;
  const ap=starAPFor(level);
  const base=ap/STAR_MULT_AP;   /* 满评级（SSS）、不 AP、不全连的基准值 */
  let v;
  if(isAP)v=ap;
  else if(isFC)v=base*STAR_MULT_FC;
  else{
    const m=(rank&&STAR_RANK_SCALE[rank]!==undefined)?STAR_RANK_SCALE[rank]:0.5;
    v=base*m;
  }
  return Math.min(STAR_CAP,Math.max(1,Math.round(v)));
}

/* ---- 奖池 ------------------------------------------------------------------ */
const TIER_LIGHT={
  SSS:{css:'#ffffff',label:'SSS',rainbow:true},
  S:{css:'#ffd76a',label:'S'},
  A:{css:'#c78bff',label:'A'},
  B:{css:'#5ea8ff',label:'B'}
};
function hexa(hex,a){
  const h=String(hex).replace('#','');
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function buildPrizePool(){
  const P=[];
  /* SSS 1%：5 件，各 1/5 × 1% */
  const sssP=0.01/5;
  P.push({id:'sss-phone',tier:'SSS',p:sssP,kind:'phone',name:'鎏金终端 · 皇室手机',desc:'高奢黄金风格手机外壳 · 鎏金按键 · 金工雕花',owned:()=>!!account.phone});
  P.push({id:'sss-lobby',tier:'SSS',p:sssP,kind:'lobby',name:'金殿 · 皇室大厅',desc:'手机背后大厅焕新为皇室奢华风 · 窗外夜景保留',owned:()=>!!account.lobby});
  P.push({id:'sss-scenery',tier:'SSS',p:sssP,kind:'scenery',name:'黄金苍穹 · 黄金奢华外景',desc:'窗外风景焕新为黄金科技炫酷风格 · 金辉天际线 · 鎏金霓虹',owned:()=>!!account.scenery});
  P.push({id:'sss-phoneui',tier:'SSS',p:sssP,kind:'phoneui',name:'鎏金天幕 · 皇室天气屏',desc:'手机天气屏焕新为皇室黄金动态鎏金风格 · 金箔流光 · 动态鎏金',owned:()=>!!account.phoneui});
  P.push({id:'sss-lobbymusic',tier:'SSS',p:sssP,kind:'lobbymusic',name:'大厅奢华钢琴 · 背景音乐',desc:'大厅背景音乐替换为奢华钢琴曲 · 循环播放 · 设置内可开关',owned:()=>!!account.lobbyMusic});
  /* S 5%：5 件，各 1/5 × 5%（白昼 / 晨曦 / 蓝宝 / 圣铠 + 黄金奢华轨道） */
  const sP=0.05/5;
  P.push({id:'note-1',tier:'S',p:sP,kind:'note',skinIndex:1,name:'按键皮肤 · 白昼',desc:'轮廓环光 · 冰白配色',owned:()=>isNoteUnlocked(1)});
  P.push({id:'note-2',tier:'S',p:sP,kind:'note',skinIndex:2,name:'按键皮肤 · 晨曦',desc:'暖阳渐变 · 削角轮廓',owned:()=>isNoteUnlocked(2)});
  P.push({id:'note-3',tier:'S',p:sP,kind:'note',skinIndex:3,name:'按键皮肤 · 蓝宝',desc:'蓝宝石八面切面 · 皇室高奢材质',owned:()=>isNoteUnlocked(3)});
  P.push({id:'note-4',tier:'S',p:sP,kind:'note',skinIndex:4,name:'按键皮肤 · 圣铠',desc:'哥特尖拱圣铠 · 皇室高奢材质',owned:()=>isNoteUnlocked(4)});
  P.push({id:'track-20',tier:'S',p:sP,kind:'track',skinIndex:20,name:'轨道皮肤 · 黄金奢华',desc:'黄金奢华风轨道 · 鎏金流光 · 高端质感',owned:()=>isTrackUnlocked(20)});
  /* A 24%：19 款轨道皮肤（除默认） */
  const aEach=0.24/19;
  for(let i=1;i<20;i++){
    const sk=TRACK_SKINS[i];
    P.push({id:'track-'+i,tier:'A',p:aEach,kind:'track',skinIndex:i,name:'轨道皮肤 · '+(sk?sk.name:('NO.'+(i+1))),desc:'第 '+(i+1)+' 款轨道背景皮肤',owned:()=>isTrackUnlocked(i)});
  }
  /* B 70%：苍穹星 67(10%) / 30(50%) / 15(40%)（相对 B 内占比） */
  P.push({id:'b-67',tier:'B',p:0.07,kind:'currency',amount:67,name:'苍穹星 ×67',desc:'大量星屑',owned:()=>false});
  P.push({id:'b-30',tier:'B',p:0.35,kind:'currency',amount:30,name:'苍穹星 ×30',desc:'一捧星屑',owned:()=>false});
  P.push({id:'b-15',tier:'B',p:0.28,kind:'currency',amount:15,name:'苍穹星 ×15',desc:'几粒星屑',owned:()=>false});
  return P;
}
function rollOnce(){
  const pool=buildPrizePool();
  const r=Math.random();let acc=0;
  for(const p of pool){acc+=p.p;if(r<acc)return p;}
  return pool[pool.length-1];
}
function rollTen(){
  const res=[];
  let hasA=false;
  for(let i=0;i<10;i++){
    const p=rollOnce();
    if(p.tier==='A'||p.tier==='S'||p.tier==='SSS')hasA=true;
    res.push(p);
  }
  if(!hasA){
    const aList=buildPrizePool().filter(x=>x.tier==='A');
    res[9]=aList[Math.floor(Math.random()*aList.length)];
  }
  return res;
}
/* 重复转化：A/S/SSS 抽中已拥有的道具时，当场按品质转化为苍穹星。
   A → 67，S → 267，SSS → 670（B 类为星屑，无重复概念，不在此列）。 */
function dupRefund(tier){return tier==='SSS'?670:(tier==='S'?267:(tier==='A'?67:0));}
function grantPrize(p){
  if(p.kind==='currency'){account.currency+=p.amount;return {dup:false,amount:p.amount};}
  if(p.kind==='note'){
    if(isNoteUnlocked(p.skinIndex)){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}
    account.unlockedNote.push(p.skinIndex);return {dup:false};
  }
  if(p.kind==='track'){
    if(isTrackUnlocked(p.skinIndex)){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}
    account.unlockedTrack.push(p.skinIndex);return {dup:false};
  }
  if(p.kind==='phone'){if(account.phone){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}account.phone=true;return {dup:false};}
  if(p.kind==='lobby'){if(account.lobby){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}account.lobby=true;return {dup:false};}
  if(p.kind==='scenery'){if(account.scenery){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}account.scenery=true;return {dup:false};}
  if(p.kind==='phoneui'){if(account.phoneui){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}account.phoneui=true;return {dup:false};}
  if(p.kind==='lobbymusic'){
    if(account.lobbyMusic){const amt=dupRefund(p.tier);account.currency+=amt;return {dup:true,amount:amt};}
    account.lobbyMusic=true;
    /* 第一次抽到就直接换上，不用再进设置手动开；之后关掉了再抽到也不会被动打开 */
    account.lobbyMusicOn=true;
    return {dup:false};
  }
  return {dup:false};
}

/* ---- 苍穹星图标（科技蓝） -------------------------------------------------- */
let _starUid=0;
function starSVG(size){
  const s=size||16,id='sdg'+(_starUid++);
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="star-svg">
    <defs><linearGradient id="${id}" x1="0" y1="2" x2="0" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#eef8ff"/><stop offset=".45" stop-color="#8ec9ff"/><stop offset="1" stop-color="#2f6dff"/>
    </linearGradient></defs>
    <path d="M12 1.4 C13.1 7.1 16.9 10.9 22.6 12 C16.9 13.1 13.1 16.9 12 22.6 C10.9 16.9 7.1 13.1 1.4 12 C7.1 10.9 10.9 7.1 12 1.4 Z" fill="url(#${id})" stroke="rgba(214,238,255,.85)" stroke-width=".5"/>
    <path d="M12 7.6 C12.55 9.9 14.1 11.45 16.4 12 C14.1 12.55 12.55 14.1 12 16.4 C11.45 14.1 9.9 12.55 7.6 12 C9.9 11.45 11.45 9.9 12 7.6 Z" fill="rgba(255,255,255,.92)"/>
  </svg>`;
}

/* ---- Store 音乐 ------------------------------------------------------------ */
const storeMusicEl=$('#storeMusic');
const storeAppEl=$('#storeApp');
let storeMusicWant=false;
function playStoreMusic(){
  try{
    if(!storeMusicEl)return;
    storeMusicWant=true;
    storeMusicEl.loop=true;
    storeMusicEl.volume=uiMusicVolume();
    /* 已经在响就别从头再来：同一个商店里 syncUIMusic 被多叫一次也不会打断 */
    if(!storeMusicEl.paused)return;
    /* 二次进入时音频可能已被浏览器回收（networkState 回到 EMPTY）或残留上次 error，
       先重新 load 再播，避免 play() 静默失败导致音乐“丢失” */
    if(storeMusicEl.error||storeMusicEl.networkState===0){
      try{storeMusicEl.load();}catch(e){}
    }
    const start=()=>{
      if(!storeMusicWant)return;
      storeMusicEl.volume=uiMusicVolume();
      try{const p=storeMusicEl.play();if(p&&p.then)p.catch(()=>{});}catch(e){}
    };
    try{storeMusicEl.currentTime=0;}catch(e){}
    if(storeMusicEl.readyState>=2){start();}
    else{
      storeMusicEl.addEventListener('canplay',start,{once:true});
      storeMusicEl.addEventListener('loadeddata',start,{once:true});
      start();
    }
  }catch(e){}
}
function stopStoreMusic(){
  storeMusicWant=false;
  try{if(storeMusicEl)storeMusicEl.pause();}catch(e){}
}
/* 被浏览器静默拦下 / 元素被回收时的补救：用户下一次点按界面时再尝试，
   不重载、不重置进度，只把 play() 再叫一次。 */
function kickStoreMusic(){
  if(!storeMusicWant||!storeMusicEl||!storeMusicEl.paused)return;
  try{storeMusicEl.volume=uiMusicVolume();const p=storeMusicEl.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}
}

/* ---- Store 落地页（iM 01 位） --------------------------------------------- */
function renderStoreLanding(){
  const feed=$('#imFeed');if(!feed)return;
  feed.innerHTML=`
    <div class="store-landing">
      <div class="store-hero">
        <h2>STORE</h2>
        <div class="store-balance">${starSVG(20)}<b id="storeLandCur">${account.currency}</b><span>苍穹星</span></div>
      </div>
      <button class="store-bigbtn" id="btnOpenStore" type="button">
        <span class="sbg-shine" aria-hidden="true"></span>
        <span class="sbg-core"><b>STORE</b><em>ENTER THE VAULT</em></span>
      </button>
      <div class="store-hint">点击进入宝库 · 单抽 ${STAR_COST_ONE} / 十连 ${STAR_COST_TEN} 苍穹星</div>
    </div>`;
  const b=$('#btnOpenStore');if(b)b.addEventListener('click',openStore);
}

/* ---- Store 内 UI ----------------------------------------------------------- */
function openStore(){
  const app=$('#storeApp');if(!app||app.classList.contains('active'))return;
  app.classList.add('active');
  stopAllUIMusic();
  playStoreMusic();
  renderStore();
  initStoreScrollHint();
  uiSound(1.25);
}
function updateStoreScrollHint(){
  const body=$('.store-body'),hint=$('#storeScrollHint');
  if(!body||!hint)return;
  const canScroll=body.scrollHeight>body.clientHeight+12;
  const nearBottom=body.scrollTop+body.clientHeight>=body.scrollHeight-48;
  hint.classList.toggle('show',canScroll&&!nearBottom);
}
function initStoreScrollHint(){
  const body=$('.store-body');
  if(!body)return;
  if(!body.__storeHintBound){
    body.__storeHintBound=true;
    body.addEventListener('scroll',updateStoreScrollHint,{passive:true});
    window.addEventListener('resize',updateStoreScrollHint);
  }
  body.scrollTop=0;
  updateStoreScrollHint();
}
function closeStore(){
  const app=$('#storeApp');if(!app)return;
  app.classList.remove('active');
  stopStoreMusic();
  syncUIMusic(true);
  uiSound(.9);
}
/* ---- 奖池里的金色图标（SVG） ------------------------------------------------
   原来「黄金奢华轨道」在奖池区就是一个黄底 + 几条黑竖线，太像占位图。
   这里用 SVG 画成真正的鎏金轨道：金属外框、四条内凹轨道、分界上的菱形嵌饰、
   上下回纹横带和斜向流光；详情弹窗 / 抽奖揭晓也用同一枚，缩小后仍然有层次。
   钢琴那件同样画成金色三角钢琴 + 音符，和 SSS 的皇室金风格对得上。 */
let _goldIcoUid=0;
function royalTrackSVG(size){
  const s=Math.max(20,Math.round(size||48)),n='rt'+(_goldIcoUid++);
  return `<svg class="gold-ico" width="${s}" height="${s}" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${n}g" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stop-color="#fff9e6"/><stop offset=".2" stop-color="#f6df9c"/>
        <stop offset=".52" stop-color="#d6ac53"/><stop offset=".78" stop-color="#9a7423"/><stop offset="1" stop-color="#5c4514"/>
      </linearGradient>
      <linearGradient id="${n}l" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6b5217"/><stop offset=".28" stop-color="#3a2a0a"/>
        <stop offset=".62" stop-color="#1a1206"/><stop offset="1" stop-color="#4a3810"/>
      </linearGradient>
      <linearGradient id="${n}s" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff8e2" stop-opacity=".5"/>
        <stop offset=".38" stop-color="#ffe9ad" stop-opacity=".14"/>
        <stop offset="1" stop-color="#fff8e2" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="1.6" y="1.6" width="96.8" height="96.8" rx="17" fill="url(#${n}g)"/>
    <rect x="6.6" y="6.6" width="86.8" height="86.8" rx="12.6" stroke="#fff6d8" stroke-opacity=".85" stroke-width="1.5"/>
    <rect x="10.5" y="12.5" width="79" height="75" rx="7" fill="#160f05" stroke="#a37d28" stroke-width="1.6"/>
    <g fill="url(#${n}l)" stroke="#b8902f" stroke-width=".9">
      <rect x="13" y="15" width="16.7" height="70" rx="2.6"/>
      <rect x="32.1" y="15" width="16.7" height="70" rx="2.6"/>
      <rect x="51.2" y="15" width="16.7" height="70" rx="2.6"/>
      <rect x="70.3" y="15" width="16.7" height="70" rx="2.6"/>
    </g>
    <g stroke="url(#${n}g)" stroke-width="2" stroke-linecap="round">
      <path d="M31.2 15.5V84.5"/><path d="M50.3 15.5V84.5"/><path d="M69.4 15.5V84.5"/>
    </g>
    <g stroke="#fff6d8" stroke-opacity=".7" stroke-width=".7">
      <path d="M29.6 16V84"/><path d="M48.7 16V84"/><path d="M67.8 16V84"/>
    </g>
    <g>
      <path d="M31.2 24.6l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M31.2 27.2l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
      <path d="M50.3 24.6l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M50.3 27.2l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
      <path d="M69.4 24.6l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M69.4 27.2l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
      <path d="M31.2 45.8l4.8 4.8-4.8 4.8-4.8-4.8z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".55" stroke-width=".4"/><path d="M31.2 48.6l2 2-2 2-2-2z" fill="#fffdf2"/>
      <path d="M50.3 45.8l4.8 4.8-4.8 4.8-4.8-4.8z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".55" stroke-width=".4"/><path d="M50.3 48.6l2 2-2 2-2-2z" fill="#fffdf2"/>
      <path d="M69.4 45.8l4.8 4.8-4.8 4.8-4.8-4.8z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".55" stroke-width=".4"/><path d="M69.4 48.6l2 2-2 2-2-2z" fill="#fffdf2"/>
      <path d="M31.2 67.1l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M31.2 69.7l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
      <path d="M50.3 67.1l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M50.3 69.7l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
      <path d="M69.4 67.1l3.9 3.9-3.9 3.9-3.9-3.9z" fill="url(#${n}g)" stroke="#fff6d8" stroke-opacity=".5" stroke-width=".4"/><path d="M69.4 69.7l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#fffdf2"/>
    </g>
    <rect x="12.6" y="12.6" width="74.8" height="3" rx="1.5" fill="url(#${n}g)"/>
    <rect x="12.6" y="84.4" width="74.8" height="3" rx="1.5" fill="url(#${n}g)"/>
    <g fill="#fff6d8" fill-opacity=".85">
      <circle cx="18" cy="14.1" r=".8"/><circle cx="26" cy="14.1" r=".8"/><circle cx="34" cy="14.1" r=".8"/>
      <circle cx="42" cy="14.1" r=".8"/><circle cx="50" cy="14.1" r=".8"/><circle cx="58" cy="14.1" r=".8"/>
      <circle cx="66" cy="14.1" r=".8"/><circle cx="74" cy="14.1" r=".8"/><circle cx="82" cy="14.1" r=".8"/>
    </g>
    <rect x="10.5" y="12.5" width="79" height="75" rx="7" fill="url(#${n}s)"/>
  </svg>`;
}
function pianoBGMThumb(size){
  const s=Math.max(20,Math.round(size||48)),n='pb'+(_goldIcoUid++);
  return `<svg class="gold-ico" width="${s}" height="${s}" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${n}g" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stop-color="#fff9e6"/><stop offset=".22" stop-color="#f6df9c"/>
        <stop offset=".55" stop-color="#d0a64c"/><stop offset=".8" stop-color="#9a7423"/><stop offset="1" stop-color="#5c4514"/>
      </linearGradient>
      <linearGradient id="${n}d" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1b1306"/><stop offset="1" stop-color="#080602"/>
      </linearGradient>
      <linearGradient id="${n}i" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fffdf4"/><stop offset="1" stop-color="#e6d7b0"/>
      </linearGradient>
      <linearGradient id="${n}s" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff8e2" stop-opacity=".36"/><stop offset=".5" stop-color="#fff8e2" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="95" height="95" rx="16" fill="url(#${n}g)"/>
    <rect x="6.6" y="6.6" width="86.8" height="86.8" rx="12.6" stroke="#fff4cd" stroke-opacity=".72" stroke-width="1.3"/>
    <rect x="10" y="10" width="80" height="80" rx="10" fill="url(#${n}d)"/>
    <g fill="url(#${n}g)" stroke="#fff4cd" stroke-width=".7" stroke-linejoin="round">
      <path d="M27 65V45c0-8 6.4-14 14.6-14h15.6C69.4 31 79 39.6 79 51v14H27z"/>
    </g>
    <path d="M32 63V47c0-6 4.6-10.6 11-10.6h13.4C66 36.4 74 43 74 52v11H32z" fill="#120c04" stroke="url(#${n}g)" stroke-width="1"/>
    <path d="M36 44c6-4.6 14-5.4 21-2.2 5 2.2 8 6 7.4 10.6" stroke="url(#${n}g)" stroke-width="1.4" stroke-linecap="round" fill="none" stroke-opacity=".85"/>
    <rect x="25" y="63" width="54" height="11" rx="1.6" fill="url(#${n}i)" stroke="#b8862a" stroke-width=".9"/>
    <g fill="#241a08">
      <rect x="30" y="63" width="2.4" height="6.2"/><rect x="37" y="63" width="2.4" height="6.2"/>
      <rect x="44" y="63" width="2.4" height="6.2"/><rect x="51" y="63" width="2.4" height="6.2"/>
      <rect x="58" y="63" width="2.4" height="6.2"/><rect x="65" y="63" width="2.4" height="6.2"/>
      <rect x="72" y="63" width="2.4" height="6.2"/>
    </g>
    <g stroke="url(#${n}g)" stroke-width="3" stroke-linecap="round">
      <path d="M30 74.6V86"/><path d="M52 74.6V88"/><path d="M74 74.6V86"/>
    </g>
    <g fill="url(#${n}g)">
      <ellipse cx="35" cy="23" rx="5.4" ry="4.2" transform="rotate(-18 35 23)"/>
      <rect x="39.4" y="9.5" width="2.4" height="13.6" rx="1.2"/>
      <path d="M41.8 9.6c5.4 1 8.6 3.6 8 9.4-1.6-3.8-4.2-5.6-8-6.2z"/>
      <ellipse cx="57" cy="18" rx="4.2" ry="3.3" transform="rotate(-18 57 18)"/>
      <rect x="60.4" y="7.4" width="2" height="10.6" rx="1"/>
    </g>
    <rect x="10" y="10" width="80" height="80" rx="10" fill="url(#${n}s)"/>
  </svg>`;
}
function trackSkinThumb(i){
  /* 黄金奢华轨道不套通用渐变，直接用那枚鎏金轨道图标 */
  if(Number(i)===20)return royalTrackSVG(48);
  const sk=TRACK_SKINS[i];if(!sk)return '';
  const a='rgb('+sk.a[0]+','+sk.a[1]+','+sk.a[2]+')';
  const b=sk.b?('rgb('+sk.b[0]+','+sk.b[1]+','+sk.b[2]+')'):a;
  return `<span class="dr-thumb track" style="background:linear-gradient(180deg,${a},${b})"></span>`;
}
function noteSkinThumb(i){
  const sk=NOTE_SKINS[i];if(!sk)return '';
  const cap=(sk.hold&&sk.hold.cap)?sk.hold.cap[0]:'#8ec9ff';
  const edge=(sk.hold&&sk.hold.edge)?sk.hold.edge:'#8ec9ff';
  return `<span class="dr-thumb note" style="background:${cap};border-color:${edge}"></span>`;
}
function renderStore(){
  const cur=$('#storeCur');if(cur)cur.textContent=account.currency;
  const cur3=$('#storeCur3');if(cur3)cur3.textContent=account.currency;
  const svgA=$('.s-cur-svg');if(svgA)svgA.innerHTML=starSVG(16);
  const svgC=$('.sbr-svg');if(svgC)svgC.innerHTML=starSVG(14);
  const ownNote=$('#storeOwnNote');if(ownNote)ownNote.textContent=account.unlockedNote.filter(i=>i>=1&&i<NOTE_SKINS.length).length+'/'+(NOTE_SKINS.length-1);
  const ownTrack=$('#storeOwnTrack');if(ownTrack)ownTrack.textContent=account.unlockedTrack.filter(i=>i>=1&&i<20).length+'/19';
  const oPhone=$('#storeOwnPhone');if(oPhone)oPhone.textContent=account.phone?'OWNED':'—';
  const oLobby=$('#storeOwnLobby');if(oLobby)oLobby.textContent=account.lobby?'OWNED':'—';
  const oScenery=$('#storeOwnScenery');if(oScenery)oScenery.textContent=account.scenery?'OWNED':'—';
  const oPhoneui=$('#storeOwnPhoneui');if(oPhoneui)oPhoneui.textContent=account.phoneui?'OWNED':'—';
  const oPiano=$('#storeOwnPiano');if(oPiano)oPiano.textContent=account.lobbyMusic?'OWNED':'—';
  /* 展台的两枚金色图标由 SVG 画（只填一次，重复渲染不重建） */
  const rtIco=$('.sc-ico.royal-track');if(rtIco&&!rtIco.dataset.filled){rtIco.innerHTML=royalTrackSVG(74);rtIco.dataset.filled='1';}
  const pbIco=$('#scIcoPiano');if(pbIco&&!pbIco.dataset.filled){pbIco.innerHTML=pianoBGMThumb(74);pbIco.dataset.filled='1';}
  const oRTrack=$('#storeOwnRoyalTrack');if(oRTrack)oRTrack.textContent=isTrackUnlocked(20)?'OWNED':'—';
  const bOne=$('#btnDrawOne');if(bOne)bOne.innerHTML='单抽 <span>'+STAR_COST_ONE+'</span>'+starSVG(14);
  const bTen=$('#btnDrawTen');if(bTen)bTen.innerHTML='十连抽 <span>'+STAR_COST_TEN+'</span>'+starSVG(14);
  renderPrizeDetail();
}
function prizeTierName(t){return {SSS:'SSS 级',S:'S 级',A:'A 级',B:'B 级'}[t]||t;}
function renderPrizeDetail(){
  const body=$('#prizeModalBody');if(!body)return;
  const pool=buildPrizePool();
  const tiers=['SSS','S','A','B'];
  let html='';
  for(const t of tiers){
    const items=pool.filter(p=>p.tier===t);
    const meta=TIER_LIGHT[t];
    html+=`<div class="pm-tier"><div class="pm-tier-h"><b class="pm-tag tier-${t.toLowerCase()}" style="color:${t==='SSS'?'#fff':meta.css}">${t}</b><span>${prizeTierName(t)}</span><em>概率 ${(items.reduce((s,p)=>s+p.p,0)*100).toFixed(t==='A'?1:2)}%</em></div>`;
    html+=`<div class="pm-grid">`;
    for(const p of items){
      const owned=p.owned();
      let ico='';
      if(p.kind==='currency')ico=starSVG(26);
      else if(p.kind==='note')ico=noteSkinThumb(p.skinIndex);
      else if(p.kind==='track')ico=trackSkinThumb(p.skinIndex);
      else if(p.kind==='phone')ico='<span class="pm-ico phone"></span>';
      else if(p.kind==='lobby')ico='<span class="pm-ico lobby"></span>';
      else if(p.kind==='scenery')ico='<span class="pm-ico scenery"></span>';
      else if(p.kind==='phoneui')ico='<span class="pm-ico phoneui"></span>';
      else if(p.kind==='lobbymusic')ico=pianoBGMThumb(40);
      html+=`<div class="pm-item ${owned?'owned':''}">
        <div class="pm-ico-wrap">${ico}</div>
        <div class="pm-name">${esc(p.name)}</div>
        <div class="pm-desc">${esc(p.desc)}</div>
        <div class="pm-own">${owned?'已拥有':'未拥有'}</div>
      </div>`;
    }
    html+=`</div></div>`;
  }
  body.innerHTML=html;
}

/* ---- 抽奖 ------------------------------------------------------------------ */
function doDraw(ten){
  const cost=ten?STAR_COST_TEN:STAR_COST_ONE;
  if(account.currency<cost){
    flashStoreInsufficient();
    return;
  }
  account.currency-=cost;
  royalSfx('tap');
  const raw=ten?rollTen():[rollOnce()];
  const items=raw.map(p=>{const g=grantPrize(p);return {prize:p,dup:g.dup,amount:g.amount};});
  saveAccount();
  renderStore();
  playDrawAnimation(items,ten);
}
function flashStoreInsufficient(){
  const el=$('#storeCur');if(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');}
  const rb=$('#storeBalanceRed');if(rb){rb.classList.remove('shake');void rb.offsetWidth;rb.classList.add('shake');}
  uiSound(.6);
}
let drawRaf=0;
function playDrawAnimation(items,ten){
  const overlay=$('#drawOverlay');if(!overlay)return;
  const reveal=$('#drawReveal');
  overlay.classList.add('active');overlay.classList.remove('flash');
  reveal.classList.remove('show');reveal.innerHTML='';
  const tiers=['B','A','S','SSS'];
  let top='B';
  for(const it of items){if(tiers.indexOf(it.prize.tier)>tiers.indexOf(top))top=it.prize.tier;}
  const cv=$('#drawCanvas');
  if(cv){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=Math.floor((window.innerWidth||800)*dpr);
    cv.height=Math.floor((window.innerHeight||600)*dpr);
  }
  cancelAnimationFrame(drawRaf);
  royalSfx('spin');
  const t0=performance.now(),DUR=1500;
  const step=now=>{
    const k=clamp((now-t0)/DUR,0,1);
    if(cv)drawDrawLight(cv,k,top);
    if(k<1){drawRaf=requestAnimationFrame(step);}
    else{
      /* 揭晓前那道白屏：CSS 里是暖白淡入淡出（不再是瞬闪纯白），
         所以先亮 430ms 再让结果淡进来，600ms 后把遮罩层撤掉。 */
      overlay.classList.add('flash');
      royalSfx(top==='SSS'?'sss':'reveal');
      setTimeout(()=>showDrawReveal(items,ten),430);
      setTimeout(()=>overlay.classList.remove('flash'),700);
    }
  };
  drawRaf=requestAnimationFrame(step);
}
function drawDrawLight(cv,k,tier){
  const c=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx=W/2,cy=H/2;
  c.clearRect(0,0,W,H);
  const T=TIER_LIGHT[tier]||TIER_LIGHT.B;
  const rainbow=!!T.rainbow;
  const TAU=Math.PI*2;
  const x=W*1.06-k*(W*1.14);
  const hue0=(k*320)%360;
  const glow=a=>rainbow?('hsla('+hue0+',100%,78%,'+a+')'):hexa(T.css,a);
  c.globalCompositeOperation='lighter';

  /* 0 · 整屏柔光底座 */
  const halo=c.createRadialGradient(x,cy,0,x,cy,W*.52);
  halo.addColorStop(0,glow(.16));halo.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=halo;c.beginPath();c.arc(x,cy,W*.52,0,TAU);c.fill();

  /* 1 · 能量彗尾：由远及近放大的一串光球 */
  const L=W*.46,N=64;
  for(let i=0;i<N;i++){
    const u=i/N;
    const px=x-L*u;
    const fade=Math.pow(1-u,1.7);
    const r=3+54*Math.pow(1-u,1.12);
    const hue=(k*340+u*220)%360;
    const col=rainbow?('hsla('+hue+',100%,74%,'+(fade*.55).toFixed(3)+')'):hexa(T.css,fade*.46);
    const g=c.createRadialGradient(px,cy,0,px,cy,r);
    g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.beginPath();c.arc(px,cy,r,0,TAU);c.fill();
  }

  /* 2 · 旋转放射光芒：绕头部的星芒束 */
  c.save();c.translate(x,cy);c.rotate(k*2.4);
  const rays=11;
  for(let i=0;i<rays;i++){
    c.rotate(TAU/rays);
    const len=W*.3*(.5+.5*Math.sin(k*6+i*2.1));
    const wA=3.4+5.5*Math.abs(Math.sin(k*5+i*1.7));
    const hueR=(k*300+i*40)%360;
    const g=c.createLinearGradient(20,0,len,0);
    g.addColorStop(0,rainbow?('hsla('+hueR+',100%,90%,.95)'):hexa(T.css,.9));
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;
    c.beginPath();c.moveTo(18,0);c.lineTo(len,-wA);c.lineTo(len,wA);c.closePath();c.fill();
  }
  c.restore();

  /* 3 · 白热核心 + 呼吸色环 */
  const head=rainbow?('hsla('+hue0+',100%,82%,1)'):hexa(T.css,1);
  const hg=c.createRadialGradient(x,cy,0,x,cy,34);
  hg.addColorStop(0,'rgba(255,255,255,.98)');
  hg.addColorStop(.3,head);
  hg.addColorStop(.62,glow(.4));
  hg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=hg;c.beginPath();c.arc(x,cy,34,0,TAU);c.fill();
  c.strokeStyle=glow(.7);c.lineWidth=2.4;
  c.beginPath();c.arc(x,cy,30+5*Math.sin(k*8),0,TAU);c.stroke();

  /* 4 · 纵向镜头光斑：主光 + 两条细副光 */
  const bh=H*.74,by0=cy-bh/2;
  const bcol=glow(.6);
  const bg=c.createLinearGradient(0,by0,0,by0+bh);
  bg.addColorStop(0,'rgba(0,0,0,0)');bg.addColorStop(.5,bcol);bg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=bg;
  c.beginPath();
  c.moveTo(x,by0);
  c.quadraticCurveTo(x+11,cy,x,by0+bh);
  c.quadraticCurveTo(x-11,cy,x,by0);
  c.closePath();c.fill();
  for(const off of [-1,1]){
    const xx=x+off*W*.018;
    const b2=c.createLinearGradient(0,cy-bh*.3,0,cy+bh*.3);
    b2.addColorStop(0,'rgba(0,0,0,0)');
    b2.addColorStop(.5,rainbow?('hsla('+((hue0+off*40)%360)+',100%,70%,.3)'):hexa(T.css,.28));
    b2.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=b2;
    c.beginPath();
    c.moveTo(xx,cy-bh*.3);
    c.quadraticCurveTo(xx+4,cy,xx,cy+bh*.3);
    c.quadraticCurveTo(xx-4,cy,xx,cy-bh*.3);
    c.closePath();c.fill();
  }

  /* 5 · 横向贯穿光带 */
  const bw=W*.5,bx0=x-bw/2;
  const hb=c.createLinearGradient(bx0,0,bx0+bw,0);
  hb.addColorStop(0,'rgba(0,0,0,0)');hb.addColorStop(.5,glow(.5));hb.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=hb;c.fillRect(bx0,cy-1.4,bw,2.8);

  /* 6 · 扩散冲击环 */
  for(let r=0;r<3;r++){
    const phase=(k*1.4+r/3)%1;
    const rr=phase*W*.42;
    const hueC=(k*300+r*60)%360;
    c.strokeStyle=rainbow?('hsla('+hueC+',100%,80%,'+((1-phase)*.5).toFixed(3)+')'):hexa(T.css,(1-phase)*.5);
    c.lineWidth=2+(1-phase)*4;
    c.beginPath();c.arc(x,cy,rr,0,TAU);c.stroke();
  }

  /* 7 · 星尘微粒（闪烁） */
  const rnd=n=>{const s=Math.sin(n)*43758.5453;return s-Math.floor(s);};
  for(let i=0;i<52;i++){
    const sx=x-W*.55*rnd(i*1.37);
    const sy=cy+(rnd(i*2.71)-.5)*H*.7;
    const tw=.5+.5*Math.sin(k*14+i*2.4);
    const sr=1+2.8*tw;
    const hueS=(k*300+i*37)%360;
    c.fillStyle=rainbow?('hsla('+hueS+',100%,85%,'+(tw*.9).toFixed(3)+')'):hexa(T.css,tw*.72);
    c.beginPath();c.arc(sx,sy,sr,0,TAU);c.fill();
  }

  /* 8 · 四芒星十字耀斑：头部忽大忽小的星芒十字 */
  const fs=30+11*Math.sin(k*9);
  c.save();c.translate(x,cy);c.rotate(k*.7);
  for(let q=0;q<2;q++){
    c.rotate(q?Math.PI/4:0);
    const fg=c.createLinearGradient(-fs,0,fs,0);
    fg.addColorStop(0,'rgba(0,0,0,0)');
    fg.addColorStop(.5,rainbow?('hsla('+hue0+',100%,90%,.85)'):hexa(T.css,.8));
    fg.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=fg;
    c.beginPath();c.moveTo(-fs,0);c.lineTo(0,-fs*.32);c.lineTo(fs,0);c.lineTo(0,fs*.32);c.closePath();c.fill();
  }
  c.restore();

  /* 9 · 环绕椭圆光环：两条细光环斜向绕转 */
  c.save();c.translate(x,cy);
  for(let q=0;q<2;q++){
    c.rotate(k*1.5+q*Math.PI/2);
    c.strokeStyle=glow(.45);
    c.lineWidth=1.6;
    c.beginPath();c.ellipse(0,0,42,14+4*Math.sin(k*7),0,0,TAU);c.stroke();
  }
  c.restore();

  /* 10 · 漂浮大光斑：柔和散景缓缓漂移 */
  for(let i=0;i<7;i++){
    const bx=x+Math.sin(k*2.1+i*2.7)*W*.26;
    const by=cy+Math.cos(k*1.7+i*2.1)*H*.28;
    const br=10+16*rnd(i*3.13);
    const ba=.08+.11*(.5+.5*Math.sin(k*6+i*1.9));
    const bcol=rainbow?('hsla('+((hue0+i*51)%360)+',100%,78%,'+ba.toFixed(3)+')'):hexa(T.css,ba);
    const bg2=c.createRadialGradient(bx,by,0,bx,by,br);
    bg2.addColorStop(0,bcol);bg2.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=bg2;c.beginPath();c.arc(bx,by,br,0,TAU);c.fill();
  }

  /* 11 · 火花飞溅：从头部螺旋甩出的细小亮星 */
  for(let i=0;i<24;i++){
    const ang=i/24*TAU + k*1.3;
    const d=(26+74*((i*.61)%1))*(.35+.65*k);
    const px2=x+Math.cos(ang)*d;
    const py2=cy+Math.sin(ang)*d*.62;
    const pr=1.1+2.2*((i*.61)%1);
    c.fillStyle=rainbow?('hsla('+((hue0+i*15)%360)+',100%,90%,.85)'):hexa(T.css,.7);
    c.beginPath();c.arc(px2,py2,pr,0,TAU);c.fill();
  }

  c.globalCompositeOperation='source-over';
}
function showDrawReveal(items,ten){
  const reveal=$('#drawReveal');if(!reveal)return;
  let html='<div class="dr-title"><i class="dr-crown"></i><span>'+(ten?'TEN DRAWS · 十连':'DRAW · 单抽')+'</span><i class="dr-crown"></i></div><div class="dr-grid'+(ten?' ten':'')+'">';
  for(const it of items){
    const p=it.prize,T=TIER_LIGHT[p.tier];
    let ico='',sub=p.desc||'';
    if(p.kind==='currency'){ico=starSVG(40);sub='苍穹星';}
    else if(p.kind==='note')ico=noteSkinThumb(p.skinIndex);
    else if(p.kind==='track')ico=trackSkinThumb(p.skinIndex);
    else if(p.kind==='phone')ico='<span class="dr-ico phone"></span>';
    else if(p.kind==='lobby')ico='<span class="dr-ico lobby"></span>';
    else if(p.kind==='scenery')ico='<span class="dr-ico scenery"></span>';
    else if(p.kind==='phoneui')ico='<span class="dr-ico phoneui"></span>';
    else if(p.kind==='lobbymusic')ico=pianoBGMThumb(48);
    html+=`<div class="dr-card tier-${p.tier.toLowerCase()}">
      <i class="dr-corner tl"></i><i class="dr-corner tr"></i><i class="dr-corner bl"></i><i class="dr-corner br"></i>
      <i class="dr-gem"></i>
      <div class="dr-glow" style="--glow:${p.tier==='SSS'?'#ffffff':T.css}"></div>
      <div class="dr-ico-wrap">${ico}</div>
      <div class="dr-name">${esc(p.name)}</div>
      <div class="dr-sub">${esc(sub)}</div>
      <div class="dr-tier" style="color:${p.tier==='SSS'?'#fff':T.css}">${p.tier}</div>
      ${it.dup?'<div class="dr-dup">已拥有 · 转化为 +'+it.amount+' 苍穹星</div>':''}
    </div>`;
  }
  html+='</div><button class="dr-confirm" id="drConfirm" type="button">CONFIRM</button>';
  reveal.innerHTML=html;
  reveal.classList.add('show');
  const c=$('#drConfirm');if(c)c.addEventListener('click',closeDrawOverlay);
}
function closeDrawOverlay(){
  const overlay=$('#drawOverlay');if(!overlay)return;
  overlay.classList.remove('active','flash');
  $('#drawReveal').classList.remove('show');
  cancelAnimationFrame(drawRaf);
  renderStore();
}

/* ---- 皮肤选择（约束到已解锁） ---------------------------------------------- */
function cycleTrackSkin(dir){
  const list=unlockedTrackList();
  let idx=list.indexOf(activeTrackSkin);if(idx<0)idx=0;
  idx=(idx+dir+list.length)%list.length;
  setTrackSkin(list[idx]);
  syncTrackSkinUI();renderSkinPreview();
}
function cycleNoteSkin(dir){
  const list=unlockedNoteList();
  let idx=list.indexOf(getNoteSkinIndex());if(idx<0)idx=0;
  idx=(idx+dir+list.length)%list.length;
  setNoteSkin(list[idx]);
  uiSound(1.3);
}

/* ---- 存档码：跨浏览器 / 跨设备迁移 -----------------------------------------
   v2：存档先压成紧凑 JSON（账号进短数组、解锁位压成位掩码、设置只存改动项），
   再用 deflate-raw 压缩、base64url 编码。出来的码比 v1 的裸 base64 短一大截，
   换了浏览器 / 换了手机只要粘这一串就能整份恢复（进度、苍穹星、皮肤、设置都带）。
   旧版 v1 的码仍然能导入，不丢老用户。 */
const SAVE_CODE_HEAD='WK';
function bitsFromList(list,maxBits){
  let m=0;const arr=Array.isArray(list)?list:[];
  for(const v of arr){const i=Math.floor(Number(v));if(i>=0&&i<maxBits)m|=(1<<i);}
  return m;
}
function listFromBits(m,maxBits){
  const out=[];const n=Math.floor(Number(m)||0);
  for(let i=0;i<maxBits;i++){if((n>>i)&1)out.push(i);}
  if(!out.includes(0))out.unshift(0);
  return out;
}
function compactSaveBlob(){
  const a=account||{};
  let flags=0;
  if(a.phone)flags|=1;
  if(a.lobby)flags|=2;
  if(a.scenery)flags|=4;
  if(a.phoneui)flags|=8;
  if(a.phoneOn)flags|=16;
  if(a.lobbyOn)flags|=32;
  if(a.sceneryOn)flags|=64;
  if(a.phoneuiOn)flags|=128;
  if(a.lobbyMusic)flags|=256;
  if(a.lobbyMusicOn)flags|=512;
  const s={};
  for(const k in DEFAULT_SETTINGS){if(settings[k]!==DEFAULT_SETTINGS[k])s[k]=settings[k];}
  const b={};
  for(const id in bestMap){
    const v=bestMap[id];if(!v)continue;
    b[id]=[v.score|0,Math.round((Number(v.acc)||0)*100)/100,v.ap?1:0,v.fc?1:0,v.combo|0,String(v.rank||'')];
  }
  return {v:3,
    a:[String(a.id||''),Math.max(0,Math.floor(Number(a.currency)||0)),
       bitsFromList(a.unlockedNote,16),bitsFromList(a.unlockedTrack,32),flags],
    b:b,s:s,c:(clears||{}),l:(likes||{}),
    u:user?[String(user.name||''),String(user.avatar||'')]:null,
    e:exUnlocked?1:0,d:devUnlockAll?1:0};
}
function bytesToB64u(u8){
  let s='';
  for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64uToBytes(txt){
  let s=String(txt).replace(/-/g,'+').replace(/_/g,'/').replace(/[^A-Za-z0-9+/]/g,'');
  while(s.length%4)s+='=';
  const bin=atob(s);
  const u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  return u8;
}
async function deflateBytes(u8){
  if(typeof CompressionStream!=='function')return null;
  try{
    const cs=new CompressionStream('deflate-raw');
    const buf=await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  }catch(e){return null;}
}
async function inflateBytes(u8,raw){
  if(typeof DecompressionStream!=='function')return null;
  try{
    const ds=new DecompressionStream(raw?'deflate-raw':'deflate');
    const buf=await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }catch(e){return null;}
}
async function exportSave(){
  try{
    const u8=new TextEncoder().encode(JSON.stringify(compactSaveBlob()));
    const z=await deflateBytes(u8);
    if(z&&z.length>0&&z.length<u8.length)return SAVE_CODE_HEAD+'3-'+bytesToB64u(z);
    return SAVE_CODE_HEAD+'1-'+bytesToB64u(u8);
  }catch(e){return '';}
}
async function decodeSaveCode(code){
  let s=String(code||'').replace(/\s+/g,'');
  if(!s)return null;
  const m=/^WK([123])-([\s\S]+)$/i.exec(s);
  if(m){
    try{
      const u8=b64uToBytes(m[2]);
      let plain=null;
      if(m[1]!=='1'){plain=await inflateBytes(u8,true);if(!plain)plain=await inflateBytes(u8,false);}
      else plain=u8;
      if(plain&&plain.length){
        const txt=new TextDecoder().decode(plain);
        return JSON.parse(txt);
      }
    }catch(e){}
    return null;
  }
  /* 旧版（v1）：裸 base64(JSON)；也接受直接粘 JSON */
  try{return JSON.parse(s);}catch(e){}
  try{return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))));}catch(e){}
  try{return JSON.parse(atob(s));}catch(e){}
  return null;
}
function applySaveBlob(obj){
  if(!obj||typeof obj!=='object')return false;
  /* v2 及更早的存档码是在 7 套按键皮肤（含冠冕/星冠）时期导出的，序号按老表重排；
     v3 起直接用新表的 5 套序号。 */
  const legacyNoteIdx=!(Number(obj.v)>=3);
  try{
    let acctSrc=null;
    if(Array.isArray(obj.a)){
      const a=obj.a,f=Number(a[4])||0;
      acctSrc={
        id:String(a[0]||''),
        currency:Number(a[1])||0,
        unlockedNote:listFromBits(a[2],16),
        unlockedTrack:listFromBits(a[3],32),
        phone:!!(f&1),lobby:!!(f&2),scenery:!!(f&4),phoneui:!!(f&8),
        phoneOn:!!(f&16),lobbyOn:!!(f&32),sceneryOn:!!(f&64),phoneuiOn:!!(f&128),
        lobbyMusic:!!(f&256),lobbyMusicOn:!!(f&512)
      };
    }else if(obj.account&&typeof obj.account==='object'){
      acctSrc=obj.account;
    }
    if(acctSrc){
      account=Object.assign(freshAccount(),acctSrc);
      if(!Array.isArray(account.unlockedNote))account.unlockedNote=[0];
      if(!Array.isArray(account.unlockedTrack))account.unlockedTrack=[0];
      if(legacyNoteIdx)account.unlockedNote=remapLegacyNoteList(account.unlockedNote);
      if(!account.unlockedNote.includes(0))account.unlockedNote.unshift(0);
      if(!account.unlockedTrack.includes(0))account.unlockedTrack.unshift(0);
      account.currency=Math.max(0,Math.floor(Number(account.currency)||0));
      saveAccount();
    }
    const bmSrc=(obj.b&&typeof obj.b==='object')?obj.b:((obj.bestMap&&typeof obj.bestMap==='object')?obj.bestMap:null);
    if(bmSrc){
      const next={};
      for(const id in bmSrc){
        const v=bmSrc[id];if(!v)continue;
        if(Array.isArray(v))next[id]={score:v[0]|0,acc:Number(v[1])||0,ap:!!v[2],fc:!!v[3],combo:v[4]|0,rank:String(v[5]||'—')};
        else if(typeof v==='object')next[id]=Object.assign(emptyBest(),v);
      }
      bestMap=next;
      try{localStorage.setItem(BEST_MAP_KEY,JSON.stringify(bestMap));}catch(e){}
    }
    const cSrc=(obj.c&&typeof obj.c==='object')?obj.c:((obj.clears&&typeof obj.clears==='object')?obj.clears:null);
    if(cSrc){clears=cSrc;saveClears();}
    const sSrc=(obj.s&&typeof obj.s==='object')?obj.s:((obj.settings&&typeof obj.settings==='object')?obj.settings:null);
    if(sSrc){
      settings=Object.assign({},DEFAULT_SETTINGS,sSrc);
      if(legacyNoteIdx&&sSrc.keySkin!==undefined)settings.keySkin=remapLegacyKeySkin(settings.keySkin);
      saveSettings();
    }
    const lSrc=(obj.l&&typeof obj.l==='object')?obj.l:((obj.likes&&typeof obj.likes==='object')?obj.likes:null);
    if(lSrc){likes=lSrc;saveLikes();}
    if(typeof obj.e==='number'||typeof obj.e==='boolean'){exUnlocked=!!obj.e;try{localStorage.setItem(EX_KEY,exUnlocked?'1':'0');}catch(e){}}
    else if(typeof obj.exUnlocked==='boolean'){exUnlocked=obj.exUnlocked;try{localStorage.setItem(EX_KEY,exUnlocked?'1':'0');}catch(e){}}
    if(typeof obj.d==='number'||typeof obj.d==='boolean'){devUnlockAll=!!obj.d;saveDevUnlock();}
    else if(typeof obj.devUnlockAll==='boolean'){devUnlockAll=obj.devUnlockAll;saveDevUnlock();}
    if(Array.isArray(obj.u)){
      user={name:String(obj.u[0]||'').trim().slice(0,10),avatar:String(obj.u[1]||'')};
      try{localStorage.setItem('welkin_os_user',JSON.stringify(user));}catch(e){}
    }else if(obj.user&&typeof obj.user==='object'){
      try{localStorage.setItem('welkin_os_user',JSON.stringify(obj.user));}catch(e){}
      user=readUser();
    }
    activeTrackSkin=isTrackUnlocked(settings.trackSkin)?settings.trackSkin:0;
    if(!isNoteUnlocked(settings.keySkin))settings.keySkin=0;
    saveSettings();
    try{localStorage.setItem(STORE_FLAG_KEY,'1');}catch(e){}
    applySkins();applyUnlocks();applySettings();
    return true;
  }catch(e){return false;}
}
async function importSave(code){
  if(!code)return false;
  const obj=await decodeSaveCode(code);
  return applySaveBlob(obj);
}

/* 存档码对话框：生成后直接把码摆出来并自动全选 + 尝试复制，手抄不了就长按复制。
   不依赖 prompt()（手机 webview 里 prompt 可能被拦、也可能不支持粘贴）。 */
let saveModalMode='export',saveModalCode='';
function openSaveModal(mode,code){
  const m=$('#saveModal');if(!m)return;
  saveModalMode=mode;
  saveModalCode=code||'';
  const kick=$('#saveModalKicker'),title=$('#saveModalTitle'),tip=$('#saveModalTip');
  const ta=$('#saveCodeArea'),meta=$('#saveModalMeta'),ok=$('#saveModalOk');
  if(!ta||!ok)return;
  if(mode==='export'){
    if(kick)kick.textContent='SAVE CODE · 跨设备存档码';
    if(title)title.textContent='存档码已生成';
    if(tip)tip.textContent='点 COPY 复制；没复制上的话，长按框里就是全选。到另一台设备打开 IMPORT 粘进来即可整份恢复。';
    ta.value=saveModalCode;
    ta.readOnly=true;
    ta.setAttribute('readonly','readonly');
    if(meta)meta.textContent='共 '+saveModalCode.length+' 个字符 · 含进度 / 苍穹星 / 皮肤 / 设置';
    ok.textContent='COPY';
  }else{
    if(kick)kick.textContent='SAVE CODE · 恢复存档';
    if(title)title.textContent='粘贴存档码';
    if(tip)tip.textContent='把在别的浏览器 / 设备上 EXPORT 出来的那串码整段粘进来，空格换行都不用管。恢复会覆盖当前进度。';
    ta.value='';
    ta.readOnly=false;
    ta.removeAttribute('readonly');
    if(meta)meta.textContent='支持新旧两种存档码';
    ok.textContent='RESTORE';
  }
  m.classList.add('active');
  setTimeout(()=>{
    try{
      ta.focus();
      if(mode==='export'){ta.select();ta.setSelectionRange(0,ta.value.length);}
    }catch(e){}
  },60);
}
function closeSaveModal(){
  const m=$('#saveModal');if(!m)return;
  m.classList.remove('active');
  const ta=$('#saveCodeArea');if(ta&&saveModalMode==='export')ta.blur();
}
async function copyTextSmart(text){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){}
  try{
    const ta=$('#saveCodeArea');
    if(!ta)return false;
    const wasReadonly=ta.readOnly;
    ta.readOnly=false;
    ta.focus();ta.select();ta.setSelectionRange(0,text.length);
    const ok=document.execCommand('copy');
    ta.readOnly=wasReadonly;
    return !!ok;
  }catch(e){return false;}
}

ensureAccount();

/* ============================================================
   2. time / weather
   ============================================================ */
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const weather={code:0,temp:22,isDay:true,city:'LOCAL SECTOR',label:'CLEAR',live:false,updated:0};
let nowDate=new Date();
let hourFloat=nowDate.getHours()+nowDate.getMinutes()/60+nowDate.getSeconds()/3600;

let batteryLevel=.86,batteryCharging=false;
function updateBattery(){
  const pct=Math.round(clamp(batteryLevel,0,1)*100);
  const fill=$('#battFill'),txt=$('#battPct');
  if(fill)fill.style.width=pct+'%';
  if(txt)txt.textContent=pct+'%';
}
function initBattery(){
  updateBattery();
  if(!navigator.getBattery)return;
  navigator.getBattery().then(b=>{
    batteryLevel=Number(b.level);
    batteryCharging=!!b.charging;
    updateBattery();
    b.addEventListener('levelchange',()=>{batteryLevel=Number(b.level);updateBattery();});
    b.addEventListener('chargingchange',()=>{batteryCharging=!!b.charging;updateBattery();});
  }).catch(()=>{});
}
function updateCalendar(){
  const mo=$('#calMonth'),dy=$('#calDay'),dw=$('#calDow'),yr=$('#calYear');
  if(mo)mo.textContent=MONTHS[nowDate.getMonth()];
  if(dy)dy.textContent=String(nowDate.getDate()).padStart(2,'0');
  if(dw)dw.textContent=DOW[nowDate.getDay()];
  if(yr)yr.textContent=String(nowDate.getFullYear());
}
function updateTime(){
  nowDate=new Date();
  hourFloat=nowDate.getHours()+nowDate.getMinutes()/60+nowDate.getSeconds()/3600;
  const hh=String(nowDate.getHours()).padStart(2,'0');
  const mm=String(nowDate.getMinutes()).padStart(2,'0');
  $('#pwTime').textContent=hh+':'+mm;
  updateCalendar();
}
setInterval(updateTime,1000);

const WEATHER_LABEL={0:'CLEAR',1:'MOSTLY CLEAR',2:'PARTLY CLOUDY',3:'OVERCAST',45:'FOG',48:'RIME FOG',51:'LIGHT DRIZZLE',53:'DRIZZLE',55:'HEAVY DRIZZLE',61:'LIGHT RAIN',63:'RAIN',65:'HEAVY RAIN',66:'FREEZING RAIN',67:'FREEZING RAIN',71:'LIGHT SNOW',73:'SNOW',75:'HEAVY SNOW',77:'SNOW GRAINS',80:'SHOWERS',81:'SHOWERS',82:'VIOLENT SHOWERS',85:'SNOW SHOWERS',86:'SNOW SHOWERS',95:'THUNDERSTORM',96:'THUNDERSTORM',99:'THUNDERSTORM'};
function weatherKind(code){
  if(code===0)return 'clear';
  if(code<=3)return 'cloud';
  if(code===45||code===48)return 'fog';
  if(code>=51&&code<=67)return 'rain';
  if(code>=71&&code<=77)return 'snow';
  if(code>=80&&code<=82)return 'rain';
  if(code>=85&&code<=86)return 'snow';
  if(code>=95)return 'storm';
  return 'clear';
}
function weatherSVG(code,isDay){
  const k=weatherKind(code);
  const c='currentColor';
  if(k==='clear'){
    if(!isDay)return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M40 14a20 20 0 1 0 10 34 16 16 0 0 1-10-34Z" fill="rgba(180,240,255,.12)"/><circle cx="18" cy="18" r="1.2" fill="${c}"/><circle cx="28" cy="10" r="1" fill="${c}"/><circle cx="12" cy="30" r="1" fill="${c}"/></svg>`;
    return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><circle cx="32" cy="32" r="11" fill="rgba(255,210,120,.2)"/><path d="M32 6v6M32 52v6M6 32h6M52 32h6M13.6 13.6l4.2 4.2M46.2 46.2l4.2 4.2M50.4 13.6l-4.2 4.2M17.8 46.2l-4.2 4.2"/></svg>`;
  }
  if(k==='cloud')return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M18 44h30a10 10 0 0 0 0-20 14 14 0 0 0-26-4 9 9 0 0 0-4 24Z" fill="rgba(180,220,255,.12)"/></svg>`;
  if(k==='fog')return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M12 24h40M8 34h48M14 44h36M20 54h24"/></svg>`;
  if(k==='snow')return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M18 40h30a9 9 0 0 0 0-18 14 14 0 0 0-26-4 8 8 0 0 0-4 22Z" fill="rgba(200,240,255,.12)"/><circle cx="22" cy="50" r="2"/><circle cx="32" cy="54" r="2"/><circle cx="42" cy="50" r="2"/></svg>`;
  if(k==='storm')return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M18 34h30a9 9 0 0 0 0-18 14 14 0 0 0-26-4 8 8 0 0 0-4 22Z" fill="rgba(200,220,255,.12)"/><path d="M34 36l-6 12h8l-4 12 12-16h-8l6-8Z" fill="rgba(255,220,120,.55)" stroke="none"/></svg>`;
  return `<svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2"><path d="M18 36h30a9 9 0 0 0 0-18 14 14 0 0 0-26-4 8 8 0 0 0-4 22Z" fill="rgba(180,220,255,.12)"/><path d="M20 46l-3 8M31 46l-3 8M42 46l-3 8"/></svg>`;
}
function applyWeather(){
  weather.label=WEATHER_LABEL[weather.code]||'CLEAR';
  $('#pwTemp').textContent=Math.round(weather.temp)+'°';
  $('#pwCond').textContent=weather.label;
  $('#weatherIcon').innerHTML=weatherSVG(weather.code,weather.isDay);
}
function syntheticWeather(){
  const d=nowDate;
  const season=Math.cos((d.getMonth()+1)/12*Math.PI*2);
  const base=18-season*9;
  weather.temp=Math.round(base+Math.sin(hourFloat/24*Math.PI*2)*5);
  weather.code=Math.abs(Math.sin(d.getDate()*3.7))>0.82?61:0;
  weather.isDay=hourFloat>=6.2&&hourFloat<18.3;
  weather.live=false;
  weather.city=(Intl.DateTimeFormat().resolvedOptions().timeZone||'LOCAL').split('/').pop().replace(/_/g,' ');
  applyWeather();
}
function loadWeather(){
  syntheticWeather();
  const geo=new Promise(res=>{
    if(!navigator.geolocation){res(null);return;}
    let done=false;
    const t=setTimeout(()=>{if(!done){done=true;res(null);}},4500);
    navigator.geolocation.getCurrentPosition(p=>{if(!done){done=true;clearTimeout(t);res(p.coords);}},()=>{if(!done){done=true;clearTimeout(t);res(null);}},{timeout:4000,maximumAge:900000});
  });
  geo.then(pos=>{
    if(!window.fetch){weather.live=false;return;}
    const lat=pos?pos.latitude:31.2304;
    const lon=pos?pos.longitude:121.4737;
    const url='https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lon.toFixed(3)+'&current=temperature_2m,weather_code,is_day&timezone=auto';
    return fetch(url).then(r=>{if(!r.ok)throw new Error('http');return r.json();}).then(j=>{
      const c=j.current||{};
      weather.temp=Number(c.temperature_2m);
      weather.code=Number(c.weather_code)||0;
      weather.isDay=!!c.is_day;
      weather.live=true;
      weather.city=pos?'LOCAL SECTOR':((Intl.DateTimeFormat().resolvedOptions().timeZone||'local').split('/').pop().replace(/_/g,' ')||'LOCAL');
      weather.updated=Date.now();
    }).catch(()=>{weather.live=false;});
  }).then(()=>applyWeather());
}
setInterval(()=>{if(Date.now()-weather.updated>1800000)loadWeather();},600000);

/* ============================================================
   3. futuristic city (window canvas)
   ============================================================ */
const city={w:0,h:0,dpr:1,buildings:[],stars:[],cars:[],rain:[],snow:[],t:0,last:0,flash:0,hue:0};
const CITY_RNG=(seed)=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};

function hexToRgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function rgbToCss(c,a){return 'rgba('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+','+a+')';}
function mixColor(a,b,t){const A=hexToRgb(a),B=hexToRgb(b);return [lerp(A[0],B[0],t),lerp(A[1],B[1],t),lerp(A[2],B[2],t)];}

function skyPalette(h){
  const stops=[
    {h:0,a:'#02040c',b:'#061527',sun:0,star:1,light:0},
    {h:4.8,a:'#040814',b:'#0a1a2c',sun:0,star:.85,light:0},
    {h:6.4,a:'#22143a',b:'#e08a6a',sun:.5,star:.16,light:.2},
    {h:8.2,a:'#4a9fc0',b:'#e8f8ff',sun:1,star:0,light:.14},
    {h:16.2,a:'#4697b8',b:'#e2f4fc',sun:1,star:0,light:.12},
    {h:18.4,a:'#2a1436',b:'#ff9a6a',sun:.7,star:.1,light:.3},
    {h:20.6,a:'#070a1c',b:'#0b1e33',sun:0,star:.75,light:.55},
    {h:24,a:'#02040c',b:'#061527',sun:0,star:1,light:.7}
  ];
  let i=0;while(i<stops.length-1&&h>stops[i+1].h)i++;
  const s=stops[i],n=stops[Math.min(i+1,stops.length-1)];
  const t=clamp((h-s.h)/Math.max(.001,n.h-s.h),0,1);
  const k=weatherKind(weather.code);
  let a=mixColor(s.a,n.a,t),b=mixColor(s.b,n.b,t);
  const toHex=arr=>'#'+arr.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
  if(k==='rain'||k==='storm'){
    a=mixColor(toHex(a),'#0a1420',.42);
    b=mixColor(toHex(b),'#28384a',.48);
  }else if(k==='cloud'){
    a=mixColor(toHex(a),'#9fb6c4',.16);
    b=mixColor(toHex(b),'#c3d5df',.18);
  }else if(k==='fog'){
    a=mixColor(toHex(a),'#1a2530',.5);
    b=mixColor(toHex(b),'#46545f',.52);
  }
  return {a,b,light:lerp(s.light,n.light,t),star:lerp(s.star,n.star,t)*(k==='cloud'||k==='rain'||k==='storm'?0.25:1),sun:lerp(s.sun,n.sun,t)};
}

function buildCity(){
  const rect=cityCanvas.getBoundingClientRect();
  const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
  const dpr=clamp(window.devicePixelRatio||1,1,Math.min(w,h)<820?(Math.min(w,h)>=700?1.15:1.25):2);
  city.w=w;city.h=h;city.dpr=dpr;
  cityCanvas.width=Math.round(w*dpr);cityCanvas.height=Math.round(h*dpr);
  cityCtx.setTransform(dpr,0,0,dpr,0,0);
  city.buildings=[];
  const layers=[
    {depth:0,min:.22,max:.52,alpha:.55,wmin:8,wmax:26,win:0.16},
    {depth:1,min:.34,max:.75,alpha:.78,wmin:14,wmax:42,win:0.22},
    {depth:2,min:.16,max:.42,alpha:1,wmin:28,wmax:74,win:0.1}
  ];
  for(let L=0;L<3;L++){
    const cfg=layers[L],rnd=CITY_RNG(97+L*311),arr=[];
    let x=-30;
    while(x<w+30){
      const bw=lerp(cfg.wmin,cfg.wmax,rnd());
      const bh=lerp(h*cfg.min,h*cfg.max,rnd());
      const b={x,w:bw,h:bh,top:h-bh,alpha:cfg.alpha,seed:rnd()*9999,lit:[],neon:rnd()<.22,spire:rnd()<.28,L,holo:rnd()<.26,holoSeed:rnd()*6.28};
      const cols=Math.max(1,Math.floor(bw/7)),rows=Math.max(1,Math.floor(bh/10));
      for(let i=0;i<cols*rows;i++)b.lit.push(rnd()<cfg.win);
      arr.push(b);
      x+=bw+lerp(3,18,rnd());
    }
    city.buildings.push(arr);
  }
  city.stars=[];
  const stars=Math.round(clamp(w*h/4200,30,110));
  for(let i=0;i<stars;i++)city.stars.push({x:Math.random()*w,y:Math.random()*h*.55,r:Math.random()*1.2+.2,p:Math.random()*6.28});
  city.cars=[];
  for(let i=0;i<12;i++)city.cars.push({x:Math.random()*w,y:h*(.1+Math.random()*.34),sp:(Math.random()>.5?1:-1)*(8+Math.random()*26),s:1+Math.random()*2,len:10+Math.random()*24,c:Math.random()>.5?'#7fe6ff':(Math.random()>.5?'#ffc06a':'#ff7fb8')});
  city.drones=[];
  for(let i=0;i<7;i++)city.drones.push({x:Math.random()*w,y:h*(.1+Math.random()*.24),sp:(Math.random()>.5?1:-1)*(6+Math.random()*14),ph:Math.random()*6.28,s:1.1+Math.random()*1.1});
  city.tethers=[{x:.12,ph:0},{x:.87,ph:2.4},{x:.66,ph:4.6}];
  city.rain=[];city.snow=[];
  for(let i=0;i<120;i++)city.rain.push({x:Math.random()*w,y:Math.random()*h,l:6+Math.random()*14,sp:140+Math.random()*220});
  for(let i=0;i<60;i++)city.snow.push({x:Math.random()*w,y:Math.random()*h,r:.8+Math.random()*1.8,sp:8+Math.random()*22,p:Math.random()*6.28});
}

function drawWindowCity(ts){
  const w=city.w||cityCanvas.clientWidth,h=city.h||cityCanvas.clientHeight;
  if(!w||!h)return;
  const ctx=cityCtx;
  const pal=skyPalette(hourFloat);
  const kind=weatherKind(weather.code);
  city.t+=.016;

  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,rgbToCss(pal.a,1));
  sky.addColorStop(.62,rgbToCss(mixColor('#'+pal.a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),'#'+pal.b.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),.7),1));
  sky.addColorStop(1,rgbToCss(pal.b,1));
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);

  // daylight horizon glow behind the skyline
  if(pal.light>.05){
    const hg=ctx.createLinearGradient(0,h*.42,0,h*.92);
    hg.addColorStop(0,'rgba(210,245,255,0)');
    hg.addColorStop(.65,'rgba(205,242,255,'+(.2*pal.light).toFixed(3)+')');
    hg.addColorStop(1,'rgba(225,250,255,'+(.34*pal.light).toFixed(3)+')');
    ctx.fillStyle=hg;ctx.fillRect(0,h*.42,w,h*.5);
  }

  // stars
  if(pal.star>0.02){
    for(const s of city.stars){
      const tw=.55+.45*Math.sin(city.t*1.6+s.p);
      ctx.fillStyle='rgba(180,235,255,'+(pal.star*tw*.8).toFixed(3)+')';
      ctx.fillRect(s.x,s.y,s.r,s.r);
    }
  }

  // sun / moon
  const sunX=w*((hourFloat-6)/12);
  const sunY=h*.62-Math.sin(clamp((hourFloat-6)/12,0,1)*Math.PI)*h*.38;
  if(pal.sun>0.02&&sunX>-40&&sunX<w+40){
    const g=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,h*.42);
    g.addColorStop(0,'rgba(255,240,200,'+(.75*pal.sun)+')');
    g.addColorStop(.22,'rgba(255,200,140,'+(.3*pal.sun)+')');
    g.addColorStop(1,'rgba(255,140,90,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(sunX,sunY,h*.42,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,250,230,'+(.95*pal.sun)+')';
    ctx.beginPath();ctx.arc(sunX,sunY,h*.042,0,Math.PI*2);ctx.fill();
  }
  if(pal.star>.4){
    const mx=w*.78,my=h*.2;
    const g=ctx.createRadialGradient(mx,my,0,mx,my,h*.22);
    g.addColorStop(0,'rgba(190,240,255,.35)');
    g.addColorStop(1,'rgba(120,200,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(mx,my,h*.22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(220,250,255,.92)';
    ctx.beginPath();ctx.arc(mx,my,h*.042,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(120,190,230,.35)';
    ctx.beginPath();ctx.arc(mx-h*.014,my+h*.008,h*.009,0,Math.PI*2);ctx.fill();
  }

  // hologram ring in the sky
  ctx.save();
  ctx.translate(w*.2,h*.2);
  ctx.rotate(-.18);
  ctx.strokeStyle='rgba(34,228,255,.18)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(0,0,w*.17,h*.055,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(34,228,255,.08)';
  ctx.beginPath();ctx.ellipse(0,0,w*.17+8,h*.055+4,0,0,Math.PI*2);ctx.stroke();
  ctx.restore();

  // orbital tether lifts / space-elevator cables
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(const t of city.tethers){
    const x=w*t.x;
    const tg=ctx.createLinearGradient(0,0,0,h*.58);
    tg.addColorStop(0,'rgba(120,235,255,.28)');
    tg.addColorStop(.55,'rgba(120,235,255,.09)');
    tg.addColorStop(1,'rgba(120,235,255,0)');
    ctx.strokeStyle=tg;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h*.58);ctx.stroke();
    for(let k=1;k<=5;k++){
      const ry=h*(.05+k*.085);
      ctx.strokeStyle='rgba(130,240,255,'+(.2-k*.025)+')';
      ctx.beginPath();ctx.ellipse(x,ry,7,1.8,0,0,Math.PI*2);ctx.stroke();
    }
    const cy=((city.t*.022+t.ph)%1)*h*.5;
    ctx.fillStyle='rgba(170,250,255,.92)';ctx.fillRect(x-2,cy,4,11);
    ctx.fillStyle='rgba(255,120,190,.8)';ctx.fillRect(x-1,cy+11,2,2);
  }
  ctx.restore();

  // clouds
  const cloudAlpha=kind==='cloud'||kind==='rain'||kind==='storm'||kind==='snow'?0.22:(kind==='fog'?0.3:0.07);
  ctx.save();
  ctx.fillStyle='rgba(190,220,240,'+cloudAlpha+')';
  for(let i=0;i<4;i++){
    const cx=((i*31+city.t*3)%120-10)/100*w;
    const cy=h*(.12+i*.08);
    ctx.beginPath();ctx.ellipse(cx,cy,w*.16,h*.035,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+w*.07,cy-h*.01,w*.1,h*.028,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();

  // buildings
  for(let L=0;L<city.buildings.length;L++){
    const arr=city.buildings[L];
    for(const b of arr){
      const base=pal.light>0.35?'#03070d':'#050b14';
      ctx.fillStyle=L===0?'rgba(4,10,18,'+b.alpha+')':L===1?'rgba(5,12,21,'+b.alpha+')':'rgba(3,7,13,'+b.alpha+')';
      ctx.fillRect(b.x,b.top,b.w,b.h);
      if(b.spire){
        ctx.fillStyle='rgba(5,12,21,.9)';
        ctx.fillRect(b.x+b.w*.46,b.top-h*.06,b.w*.08,h*.06);
        ctx.fillStyle='rgba(255,90,120,.55)';
        ctx.fillRect(b.x+b.w*.47,b.top-h*.065,2,2);
      }
      if(b.neon&&pal.light>.2){
        ctx.fillStyle='rgba(34,228,255,'+(.18+pal.light*.25)+')';
        ctx.fillRect(b.x+2,b.top+4,1.2,b.h*.4);
      }
      const cols=Math.max(1,Math.floor(b.w/7)),rows=Math.max(1,Math.floor(b.h/10));
      const litStrength=pal.light>0.35?0.12:0.75;
      for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
          if(!b.lit[r*cols+c])continue;
          if(((r*7+c*13+L)%5)===0&&pal.light>0.4)continue;
          const wx=b.x+3+c*((b.w-6)/cols);
          const wy=b.top+5+r*((b.h-8)/rows);
          ctx.fillStyle=(c*3+r)%7===0?'rgba(255,198,120,'+(litStrength*.75)+')':'rgba(120,226,255,'+(litStrength*.55)+')';
          ctx.fillRect(wx,wy,1.6,2.2);
        }
      }
      if(b.holo&&b.w>30&&b.h>h*.15){
        const hs=b.holoSeed,mag=hs>3.3;
        const c1=mag?'255,110,190':'120,245,255';
        const hw=Math.min(b.w*.86,86),hh=Math.max(10,Math.min(h*.105,b.h*.16));
        const hx=b.x+(b.w-hw)/2,hy=b.top+b.h*.16;
        const flick=.7+.3*Math.sin(city.t*4+hs*3);
        ctx.save();ctx.globalAlpha=.82*flick;
        ctx.fillStyle='rgba('+c1+',.12)';ctx.fillRect(hx,hy,hw,hh);
        ctx.strokeStyle='rgba('+c1+',.55)';ctx.lineWidth=1;ctx.strokeRect(hx+.5,hy+.5,hw-1,hh-1);
        ctx.fillStyle='rgba('+c1+',.15)';
        for(let yy=hy+2;yy<hy+hh-1;yy+=3)ctx.fillRect(hx+1,yy,hw-2,1);
        const labels=['E.','WELKIN','LIVE','SYNC','01','NEO'];
        ctx.font='700 '+Math.max(7,hh*.55).toFixed(1)+'px '+FONT_D;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='rgba('+c1+',.9)';ctx.shadowBlur=9;ctx.shadowColor='rgba('+c1+',.65)';
        ctx.fillText(labels[Math.floor(hs*1.7)%labels.length],hx+hw/2,hy+hh/2+.5);
        ctx.restore();
      }
    }
  }

  // atmospheric haze over the skyline
  const hazeA=.12*pal.light+(kind==='fog'?0.1:0);
  const hz=ctx.createLinearGradient(0,h*.34,0,h);
  hz.addColorStop(0,'rgba(200,238,250,0)');
  hz.addColorStop(.75,'rgba(190,232,246,'+hazeA.toFixed(3)+')');
  hz.addColorStop(1,'rgba(210,242,252,'+(.24*pal.light).toFixed(3)+')');
  ctx.fillStyle=hz;ctx.fillRect(0,h*.34,w,h*.66);

  // rooftop searchlights
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){
    const bx=w*(.16+i*.3),by=h*.58;
    const ang=(i-1)*.17+Math.sin(city.t*.3+i*1.7)*.12;
    const lg=ctx.createLinearGradient(bx,by,bx+Math.sin(ang)*h*.8,by-h*.8);
    lg.addColorStop(0,'rgba(120,235,255,.1)');
    lg.addColorStop(1,'rgba(120,235,255,0)');
    ctx.fillStyle=lg;ctx.beginPath();
    ctx.moveTo(bx,by);
    ctx.lineTo(bx-16+Math.sin(ang)*h*.8,by-h*.8);
    ctx.lineTo(bx+16+Math.sin(ang)*h*.8,by-h*.8);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();

  // flying cars + patrol drones
  if(!settings.motion){
    for(const car of city.cars){
      car.x+=car.sp*.016;
      if(car.x>w+40)car.x=-40;
      if(car.x<-40)car.x=w+40;
      const dir=Math.sign(car.sp)||1;
      const g=ctx.createLinearGradient(car.x-car.len*dir,car.y,car.x,car.y);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(1,car.c);
      ctx.strokeStyle=g;ctx.lineWidth=1.1;ctx.globalAlpha=.55;
      ctx.beginPath();ctx.moveTo(car.x-car.len*dir,car.y);ctx.lineTo(car.x,car.y);ctx.stroke();
      ctx.globalAlpha=.95;ctx.fillStyle=car.c;
      ctx.fillRect(car.x,car.y-1,3.2*car.s,2*car.s);
      ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(car.x+dir*1.2*car.s,car.y-.6,1.2,1.2);
      ctx.globalAlpha=.35;ctx.fillStyle=car.c;ctx.fillRect(car.x-1,car.y+2,5*car.s,1);
      ctx.globalAlpha=1;
    }
    for(const d of city.drones){
      d.x+=d.sp*.016;
      d.y+=Math.sin(city.t*2.1+d.ph)*.09;
      if(d.x>w+30)d.x=-30;
      if(d.x<-30)d.x=w+30;
      ctx.save();ctx.translate(d.x,d.y);ctx.scale(d.s,d.s);
      ctx.strokeStyle='rgba(120,230,255,.42)';ctx.lineWidth=.8;
      for(const a of [.785,2.356,3.927,5.498]){
        const rx=Math.cos(a)*7,ry=Math.sin(a)*4;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(rx,ry);ctx.stroke();
        ctx.beginPath();ctx.arc(rx,ry,2.1,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='rgba(8,24,38,.95)';ctx.fillRect(-3,-2.2,6,4.4);
      const blink=Math.sin(city.t*7+d.ph)>0;
      ctx.fillStyle=blink?'rgba(255,70,110,.95)':'rgba(34,228,255,.65)';
      ctx.fillRect(-.9,-.9,1.8,1.8);
      ctx.restore();
    }
  }

  // weather particles
  if(kind==='rain'||kind==='storm'){
    ctx.strokeStyle='rgba(170,220,255,.35)';ctx.lineWidth=1;
    for(const d of city.rain){
      if(!settings.motion){d.y+=d.sp*.016;d.x-=d.sp*.003;}
      if(d.y>h){d.y=-10;d.x=Math.random()*w;}
      ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-1.2,d.y+d.l);ctx.stroke();
    }
  }
  if(kind==='snow'){
    ctx.fillStyle='rgba(230,248,255,.75)';
    for(const d of city.snow){
      if(!settings.motion){d.y+=d.sp*.016;d.x+=Math.sin(city.t+d.p)*.2;}
      if(d.y>h){d.y=-6;d.x=Math.random()*w;}
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();
    }
  }
  if(kind==='storm'&&!settings.motion){
    city.flash=Math.max(0,city.flash-.02);
    if(Math.random()<.0025)city.flash=.9;
    if(city.flash>0){ctx.fillStyle='rgba(210,235,255,'+city.flash*.35+')';ctx.fillRect(0,0,w,h);}
  }
  if(kind==='fog'){
    ctx.fillStyle='rgba(180,200,215,.12)';ctx.fillRect(0,0,w,h);
    const fg=ctx.createLinearGradient(0,h*.45,0,h);
    fg.addColorStop(0,'rgba(180,200,215,0)');
    fg.addColorStop(1,'rgba(180,200,215,.18)');
    ctx.fillStyle=fg;ctx.fillRect(0,0,w,h);
  }

  // window vignette
  const vg=ctx.createRadialGradient(w/2,h*.5,h*.2,w/2,h*.5,h*.85);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.45)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}

/* 黄金奢华外景（SSS）：窗外风景切换为黄金科技炫酷风。复用 city 几何状态，
   仅换一套鎏金配色与金色特效，不触碰默认城市夜景的渲染。 */
function drawGoldenCity(ts){
  const w=city.w||cityCanvas.clientWidth,h=city.h||cityCanvas.clientHeight;
  if(!w||!h)return;
  const ctx=cityCtx;
  const kind=weatherKind(weather.code);
  city.t+=.016;

  // 鎏金天空：深金 → 暖金 → 亮金地平线
  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'#0f0a03');
  sky.addColorStop(.45,'#2b1d07');
  sky.addColorStop(.74,'#6b4a14');
  sky.addColorStop(1,'#c8953a');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);

  // 地平线金色辉光
  const hg=ctx.createLinearGradient(0,h*.5,0,h);
  hg.addColorStop(0,'rgba(255,200,110,0)');
  hg.addColorStop(.7,'rgba(255,190,90,.26)');
  hg.addColorStop(1,'rgba(255,215,130,.48)');
  ctx.fillStyle=hg;ctx.fillRect(0,h*.5,w,h*.5);

  // 金色星点
  for(const s of city.stars){
    const tw=.55+.45*Math.sin(city.t*1.6+s.p);
    ctx.fillStyle='rgba(255,232,170,'+(.5*tw).toFixed(3)+')';
    ctx.fillRect(s.x,s.y,s.r,s.r);
  }

  // 金色耀核
  const coreX=w*((hourFloat-6)/12),coreY=h*.58;
  if(coreX>-60&&coreX<w+60){
    const g=ctx.createRadialGradient(coreX,coreY,0,coreX,coreY,h*.5);
    g.addColorStop(0,'rgba(255,236,182,.8)');
    g.addColorStop(.25,'rgba(255,206,120,.36)');
    g.addColorStop(1,'rgba(255,170,80,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(coreX,coreY,h*.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,247,216,.96)';
    ctx.beginPath();ctx.arc(coreX,coreY,h*.05,0,Math.PI*2);ctx.fill();
  }

  // 金色全息环 + 六边形科技节点
  ctx.save();
  ctx.translate(w*.2,h*.18);ctx.rotate(-.18);
  ctx.strokeStyle='rgba(255,200,90,.32)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.ellipse(0,0,w*.17,h*.055,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(255,200,90,.12)';
  ctx.beginPath();ctx.ellipse(0,0,w*.17+9,h*.055+4,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(255,220,150,.65)';
  for(let i=0;i<7;i++){
    const ax=Math.cos(i/7*Math.PI*2)*w*.17,ay=Math.sin(i/7*Math.PI*2)*h*.055;
    ctx.fillRect(ax-1,ay-1,2,2);
  }
  ctx.restore();

  // 黄金天梯缆索
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const t of city.tethers){
    const x=w*t.x;
    const tg=ctx.createLinearGradient(0,0,0,h*.58);
    tg.addColorStop(0,'rgba(255,214,120,.4)');
    tg.addColorStop(.55,'rgba(255,214,120,.13)');
    tg.addColorStop(1,'rgba(255,214,120,0)');
    ctx.strokeStyle=tg;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h*.58);ctx.stroke();
    for(let k=1;k<=5;k++){
      const ry=h*(.05+k*.085);
      ctx.strokeStyle='rgba(255,220,130,'+(.26-k*.03)+')';
      ctx.beginPath();ctx.ellipse(x,ry,8,2,0,0,Math.PI*2);ctx.stroke();
    }
    const cy=((city.t*.022+t.ph)%1)*h*.5;
    ctx.fillStyle='rgba(255,238,180,.95)';ctx.fillRect(x-2,cy,4,12);
    ctx.fillStyle='rgba(255,150,70,.85)';ctx.fillRect(x-1,cy+12,2,2);
  }
  ctx.restore();

  // 金色楼宇
  for(let L=0;L<city.buildings.length;L++){
    const arr=city.buildings[L];
    for(const b of arr){
      ctx.fillStyle=L===0?'rgba(22,14,5,'+b.alpha+')':L===1?'rgba(17,11,4,'+b.alpha+')':'rgba(13,8,2,'+b.alpha+')';
      ctx.fillRect(b.x,b.top,b.w,b.h);
      if(b.spire){
        ctx.fillStyle='rgba(30,20,8,.95)';
        ctx.fillRect(b.x+b.w*.46,b.top-h*.06,b.w*.08,h*.06);
        ctx.fillStyle='rgba(255,196,80,.8)';
        ctx.fillRect(b.x+b.w*.47,b.top-h*.065,2,2);
      }
      if(b.neon){
        ctx.fillStyle='rgba(255,186,74,.42)';
        ctx.fillRect(b.x+2,b.top+4,1.2,b.h*.4);
      }
      const cols=Math.max(1,Math.floor(b.w/7)),rows=Math.max(1,Math.floor(b.h/10));
      for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
          if(!b.lit[r*cols+c])continue;
          const wx=b.x+3+c*((b.w-6)/cols);
          const wy=b.top+5+r*((b.h-8)/rows);
          ctx.fillStyle=(c*3+r)%7===0?'rgba(255,236,190,.82)':'rgba(255,196,96,.55)';
          ctx.fillRect(wx,wy,1.6,2.2);
        }
      }
      if(b.holo&&b.w>30&&b.h>h*.15){
        const hs=b.holoSeed;
        const hw=Math.min(b.w*.86,86),hh=Math.max(10,Math.min(h*.105,b.h*.16));
        const hx=b.x+(b.w-hw)/2,hy=b.top+b.h*.16;
        const flick=.7+.3*Math.sin(city.t*4+hs*3);
        ctx.save();ctx.globalAlpha=.82*flick;
        ctx.fillStyle='rgba(255,200,90,.14)';ctx.fillRect(hx,hy,hw,hh);
        ctx.strokeStyle='rgba(255,200,90,.6)';ctx.lineWidth=1;ctx.strokeRect(hx+.5,hy+.5,hw-1,hh-1);
        ctx.fillStyle='rgba(255,200,90,.18)';
        for(let yy=hy+2;yy<hy+hh-1;yy+=3)ctx.fillRect(hx+1,yy,hw-2,1);
        const labels=['AU.','GOLD','ROYAL','VAULT','999','LUX'];
        ctx.font='700 '+Math.max(7,hh*.55).toFixed(1)+'px '+FONT_D;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='rgba(255,224,150,.95)';ctx.shadowBlur=9;ctx.shadowColor='rgba(255,190,90,.7)';
        ctx.fillText(labels[Math.floor(hs*1.7)%labels.length],hx+hw/2,hy+hh/2+.5);
        ctx.restore();
      }
    }
  }

  // 金色大气雾
  const hz=ctx.createLinearGradient(0,h*.34,0,h);
  hz.addColorStop(0,'rgba(255,214,150,0)');
  hz.addColorStop(.75,'rgba(255,205,140,.12)');
  hz.addColorStop(1,'rgba(255,225,170,.24)');
  ctx.fillStyle=hz;ctx.fillRect(0,h*.34,w,h*.66);

  // 金色探照灯
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){
    const bx=w*(.16+i*.3),by=h*.58;
    const ang=(i-1)*.17+Math.sin(city.t*.3+i*1.7)*.12;
    const lg=ctx.createLinearGradient(bx,by,bx+Math.sin(ang)*h*.8,by-h*.8);
    lg.addColorStop(0,'rgba(255,214,120,.14)');
    lg.addColorStop(1,'rgba(255,214,120,0)');
    ctx.fillStyle=lg;ctx.beginPath();
    ctx.moveTo(bx,by);
    ctx.lineTo(bx-16+Math.sin(ang)*h*.8,by-h*.8);
    ctx.lineTo(bx+16+Math.sin(ang)*h*.8,by-h*.8);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();

  // 金色飞行载具 + 巡逻无人机
  if(!settings.motion){
    for(const car of city.cars){
      car.x+=car.sp*.016;
      if(car.x>w+40)car.x=-40;
      if(car.x<-40)car.x=w+40;
      const dir=Math.sign(car.sp)||1;
      const g=ctx.createLinearGradient(car.x-car.len*dir,car.y,car.x,car.y);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(1,'rgba(255,205,100,.9)');
      ctx.strokeStyle=g;ctx.lineWidth=1.1;ctx.globalAlpha=.55;
      ctx.beginPath();ctx.moveTo(car.x-car.len*dir,car.y);ctx.lineTo(car.x,car.y);ctx.stroke();
      ctx.globalAlpha=.95;ctx.fillStyle='#ffd76a';
      ctx.fillRect(car.x,car.y-1,3.2*car.s,2*car.s);
      ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(car.x+dir*1.2*car.s,car.y-.6,1.2,1.2);
      ctx.globalAlpha=.35;ctx.fillStyle='#ffd76a';ctx.fillRect(car.x-1,car.y+2,5*car.s,1);
      ctx.globalAlpha=1;
    }
    for(const d of city.drones){
      d.x+=d.sp*.016;
      d.y+=Math.sin(city.t*2.1+d.ph)*.09;
      if(d.x>w+30)d.x=-30;
      if(d.x<-30)d.x=w+30;
      ctx.save();ctx.translate(d.x,d.y);ctx.scale(d.s,d.s);
      ctx.strokeStyle='rgba(255,205,120,.5)';ctx.lineWidth=.8;
      for(const a of [.785,2.356,3.927,5.498]){
        const rx=Math.cos(a)*7,ry=Math.sin(a)*4;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(rx,ry);ctx.stroke();
        ctx.beginPath();ctx.arc(rx,ry,2.1,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='rgba(30,20,8,.95)';ctx.fillRect(-3,-2.2,6,4.4);
      const blink=Math.sin(city.t*7+d.ph)>0;
      ctx.fillStyle=blink?'rgba(255,160,70,.95)':'rgba(255,214,120,.7)';
      ctx.fillRect(-.9,-.9,1.8,1.8);
      ctx.restore();
    }
  }

  // 金色天气粒子
  if(kind==='rain'||kind==='storm'){
    ctx.strokeStyle='rgba(255,214,150,.4)';ctx.lineWidth=1;
    for(const d of city.rain){
      if(!settings.motion){d.y+=d.sp*.016;d.x-=d.sp*.003;}
      if(d.y>h){d.y=-10;d.x=Math.random()*w;}
      ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-1.2,d.y+d.l);ctx.stroke();
    }
  }
  if(kind==='snow'){
    ctx.fillStyle='rgba(255,240,205,.8)';
    for(const d of city.snow){
      if(!settings.motion){d.y+=d.sp*.016;d.x+=Math.sin(city.t+d.p)*.2;}
      if(d.y>h){d.y=-6;d.x=Math.random()*w;}
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();
    }
  }

  // 金色暗角
  const vg=ctx.createRadialGradient(w/2,h*.5,h*.2,w/2,h*.5,h*.85);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(20,10,0,.5)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}

function cityLoop(ts){
  requestAnimationFrame(cityLoop);
  if(document.hidden)return;
  if(gameWrap.classList.contains('active')||imApp.classList.contains('active')||settingsApp.classList.contains('active')||songScreen.classList.contains('active')||chapterScreen.classList.contains('active')||songSelectScreen.classList.contains('active'))return;
  const storeAppEl=document.getElementById('storeApp');
  if(storeAppEl&&storeAppEl.classList.contains('active'))return;
  if(Math.min(window.innerWidth,window.innerHeight)<820&&ts-city.last<50)return;
  if(settings.motion&&ts-city.last<400)return;
  city.last=ts;
  if(account.sceneryOn)drawGoldenCity(ts);else drawWindowCity(ts);
}

/* ============================================================
   4. phone UI
   ============================================================ */
function updatePhone(){
  updateTime();
}
/* phone time/date is driven by updateTime */

/* ============================================================
   5. loading / wake / login
   ============================================================ */
const bootState={done:0,total:0,finished:false,files:[]};
function bootProgress(p){
  const pct=clamp(Math.round(p*100),0,100);
  $('#bootFill').style.width=pct+'%';
  $('#bootPct').textContent=pct+'%';
}
function bootLog(line){
  const el=$('#bootLog');if(el)el.textContent=line;
}
const ASSET_IMAGES={};
function waitAudioReady(el,timeout=8000){
  return new Promise(resolve=>{
    if(!el)return resolve();
    let done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
    const timer=setTimeout(finish,timeout);
    if(el.readyState>=3)return finish();
    el.addEventListener('canplaythrough',finish,{once:true});
    el.addEventListener('loadeddata',finish,{once:true});
    el.addEventListener('error',finish,{once:true});
    try{el.load();}catch(e){}
  });
}
function waitImage(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.decoding='async';
    let done=false;
    const finish=()=>{if(done)return;done=true;ASSET_IMAGES[src]=img;resolve();};
    img.onload=()=>{
      if(img.decode)img.decode().then(finish).catch(finish);
      else finish();
    };
    img.onerror=finish;
    img.src=imgUrl(src);
  });
}
function preload(){
  /* 大厅 BGM 已经换成钢琴曲时，开机就直接预载 Audio.mp3（phone.mp3 等要用再按需加载） */
  const lobbyJob=lobbyMusicAllowed()
    ?{label:'LOBBY PIANO',w:.18,run:()=>waitAudioReady(lobbyBgm,14000)}
    :{label:'PHONE CHANNEL',w:.18,run:()=>waitAudioReady(getUITrack('phone'),10000)};
  const jobs=[
    {label:'SELECT CHANNEL',w:.26,run:()=>waitAudioReady(getUITrack('select'),14000)},
    lobbyJob,
    {label:'CONFIG CHANNEL',w:.08,run:()=>waitAudioReady(getUITrack('setting'),10000)},
    {label:'NEURAL FEED',w:.18,run:()=>waitAudioReady(getUITrack('im'),10000)},
    {label:'UI AUDIO BUS',w:.02,run:()=>{try{uiPlayer.src=UI_TRACK_FILES.select;uiPlayer.load();uiPlayerKey='select';}catch(e){}}},
    {label:'OPERATOR 01',w:.05,run:()=>waitImage('avatar_im.avif')},
    {label:'OPERATOR 02',w:.04,run:()=>waitImage('nick_avatar.avif')},
    {label:'OPERATOR 03',w:.03,run:()=>waitImage('bb.im.avif')}
  ];
  return new Promise(resolve=>{
    const started=performance.now();
    const total=jobs.reduce((s,j)=>s+j.w,0)||1;
    let doneW=0;
    bootProgress(.01);
    bootLog('LOADING ASSETS');
    jobs.forEach(job=>{
      Promise.resolve().then(job.run).catch(()=>{}).then(()=>{
        doneW+=job.w/total;
        bootProgress(Math.min(.99,doneW));
        bootLog(job.label+' // READY');
        if(doneW>=.999){
          const wait=Math.max(0,900-(performance.now()-started));
          setTimeout(()=>{
            bootProgress(1);
            bootLog('ALL SYSTEMS NOMINAL');
            setTimeout(()=>{
              loadingLayer.classList.remove('active');
              afterLoad();
              resolve();
            },420);
          },wait);
        }
      });
    });
  });
}
function afterLoad(){
  if(!user)user=readUser();
  if(user){
    runWake();
  }else{
    loginLayer.classList.add('active');
    state='LOGIN';
    phoneBoot.classList.add('done');
    $('#nameInput').focus({preventScroll:true});
  }
}

function runWake(){
  if(state==='WAKE')return;
  state='WAKE';
  loginLayer.classList.remove('active');
  wakeLayer.classList.add('active');
  room.classList.add('waking');
  phoneBoot.classList.remove('done');
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t1=reduce?120:900;
  const t2=reduce?260:1500;
  const t3=reduce?400:2100;
  const t4=reduce?600:3700;
  setTimeout(()=>{wakeLayer.classList.add('open');},t1);
  setTimeout(()=>{wakeLayer.classList.add('flash');},t1+260);
  setTimeout(()=>{phoneBoot.classList.add('done');},t2);
  setTimeout(()=>{
    wakeLayer.classList.remove('active','open','flash','blink');
    room.classList.remove('waking');
    phoneBoot.classList.add('done');
    state='PHONE';
    syncUIMusic(true);
  },t4);
}

/* avatar */
function defaultAvatar(name){
  const c=document.createElement('canvas');c.width=c.height=160;
  const g=c.getContext('2d');
  const grd=g.createLinearGradient(0,0,160,160);grd.addColorStop(0,'#0b2b3d');grd.addColorStop(1,'#050d16');
  g.fillStyle=grd;g.fillRect(0,0,160,160);
  g.strokeStyle='rgba(34,228,255,.45)';g.lineWidth=2;g.beginPath();g.arc(80,80,62,0,Math.PI*2);g.stroke();
  g.fillStyle='#bff9ff';g.font='700 62px Bahnschrift, Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.fillText(String(name||'W').slice(0,1).toUpperCase(),80,84);
  return c.toDataURL('image/png');
}
function compressAvatar(file,cb){
  let url='';
  try{url=URL.createObjectURL(file);}catch(e){cb(null);return;}
  const img=new Image();
  img.onload=()=>{
    try{
      const s=Math.min(img.width,img.height);
      const c=document.createElement('canvas');c.width=c.height=160;
      const g=c.getContext('2d');
      g.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,160,160);
      cb(c.toDataURL('image/jpeg',.82));
    }catch(e){cb(null);}
    try{URL.revokeObjectURL(url);}catch(e){}
  };
  img.onerror=()=>{try{URL.revokeObjectURL(url);}catch(e){}cb(null);};
  img.src=url;
}
let tempAvatar='';
function showLogin(){
  stopAllUIMusic();
  loginLayer.classList.add('active');
  state='LOGIN';
  tempAvatar='';
  $('#avatarPreview').hidden=true;
  $('#avatarHint').style.display='';
  $('#nameInput').value='';
  setTimeout(()=>$('#nameInput').focus({preventScroll:true}),300);
}
let enteringTerminal=false;
function enterTerminal(){
  if(state!=='LOGIN'||enteringTerminal)return;
  enteringTerminal=true;
  const name=($('#nameInput').value||'').trim().replace(/\s+/g,' ').slice(0,10);
  if(!name){
    enteringTerminal=false;
    $('#nameInput').style.borderColor='#ff4d9d';
    setTimeout(()=>{$('#nameInput').style.borderColor='';},900);
    return;
  }
  const avatar=tempAvatar||defaultAvatar(name);
  user={name,avatar};
  bestMap=readBestMap();
  best=emptyBest();
  try{localStorage.setItem(LAST_USER_KEY,name);}catch(e){}
  try{localStorage.setItem('welkin_os_user',JSON.stringify(user));}catch(e){
    try{localStorage.setItem('rhythm_user',JSON.stringify(user));}catch(e2){}
  }
  unlockAudio();
  renderUser();
  runWake();
  setTimeout(()=>{enteringTerminal=false;},800);
}

function renderUser(){
  if(!user)return;
  const setTxt=$('#setUser');if(setTxt)setTxt.textContent=user.name;
}

/* ============================================================
   6. navigation: chapter / song select / detail / iM / settings
   ============================================================ */
function makeMainSongs(prefix,levels,bossLevel){
  const normal=levels.map((level,i)=>({
    id:prefix+'-'+(i+2),chapterId:prefix,no:'TRACK '+String(i+1).padStart(2,'0'),title:'—',
    artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level,boss:false,chart:null,
    cover:null,state:i===3?'available':'locked'
  }));
  return [{id:prefix+'-boss',chapterId:prefix,no:'TRACK 06',title:'—',artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level:bossLevel,boss:true,chart:null,cover:null,state:'locked'},...normal];
}
/* 承章七首：曲绘全部到位，顺序是 TRACK 01→06 = init / an / La / bn / pen / fb，魔王曲 = ca。
   La 插在 an(TRACK 02) 和 bn(原 TRACK 03) 之间，成为新的第三关，曲绘 La.avif。
   曲名跟着解锁走：没解锁的卡在选歌页显示 ?（魔王曲 ???）并罩一层黑雾，
   解锁之后才露真名——和第一章同一套规则，见 songNodeHTML。
   谱面都还没接，chart 保持 null。id 沿用旧的 ch2-2…ch2-6 / ch2-boss，
   新插入的 La 用独立 id ch2-7，这样以前存下来的通关记录不会因为改曲目表而对不上。 */
const CH2_COVER_FILES=['init.avif','an.avif','La.avif','bn.avif','pen.avif','fb.avif','ca.avif'];
/* 承章七首正式接入：顺序 TRACK 01→06 = init / 时逝 / Lamentation / Grievous Lady /
   Pentiment / Tempestissimo，魔王曲 = CyberAttack。曲绘沿用旧的短名文件（bn=Grievous Lady，
   ca=CyberAttack）。id 沿用 ch2-2…ch2-6 / ch2-boss，La 用独立 id ch2-7，避免撞旧通关记录。 */
const CH2_INIT={id:'ch2-2',chapterId:'ch2',no:'TRACK 01',title:'init()',artist:'WELKIN',charter:'Welkin',bpm:'180',length:'02:22',notes:915,level:10,boss:false,chart:'init',audio:'init.mp3',cover:'init.avif',state:'locked',fingers:'dual'};
const CH2_AN={id:'ch2-3',chapterId:'ch2',no:'TRACK 02',title:'时逝',artist:'WELKIN',charter:'Welkin',bpm:'199',length:'02:09',notes:1152,level:14,boss:false,chart:'an',audio:'an.mp3',cover:'an.avif',state:'locked',fingers:'dual'};
const CH2_LA={id:'ch2-7',chapterId:'ch2',no:'TRACK 03',title:'Lamentation',artist:'WELKIN',charter:'Welkin',bpm:'98',length:'02:22',notes:770,level:15,boss:false,chart:'la',audio:'La.mp3',cover:'La.avif',state:'locked',fingers:'multi'};
const CH2_LADY={id:'ch2-4',chapterId:'ch2',no:'TRACK 04',title:'Grievous Lady',artist:'WELKIN',charter:'Welkin',bpm:'106',length:'02:22',notes:1505,level:17,boss:false,chart:'lady',audio:'Lady.mp3',cover:'bn.avif',state:'locked',fingers:'multi'};
const CH2_PEN={id:'ch2-5',chapterId:'ch2',no:'TRACK 05',title:'Pentiment',artist:'WELKIN',charter:'Welkin',bpm:'111',length:'02:41',notes:1217,level:18,boss:false,chart:'pen',audio:'pen.mp3',cover:'pen.avif',state:'locked',fingers:'dual'};
const CH2_FB={id:'ch2-6',chapterId:'ch2',no:'TRACK 06',title:'Tempestissimo',artist:'WELKIN',charter:'Welkin',bpm:'116',length:'02:18',notes:1770,level:19,boss:false,chart:'fb',audio:'fb.mp3',cover:'fb.avif',state:'locked',fingers:'multi'};
const CH2_CYBER={id:'ch2-boss',chapterId:'ch2',no:'TRACK 07',title:'CyberAttack',artist:'WELKIN',charter:'Welkin',bpm:'130',length:'03:21',notes:2270,level:20,boss:true,chart:'cyber',audio:'Cyber.mp3',cover:'ca.avif',state:'locked',fingers:'multi'};
function makeCh2Songs(){return [CH2_CYBER,CH2_INIT,CH2_AN,CH2_LA,CH2_LADY,CH2_PEN,CH2_FB];}
const EFFULGENCE={
  id:'ch1-2',chapterId:'ch1',no:'TRACK 01',title:'Effulgence',artist:'WELKIN',charter:'Welkin',
  bpm:'—',length:'02:41',notes:493,level:5,boss:false,chart:'effulgence',audio:'Effulgence.mp3',cover:'Effulgence.avif',state:'locked',fingers:'multi'
};
const SPARK={
  id:'ch1-3',chapterId:'ch1',no:'TRACK 02',title:'The Spark',artist:'WELKIN',charter:'Welkin',
  bpm:'175',length:'02:25',notes:1078,level:8,boss:false,chart:'spark',audio:'The Spark.mp3',cover:'The Spark.avif',state:'locked',fingers:'dual'
};
/* 初章第三关：插在 The Spark(TRACK 02) 和 R.I.P.(原 TRACK 03) 之间，成为新的第三关。
   曲绘 ltzz.avif、曲名 テリトリーバトル、铺面 ltzz.qua、音乐 ltzz.mp3、难度 11；
   仍锁在解锁链上逐关解锁；id 用 ch1-7 避免撞号。 */
const CH1_T3={id:'ch1-7',chapterId:'ch1',no:'TRACK 03',title:'テリトリーバトル',artist:'WELKIN',charter:'Welkin',bpm:'140',length:'02:32',notes:849,level:11,boss:false,chart:'ltzz',audio:'ltzz.mp3',cover:'ltzz.avif',state:'locked',fingers:'multi'};
const RIP={id:'ch1-4',chapterId:'ch1',no:'TRACK 04',title:'R.I.P.',artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level:10,boss:false,chart:null,audio:null,cover:'R.I.P.avif',state:'locked',fingers:'dual'};
const WELKIN={id:'ch1-5',chapterId:'ch1',no:'TRACK 06',title:'WELKIN',artist:'WELKIN',charter:'Welkin',bpm:'150',length:'04:12',notes:1662,level:16,boss:true,chart:'welkin',audio:'WELKIN.mp3',cover:'W.avif',state:'locked',fingers:'multi'};
const CORR={id:'ch1-6',chapterId:'ch1',no:'TRACK 05',title:'Corrupted Entity',artist:'—',charter:'WeIkin',bpm:'181',length:'02:45',notes:1405,level:15,boss:false,chart:'corr',audio:'Corrupted Entity.mp3',cover:'Corr.avif',state:'locked',fingers:'dual'};
const STILL={id:'ex-1',chapterId:'ex',no:'TRACK 01',title:'Still (piano version)',artist:'—',charter:'Welkin',bpm:'130',length:'01:48',notes:365,level:6,boss:true,chart:'still',audio:'Still.mp3',cover:'Still.avif',state:'locked',fingers:'dual'};
/* 主线序章：单曲章节，曲目 W。它有自己的选歌页（DATAFALL），和初章 TRACK 05 的占位互不影响。 */
const PROLOGUE_W={id:'prologue-1',chapterId:'prologue',no:'TRACK 01',title:'W.',artist:'WELKIN',charter:'Welkin',bpm:'152',length:'01:26',notes:84,level:2,boss:false,chart:'w',audio:'w.（.mp3',cover:'wel.avif',state:'available',fingers:'dual'};
/* 终章普通曲（占位）：TRACK 01→06，魔王曲 TRACK 07，收尾曲 TRACK 08(secret)。
   新插的第三关暂无曲绘，cover 保持 null；插在 TRACK 02 和 TRACK 03 之间，
   独立 id ch3-8 避免撞号，其余沿用 ch3-2…ch3-6 / ch3-boss。 */
function makeCh3Songs(){
  const rows=[
    {id:'ch3-2',no:'TRACK 01',level:6},
    {id:'ch3-3',no:'TRACK 02',level:8},
    {id:'ch3-8',no:'TRACK 03',level:8},
    {id:'ch3-4',no:'TRACK 04',level:9},
    {id:'ch3-5',no:'TRACK 05',level:10},
    {id:'ch3-6',no:'TRACK 06',level:12}
  ];
  const normal=rows.map(r=>({
    id:r.id,chapterId:'ch3',no:r.no,title:'—',
    artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level:r.level,boss:false,chart:null,
    cover:null,state:'locked'
  }));
  return [{id:'ch3-boss',chapterId:'ch3',no:'TRACK 07',title:'—',artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level:15,boss:true,chart:null,cover:null,state:'locked'},...normal];
}
/* 终章收尾曲：魔王曲之后的最后一首。选歌页里放在魔王曲正上方，未解锁时几乎透明（secret）。
   它排在 TRACK 08，解锁链上自然变成「清完魔王曲才出现」。 */
const CH3_FINALE={
  id:'ch3-7',chapterId:'ch3',no:'TRACK 08',title:'The Last Horizon',artist:'—',charter:'—',
  bpm:'—',length:'—',notes:0,level:15,boss:false,secret:true,chart:null,audio:null,cover:null,state:'locked'
};
const CHAPTERS=[
  {id:'prologue',no:'00',cn:'主线 · 序章',en:'PROLOGUE',sub:'THE ORIGIN SIGNAL',theme:'prologue',layout:'SOLO',progress:'0 / 1',previewArt:'wel.avif',songs:[PROLOGUE_W]},
  {id:'ch1',no:'01',cn:'主线 · 初章',en:'ORIGIN',sub:'THE FIRST SIGNAL',theme:'ch1',layout:'HELIX',progress:'0 / 6',songs:[WELKIN,EFFULGENCE,SPARK,CH1_T3,RIP,CORR]},
  {id:'ch2',no:'02',cn:'主线 · 承章',en:'ASCENT',sub:'THE SECOND CURRENT',theme:'ch2',layout:'ORBIT',progress:'0 / 7',songs:makeCh2Songs()},
  {id:'ch3',no:'03',cn:'主线 · 终章',en:'TERMINUS',sub:'THE LAST HORIZON',theme:'ch3',layout:'CIRCUIT',progress:'0 / 8',locked:true,songs:[...makeCh3Songs(),CH3_FINALE]},
  {id:'ex',no:'EX',cn:'EX 章节',en:'ANOMALY',sub:'BEYOND THE LINE',theme:'ex',layout:'DIRECT',progress:'LOCKED',locked:true,previewArt:'Still.avif',songs:[STILL]}
];
CHAPTERS.forEach(ch=>ch.songs.forEach(s=>{s.chapterCn=ch.cn;s.chapterEn=ch.en;s.chapterNo=ch.no;}));
/* 曲绘铺满（cover）以后，每张图的裁切对准点都记在这里，键就是曲绘文件名。
   规则只有一条：印在曲绘上的曲名，裁完必须还是完整的字。
   - 曲名在底部 → 对准底边 50% 100%（自上往下裁，裁掉的是上半截）
   - 曲名在右侧 → 往右偏（The Spark 的 THE SPARK 在右边，偏 80% 既留住整行字，
     也不会把她半张脸切在框外）
   - 曲名在顶上 → 对准顶边 50% 0%（init 的 logo 在右上角）
   - 曲名横跨整幅、往哪边裁都会缺字（ca 的 Corrupted、an 的 かすみそう）
     → 这两张拉伸铺满（100% 100%）。ca 是故障噪点风、an 只压 4%，肉眼看不出变形。
   没列到的图没有会切字的曲名，走默认 50% 50% + cover。
   详情页那块斜面板不吃这张表：那边一律从图片顶边往下截（object-position 50% 0%），
   因为人脸基本都在图上方，曲名反倒被裁掉也无所谓——曲名屏幕上本来就有。 */
const COVER_CROP={
  'Effulgence.avif':{pos:'50% 100%'},
  'ltzz.avif':{pos:'50% 100%'},
  'The Spark.avif':{pos:'80% 50%'},
  'init.avif':{pos:'50% 0%'},
  'an.avif':{fit:'100% 100%'},
  'ca.avif':{fit:'100% 100%'}
};
const CLEAR_KEY='welkin_os_clears_v1';
let clears={};
try{const raw=JSON.parse(localStorage.getItem(CLEAR_KEY)||'{}');if(raw&&typeof raw==='object')clears=raw;}catch(e){}
function saveClears(){try{localStorage.setItem(CLEAR_KEY,JSON.stringify(clears));}catch(e){}}
/* 开发者模式：隐藏入口输对密钥后，把所有曲目全部解锁（不落进 clears，关掉即还原原进度）。
   未接入谱面（chart=null）的曲目详情页/开局仍会被 chart 判断拦下，因此不可进入。 */
const DEV_KEY='welkin_os_dev_unlock';
let devUnlockAll=false;
try{devUnlockAll=localStorage.getItem(DEV_KEY)==='1';}catch(e){}
function saveDevUnlock(){try{localStorage.setItem(DEV_KEY,devUnlockAll?'1':'0');}catch(e){}}
const trackNum=s=>{
  const m=/(\d+)\s*$/.exec(String(s.no||''));
  return m?parseInt(m[1],10):99;
};
const chapterTrackOrder=ch=>ch.songs.slice().sort((a,b)=>trackNum(a)-trackNum(b)).map(s=>s.id);
/* SESSION 编号：游戏里轨道下面那行「4 LANES · SESSION 001」用的号。
   跨章连续编，跟着关卡顺序走：章序就是 CHAPTERS 的数组序（序章 → 初章 → 承章 → 终章 → EX），
   章内按 TRACK 号从小到大。序章 W. = 001，初章 TRACK 01→06 = 002→007，
   所以初章魔王曲 WELKIN（TRACK 06）就是 SESSION 007，往后接着 008… 一路数下去。
   编号挂在 song.session 上，改曲目表/插关卡都会自动重排，不用手写死号。 */
let sessionSeq=0;
CHAPTERS.forEach(ch=>{
  ch.songs.slice().sort((a,b)=>trackNum(a)-trackNum(b)).forEach(s=>{s.session=++sessionSeq;});
});
const sessionLabel=song=>'SESSION '+String((song&&song.session)||0).padStart(3,'0');
/* 跨章解锁：每章第一关挂在上一章最后一关上，过了才开。
   ch1 第一关要序章通关（prologue-1）；ch2 第一关要初章最后一关 TRACK 06 WELKIN（ch1-5）。
   ch3 那条门已经不走了——终章是永封（见 sealChapter3），表里留着只是为了完整。 */
const CH_GATE={ch1:'prologue-1',ch2:'ch1-5',ch3:'ch2-boss'};
function songClearedAnywhere(id){
  for(const k in clears){if(Array.isArray(clears[k])&&clears[k].includes(id))return true;}
  /* 个人最佳只会在「真的把这局打完」时写入。开发者模式里刷过的关、或者早期被
     「必须按顺序通关」那道判断吞掉的清关，clears 里查不到，但 bestMap 里有记录，
     一样算通过——省得老存档卡在初章→承章那道门上。 */
  return !!(bestMap&&bestMap[id]);
}
function applyUnlocksInner(){
  if(devUnlockAll){
    /* 全解锁模式：所有章节打开、所有曲目全开（保留 clear 标记）。
       未接入谱面的曲目 state 也照常置 available，但详情页/开局的 chart 判断
       仍会拦下它们（CHART PENDING），所以「未安装铺面的关卡依然进不去」。
       本分支不写 clears，关掉即还原原始进度。 */
    CHAPTERS.forEach(ch=>{
      const ids=Array.isArray(clears[ch.id])?clears[ch.id]:[];
      ch.locked=false;
      ch.songs.forEach(s=>{
        s.state=ids.includes(s.id)?'clear':'available';
      });
      ch.cleared=ids.length;
      ch.progress=`${ids.length} / ${ch.songs.length}`;
    });
    return;
  }
  CHAPTERS.forEach(ch=>{
    if(ch.id==='prologue'){
      const ids=Array.isArray(clears[ch.id])?clears[ch.id]:[];
      ch.locked=false;
      ch.songs.forEach(s=>{s.state=ids.includes(s.id)?'clear':'available';});
      ch.cleared=ids.length;
      ch.progress=`${ids.length} / ${ch.songs.length}`;
      return;
    }
    if(ch.id==='ex'){
      ch.locked=!exUnlocked;
      const ids=Array.isArray(clears[ch.id])?clears[ch.id]:[];
      ch.cleared=ids.length;
      ch.progress=ch.locked?'LOCKED':`${ids.length} / ${ch.songs.length}`;
      ch.songs.forEach(s=>{s.state=ch.locked?'locked':(ids.includes(s.id)?'clear':'available');});
      return;
    }
    /* 终章不归这里管：封条由 sealChapter3 在每次 applyUnlocks 收尾时压死，
       跟进度、跟开发者模式、跟老存档都没关系。这里只兜住「已经锁着」的那条分支。 */
    if(ch.locked){ch.cleared=0;ch.progress='LOCKED';ch.songs.forEach(s=>{s.state='locked';});return;}
    const order=chapterTrackOrder(ch);
    order.forEach((id,i)=>{
      const s=ch.songs.find(x=>x.id===id);if(!s)return;
      if(clears[ch.id]&&clears[ch.id].includes(id)){s.state='clear';return;}
      if(i===0){
        const gate=CH_GATE[ch.id];
        s.state=(!gate||songClearedAnywhere(gate))?'available':'locked';return;
      }
      const prevId=order[i-1];
      s.state=(clears[ch.id]&&clears[ch.id].includes(prevId))?'available':'locked';
    });
    const ids=Array.isArray(clears[ch.id])?clears[ch.id]:[];
    ch.cleared=ids.length;
    ch.progress=`${ids.length} / ${ch.songs.length}`;
  });
}
/* 终章封条。作者定死的规则：第三章永远锁着——
   承章全清不开、开发者模式不开、老存档里有过清关记录也不开。
   每次算完解锁状态都在最后压一次，任何分支（包括全解锁）都翻不过去。
   真要放人进去，只改 CH3_SEALED 这一行。 */
const CH3_SEALED=true;
function sealChapter3(){
  if(!CH3_SEALED)return;
  const ch=CHAPTERS.find(c=>c.id==='ch3');
  if(!ch)return;
  ch.locked=true;
  ch.cleared=0;
  ch.progress='LOCKED';
  ch.songs.forEach(s=>{s.state='locked';});
}
function applyUnlocks(){
  applyUnlocksInner();
  sealChapter3();
}
/* 解锁状态变了而玩家正停在章节选择页时，卡片不会自己重画（SIGNAL SEALED 会赖在 DOM 上）。
   开发者模式开关完主动刷一次，免得「已经解锁了但界面还锁着」。 */
function refreshChapterSelectIfActive(){
  if(chapterScreen&&chapterScreen.classList.contains('active'))renderChapterSelect();
}
function markSongCleared(song){
  if(!song)return;
  const ch=CHAPTERS.find(c=>c.id===song.chapterId);if(!ch)return;
  /* 以前这里有一条「上一关没通关就不记账」的保护，开发者模式直接跳关时会被它吞掉。
     能进这一局本身就说明关是开着的，所以清关一律照记。 */
  if(!Array.isArray(clears[ch.id]))clears[ch.id]=[];
  if(!clears[ch.id].includes(song.id))clears[ch.id].push(song.id);
  song.state='clear';
  applyUnlocks();
  saveClears();
}
const EX_KEY='welkin_os_ex_unlocked';
let exUnlocked=false;
try{exUnlocked=localStorage.getItem(EX_KEY)==='1';}catch(e){}
function anyAP(){
  for(const k in bestMap){if(bestMap[k]&&bestMap[k].ap)return true;}
  return false;
}
function unlockExIfPossible(){
  if(!exUnlocked&&anyAP())exUnlocked=true;
  const ex=CHAPTERS.find(c=>c.id==='ex');
  if(ex)ex.locked=!exUnlocked;
  try{localStorage.setItem(EX_KEY,exUnlocked?'1':'0');}catch(e){}
  applyUnlocks();
}
unlockExIfPossible();
let currentChapter=CHAPTERS[0],chapterFocus=0,selectedChapter=CHAPTERS[0];
let selectedSong=EFFULGENCE,detailSource='songselect',detailReadyAt=0,uiLockUntil=0;
/* 第一章 6 张卡：画布 150%，普通卡 12%、魔王曲 14%（物理尺寸和 130% 时的 14/16 一样），
   彼此留 3.4% 空隙（约 37px），不再一张贴一张。
   下标即 ch1.songs 的数组序：[魔王曲, TRACK01, 02, 03, 04, 05]，
   所以 index0 在最上面，index1(TRACK01) 压到 80% 收尾，从 01 往上逐关爬。 */
const SS_POS={
  ch1:[[50,1],[67,80],[33,64.6],[67,49.2],[33,33.8],[67,18.4]],
  /* 承章 7 首：画布 150%，普通卡 11%、魔王曲 13%（物理尺寸和原来 130% 时的 14/16 一致），
     彼此留 2% 空隙。下标即 ch2.songs 数组序：[魔王曲, 01,02,03,04,05,06]。 */
  ch2:[[50,1],[67,81],[33,68],[67,55],[33,42],[67,29],[33,16]],
  /* 终章 8 首：11-16 起位置/高度不再用这张表，改由 ch3Stack 按视口现算（见下面的 ch3Stack），
     这里留一份旧数据只是兜底（ch3Stack 万一取不到 songs 时的退路）。
     旧口径：画布 170%、普通卡 7.3%、魔王曲 9.1%，TRACK 01 收在 80.2%。 */
  ch3:[[50,9.1],[50,72.9],[67,62.9],[33,52.9],[67,42.9],[33,32.8],[67,22.8],[50,0.9]]
};
const SS_POS_M={
  ch1:[[50,1],[70,80],[30,64.6],[70,49.2],[30,33.8],[70,18.4]],
  ch2:[[50,1],[70,81],[30,68],[70,55],[30,42],[70,29],[30,16]],
  /* 窄屏终章同样改走 ch3Stack，这张表只是兜底。旧口径：画布 185%、普通卡 8.4%。 */
  ch3:[[50,8.5],[50,73.5],[70,62.8],[30,52.1],[70,41.4],[30,30.7],[70,20.0],[50,0.3]]
};
function chapterPreviewHTML(ch){
  const art=ch.previewArt
    ?`<div class="ch-art img" style="background-image:url('${imgUrl(ch.previewArt)}')"></div><div class="ch-veil"></div>`
    :'<div class="ch-art"></div>';
  const only=ch.songs&&ch.songs.length===1?ch.songs[0]:null;
  const track=only?`<p class="ch-track"><em>${only.no}</em> ${only.title}</p>`:'';
  return `${art}<div class="ch-big">${ch.no}</div>
    <div class="ch-info"><span>${ch.locked?'ACCESS DENIED':'NOW SELECTING'}</span><h2>${ch.cn}</h2><p>${ch.en} — ${ch.sub}</p>${track}<b>${ch.locked?'CHAPTER LOCKED':'ENTER CHAPTER →'}</b></div>
    <div class="ch-progress"><b>${ch.progress}</b>CHAPTER PROGRESS</div>`;
}
function updateChapterFocus(i){
  chapterFocus=i;
  $$('#chapterCards .ch-card').forEach((el,j)=>el.classList.toggle('on',j===i));
  const ch=CHAPTERS[i];
  $('#chapterPreview').innerHTML=chapterPreviewHTML(ch);
  $('#chapterPreview').classList.toggle('attack',ch.id==='ch2');
}
function enterChapter(ch){
  if(!ch)return;
  if(ch.id==='prologue'&&!ch.locked){openPrologue();return;}
  /* 终章永久封条：不管 locked 被谁改成什么样，这里再压一次，进不去就是进不去。 */
  if(ch.id==='ch3'&&CH3_SEALED){sealChapter3();ch.locked=true;}
  if(ch.locked){
    if(ch.id==='ex'){
      unlockExIfPossible();
      if(exUnlocked){
        showExNotice('ACCESS GRANTED','EX 章节已解开 · ENTER TO CONTINUE');
        renderChapterSelect();
      }else{
        showExNotice('AP REQUIRED','需要 AP 一首歌才能解开 EX 章节');
      }
      uiSound(.6);
      return;
    }
    const card=$('#chapterCards .ch-card[data-i="'+chapterFocus+'"]');
    if(card){card.classList.add('denied');setTimeout(()=>card.classList.remove('denied'),420);}
    const pv=$('#chapterPreview');
    if(pv){pv.classList.add('denied');setTimeout(()=>pv.classList.remove('denied'),420);}
    uiSound(.55);
    return;
  }
  if(ch.id==='ex'){openExChapter();return;}
  openSongSelect(ch);
}
function renderChapterSelect(){
  $('#chapterPreview').innerHTML=chapterPreviewHTML(CHAPTERS[chapterFocus]);
  $('#chapterPreview').classList.toggle('attack',CHAPTERS[chapterFocus].id==='ch2');
  const totalTracks=CHAPTERS.reduce((n,ch)=>n+ch.songs.length,0);
  const cnt=$('#chStatusCount');
  if(cnt)cnt.textContent=`${CHAPTERS.length} CHAPTERS / ${totalTracks} TRACKS`;
  $('#chapterCards').innerHTML=CHAPTERS.map((ch,i)=>`<button type="button" class="ch-card ${i===chapterFocus?'on':''} ${ch.id==='ex'?'ex':''} ${ch.id==='prologue'?'prologue':''} ${ch.locked?'locked':''} ${ch.id==='ch2'?'attack':''} ${ch.id==='ch3'?'ch3':''}" data-i="${i}">
    <span class="ch-no">${ch.no}</span><span class="ch-en">${ch.en}</span><h3>${ch.cn}</h3><p>${ch.sub}</p>${ch.locked?(ch.id==='ch3'?'<span class="ch-tech-lock"><i class="lock-glyph"></i>SIGNAL SEALED</span>':'<span class="ch-lock">ACCESS LOCKED</span>'):''}<span class="ch-bar"><i style="width:${ch.locked?0:Math.round((ch.cleared||0)/Math.max(1,ch.songs.length)*100)}%"></i></span>
  </button>`).join('');
  $$('#chapterCards .ch-card').forEach(el=>{
    const i=Number(el.dataset.i);
    el.addEventListener('mouseenter',()=>{if(i!==chapterFocus)updateChapterFocus(i);});
    el.addEventListener('focus',()=>{if(i!==chapterFocus)updateChapterFocus(i);});
    el.addEventListener('click',()=>{
      if(performance.now()<uiLockUntil)return;
      const ch=CHAPTERS[i];chapterFocus=i;
      updateChapterFocus(i);
      enterChapter(ch);
    });
  });
}
/* 进章前把该章所有曲绘先解码一遍，别让选歌页里的 <img> 一张张往外跳。
   列表直接从该章的 songs 里按顺序取（去重、跳过没曲绘的），
   以后初章/承章再加歌、换曲绘，这里的张数自动跟着走，不会再停在 5。
   序章和 EX 是单曲页，各走自己的 gate，不在这里排队。 */
function chapterCoverList(id){
  const ch=CHAPTERS.find(c=>c.id===id);
  if(!ch||!ch.songs)return null;
  const no=s=>Number(String(s.no||'').replace(/\D+/g,''))||99;
  const out=[];
  ch.songs.filter(s=>s.cover).sort((a,b)=>no(a)-no(b))
    .forEach(s=>{if(out.indexOf(s.cover)<0)out.push(s.cover);});
  return out.length?out:null;
}
const CHAPTER_COVER_GATES={
  ch1:chapterCoverList('ch1'),
  ch2:chapterCoverList('ch2')||CH2_COVER_FILES
};
function gateChapterCovers(ch,done){
  const covers=ch?CHAPTER_COVER_GATES[ch.id]:null;
  if(!covers||!covers.length){done();return;}
  const layer=$('#selLoading');if(!layer){done();return;}
  const isCh2=ch.id==='ch2';
  layer.classList.add('active');
  layer.classList.toggle('ch2',isCh2);
  const kick=$('#selLoadKicker'),title=$('#selLoadTitle');
  if(kick)kick.textContent=isCh2?'ASCENT DATA LINK // COVER STREAM':'CHAPTER DATA LINK // COVER STREAM';
  if(title)title.textContent=isCh2?'SIGNAL UPLINK':'ARCHIVE UPLINK';
  const bar=$('#selLoadBar'),txt=$('#selLoadTxt');
  bar.style.width='0%';txt.textContent='COVER 0 / '+covers.length;
  /* 承章的 6 张图在本机几乎是瞬间读完的，给 loading 留一个 650ms 的最短停留，
     不然「SIGNAL UPLINK」只闪一帧就没了。初章保持原来的节奏不动。 */
  const startedAt=performance.now();
  const minShow=isCh2?650:0;
  let loaded=0,finished=false;
  const tick=()=>{
    if(finished)return;
    loaded++;
    bar.style.width=Math.round(loaded/covers.length*100)+'%';
    txt.textContent='COVER '+loaded+' / '+covers.length;
    if(loaded>=covers.length){
      finished=true;
      const wait=220+Math.max(0,minShow-(performance.now()-startedAt));
      setTimeout(()=>{layer.classList.remove('active');done();},wait);
    }
  };
  covers.forEach(src=>{
    const im=new Image();
    let t=false;
    const once=()=>{if(!t){t=true;tick();}};
    im.onload=once;im.onerror=once;
    setTimeout(once,6000);
    im.src=imgUrl(src);
  });
}
/* EX chapter: tech notice + separate cover preload + direct song entry */
let exNoticeTimer=0;
function showExNotice(title,text){
  const el=$('#exNotice');if(!el)return;
  const tEl=$('#exNoticeTitle'),xEl=$('#exNoticeText');
  if(tEl)tEl.textContent=title;
  if(xEl)xEl.textContent=text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(exNoticeTimer);
  exNoticeTimer=setTimeout(()=>el.classList.remove('show'),1100);
}
function gateSoloCover(src,label,done){
  const layer=$('#selLoading');if(!layer){done();return;}
  layer.classList.add('active');
  const bar=$('#selLoadBar'),txt=$('#selLoadTxt');
  if(bar)bar.style.width='0%';
  if(txt)txt.textContent='LOADING COVER · '+label;
  const im=new Image();
  let t=false;
  const once=()=>{if(t)return;t=true;if(bar)bar.style.width='100%';setTimeout(()=>{layer.classList.remove('active');done();},220);};
  im.onload=once;im.onerror=once;
  setTimeout(once,6000);
  im.src=imgUrl(src);
}
function gateStillCover(done){gateSoloCover(STILL.cover||'Still.avif','STILL',done);}
function gatePrologue(done){
  const layer=$('#proLoading');if(!layer){done();return;}
  const startedAt=performance.now();
  layer.classList.add('active');
  const bar=$('#proLoadBar'),txt=$('#proLoadTxt');
  if(bar)bar.style.width='0%';
  if(txt)txt.textContent='DECODING SEED_00';
  const im=new Image();
  let settled=false;
  const finish=()=>{
    if(settled)return;settled=true;
    if(bar)bar.style.width='100%';
    const wait=Math.max(0,760-(performance.now()-startedAt));
    setTimeout(()=>{layer.classList.remove('active');done();},wait);
  };
  im.onload=finish;im.onerror=finish;
  setTimeout(finish,5000);
  im.src=imgUrl(PROLOGUE_W.cover||'wel.avif');
}

/* ---------- PROLOGUE · DATAFALL ---------- */
let proRainActive=false;
const PRO_RAIN_CHARS='01ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
function stopPrologueRain(){
  proRainActive=false;
  const rail=$('#proRain');
  if(rail)rail.innerHTML='';
}
function startPrologueRain(){
  const rail=$('#proRain');if(!rail)return;
  stopPrologueRain();
  const w=window.innerWidth||390;
  const cols=Math.max(16,Math.min(96,Math.round(w/22)));
  const lines=110;
  const frag=document.createDocumentFragment();
  for(let i=0;i<cols;i++){
    const col=document.createElement('span');
    col.className='pro-col';
    let block='';
    for(let j=0;j<lines;j++){
      block+=PRO_RAIN_CHARS[(Math.random()*PRO_RAIN_CHARS.length)|0];
      if(j<lines-1)block+='\n';
    }
    col.textContent=block+'\n'+block;
    col.style.left=(i*(100/cols)+(Math.random()*1.4-.7)).toFixed(2)+'%';
    col.style.animationDuration=(16+Math.random()*16).toFixed(1)+'s';
    col.style.animationDelay=(-Math.random()*24).toFixed(1)+'s';
    col.style.opacity=(.16+Math.random()*.34).toFixed(2);
    frag.appendChild(col);
  }
  rail.appendChild(frag);
  proRainActive=true;
}

/* ---------- EX · HOLO rain (thin streaks, transform-only, light) ---------- */
let exRainActive=false;
function stopExRain(){
  exRainActive=false;
  const rail=$('#exRain');
  if(rail)rail.innerHTML='';
}
function startExRain(){
  const rail=$('#exRain');if(!rail)return;
  stopExRain();
  const w=window.innerWidth||390;
  const n=Math.max(20,Math.min(64,Math.round(w/(PERF_LITE?20:14))));
  const frag=document.createDocumentFragment();
  for(let i=0;i<n;i++){
    const d=document.createElement('i');
    d.className='ex-drop';
    d.style.left=(Math.random()*104-2).toFixed(2)+'%';
    d.style.height=(16+Math.random()*30).toFixed(0)+'px';
    d.style.animationDuration=(1.1+Math.random()*1.6).toFixed(2)+'s';
    d.style.animationDelay=(-Math.random()*3).toFixed(2)+'s';
    d.style.opacity=(.18+Math.random()*.4).toFixed(2);
    frag.appendChild(d);
  }
  rail.appendChild(frag);
  exRainActive=true;
}
window.addEventListener('resize',()=>{if(proRainActive)startPrologueRain();if(exRainActive)startExRain();});

let proDecodeToken=0;
function decodePrologueTitle(){
  const el=$('#proTitle');if(!el)return;
  const target=el.textContent||'W';
  const glyphs='ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789$%&/<>*+=-#';
  const t0=performance.now(),DUR=1900;
  const token=++proDecodeToken;
  const step=()=>{
    if(token!==proDecodeToken)return;
    const p=Math.min(1,(performance.now()-t0)/DUR);
    const e=1-Math.pow(1-p,2);
    const settled=Math.floor(e*(target.length+1));
    let out='';
    for(let i=0;i<target.length;i++)out+=(i<settled)?target.charAt(i):glyphs[(Math.random()*glyphs.length)|0];
    el.textContent=out;
    if(p<1)requestAnimationFrame(step);
    else el.textContent=target;
  };
  requestAnimationFrame(step);
}
/* 曲绘统一走背景图：元素上没有 <img>，长按/拖拽都拿不到图片文件。 */
function setCoverArt(el,src,fallback){
  if(!el)return;
  const u=imgUrl(String(src||fallback||'').replace(/["\\]/g,''));
  if(!u){el.style.backgroundImage='';return;}
  el.style.backgroundImage='url("'+u+'")';
}
function renderPrologue(){
  const s=PROLOGUE_W;
  setCoverArt($('#proCover'),s.cover,'wel.avif');
  const title=$('#proTitle');if(title)title.textContent=s.title||'W';
  const ap=!!(getBestFor(s.id).ap);
  const core=$('#proCore');if(core)core.classList.toggle('ap',ap);
  decodePrologueTitle();
}
function openPrologue(){
  state='LOADING';
  uiLockUntil=performance.now()+400;
  navBaseOn();
  gatePrologue(()=>{
    const ch=CHAPTERS.find(c=>c.id==='prologue');
    selectedChapter=ch||CHAPTERS[0];
    retireNavLayer(chapterScreen);
    retireNavLayer(exScreen);
    retireNavLayer(songSelectScreen);
    retireNavLayer(songScreen);
    showNavLayer(prologueScreen);
    state='SONGSELECT';
    renderPrologue();
    stopExRain();
    startPrologueRain();
    playUIMusic('select',false);
    uiSound(1.05);
  });
}
function startPrologueSession(){
  if(performance.now()<uiLockUntil)return;
  openSongDetail(PROLOGUE_W,'prologue');
}
/* 序章 → 紫色 GUIDE：操作 / 音符 / 判定 / 分数 / 评级 一份说明。
   只是覆盖层，不动 state，也不拦触屏输入层（面板自己吃掉事件）。 */
function openProGuide(){
  const g=$('#proGuide');
  if(!g||g.classList.contains('active'))return;
  const body=$('.gd-body',g);
  if(body){
    if(!body.__gdBound){
      body.__gdBound=true;
      body.addEventListener('scroll',()=>{body.classList.toggle('is-scrolled',body.scrollTop>2);},{passive:true});
    }
    body.scrollTop=0;
    body.classList.remove('is-scrolled');
  }
  g.classList.add('active');
  g.setAttribute('aria-hidden','false');
  uiSound(1.2);
}
function closeProGuide(){
  const g=$('#proGuide');
  if(!g||!g.classList.contains('active'))return;
  g.classList.remove('active');
  g.setAttribute('aria-hidden','true');
  uiSound(.9);
}
function closeSolo(){
  if(!prologueScreen.classList.contains('active')&&!exScreen.classList.contains('active'))return;
  retireNavLayer(prologueScreen);
  retireNavLayer(exScreen);
  stopPrologueRain();
  stopExRain();
  proDecodeToken++;
  showNavLayer(chapterScreen);
  state='CHAPTER';
  chapterFocus=Math.max(0,CHAPTERS.findIndex(c=>c.id===(selectedChapter&&selectedChapter.id)));
  renderChapterSelect();
  playUIMusic('select',false);
  uiSound(.9);
}

/* ---------- EX · HOLO ---------- */
function renderExScreen(){
  const s=STILL;
  setCoverArt($('#exCover'),s.cover,'Still.avif');
  const ap=!!(getBestFor(s.id).ap);
  const frame=$('#exFrame');if(frame)frame.classList.toggle('ap',ap);
  const base=String(s.title||'Still').replace(/\s*\(.*?\)\s*/g,'').trim();
  const title=$('#exTitle');if(title)title.textContent=(base||'Still').toUpperCase();
  const m=/\((.*?)\)/.exec(String(s.title||''));
  const sub=$('#exSub');if(sub)sub.textContent=m?m[1].toUpperCase():'ORIGINAL SESSION';
  const len=$('#exLen');if(len)len.textContent=s.length||'--:--';
  const charter=$('#exCharter');if(charter)charter.textContent=s.charter||'—';
  const lv=$('#exLevel');if(lv)lv.textContent='LV.'+s.level;
  const notes=$('#exNotes');if(notes)notes.textContent=s.notes||'—';
  const starBtn=$('#btnStillLetter');
  if(starBtn){starBtn.classList.toggle('on',ap);starBtn.classList.toggle('locked',!ap);}
}
function showExScreen(){
  const ex=CHAPTERS.find(c=>c.id==='ex');
  selectedChapter=ex||CHAPTERS[CHAPTERS.length-1];
  stopPrologueRain();
  retireNavLayer(chapterScreen);
  retireNavLayer(prologueScreen);
  retireNavLayer(songSelectScreen);
  retireNavLayer(songScreen);
  showNavLayer(exScreen);
  state='SONGSELECT';
  renderExScreen();
  startExRain();
  playUIMusic('select',false);
  uiSound(1.1);
}
function openExChapter(){
  if(!exUnlocked&&!devUnlockAll)return;
  state='LOADING';
  uiLockUntil=performance.now()+400;
  navBaseOn();
  gateStillCover(showExScreen);
}
function startExSession(){
  if(performance.now()<uiLockUntil)return;
  openSongDetail(STILL,'ex');
}
function openStillLetter(){
  const b=getBestFor(STILL.id);
  if(!(b&&b.ap)){uiSound(.5);return;}
  const ov=$('#letterOverlay');if(ov)ov.classList.add('active');
  uiSound(1.2);
}
function closeStillLetter(){
  const ov=$('#letterOverlay');if(ov)ov.classList.remove('active');
  uiSound(.9);
}
/* ---------- 页面切换：底衬 + 交叉淡出 ----------
   大厅（.room）在 z-index 0，选章 / 选曲 / 曲目 / 序章 / EX 都是 .layer（opacity 淡入 .5s）。
   以前切页是「旧页立刻 remove、新页从 0 淡入」，那半秒里最底下的大厅就露了出来——
   这就是点进章节 / 点开曲目时闪几帧大厅的根因。
   现在两层保障：
     1. #navBase（z-index 49，垫在所有选择页下面、大厅上面）在进入这些页面时立刻不透明；
     2. 旧页不立刻抽走，等新页淡入完成再撤，两页真正交叉淡化。
   离开这些页面回大厅时才撤底衬，于是「回大厅」依旧是正常的淡出。 */
const NAV_RETIRE_MS=560;
function navBaseOn(){
  if(navBase)navBase.classList.add('on');
  /* 进选章 / 选曲 / 曲目页时大厅钢琴 BGM 立刻收住，别和选曲 BGM 叠在一起 */
  stopLobbyBgm();
}
function navBaseOff(){if(navBase)navBase.classList.remove('on');}
function showNavLayer(el){
  if(!el)return;
  if(el.__retireTimer){clearTimeout(el.__retireTimer);el.__retireTimer=0;}
  delete el.dataset.retiring;
  el.classList.add('active');
}
function retireNavLayer(el){
  if(!el||!el.classList.contains('active'))return;
  if(el.__retireTimer)clearTimeout(el.__retireTimer);
  el.dataset.retiring='1';
  el.__retireTimer=setTimeout(()=>{
    el.__retireTimer=0;
    if(el.dataset.retiring!=='1')return;
    delete el.dataset.retiring;
    el.classList.remove('active');
  },NAV_RETIRE_MS);
}
function openChapterSelect(){
  if(state==='GAME'||state==='PAUSED'||state==='RESULT'||state==='CHAPTER'||state==='SONGSELECT'||state==='LOADING')return;
  chapterFocus=0;selectedChapter=CHAPTERS[0];
  state='CHAPTER';
  uiLockUntil=performance.now()+300;
  navBaseOn();
  /* 每次打开章节页都按当前 clears / best 重算一遍解锁，别让上一轮的锁定状态挂在 DOM 上。 */
  applyUnlocks();
  gateChapterCovers(CHAPTERS[0],()=>{
    showNavLayer(chapterScreen);
    chapterScreen.classList.remove('closing');
    retireNavLayer(songSelectScreen);
    retireNavLayer(songScreen);
    renderChapterSelect();
    playUIMusic('select',true);
    uiSound(1.15);
  });
}
function closeChapterSelect(){
  if(!chapterScreen.classList.contains('active'))return;
  chapterScreen.classList.remove('active');
  if(state==='CHAPTER')state='PHONE';
  navBaseOff();
  syncUIMusic(true);
  uiSound(.9);
}
function openSongSelect(ch){
  if(!ch||ch.id==='ex'||ch.id==='prologue')return;
  currentChapter=ch;selectedChapter=ch;
  state='SONGSELECT';
  uiLockUntil=performance.now()+240;
  navBaseOn();
  gateChapterCovers(ch,()=>{
    retireNavLayer(chapterScreen);
    retireNavLayer(songScreen);
    showNavLayer(songSelectScreen);
    renderSongSelect();
    /* 进章时回到最上面（终章那首收尾曲藏在魔王曲上方，得从顶部看起）；
       从曲目详情返回时不重置，保持刚才滚到的位置。 */
    const sm=$('#ssMap');if(sm)sm.scrollTop=0;
    playUIMusic('select',false);
    uiSound(1.05);
  });
}
function closeSongSelect(){
  if(!songSelectScreen.classList.contains('active'))return;
  retireNavLayer(songSelectScreen);
  showNavLayer(chapterScreen);
  state='CHAPTER';
  renderChapterSelect();
  playUIMusic('select',false);
  uiSound(.9);
}
/* 卡片高度（占选歌画布的百分比）：终章画布拔高到 155%，所以卡片要按比例收一点，
   收尾曲(secret)再矮一点，好把它和魔王曲之间那段空留出来。
   普通曲从 9.8 收到 9（窄屏 12 → 11），把省下来的高度让给卡片之间的空隙。 */
function songNodeH(song){
  const narrow=window.innerWidth<=900;
  /* 终章所有宽度都不走这里：位置/高度由 ch3Stack 出，见下面。 */
  if(song.chapterId==='ch3'){
    const slim=window.innerWidth<700;
    if(slim)return song.secret?5.9:(song.boss?9.2:8.4);
    return song.secret?7.3:(song.boss?9.1:7.3);
  }
  /* 第一章画布抬到 150%，卡片按比例从 14/16 收到 12/14，物理尺寸和原来一模一样，
     省下来的高度全给卡片之间那 3.4% 的空隙。 */
  if(song.chapterId==='ch1')return song.boss?14:12;
  /* 承章也抬到 150%，7 首按 11/13 收（物理尺寸和 130% 时的 14/16 一致），
     留出的高度给 7 张卡之间那 2% 的空隙。 */
  const tall=song.chapterId==='ch2';
  return song.boss?(tall?13:21):(tall?11:18);
}
/* ---------- 终章卡片堆叠（手机/平板/桌面同一套） ----------
   旧写法把 8 张卡的位置/高度写死在 SS_POS.ch3，百分比挂在一条固定 170% 高的画布上：
   画布高随窗口高走，卡片高只听画布百分比，于是平板这种「窗口矮、卡还宽」的比例下
   卡片被压成 271×82 的扁条，连曲绘（82px）都塞不进内边距，上下被裁掉一截。
   现在改成：卡片高度统一给百分比，纵向从 CH3_TOP 排到 CH3_BOTTOM、间距均分（卡片整体下移、
   底部留白收窄）；画布高度不写死，由「卡片至少要多高才装得下曲绘」反推（applySsMapScale）。
   数组序是 ch3.songs：[魔王曲, TRACK01..06, 收尾曲]，纵向从上到下则是
   收尾曲 → 魔王曲 → TRACK 06 → … → TRACK 01（01 在最下面，和 CIRCUIT 连线走向一致）。 */
const CH3_TOP=1,CH3_BOTTOM=90,CH3_H=8.6,CH3_BOSS_H=10.4;
const CH3_SCALE_MIN=1.5,CH3_SCALE_MAX=2.35;
function ch3Stack(songs){
  const idx=songs.map((s,i)=>i);
  const secret=idx.filter(i=>songs[i].secret);
  const boss=idx.filter(i=>songs[i].boss);
  /* 普通曲按 TRACK 号倒序：06 在上、01 在最下 */
  const rest=idx.filter(i=>!songs[i].secret&&!songs[i].boss)
    .sort((a,b)=>trackNum(songs[b])-trackNum(songs[a]));
  const order=secret.concat(boss,rest);
  const hsByOrder=order.map(i=>songs[i].boss?CH3_BOSS_H:CH3_H);
  const sumH=hsByOrder.reduce((a,b)=>a+b,0);
  const n=order.length;
  const gap=(CH3_BOTTOM-CH3_TOP-sumH)/Math.max(1,n-1);
  const pts=order.map(()=>[50,0]);
  const hs=order.map(()=>0);
  let y=CH3_TOP;
  order.forEach((songIdx,k)=>{
    /* 左右摆：收尾曲/魔王曲居中，普通曲 67/33 交替，最下面那张回中间收线 */
    let x=50;
    if(!songs[songIdx].secret&&!songs[songIdx].boss){
      const normalRank=k-(secret.length+boss.length);
      x=(normalRank===rest.length-1)?50:(normalRank%2===0?67:33);
    }
    pts[songIdx]=[x,+y.toFixed(2)];
    hs[songIdx]=hsByOrder[k];
    y+=hsByOrder[k]+gap;
  });
  return {pts,hs};
}
/* 画布高度反推：卡片至少要 coverPx + 上下内边距 + 一点余量，才不像被裁过的扁条。
   手机/平板/桌面同一套：卡片高度的百分比一样，画布跟着视口高度伸缩，物理尺寸就跟着曲绘走。
   11-22 承章也走这套：它原来把画布写死 150%，卡片高度就只听窗口高——1280x720 上卡片只剩
   95px，曲绘 82px 上下各留 6.6px，几乎顶到卡片边框，这就是「曲绘贴着卡片边缘」的由来。
   现在按曲绘反推画布，矮窗口卡片自动变大，任何尺寸都留出余量；上限 1.85 是不让内容滚太远。 */
const MAP_SCALE_MIN={ch2:1.5,ch3:CH3_SCALE_MIN};
const MAP_SCALE_MAX={ch2:1.85,ch3:CH3_SCALE_MAX};
function applySsMapScale(ch){
  const map=$('#ssMap');
  if(!map)return;
  if(!ch||(ch.id!=='ch2'&&ch.id!=='ch3')){map.style.removeProperty('--ss-map-h');return;}
  const vh=map.clientHeight||0;
  if(vh<=0){map.style.removeProperty('--ss-map-h');return;}
  const card=$('#ssNodes .ss-node:not(.boss)')||$('#ssNodes .ss-node');
  let coverPx=0,pad=14;
  if(card){
    const cov=card.querySelector('.ss-cover');
    if(cov)coverPx=cov.getBoundingClientRect().height;
    const cs=getComputedStyle(card);
    pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
  }
  /* 普通卡占画布的百分比：承章 11%（见 songNodeH），终章 CH3_H */
  const frac=(ch.id==='ch3'?CH3_H:11)/100;
  /* 终章沿用原来的 14px 余量；承章要更松，留 18px */
  const slack=ch.id==='ch3'?14:18;
  const target=clamp(coverPx?coverPx+pad+slack:104,96,176);
  const scale=clamp(target/(frac*vh),MAP_SCALE_MIN[ch.id],MAP_SCALE_MAX[ch.id]);
  map.style.setProperty('--ss-map-h',(scale*100).toFixed(1)+'%');
}
/* 窗口变化时重算画布高度（坐标都是百分比，不需要重新排） */
function refreshSongMapScale(){
  if(currentChapter)applySsMapScale(currentChapter);
}
function songNodeHTML(song,i,pos,hOverride){
  const stateClass=song.state==='available'?'avail':song.state==='clear'?'clear':'locked';
  const disabled=(song.state==='available'||song.state==='clear')||(song.state==='locked'&&!(song.boss&&song.chart))?'':'disabled';
  const locked=song.state==='locked';
  /* 没解锁的卡罩黑雾；song.shroud 是以前「承章整章不揭」留下的开关，暂时没有曲目用它，
     留着以后想整章藏的时候直接挂上去。 */
  const shrouded=locked||!!song.shroud;
  const hidden=locked||!!song.shroud;
  /* 曲名规则（所有章节统一）：未解锁 → 「?」；魔王曲 → 「？？？」；收尾曲同样是「？？？」，
     只让人知道这一关藏着东西，不泄曲名。解锁之后照常显示真名。 */
  const title=hidden?(song.boss||song.secret?'???':'?'):song.title;
  const best=getBestFor(song.id);
  const apCls=(best&&best.ap)?' ap':'';
  const tall=song.chapterId==='ch2'||song.chapterId==='ch3';
  const nodeH=hOverride!=null?hOverride:songNodeH(song);
  const numLabel=song.boss?(tall?song.no:'FINAL / '+String(trackNum(song)).padStart(2,'0')):song.no;
  const stateText=song.state==='available'?'READY':song.state==='clear'?'CLEAR':(song.secret?'···':'LOCKED');
  /* 曲绘铺法：按 COVER_CROP 里的对准点写行内变量，CSS 那边只认这两个变量。
     变量直接挂在 inline style 上——背景图本来就在这儿，位置和缩放跟着一起走。 */
  const coverCrop=song.cover?(COVER_CROP[song.cover]||null):null;
  const coverVars=coverCrop?`${coverCrop.pos?`--cover-pos:${coverCrop.pos};`:''}${coverCrop.fit?`--cover-size:${coverCrop.fit};`:''}`:'';
  return `<button type="button" class="ss-node ${stateClass} ${song.boss?'boss':''} ${song.secret?'secret':''}" data-i="${i}" ${disabled} style="left:${pos[0]}%;top:${pos[1]}%;height:${nodeH}%">
    <span class="ss-cover ${song.cover?'art':''}${apCls}"${song.cover?` style="background-image:url('${imgUrl(song.cover)}');${coverVars}"`:''}>${song.boss?'<i class="boss-frame"></i>':''}${shrouded?'<span class="ss-fog tf"></span><span class="ss-fog bf"></span>':''}</span><span class="ss-copy"><span class="ss-num">${numLabel}</span><h3>${title}</h3></span>
    <span class="ss-state">${stateText}</span>${song.boss?'<i class="glitch"></i>':''}
  </button>`;
}
/* 收尾曲和魔王曲之间那条「混乱、几乎透明」的虚点连线：
   几股断裂的短折线 + 散点，每次进章都用同一个种子重排，看着像信号残迹。 */
function finaleLinkSVG(ch,pts,hs){
  const fin=ch.songs.findIndex(s=>s.secret);
  const bossI=ch.songs.findIndex(s=>s.boss);
  if(fin<0||bossI<0)return '';
  const cx=pts[fin][0];
  const yTop=pts[fin][1]+hs[fin];
  const yBot=pts[bossI][1];
  if(!(yBot>yTop))return '';
  let seed=0x7a31c9;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  let out='';
  for(let s=0;s<4;s++){
    const steps=5+Math.floor(rnd()*3);
    let d='';
    for(let k=0;k<=steps;k++){
      const t=k/steps;
      const x=cx+(rnd()-.5)*5.2;
      const y=yTop+(yBot-yTop)*t+(rnd()-.5)*1.4;
      d+=(k?' L ':'M ')+x.toFixed(2)+' '+y.toFixed(2);
    }
    out+=`<path d="${d}" fill="none" stroke="rgba(198,255,246,${(0.06+rnd()*0.09).toFixed(3)})" stroke-width="${(0.6+rnd()*0.5).toFixed(2)}" stroke-dasharray="${(1.2+rnd()*2.4).toFixed(1)} ${(2.6+rnd()*4.2).toFixed(1)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  for(let k=0;k<30;k++){
    const x=cx+(rnd()-.5)*7.4;
    const y=yTop+rnd()*(yBot-yTop);
    out+=`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(0.09+rnd()*0.16).toFixed(2)}" fill="rgba(212,255,250,${(0.06+rnd()*0.14).toFixed(3)})"/>`;
  }
  return `<g class="ss-finale-link">${out}</g>`;
}
/* 连线走线顺序：CIRCUIT 是直角折线，按曲序(TRACK 01→06)走成阶梯，
   01 关在最下面，从 01 往上爬到魔王曲；其它 layout 保持原来的走向。
   chain 是 ch.songs 的数组下标(已排除 secret)，songs 用于按 track 号排序。 */
function pathOrderFor(layout,chain,songs){
  if(layout==='CIRCUIT')return chain.slice().sort((a,b)=>trackNum(songs[a])-trackNum(songs[b]));
  return [chain[0],...chain.slice(1).reverse()];
}
function renderSongSelect(){
  const ch=currentChapter;
  const layout=ch.layout;
  songSelectScreen.className='layer song-select '+ch.theme+' active';
  $('#ssChapterNo').textContent=ch.no;
  $('#ssChapterCn').textContent=ch.cn;
  $('#ssChapterCn').dataset.text=ch.cn;
  $('#ssChapterEn').textContent=ch.en;
  $('#ssProgress').textContent=ch.progress+' CLEARED';
  /* 终章：位置/高度都走 ch3Stack 现算（手机/平板/桌面同一套），其它章节还是原来写死的表 */
  const geom=ch.id==='ch3'?ch3Stack(ch.songs):null;
  const pts=geom?geom.pts:(window.innerWidth<700?(SS_POS_M[ch.id]||SS_POS_M.ch1):(SS_POS[ch.id]||SS_POS.ch1));
  const hs=geom?geom.hs:ch.songs.map(songNodeH);
  $('#ssNodes').innerHTML=ch.songs.map((s,i)=>songNodeHTML(s,i,pts[i]||[50,50],geom?hs[i]:null)).join('');
  const centers=pts.map((p,i)=>[p[0],p[1]+hs[i]/2]);
  /* 收尾曲不进主线回路，它跟魔王曲之间单独连虚点 */
  const chain=ch.songs.map((s,i)=>i).filter(i=>!ch.songs[i].secret);
  const pathOrder=pathOrderFor(layout,chain,ch.songs);
  const pathCenters=pathOrder.map(i=>centers[i]);
  let d='M '+pathCenters[0][0]+' '+pathCenters[0][1];
  for(let i=1;i<pathCenters.length;i++){
    const p=pathCenters[i],q=pathCenters[i-1];
    if(layout==='ORBIT'){const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;d+=` Q ${mx} ${q[1]} ${mx} ${my} T ${p[0]} ${p[1]}`;}
    else if(layout==='CIRCUIT'){d+=` L ${p[0]} ${q[1]} L ${p[0]} ${p[1]}`;}
    else {d+=` C ${q[0]} ${(q[1]+p[1])/2} ${p[0]} ${(q[1]+p[1])/2} ${p[0]} ${p[1]}`;}
  }
  $('#ssPath').innerHTML=`<path class="ss-base" d="${d}" vector-effect="non-scaling-stroke"/><path class="ss-line" d="${d}" vector-effect="non-scaling-stroke"/>${pathCenters.map(p=>`<circle class="ss-dot" cx="${p[0]}" cy="${p[1]}" r=".8" vector-effect="non-scaling-stroke"/>`).join('')}${finaleLinkSVG(ch,pts,hs)}`;
  /* 卡片已经进 DOM 了，能量到曲绘的实际高度，这时候再把画布高度定下来（只影响高度比例，不动坐标） */
  applySsMapScale(ch);
  const avail=ch.songs.find(s=>s.state==='available');
  $('#ssSide').innerHTML=`<span class="ss-kicker">CHAPTER ${ch.no} / ${ch.en}</span><h2>${ch.cn}</h2><p>${ch.sub}<br>BOSS AT TOP · ONE BY ONE UNLOCK</p><div class="ss-rule"></div><div class="ss-prog"><b>${ch.progress}</b>CHAPTER PROGRESS</div><div class="ss-unlock">NEXT UNLOCK<br><b>${avail?avail.no+' — READY':'—'}</b></div>`;
  $$('#ssNodes .ss-node').forEach(el=>{
    const song=ch.songs[Number(el.dataset.i)];
    if(song&&song.state==='locked'&&song.boss&&song.chart){
      let lp=0;
      const cancelLp=()=>{if(lp){clearTimeout(lp);lp=0;}};
      el.addEventListener('pointerdown',()=>{
        cancelLp();
        lp=setTimeout(()=>{
          lp=0;
          if(performance.now()<uiLockUntil)return;
          selectedChapter=ch;
          openSongDetail(song,'songselect');
          uiSound(1.15);
        },5000);
      });
      ['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,cancelLp));
      el.addEventListener('contextmenu',e=>e.preventDefault());
    }
    el.addEventListener('click',()=>{
      if(performance.now()<uiLockUntil)return;
      if(song&&(song.state==='available'||song.state==='clear')){selectedChapter=ch;openSongDetail(song,'songselect');}
    });
  });
  fitSongTitles();
}
/* 卡片窄的时候（手机 180px）长曲名会被 ellipsis 截成「テリトリーバ…」。
   这里量一下实际宽度，超了就一档一档缩字号，宁可小一号也要把曲名整个摆出来。 */
function fitSongTitles(){
  $$('#ssNodes .ss-node h3').forEach(h=>{
    h.style.fontSize='';
    let size=parseFloat(getComputedStyle(h).fontSize)||14;
    let guard=0;
    while(h.scrollWidth>h.clientWidth+1&&size>9&&guard++<14){
      size-=1;
      h.style.fontSize=size+'px';
    }
  });
}
function renderSongDetail(song){
  const blank=!song.cover;
  best=getBestFor(song.id);
  songScreen.classList.toggle('blank',blank);
  $('#songCrumb').innerHTML=`ARCHIVE <i>/</i> ${song.chapterNo} / ${song.no}`;
  $('#songTag').textContent=`${song.chapterCn} — ${song.chapterEn}`;
  $('#songTitle').textContent=song.title;
  $('#songTitle').classList.toggle('blank',blank);
  $('#songTitle').classList.toggle('long',song.title.length>7);
  $('#songArtist').innerHTML=`${song.artist} <span>/</span> ${blank?'AWAITING DATA':'ORIGINAL SESSION'}`;
  $('#songBpm').textContent=song.notes||'—';
  $('#songLength').textContent=song.length;
  $('#songCharter').textContent=song.charter;
  $('#songLevel').textContent=song.level+' / 20';
  $('#songDiff').innerHTML=Array.from({length:20},(_,i)=>`<i class="${i<song.level?'on':''}"></i>`).join('');
  const fi=$('#fingerInd');
  if(fi){
    const chip=fi.querySelector('.finger-chip');
    if(song.fingers==='multi'||song.fingers==='dual'){
      /* 多指=暗红 / 双指=暗绿。以前类名只挂在外层 .finger-ind 上，可 CSS 选的是
         .finger-chip.multi / .finger-chip.dual，两个模式都落在 chip 的默认绿上，
         看着一模一样。这里把类名同时挂到 chip 上，颜色才真的分得开。 */
      const mode=song.fingers==='multi'?'multi':'dual';
      fi.style.display='';
      fi.className='finger-ind '+mode;
      if(chip){chip.className='finger-chip '+mode;chip.textContent=mode==='multi'?'多指':'双指';}
    }else{
      fi.style.display='none';
    }
  }
  const hasBest=!!song.chart&&best&&best.score>0;
  $('#songBest').textContent=hasBest?pad7(best.score):'0000000';
  $('#songRank').textContent=hasBest?rankOf(best.score):'—';
  $('#songAcc').textContent=hasBest&&best.acc!=null?best.acc.toFixed(2)+'%':'—';
  syncMirrorBtn();
  $('#badgeAP').classList.toggle('on',!!(hasBest&&best.ap));
  $('#badgeFC').classList.toggle('on',!!(hasBest&&best.fc&&!best.ap));
  $('#coverImg').style.display=blank?'none':'block';
  if(song.cover)$('#coverImg').src=imgUrl(song.cover);
  /* 详情页的大曲绘也是 object-fit:cover 铺在斜面板上，会裁边。
     这里一律从图片顶边往下截（CSS 里 object-position:50% 0%），
     理由是人脸基本都在图的上方，而曲名屏幕上本来就有，被裁掉不可惜。 */
  $('#coverImg').style.objectPosition='';
  $('#coverInner').classList.toggle('blank',blank);
  $('#coverBlankText').textContent=`${song.chapterCn} / ${song.no}`;
  $('#coverRailRight').textContent=`${song.chapterNo} / ${song.no}`;
  $('#songBg').style.backgroundImage=blank?'none':`url('${imgUrl(song.cover)}')`;
  $('#songMarquee').textContent=`WELKIN AUDIO SYSTEM · ${song.chapterEn} · NOTES ${song.notes||'—'} · FOUR LANES · ${song.chart?'ALL SYSTEMS NOMINAL':'CHART DATA PENDING'} ·`;
  $('#songState').textContent=song.chart?'READY':'DATA PENDING';
  const btn=$('#btnStartGame');
  btn.disabled=true;
  btn.innerHTML=song.chart?'BEGIN SESSION <span>→</span>':'CHART PENDING';
  $('#songTip').innerHTML=song.chart?'<kbd>C</kbd><kbd>V</kbd><kbd>B</kbd><kbd>N</kbd> 四轨 / 或直接点击轨道':'<span>谱面尚未接入 · 该曲目等待制作</span>';
  setTimeout(()=>{
    if(songScreen.classList.contains('active')&&selectedSong===song&&song.chart){btn.disabled=false;detailReadyAt=performance.now()-300;}
  },300);
}
function openSongDetail(song,source){
  selectedSong=song;detailSource=source||'songselect';detailReadyAt=performance.now()+300;
  navBaseOn();
  retireNavLayer(prologueScreen);
  retireNavLayer(exScreen);
  stopPrologueRain();
  stopExRain();
  retireNavLayer(chapterScreen);
  retireNavLayer(songSelectScreen);
  showNavLayer(songScreen);
  state='SONG';
  renderSongDetail(song);
  playUIMusic('select',false);
  uiSound(1.1);
}
function closeSongDetail(){
  if(!songScreen.classList.contains('active'))return;
  retireNavLayer(songScreen);
  if(detailSource==='ex'){
    showNavLayer(exScreen);
    state='SONGSELECT';
    renderExScreen();
    startExRain();
  }else if(detailSource==='prologue'){
    showNavLayer(prologueScreen);
    state='SONGSELECT';
    renderPrologue();
    startPrologueRain();
  }else if(detailSource==='chapter'){
    showNavLayer(chapterScreen);
    state='CHAPTER';
    chapterFocus=Math.max(0,CHAPTERS.findIndex(c=>c.id===selectedSong.chapterId));
    renderChapterSelect();
  }else{
    showNavLayer(songSelectScreen);
    state='SONGSELECT';
    renderSongSelect();
  }
  playUIMusic('select',false);
  uiSound(.9);
}
function openSong(){openChapterSelect();}
function closeSong(){closeSongDetail();}
function renderSong(){renderSongDetail(selectedSong);}

let imClosing=false;
function openIM(){
  if(imApp.classList.contains('active')||imClosing)return;
  imApp.classList.remove('im-closing');
  imApp.classList.add('active');
  state='IM';
  $('#imDetail').classList.remove('active');
  renderFeed('store');
  playUIMusic('im',true);
  uiSound(1.1);
}
function closeIM(){
  if(!imApp.classList.contains('active')||imClosing)return;
  imClosing=true;
  imApp.classList.add('im-closing');
  playUIMusic(null);
  uiSound(.9);
  setTimeout(()=>{
    imApp.classList.remove('active','im-closing');
    $('#imDetail').classList.remove('active');
    imClosing=false;
    if(state==='IM')state='PHONE';
    syncUIMusic(true);
  },430);
}

function openSettings(from){
  if(settingsApp.classList.contains('active'))return;
  settingsReturn=from||'PHONE';
  syncSettingsUI();
  /* 每次进来都从顶部开始：PHONE UI 区在最上面，别让上次滚到底的位置把它藏起来 */
  const sbody=settingsApp.querySelector('.set-body');
  if(sbody)sbody.scrollTop=0;
  settingsApp.classList.add('active');
  playUIMusic('setting',true);
  uiSound(1.1);
}
function closeSettings(){
  settingsApp.classList.remove('active');
  saveSettings();
  syncUIMusic(true);
  uiSound(.9);
}
function syncSettingsUI(){
  $('#sSpeed').value=settings.speed;
  $('#sDim').value=settings.dim;
  $('#sVol').value=settings.volume;
  $('#sHitVol').value=settings.hitVol;
  $('#sInputOffset').value=settings.inputOffset;
  $('#vSpeed').textContent=(+settings.speed).toFixed(2)+'×';
  $('#vDim').textContent=Math.round(settings.dim)+'%';
  $('#vVol').textContent=Math.round(settings.volume)+'%';
  $('#vHitVol').textContent=Math.round(settings.hitVol)+'%';
  $('#vInputOffset').textContent=(settings.inputOffset>0?'+':'')+settings.inputOffset+'ms';
  setSwitch('#tEarly',settings.early);
  setSwitch('#tHit',settings.hit);
  setSwitch('#tUI',settings.ui);
  setSwitch('#tMotion',settings.motion);
  syncTrackSkinUI();
  renderSkinPreview();
  syncNoteSkinUI();
  renderNoteSkinPreview();
  syncPerfSeg();
  syncDevButton();
  const tp=$('#tPhone');if(tp){tp.classList.toggle('locked',!account.phone);setSwitch('#tPhone',!!account.phoneOn);}
  const tl=$('#tLobby');if(tl){tl.classList.toggle('locked',!account.lobby);setSwitch('#tLobby',!!account.lobbyOn);}
  const ts=$('#tScenery');if(ts){ts.classList.toggle('locked',!account.scenery);setSwitch('#tScenery',!!account.sceneryOn);}
  const tui=$('#tPhoneui');if(tui){tui.classList.toggle('locked',!account.phoneui);setSwitch('#tPhoneui',!!account.phoneuiOn);}
  const tlbm=$('#tLobbyMusic');if(tlbm){tlbm.classList.toggle('locked',!account.lobbyMusic);setSwitch('#tLobbyMusic',!!account.lobbyMusicOn);}
  if(user)$('#setUser').textContent=user.name;
}
/* ---- 手机新 UI / 大厅 BGM：五件 SSS 各一个开关 --------------------------------
   鎏金终端（手机壳）/ 金殿（大厅）/ 黄金苍穹（外景）/ 鎏金天幕（天气屏）/
   大厅奢华钢琴（背景音乐，走独立的 #lobbyBgm 音轨）。 */
function syncTrackSkinUI(){
  const sk=getTrackSkin();
  const el=$('#vTrackSkin');
  if(el)el.textContent=sk.name+'  '+(activeTrackSkin+1)+'/21';
}
function syncMirrorBtn(){
  const b=$('#btnMirror');
  if(b)b.classList.toggle('on',!!settings.mirror);
}
function toggleMirror(){
  settings.mirror=!settings.mirror;
  saveSettings();
  syncMirrorBtn();
  uiSound(1.3);
}
/* Settings 内的小尺寸轨道预览：独立渲染器，只读 TRACK_SKINS，不碰任何游戏
   状态（game/V 都不依赖），换肤或打开设置时调用，绝不参与打歌渲染。 */
function renderSkinPreview(){
  const cv=$('#skinPreview');
  if(!cv)return;
  const c=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  const sk=getTrackSkin();
  const laneW=Math.min(110,W*.2),w=laneW*4,x=(W-w)/2,y=H*.76;
  const pulse=.5,A=sk.a,B=sk.b,C=sk.c||sk.a;
  c.clearRect(0,0,W,H);
  c.fillStyle='#04070d';c.fillRect(0,0,W,H);
  for(let i=0;i<18;i++){c.fillStyle='rgba(160,225,255,'+(.06+Math.random()*.16)+')';c.fillRect(Math.random()*W,Math.random()*H*.6,1,1);}
  const halo=c.createRadialGradient(x+w/2,y,0,x+w/2,y,w*.95);
  halo.addColorStop(0,rgba(A,.13+pulse*.08));halo.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=halo;c.fillRect(0,0,W,H);
  const tg=c.createLinearGradient(0,0,0,H);
  tg.addColorStop(0,'rgba(5,12,22,0)');tg.addColorStop(.3,'rgba(6,16,29,.5)');tg.addColorStop(1,'rgba(9,22,39,.72)');
  c.fillStyle=tg;c.fillRect(x,0,w,H);
  if(sk.col==='grad'){
    const hg=c.createLinearGradient(x,0,x+w,0);
    hg.addColorStop(0,rgba(A,.05*sk.dim));hg.addColorStop(.5,rgba(C,.07*sk.dim));hg.addColorStop(1,rgba(B,.05*sk.dim));
    c.fillStyle=hg;c.fillRect(x,0,w,H);
  }else if(sk.col==='dots'){
    c.fillStyle=rgba(A,.13*sk.dim);
    for(let i=0;i<4;i++){const bx=x+i*laneW;for(let yy=0;yy<H;yy+=16){c.fillRect(bx+laneW*.18,yy,2,2);c.fillRect(bx+laneW*.78,yy,2,2);}}
  }else if(sk.col==='stripe'){
    c.save();c.beginPath();c.rect(x,0,w,H);c.clip();
    c.strokeStyle=rgba(A,.06*sk.dim);c.lineWidth=3;
    for(let i=0;i<4;i++){const bx=x+i*laneW;for(let xx=-H;xx<w;xx+=22){c.beginPath();c.moveTo(bx+xx,0);c.lineTo(bx+xx-H,H);c.stroke();}}
    c.restore();
  }else if(sk.col==='beam'){
    for(let i=0;i<4;i++){
      const bx=x+i*laneW+laneW/2;
      const beam=c.createLinearGradient(bx-laneW*.16,0,bx+laneW*.16,0);
      beam.addColorStop(0,'rgba(0,0,0,0)');beam.addColorStop(.5,rgba(A,.08*sk.dim+pulse*.02));beam.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=beam;c.fillRect(bx-laneW*.16,0,laneW*.32,H);
    }
  }else if(sk.col==='fade'){
    for(let i=0;i<4;i++){
      const lg=c.createLinearGradient(0,0,0,H);
      lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(.6,rgba(A,(i%2?.02:.035)*sk.dim+pulse*.012));lg.addColorStop(1,rgba(A,.06*sk.dim));
      c.fillStyle=lg;c.fillRect(x+i*laneW,0,laneW,H);
    }
  }else{
    for(let i=0;i<4;i++){
      const lg=c.createLinearGradient(0,0,0,H);
      lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(.65,rgba(A,(i%2?.028:.045)*sk.dim+pulse*.016));lg.addColorStop(1,rgba(A,.07*sk.dim));
      c.fillStyle=lg;c.fillRect(x+i*laneW,0,laneW,H);
    }
  }
  const dg=c.createLinearGradient(0,0,0,H);
  dg.addColorStop(0,'rgba(0,0,0,0)');dg.addColorStop(.55,rgba(B,.16));dg.addColorStop(.92,rgba(B,.42));dg.addColorStop(1,rgba(B,.1));
  c.strokeStyle=dg;c.lineWidth=1;
  for(let i=0;i<=4;i++){
    const lx=Math.round(x+i*laneW)+.5;
    if(sk.div==='dot'){c.setLineDash([1,7]);c.lineWidth=1.6;}
    else if(sk.div==='dash'){c.setLineDash([5,7]);}
    else{c.setLineDash([]);}
    c.beginPath();c.moveTo(lx,0);c.lineTo(lx,H);c.stroke();
    if(sk.div==='double'){
      c.strokeStyle=rgba(B,.12);c.lineWidth=1;c.setLineDash([]);
      c.beginPath();c.moveTo(lx-3,0);c.lineTo(lx-3,H);c.moveTo(lx+3,0);c.lineTo(lx+3,H);c.stroke();
      c.strokeStyle=dg;
    }
  }
  c.setLineDash([]);
  c.strokeStyle=rgba(A,.32);
  c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,H);c.moveTo(x+w-.5,0);c.lineTo(x+w-.5,H);c.stroke();
  if(activeTrackSkin===20){drawGoldenFiligree(c,x,w,H,laneW);}
  // scan band (static)
  const sy=H*.34;
  const scan=c.createLinearGradient(0,sy-30,0,sy+30);
  scan.addColorStop(0,'rgba(0,0,0,0)');scan.addColorStop(.5,rgba(A,.055));scan.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=scan;c.fillRect(x,sy-30,w,60);
  c.fillStyle=rgba(A,.12);c.fillRect(x,sy,w,1);
  // judgement line
  const jg=c.createLinearGradient(x,y-8,x,y+8);
  jg.addColorStop(0,rgba(A,0));jg.addColorStop(.5,rgba(A,.5));jg.addColorStop(1,rgba(A,0));
  c.fillStyle=jg;c.fillRect(x,y-2,w,4);
  c.fillStyle='rgba(240,253,255,.9)';c.fillRect(x,y-1,w,2);
  // sample notes
  const samples=[[.5,62],[1.5,92],[2.5,40],[3.5,72]];
  for(const s of samples){
    const nx=x+s[0]*laneW,ny=y-s[1];
    c.fillStyle='rgba(111,228,255,.92)';c.strokeStyle='rgba(225,252,255,.9)';
    c.fillRect(nx-13,ny-5,26,10);c.strokeRect(nx-13.5,ny-5.5,27,11);
  }
}
function syncPerfSeg(){
  $$('.seg').forEach(b=>b.classList.toggle('on',b.dataset.pm===settings.perfMode));
}
function setSwitch(sel,on){
  const el=$(sel);if(!el)return;
  el.setAttribute('aria-checked',on?'true':'false');
}
function applySettings(){
  bgm.volume=clamp(settings.volume/100,0,1);
  try{uiPlayer.volume=uiMusicVolume();}catch(e){}
  try{if(lobbyBgm)lobbyBgm.volume=uiMusicVolume();}catch(e){}
  try{if(storeMusicEl&&storeMusicWant)storeMusicEl.volume=uiMusicVolume();}catch(e){}
  Object.keys(uiTracks).forEach(k=>{const a=uiTracks[k];if(a)a.volume=uiMusicVolume();});
  if(typeof updateScrollSpeed==='function')updateScrollSpeed();
  document.body.classList.toggle('reduce-motion',settings.motion);
  document.body.classList.toggle('perf-eco',settings.perfMode==='ultra'||settings.perfMode==='low');
  settings.trackSkin=activeTrackSkin;
  saveSettings();
}

/* ============================================================
   6b. developer access — hidden key gate, unlock-all, restore
   ============================================================ */
const DEV_KEY_INPUT='Welkin';
let devFxTimer=0;
/* 合成音效：成功 = 上行琶音，失败 = 下滑低音 + 噪。独立于 UI 音效开关，始终播放。 */
function devSfx(ok){
  const c=ensureAudioCtx();if(!c)return;
  try{
    if(c.state==='suspended')c.resume().catch(()=>{});
    const t0=c.currentTime;
    if(ok){
      const notes=[523.25,659.25,783.99,1046.5,1318.5];
      notes.forEach((f,i)=>{
        const o=c.createOscillator(),g=c.createGain();
        o.type='sine';o.frequency.value=f;
        const st=t0+i*.085;
        g.gain.setValueAtTime(0,st);
        g.gain.linearRampToValueAtTime(.2,st+.02);
        g.gain.exponentialRampToValueAtTime(.0008,st+.5);
        o.connect(g);g.connect(c.destination);
        o.start(st);o.stop(st+.55);
      });
    }else{
      const o=c.createOscillator(),g=c.createGain();
      o.type='sawtooth';
      o.frequency.setValueAtTime(233,t0);
      o.frequency.exponentialRampToValueAtTime(98,t0+.32);
      g.gain.setValueAtTime(.16,t0);
      g.gain.exponentialRampToValueAtTime(.001,t0+.4);
      o.connect(g);g.connect(c.destination);
      o.start(t0);o.stop(t0+.45);
      const o2=c.createOscillator(),g2=c.createGain();
      o2.type='square';o2.frequency.value=147;
      g2.gain.setValueAtTime(.09,t0+.05);
      g2.gain.exponentialRampToValueAtTime(.001,t0+.4);
      o2.connect(g2);g2.connect(c.destination);
      o2.start(t0+.05);o2.stop(t0+.45);
    }
  }catch(e){}
}
function syncDevButton(){
  const b=$('#btnDev');if(!b)return;
  b.classList.toggle('on',!!devUnlockAll);
  b.querySelector('i').textContent=devUnlockAll?'DEV · ON':'·';
}
function playDevFx(ok,title,text){
  const el=$('#devFx');if(!el)return;
  el.classList.remove('play','ok','fail');
  const t=$('#devFxTitle'),x=$('#devFxText');
  if(t)t.textContent=title;
  if(x)x.textContent=text;
  void el.offsetWidth;
  el.classList.add('play',ok?'ok':'fail');
  devSfx(ok);
  clearTimeout(devFxTimer);
  devFxTimer=setTimeout(()=>el.classList.remove('play','ok','fail'),ok?1500:1300);
}
function openDevModal(){
  const m=$('#devModal');if(!m)return;
  m.classList.toggle('on',!!devUnlockAll);
  $('#devModalTitle').textContent=devUnlockAll?'DEV MODE':'ENTER KEY';
  const inp=$('#devKeyInput');
  inp.value='';
  m.classList.add('active');
  uiSound(1.1);
  if(!devUnlockAll)setTimeout(()=>{try{inp.focus();}catch(e){}},80);
}
function closeDevModal(){
  const m=$('#devModal');if(m)m.classList.remove('active');
  uiSound(.9);
}
function confirmDevKey(){
  const inp=$('#devKeyInput');
  const val=inp?inp.value:'';
  if(val===DEV_KEY_INPUT){
    closeDevModal();
    devUnlockAll=true;
    saveDevUnlock();
    applyUnlocks();
    refreshChapterSelectIfActive();
    syncDevButton();
    playDevFx(true,'ACCESS GRANTED','ALL TRACKS UNLOCKED');
  }else{
    inp.value='';
    playDevFx(false,'ACCESS DENIED','INVALID KEY');
    setTimeout(()=>{try{inp.focus();}catch(e){}},40);
  }
}
function disableDevMode(){
  closeDevModal();
  devUnlockAll=false;
  saveDevUnlock();
  applyUnlocks();
  refreshChapterSelectIfActive();
  syncDevButton();
  playDevFx(true,'PROGRESS RESTORED','DEV MODE DISABLED');
}

/* ============================================================
   7. iM community
   ============================================================ */
const IM_POSTS=[
  {
    id:'welkin',name:'WELKIN',role:'CREATOR',avatar:'avatar_im.avif',time:'JUST NOW',likes:99,pinned:true,
    text:'大家好！欢迎来到我制作的小音游，以后会加油更新，希望大家多多支持！该网址可以电脑打开游玩，按键控制是cvbn键，对应四个轨道！谢谢大家！',
    comments:[
      {name:'SYSTEM',avatar:'📡',bg:'#9fb6c2',text:'正在更新中！'},
      {name:'—',avatar:'😡',bg:'#ffcccc',text:'啥时候出新歌？'}
    ]
  },
  {
    id:'nick',name:'Nick',role:'OPERATOR',avatar:'nick_avatar.avif',time:'1H AGO',likes:12,pinned:false,
    text:'祝Welkin天天开心，永远不死',
    comments:[{name:'NEKO',avatar:'🐱',bg:'#ffb6c1',text:'带我一个！(⁎⁍̴̛ᴗ⁍̴̛⁎)'}]
  },
  {
    id:'jirong',name:'季绒',role:'OPERATOR',avatar:'bb.im.avif',time:'3H AGO',likes:8,pinned:false,
    text:'jj加油！',
    comments:[{name:'NEKO',avatar:'🐱',bg:'#ffb6c1',text:'哇库^o^'}]
  },
  {
    id:'wvw',name:'w●ｖ●w',role:'OPERATOR',avatar:'wvw.avif',time:'4H AGO',likes:6,pinned:false,
    text:'zz厉害w～',
    comments:[{name:'NEKO',avatar:'🐱',bg:'#ffb6c1',text:'为他打Call！030'}]
  }
];
function updatePhonePanels(){
  const p=IM_POSTS[0];
  if(!p)return;
  const n=$('#msgName'),a=$('#msgAvatar');
  if(n)n.textContent=p.name;
  if(a){a.src=imgUrl(p.avatar);a.onerror=()=>{a.style.display='none';};}
}
const LIKE_KEY='welkin_os_likes_v1';
let likes={};
try{likes=JSON.parse(localStorage.getItem(LIKE_KEY)||'{}')||{};}catch(e){likes={};}
function saveLikes(){try{localStorage.setItem(LIKE_KEY,JSON.stringify(likes));}catch(e){}}
function likeCount(p){return p.likes+(likes[p.id]?1:0);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function likeButton(p){
  const liked=!!likes[p.id];
  return `<button class="im-like${liked?' on':''}" data-like="${p.id}">
    <svg viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
    <span>${likeCount(p)}</span>
  </button>`;
}
function postHero(p){
  return `<article class="im-hero" data-post="${p.id}">
    <div class="im-index">#001</div>
    <div class="im-hero-main">
      <div class="im-head">
        <img class="im-avatar" src="${p.avatar}" alt="" loading="eager" decoding="sync" onerror="this.style.display='none'">
        <div class="im-name">${esc(p.name)}<small>${esc(p.role)} · ${esc(p.time)}</small></div>
      </div>
      <div class="im-hero-text">${esc(p.text)}</div>
      <div class="im-foot">${likeButton(p)}<span>· ${p.comments.length} REPLIES</span><span>PINNED SIGNAL</span></div>
    </div>
    <div class="im-hero-mark">PINNED</div>
  </article>`;
}
function postRow(p,idx){
  return `<article class="im-row" data-post="${p.id}">
    <div class="im-index">#${String(idx).padStart(3,'0')}</div>
    <div class="im-row-main">
      <div class="im-head">
        <img class="im-avatar" src="${p.avatar}" alt="" loading="eager" decoding="sync" onerror="this.style.display='none'">
        <div class="im-name">${esc(p.name)}<small>${esc(p.role)} · ${esc(p.time)}</small></div>
      </div>
      <div class="im-text">${esc(p.text)}</div>
    </div>
    <div class="im-row-side">${likeButton(p)}<span>${p.comments.length} REPLIES</span><span class="im-row-arrow">›</span></div>
  </article>`;
}
function renderFeed(tab){
  const feed=$('#imFeed');
  if(tab==='store'){renderStoreLanding();return;}
  const totalLikes=IM_POSTS.reduce((s,p)=>s+likeCount(p),0);
  const summary=`<div class="im-summary"><span>LOCAL NETWORK</span><b>${String(IM_POSTS.length).padStart(2,'0')}</b>SIGNALS <b>${String(IM_POSTS.length).padStart(2,'0')}</b>OPERATORS <b>${totalLikes}</b>LIKES <span class="dim">SYNCED</span></div>`;
  if(tab==='mine'){
    feed.innerHTML=summary+`<div class="im-empty">
      <b>NO SIGNAL YET</b>
      <span>${user?esc(user.name):'GUEST'}，你的频道还是空的<br>先去 FOR YOU 看看大家，或者听听《Effulgence》</span>
      <button class="btn ghost" id="imBrowse">BROWSE FOR YOU</button>
    </div>`;
    const b=$('#imBrowse');
    if(b)b.addEventListener('click',()=>{$$('.im-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='feed'));renderFeed('feed');});
    uiSound(1.1);
    return;
  }
  const pinned=IM_POSTS.find(p=>p.pinned)||IM_POSTS[0];
  const rest=IM_POSTS.filter(p=>p!==pinned);
  feed.innerHTML=summary+postHero(pinned)+rest.map((p,i)=>postRow(p,i+2)).join('')+`<div class="im-end">END OF LOCAL FEED · ${String(IM_POSTS.length).padStart(2,'0')} SIGNALS</div>`;
  feed.querySelectorAll('.im-hero,.im-row').forEach(card=>{
    card.addEventListener('click',e=>{
      if(e.target.closest('.im-like'))return;
      openPost(card.dataset.post);
    });
  });
  feed.querySelectorAll('.im-like').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const id=btn.dataset.like;
      likes[id]=!likes[id];
      if(!likes[id])delete likes[id];
      saveLikes();
      btn.classList.toggle('on',!!likes[id]);
      const p=IM_POSTS.find(x=>x.id===id);
      btn.querySelector('span').textContent=likeCount(p);
      btn.querySelector('svg').setAttribute('fill',likes[id]?'currentColor':'none');
      uiSound(1.5);
    });
  });
}
function openPost(id){
  const p=IM_POSTS.find(x=>x.id===id);
  if(!p)return;
  const liked=!!likes[id];
  const idx=IM_POSTS.indexOf(p)+1;
  $('#imDetailBody').innerHTML=`
    <div class="im-detail-wrap">
      <div class="im-detail-index">SIGNAL #${String(idx).padStart(3,'0')} / ${esc(p.role)}</div>
      <div class="im-detail-head">
        <img class="im-avatar" src="${p.avatar}" alt="" loading="eager" decoding="sync" onerror="this.style.display='none'">
        <div class="im-name">${esc(p.name)}<small>${esc(p.role)} · ${esc(p.time)}</small></div>
      </div>
      <div class="im-detail-text">${esc(p.text)}</div>
      <div class="im-detail-actions">
        <button class="im-like${liked?' on':''}" id="detailLike" data-like="${p.id}">
          <svg viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
          <span>${likeCount(p)}</span> LIKE
        </button>
        <span>${p.comments.length} REPLIES</span><span>${esc(p.time)}</span>
      </div>
      <div class="im-comments">
        ${p.comments.map(c=>`<div class="im-comment"><div class="im-cavatar" style="background:${c.bg}">${c.avatar}</div><div class="im-cbody"><div class="im-cname">${esc(c.name)}</div><div class="im-ctext">${esc(c.text)}</div></div></div>`).join('')}
      </div>
    </div>`;
  $('#imDetail').classList.add('active');
  const dl=$('#detailLike');
  if(dl)dl.addEventListener('click',()=>{
    likes[id]=!likes[id];
    if(!likes[id])delete likes[id];
    saveLikes();
    dl.classList.toggle('on',!!likes[id]);
    dl.querySelector('svg').setAttribute('fill',likes[id]?'currentColor':'none');
    dl.querySelector('span').textContent=likeCount(p);
    var _tab=$('.im-tab.active');renderFeed((_tab&&_tab.dataset&&_tab.dataset.tab)||'feed');
    uiSound(1.5);
  });
  uiSound(1.15);
}

/* ============================================================
   8. UI audio (soft terminal blips)
   ============================================================ */
let sfxCtx=null,sfxReady=false,uiBuffer=null;
function ensureAudioCtx(){
  if(sfxCtx)return sfxCtx;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    sfxCtx=new AC();
    const sr=sfxCtx.sampleRate;
    const len=Math.floor(sr*.05);
    uiBuffer=sfxCtx.createBuffer(1,len,sr);
    const d=uiBuffer.getChannelData(0);
    for(let i=0;i<len;i++){
      const t=i/len;
      d[i]=(Math.sin(t*Math.PI*2*9)*.5+Math.sin(t*Math.PI*2*22)*.2)*Math.pow(1-t,9)*.5;
    }
    sfxReady=true;
  }catch(e){sfxCtx=null;}
  return sfxCtx;
}
function uiSound(pitch){
  if(!settings.ui)return;
  const c=ensureAudioCtx();if(!c||!uiBuffer)return;
  try{
    if(c.state==='suspended')c.resume().catch(()=>{});
    const s=c.createBufferSource();s.buffer=uiBuffer;s.playbackRate.value=pitch||1;
    const g=c.createGain();g.gain.value=.12;
    s.connect(g);g.connect(c.destination);s.start();
  }catch(e){}
}

/* ---- 皇室奢华音效（抽奖专用，Web Audio 合成，无外部文件） ------------------ */
function royalTone(freq,delay,dur,vol,type){
  const c=ensureAudioCtx();if(!c)return;
  try{
    if(c.state==='suspended')c.resume().catch(()=>{});
    const t=c.currentTime+(delay||0);
    const o=c.createOscillator();o.type=type||'sine';o.frequency.value=freq;
    const g=c.createGain();const a=vol||.16;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(a,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(c.destination);
    o.start(t);o.stop(t+dur+.06);
  }catch(e){}
}
function royalSfx(kind){
  if(!settings.ui)return;
  const c=ensureAudioCtx();if(!c)return;
  if(kind==='tap'){/* 点击抽奖：金色上行琶音 */
    royalTone(523.25,0,.5,.16,'sine');
    royalTone(659.25,.06,.5,.15,'sine');
    royalTone(783.99,.12,.55,.15,'sine');
    royalTone(1046.5,.18,.6,.17,'sine');
    royalTone(1318.5,.25,.7,.13,'triangle');
  }else if(kind==='spin'){/* 动画启动：低音蓄势上行 */
    royalTone(130.81,0,.45,.12,'sine');
    royalTone(196,.06,.45,.11,'sine');
    royalTone(261.63,.12,.5,.12,'triangle');
    royalTone(329.63,.18,.55,.12,'triangle');
    royalTone(392,.24,.6,.12,'triangle');
  }else if(kind==='reveal'){/* 白屏揭示：高亮钟声 */
    royalTone(1046.5,0,.9,.2,'sine');
    royalTone(1567.98,.02,1,.16,'triangle');
    royalTone(2093,.04,.95,.14,'sine');
    royalTone(2637,.06,1.1,.1,'sine');
  }else if(kind==='sss'){/* SSS 大奖：华丽彩虹琶音 */
    royalTone(523.25,0,.42,.16,'sine');
    royalTone(659.25,.05,.42,.16,'sine');
    royalTone(783.99,.1,.46,.16,'sine');
    royalTone(1046.5,.15,.5,.18,'sine');
    royalTone(1318.5,.2,.55,.18,'triangle');
    royalTone(1567.98,.26,.6,.18,'triangle');
    royalTone(2093,.32,.75,.16,'sine');
  }
}

/* ============================================================
   8b. independent UI music (phone / settings / iM)
   ============================================================ */
const UI_TRACK_FILES={phone:'phone.mp3',setting:'setting.mp3',im:'iM.mp3',select:'Ui.mp3'};
const uiTracks={};
const uiPlayer=$('#uiMusic');
uiPlayer.loop=true;uiPlayer.preload='auto';uiPlayer.volume=0;
uiPlayer.playsInline=true;uiPlayer.setAttribute('playsinline','');
let uiCurrent='',uiFadeToken=0,uiPlayerKey='select';
function uiMusicVolume(){return clamp(settings.volume/100*.9,0,1);}
/* ---- 大厅奢华钢琴 BGM（SSS 奖品 · Audio.mp3） -------------------------------
   独立一条 <audio id="lobbyBgm">，不跟 uiPlayer 共用同一个元素：
   反复进出商店 / 设置 / 选曲再回到大厅，只 pause / resume，不会重新 load 把进度清零，
   也不会像以前商店音乐那样「第二次进来就没声」。loop 由元素自身保持。
   抽到这件奖品后它就替换默认的大厅 BGM（phone.mp3），两首绝不会同时响。 */
let lobbyBgmWant=false;
function lobbyMusicAllowed(){return !!(account&&account.lobbyMusic&&account.lobbyMusicOn);}
function playLobbyBgm(){
  if(!lobbyBgm||!lobbyMusicAllowed())return;
  lobbyBgmWant=true;
  try{
    lobbyBgm.loop=true;
    lobbyBgm.volume=uiMusicVolume();
    /* 被浏览器回收（networkState EMPTY）或残留 error 时先重新 load 一次，
       否则 play() 会静默失败——这正是「再进来就没音乐」的老毛病。 */
    if(lobbyBgm.error||lobbyBgm.networkState===0){
      try{lobbyBgm.load();}catch(e){}
    }
    if(lobbyBgm.paused){
      const p=lobbyBgm.play();
      if(p&&p.catch)p.catch(()=>{});
    }
  }catch(e){}
}
function stopLobbyBgm(){
  lobbyBgmWant=false;
  try{if(lobbyBgm)lobbyBgm.pause();}catch(e){}
}
function retryLobbyBgm(){
  if(lobbyBgmWant&&lobbyBgm&&lobbyBgm.paused&&lobbyMusicAllowed()){
    try{lobbyBgm.volume=uiMusicVolume();const p=lobbyBgm.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}
  }
}
function getUITrack(key){
  if(uiTracks[key])return uiTracks[key];
  const file=UI_TRACK_FILES[key];if(!file)return null;
  const a=new Audio(file);
  a.loop=true;a.preload='auto';a.volume=0;
  a.addEventListener('error',()=>{a.dataset.failed='1';});
  uiTracks[key]=a;
  return a;
}
function kickUIMusic(){
  if(!uiCurrent||!uiPlayer.paused)return;
  try{uiPlayer.play().then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});}catch(e){}
}
function fadeInUIMusic(a){
  const token=++uiFadeToken;
  const target=uiMusicVolume();
  const t0=performance.now();
  a.volume=target*.4;
  const step=()=>{
    if(token!==uiFadeToken)return;
    if(a.paused){a.volume=target;return;}
    const k=clamp((performance.now()-t0)/360,0,1);
    const e=k*k*(3-2*k);
    a.volume=target*(.4+.6*e);
    if(k<1)requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function playUIMusic(key,restart=false){
  key=key||'';
  /* 选曲 / 设置 / 商店 / iM 任一 UI 音乐要接管时，大厅钢琴先退场（它有自己的元素） */
  stopLobbyBgm();
  if(!key){
    uiFadeToken++;
    try{uiPlayer.pause();uiPlayer.volume=0;}catch(e){}
    uiCurrent='';
    return;
  }
  const file=UI_TRACK_FILES[key];if(!file)return;
  const switching=uiPlayerKey!==key;
  if(!switching&&!restart&&!uiPlayer.paused&&uiCurrent===key)return;
  if(switching){
    try{uiPlayer.pause();}catch(e){}
    uiPlayerKey=key;
    uiPlayer.src=file;
    try{uiPlayer.load();}catch(e){}
  }
  uiCurrent=key;
  try{uiPlayer.currentTime=0;}catch(e){}
  uiPlayer.volume=0;
  const start=()=>{
    if(uiCurrent!==key)return;
    uiPlayer.volume=0;
    try{const p=uiPlayer.play();if(p&&p.then)p.then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});}catch(e){}
  };
  uiPlayer.oncanplay=()=>{if(uiCurrent===key&&uiPlayer.paused)start();};
  start();
}
function syncUIMusic(restart=false){
  if(storeAppEl&&storeAppEl.classList.contains('active')){stopAllUIMusic();playStoreMusic();return;}
  if(settingsApp.classList.contains('active'))return playUIMusic('setting',restart);
  if(imApp.classList.contains('active')&&!imApp.classList.contains('im-closing'))return playUIMusic('im',restart);
  if(state==='PHONE'){
    if(lobbyMusicAllowed()){
      /* 钢琴曲接管大厅 BGM：uiPlayer 上的 phone.mp3 静音，只播这一条。
         已经响着就别动它——重复回大厅、反复开关设置都不会从头开始。 */
      uiFadeToken++;
      try{uiPlayer.pause();uiPlayer.volume=0;}catch(e){}
      uiCurrent='';
      playLobbyBgm();
      return;
    }
    stopLobbyBgm();
    return playUIMusic('phone',restart);
  }
  stopLobbyBgm();
  if((state==='CHAPTER'||state==='SONGSELECT'||state==='SONG')&&(chapterScreen.classList.contains('active')||songSelectScreen.classList.contains('active')||songScreen.classList.contains('active')||prologueScreen.classList.contains('active')||exScreen.classList.contains('active')))return playUIMusic('select',restart);
  playUIMusic(null);
}
function retryUIMusic(){
  retryLobbyBgm();
  kickStoreMusic();
  if(!uiCurrent)return;
  if(uiPlayer.paused){try{uiPlayer.currentTime=0;}catch(e){}uiPlayer.volume=0;try{const p=uiPlayer.play();if(p&&p.then)p.then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});}catch(e){}}
}
function stopAllUIMusic(){
  uiFadeToken++;
  try{uiPlayer.pause();uiPlayer.volume=0;}catch(e){}
  uiCurrent='';
  stopLobbyBgm();
}


/* ============================================================
   9. gameplay —constants, chart, audio clock
   ============================================================ */
const PERFECT_WINDOW=.120,GOOD_WINDOW=.150,BAD_WINDOW=.160,CHART_OFFSET=-.2;
const MISS_DELAY=.180;
const MUSIC_DELAY=.3;
let AUDIO_DELAY=0;
function audioTime(clock){return clock-MUSIC_DELAY-AUDIO_DELAY;}
let SONG_DURATION=242.0,FINAL_CHORD_TIME=239.0+CHART_OFFSET;
/* 本次加载到的音频真实时长（秒），加载完歌曲时由 bgm.duration 填，resetGameData 拿它兜底。 */
let AUDIO_LOADED_DURATION=0;
/* duration = 这一局跑到哪个音乐时间就结束。承章七首原来写的是「最后一颗音符再往后一点点」，
   比音频里真正最后一声短了 1.6~5.6s：铺面打完了、音乐还在响，画面就被切去结果页。
   现在改成按音频实测结尾（最后一声的位置）+0.25s。其它章不动。 */
const CHART_META={
  effulgence:{duration:161,final:157.2},
  spark:{duration:146,final:145.3},
  corr:{duration:164.9,final:161.505},
  still:{duration:108,final:101.769},
  w:{duration:86.34,final:82.006},
  ltzz:{duration:152.1,final:148.621},
  welkin:{duration:252,final:242.833},
  init:{duration:142.44,final:139.027},
  an:{duration:128.67,final:127.839},
  la:{duration:141.25,final:132.397},
  lady:{duration:140.83,final:133.867},
  pen:{duration:160.06,final:156.756},
  fb:{duration:138.57,final:136.034},
  cyber:{duration:201.51,final:194.395}
};
const KEYS=['c','v','b','n'];

const stage=$('#stage');
const sctx=stage.getContext('2d',{alpha:false});
const V={w:0,h:0,x:0,laneW:0,trackW:0,judgeY:0,noteH:0,scrollSpeed:0,dpr:1,portrait:false,stars:[],dust:[]};

let game={
  clock:-3,perfect:0,good:0,bad:0,miss:0,combo:0,maxCombo:0,weightSum:0,
  feedback:'',feedbackType:'',feedbackTimer:0,comboScale:1,screenShake:0,
  judgeLineGlow:0,bpmPulse:0,flashAlpha:0,whiteFlash:0,
  notes:[],effects:[],keyHold:[false,false,false,false],laneFlash:[0,0,0,0],
  lastDelta:0,lastType:'',lanePtr:[0,0,0,0]
};
const hudCache={score:'',acc:'',time:'',prog:-1};
let isPlaying=false;
let audioStarted=false,audioUnlocked=false;
let audioGate=false,audioGateSince=0,audioGateDone=false;
let playPending=false,playPendingSince=0,playToken=0,audioSyncPending=false;
let audioFailCount=0,audioRetryAfter=0;
let lastBgTimeChangeAt=0,bgTimeInitialized=false,lastHealthCheck=0,lastSeekTime=0;
let resumeCountdown=0,pausedClock=0,resumePendingStart=false,resumePendingTimer=0;
let gameStartAt=0,resumeEndAt=0;
let clockAnchor=0,lastTime=0,gameRaf=0;
let displayScore=0,displayAcc=100,feedbackYOffset=0;
let pointerLanes={};
let finalScore=0,resultReveal=0,resultAcc=100;

bgm.volume=clamp(settings.volume/100,0,1);

function AddNote(time,lane,startLane,type,end,opts){
  game.notes.push({
    time:time,lane:lane,startLane:startLane,
    type:type||'tap',end:end||0,
    perform:!!(opts&&opts.perform),
    judged:false,headHit:false,is_chord:false,is_multi:false
  });
}
function finalizeChart(){
  for(let i=0;i<game.notes.length;i++){
    if(game.notes[i].perform)continue;
    let c=0;
    for(let j=0;j<game.notes.length;j++){
      if(game.notes[j].perform)continue;
      if(Math.abs(game.notes[i].time-game.notes[j].time)<0.006)c++;
    }
    game.notes[i].is_chord=c>=2;
    game.notes[i].is_multi=c>=3;
    game.notes[i].chordSize=c;
  }
}
/* EFFULGENCE — all notes except the opening double hold land 0.1s earlier. */
function T(t){return t+MUSIC_DELAY-.1;}
function EFF(){
  const g=game.notes;
  const tap=(lane,t)=>g.push({time:T(t),lane:lane,startLane:lane,type:'tap',end:0,perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});
  const hold=(lane,t,end)=>g.push({time:T(t),lane:lane,startLane:lane,type:'hold',end:T(end),perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});
  const brk=(lane,t)=>g.push({time:T(t),lane:lane,startLane:lane,type:'break',end:0,perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});
  const perf=(lane,t)=>g.push({time:T(t),lane:lane,startLane:lane,type:'break',end:0,perform:true,judged:true,headHit:false,is_chord:false,is_multi:false});
  const D=(l1,l2,t,type,end)=>{if(type==='hold'){hold(l1,t,end);hold(l2,t,end);}else if(type==='break'){brk(l1,t);brk(l2,t);}else{tap(l1,t);tap(l2,t);}};
  const holdAbs=(lane,st,en)=>g.push({time:st,lane:lane,startLane:lane,type:'hold',end:en,perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});
  let i,t;
  // intro holds
  // first double hold: absolute 0.4s after countdown, 3.1s long (not music+0.4)
  holdAbs(1,0.4,3.5);holdAbs(2,0.4,3.5);
  D(0,3,3.5,'hold',10);
  // 10.3 phrase starts 0.2s earlier at 10.1; the rest is the revised hit-time list
  D(1,2,10.1,'tap');
  tap(3,10.6);tap(2,10.8);tap(3,11);tap(0,11.5);tap(1,11.8);
  D(0,3,12,'hold',12.5);
  D(1,2,13,'tap');
  tap(1,14);tap(2,14.4);tap(0,14.7);
  hold(3,15,15.8);
  D(0,1,16,'tap');D(2,3,16.4,'tap');D(1,2,16.8,'tap');
  tap(0,17.3);tap(3,17.8);tap(1,18.3);tap(2,18.4);tap(0,18.7);
  brk(3,19.0);brk(2,19.1);brk(1,19.2);brk(0,19.3);
  tap(2,20.1);tap(1,20.3);tap(2,20.5);
  D(0,3,20.9,'tap');D(1,2,21.2,'hold',21.8);
  tap(1,22.2);tap(2,22.3);tap(1,22.5);tap(2,22.7);
  D(0,3,23.4,'tap');
  D(1,2,23.9,'tap');tap(0,24.2);tap(3,24.4);tap(0,24.6);tap(3,24.8);
  D(1,2,25.0,'tap');D(1,2,25.1,'tap');
  for(i=0;i<6;i++)D(0,3,25.3+i*0.2,'tap');
  hold(2,26.8,28.8);
  tap(1,29.5);
  D(0,3,30,'hold',31.5);
  hold(0,32.2,33);hold(2,33,33.8);hold(1,34.2,34.8);
  tap(3,34.9);tap(0,35.2);tap(2,35.5);
  D(1,2,35.8,'tap');D(1,2,36.5,'hold',38);
  tap(0,39);hold(3,39,40);hold(0,39.3,39.7);tap(2,39.6);
  tap(1,40);tap(2,40.6);
  tap(0,41);hold(3,41,42);
  tap(1,42.2);tap(3,42.5);tap(0,43);tap(2,43.5);
  D(1,2,44,'tap');
  D(0,3,45,'hold',45.8);
  hold(1,46,46.8);brk(1,46.4);tap(2,46.9);
  hold(2,47.4,49.4);
  tap(0,50);tap(1,50.4);tap(2,50.7);tap(3,51);
  hold(0,51.7,52.5);tap(3,52);
  tap(2,53.3);tap(0,53.6);tap(1,53.9);tap(3,54.2);tap(2,54.6);tap(3,54.8);
  D(0,1,55,'hold',56.8);
  tap(3,57.1);tap(2,57.5);tap(0,57.9);tap(1,58.1);tap(2,58.3);tap(2,58.7);tap(1,59.2);tap(2,59.5);tap(1,59.8);tap(2,60);
  D(1,2,60.2,'hold',72.7);
  // 73.6-89.8: gaps +0.2s, config every 1s, continuous double groups
  const pairs=[[1,2],[0,3],[1,3],[0,2],[2,3],[0,1]];
  t=73.6;
  let guard=0;
  while(t<90&&guard++<80){
    for(let k=0;k<5&&t<90;k++){
      const et=t;
      const cfg=pairs[Math.floor((et-73.6)/1)%pairs.length];
      D(cfg[0],cfg[1],et,'tap');
      tap((cfg[0]+2)%4,et+0.3);
      t+=0.6;
    }
  }
  // 最后一拍 2/3 轨道双押保留；原来跟在后头的 1 轨道单键（90.7）已删，
  // 原本 90.8 的 2/3 双押顶到它的时间上。
  D(2,3,90.4,'tap');
  D(1,2,90.7,'tap');
  // 两组三连对调：先 2 轨道，再 3 轨道。
  for(i=0;i<3;i++)tap(1,90.9+i*0.225);
  for(i=0;i<3;i++)tap(2,91.4+i*0.225);
  // 1↔4 lane interaction: +0.05s instead of +0.1s (0.15s spacing) so it stays harder than the last pass
  {let k=0;for(t=91.9;t<=93.351;t+=0.15,k++)tap(k%2===0?0:3,t);}
  // floating performance yellow keys, no judgement
  for(i=0;i<20;i++)perf(i%2===0?1:2,93.5+i*0.1);
  D(1,2,95.9,'tap');
  // 96-129.4: blue start + 5-8 random yellow keys, unique continuous configs
  let seed=0x51f15e;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  t=96.1;
  const seen=new Set();
  let phrase=0;
  while(t<129.2&&phrase++<80){
    let nY=Math.floor(5+rnd()*4); // 5..8
    let lanes=[];
    for(let q=0;q<40;q++){
      lanes=[];const used=new Set();
      while(lanes.length<nY){const l=Math.floor(rnd()*4);if(!used.has(l)||lanes.length>3)lanes.push(l);used.add(l);}
      const sig=lanes.join('');
      if(!seen.has(sig)){seen.add(sig);break;}
    }
    const firstLane=Math.floor(rnd()*4);
    tap(firstLane,t);
    for(let k=0;k<lanes.length;k++)brk(lanes[k],t+0.15*(k+1));
    t+=0.15*(lanes.length+1);
  }
  D(1,2,129.4,'hold',133.9);
  D(0,3,134.5,'hold',139.5);
  D(1,2,140.3,'tap');
  tap(1,143.5);tap(2,143.8);D(1,2,144.7,'tap');
  hold(3,145.7,148.2);
  // 2:34 那个 3 轨道黄键提前 0.8s；2:35 后的 4 轨道黄键删掉，原 2/3 双押顶到它的时间上。
  brk(1,152.8);brk(2,153.9);
  D(1,2,155.4,'tap');
  D(0,3,157,'hold',159);

}
/* The Spark — imported from The Spark.qua (Quaver Keys4). [type,lane,start,end] seconds; type 1 = hold. */
const SPARK_NOTES=[[0,1,0,0],[0,2,0,0],[0,0,0.342,0],[0,3,0.342,0],[0,1,0.685,0],[0,2,0.685,0],[0,0,1.028,0],[0,3,1.028,0],[0,1,1.371,0],[0,2,1.371,0],[0,0,1.714,0],[0,3,1.714,0],[0,1,2.057,0],[0,2,2.057,0],[0,0,2.4,0],[0,3,2.4,0],[0,1,2.742,0],[0,2,2.742,0],[0,0,3.085,0],[0,3,3.085,0],[0,0,3.428,0],[0,3,3.428,0],[0,1,3.6,0],[0,2,3.6,0],[0,1,3.771,0],[0,2,3.771,0],[0,0,3.942,0],[0,3,3.942,0],[1,2,4.114,4.457],[1,1,4.114,4.457],[0,2,4.628,0],[0,0,4.8,0],[0,3,4.8,0],[0,1,4.971,0],[0,0,5.142,0],[0,3,5.142,0],[0,2,5.314,0],[0,0,5.485,0],[0,3,5.485,0],[0,1,5.657,0],[0,0,5.828,0],[0,3,5.828,0],[0,1,6,0],[0,2,6,0],[0,0,6.171,0],[0,3,6.171,0],[0,1,6.342,0],[0,2,6.342,0],[0,1,6.514,0],[0,2,6.514,0],[0,0,6.685,0],[0,1,6.857,0],[0,2,6.857,0],[0,0,7.028,0],[0,1,7.2,0],[0,2,7.2,0],[0,3,7.371,0],[0,2,7.542,0],[0,1,7.542,0],[0,3,7.714,0],[0,0,7.885,0],[0,1,7.885,0],[0,0,8.057,0],[0,2,8.228,0],[0,3,8.228,0],[0,3,8.4,0],[0,2,8.571,0],[0,0,8.571,0],[0,1,8.742,0],[0,1,8.914,0],[0,3,8.914,0],[0,2,9.085,0],[0,2,9.257,0],[0,0,9.257,0],[0,1,9.428,0],[0,2,9.428,0],[1,1,9.6,9.942],[1,2,9.6,9.942],[0,1,10.114,0],[0,2,10.114,0],[0,0,10.285,0],[0,3,10.285,0],[0,3,10.457,0],[0,0,10.628,0],[0,3,10.628,0],[0,0,10.8,0],[0,0,10.971,0],[0,3,10.971,0],[0,3,11.142,0],[0,3,11.314,0],[0,0,11.314,0],[0,0,11.485,0],[0,3,11.485,0],[0,0,11.657,0],[0,3,11.657,0],[0,3,11.828,0],[0,0,12,0],[0,3,12.171,0],[0,0,12.342,0],[0,3,12.514,0],[0,0,12.685,0],[0,3,12.857,0],[0,0,13.028,0],[0,3,13.028,0],[0,1,13.2,0],[0,2,13.371,0],[0,1,13.542,0],[0,0,13.714,0],[0,3,13.714,0],[0,1,13.885,0],[0,2,13.885,0],[0,0,14.057,0],[0,3,14.057,0],[0,0,14.228,0],[0,3,14.4,0],[0,0,14.571,0],[0,1,14.742,0],[0,2,14.742,0],[0,1,14.914,0],[0,2,14.914,0],[1,0,15.085,15.428],[1,3,15.085,15.428],[0,0,15.6,0],[0,3,15.6,0],[0,1,15.771,0],[0,2,15.771,0],[0,0,15.942,0],[0,3,15.942,0],[0,1,16.114,0],[0,2,16.114,0],[0,0,16.285,0],[0,3,16.285,0],[0,1,16.457,0],[0,2,16.542,0],[0,1,16.628,0],[0,2,16.714,0],[0,1,16.8,0],[0,2,16.885,0],[0,1,16.971,0],[0,2,17.057,0],[0,1,17.142,0],[0,2,17.228,0],[0,1,17.314,0],[0,2,17.4,0],[0,1,17.485,0],[0,2,17.571,0],[0,1,17.657,0],[0,2,17.742,0],[0,0,17.828,0],[0,3,17.828,0],[0,3,18,0],[0,0,18.085,0],[0,3,18.171,0],[0,0,18.257,0],[0,3,18.342,0],[0,0,18.428,0],[0,3,18.514,0],[0,0,18.6,0],[0,3,18.685,0],[0,0,18.771,0],[0,3,18.857,0],[0,0,18.942,0],[0,3,19.028,0],[0,0,19.114,0],[0,3,19.2,0],[0,0,19.285,0],[0,3,19.371,0],[0,0,19.457,0],[0,3,19.542,0],[0,0,19.628,0],[0,3,19.714,0],[0,0,19.8,0],[0,3,19.885,0],[0,0,19.971,0],[0,3,20.057,0],[0,0,20.142,0],[0,3,20.228,0],[0,0,20.314,0],[0,3,20.4,0],[0,0,20.485,0],[1,2,20.571,21],[1,1,21.085,21.514],[0,1,21.6,0],[0,2,21.6,0],[0,1,21.942,0],[0,2,21.942,0],[0,0,22.114,0],[0,3,22.114,0],[0,1,22.285,0],[0,2,22.285,0],[0,0,22.457,0],[0,3,22.457,0],[0,1,22.628,0],[0,2,22.628,0],[0,0,22.8,0],[0,3,22.8,0],[0,0,22.971,0],[0,3,22.971,0],[0,0,23.142,0],[0,3,23.142,0],[1,1,23.314,23.657],[1,2,23.314,23.657],[0,0,23.828,0],[0,3,23.828,0],[0,0,24,0],[0,3,24,0],[0,0,24.171,0],[0,3,24.171,0],[0,1,24.342,0],[0,2,24.342,0],[0,1,24.514,0],[0,2,24.514,0],[1,1,24.685,25.028],[1,2,24.685,25.028],[0,0,25.2,0],[0,3,25.2,0],[0,0,25.371,0],[0,3,25.371,0],[0,1,25.542,0],[0,2,25.542,0],[0,1,25.714,0],[0,2,25.714,0],[0,0,25.885,0],[0,3,25.885,0],[1,0,26.057,26.4],[1,3,26.057,26.4],[0,0,26.571,0],[0,3,26.571,0],[0,1,26.742,0],[0,2,26.742,0],[0,0,26.914,0],[0,3,26.914,0],[0,1,27.085,0],[0,2,27.085,0],[0,0,27.257,0],[0,3,27.257,0],[1,1,27.428,27.771],[1,2,27.428,27.771],[0,0,27.942,0],[0,3,27.942,0],[0,0,28.114,0],[0,3,28.114,0],[0,0,28.285,0],[0,3,28.285,0],[0,0,28.457,0],[0,3,28.457,0],[0,0,28.628,0],[0,3,28.628,0],[1,1,28.8,29.142],[1,2,28.8,29.142],[0,1,29.314,0],[0,2,29.314,0],[0,1,29.485,0],[0,2,29.485,0],[0,1,29.657,0],[0,2,29.657,0],[0,1,29.828,0],[0,2,29.828,0],[0,1,30,0],[0,2,30,0],[1,0,30.171,30.514],[1,2,30.171,30.514],[0,1,30.685,0],[0,2,30.685,0],[0,1,30.857,0],[0,2,30.857,0],[0,1,31.028,0],[0,2,31.028,0],[0,1,31.2,0],[0,2,31.2,0],[0,1,31.371,0],[0,2,31.371,0],[1,1,31.542,31.885],[1,3,31.542,31.885],[0,0,32.057,0],[0,3,32.057,0],[0,1,32.228,0],[0,2,32.228,0],[0,0,32.4,0],[0,2,32.4,0],[0,1,32.571,0],[0,3,32.571,0],[0,0,32.742,0],[0,2,32.742,0],[1,1,32.914,33.171],[1,2,32.914,33.171],[0,3,33.342,0],[0,0,33.428,0],[0,3,33.514,0],[0,0,33.685,0],[0,3,33.771,0],[0,0,33.857,0],[0,1,34.028,0],[0,2,34.114,0],[0,1,34.2,0],[0,2,34.371,0],[0,1,34.457,0],[0,2,34.542,0],[0,3,34.714,0],[0,0,34.8,0],[0,3,34.885,0],[0,0,35.057,0],[0,3,35.142,0],[0,0,35.228,0],[0,1,35.4,0],[0,2,35.485,0],[0,1,35.571,0],[0,2,35.742,0],[0,1,35.828,0],[0,2,35.914,0],[0,0,36.085,0],[0,2,36.171,0],[0,3,36.257,0],[0,3,36.428,0],[0,1,36.514,0],[0,0,36.6,0],[0,2,36.771,0],[0,1,36.857,0],[0,2,36.942,0],[0,1,37.114,0],[0,2,37.2,0],[0,1,37.285,0],[0,0,37.457,0],[0,3,37.542,0],[0,0,37.628,0],[0,0,37.8,0],[0,3,37.885,0],[0,0,37.971,0],[0,3,38.142,0],[0,0,38.228,0],[0,3,38.314,0],[0,3,38.485,0],[0,0,38.571,0],[0,3,38.657,0],[0,1,38.828,0],[0,0,38.914,0],[0,3,39,0],[0,2,39.171,0],[0,3,39.257,0],[0,0,39.342,0],[0,1,39.514,0],[0,2,39.6,0],[0,0,39.685,0],[0,2,39.857,0],[0,1,39.942,0],[0,3,40.028,0],[0,1,40.2,0],[0,2,40.285,0],[0,1,40.371,0],[0,2,40.542,0],[0,1,40.628,0],[0,2,40.714,0],[0,0,40.885,0],[0,3,40.885,0],[0,0,41.142,0],[0,3,41.142,0],[0,1,41.314,0],[0,2,41.4,0],[0,1,41.485,0],[0,2,41.571,0],[0,1,41.657,0],[0,2,41.742,0],[0,1,41.828,0],[0,2,41.914,0],[0,1,42,0],[0,2,42.085,0],[0,1,42.171,0],[0,2,42.257,0],[0,1,42.342,0],[1,1,42.514,42.857],[1,2,42.942,43.285],[0,0,43.542,0],[0,3,43.542,0],[0,3,43.714,0],[0,1,43.885,0],[0,2,43.885,0],[0,0,44.057,0],[0,1,44.228,0],[0,2,44.228,0],[0,3,44.4,0],[0,1,44.571,0],[0,2,44.571,0],[0,0,44.742,0],[0,1,44.914,0],[0,2,44.914,0],[0,1,45.085,0],[0,0,45.257,0],[0,3,45.257,0],[0,2,45.428,0],[0,0,45.6,0],[0,3,45.6,0],[0,1,45.771,0],[0,2,45.771,0],[0,0,45.942,0],[0,3,45.942,0],[0,2,46.114,0],[0,0,46.285,0],[0,3,46.285,0],[0,1,46.457,0],[0,0,46.628,0],[0,3,46.628,0],[0,1,46.8,0],[0,2,46.8,0],[0,0,46.971,0],[0,3,46.971,0],[0,1,47.142,0],[0,2,47.142,0],[0,0,47.314,0],[0,3,47.314,0],[0,1,47.485,0],[0,2,47.485,0],[0,0,47.657,0],[0,3,47.657,0],[0,0,47.828,0],[0,3,47.828,0],[0,0,48,0],[0,3,48,0],[0,0,48.171,0],[0,3,48.171,0],[0,0,48.342,0],[0,3,48.342,0],[0,0,48.514,0],[0,3,48.514,0],[0,0,48.685,0],[0,3,48.685,0],[0,2,48.857,0],[0,0,49.028,0],[0,3,49.028,0],[0,1,49.2,0],[0,0,49.371,0],[0,3,49.371,0],[0,2,49.542,0],[0,0,49.714,0],[0,3,49.714,0],[0,1,49.885,0],[0,0,50.057,0],[0,3,50.057,0],[0,3,50.228,0],[0,0,50.4,0],[0,3,50.4,0],[0,0,50.571,0],[0,2,50.571,0],[0,0,50.742,0],[0,3,50.742,0],[0,1,50.914,0],[0,2,50.914,0],[0,0,51.085,0],[0,3,51.085,0],[0,3,51.257,0],[0,0,51.428,0],[0,2,51.428,0],[0,0,51.6,0],[0,1,51.771,0],[0,3,51.771,0],[0,3,51.942,0],[0,0,52.114,0],[0,1,52.114,0],[0,0,52.285,0],[0,2,52.457,0],[0,3,52.457,0],[0,0,52.628,0],[0,2,52.8,0],[0,3,52.8,0],[0,3,52.971,0],[0,0,53.142,0],[0,1,53.142,0],[0,3,53.314,0],[0,0,53.485,0],[0,1,53.485,0],[0,3,53.657,0],[0,1,53.828,0],[0,2,53.828,0],[0,0,54,0],[0,1,54.171,0],[0,2,54.171,0],[0,3,54.342,0],[0,1,54.514,0],[0,2,54.514,0],[0,0,54.685,0],[1,1,54.857,55.2],[1,2,54.857,55.2],[0,2,55.285,0],[0,1,55.371,0],[0,2,55.457,0],[0,0,55.542,0],[0,3,55.542,0],[0,1,55.628,0],[0,2,55.714,0],[0,1,55.8,0],[0,0,55.885,0],[0,3,55.885,0],[0,3,56.057,0],[0,1,56.228,0],[0,2,56.228,0],[0,0,56.4,0],[0,3,56.4,0],[0,0,56.571,0],[0,1,56.742,0],[0,2,56.742,0],[0,1,56.914,0],[0,2,56.914,0],[0,1,57.085,0],[0,2,57.085,0],[0,1,57.257,0],[0,2,57.342,0],[0,1,57.428,0],[0,2,57.514,0],[0,0,57.6,0],[0,3,57.6,0],[0,3,57.771,0],[0,3,57.942,0],[0,0,57.942,0],[0,3,58.114,0],[0,3,58.285,0],[0,0,58.285,0],[0,3,58.457,0],[0,3,58.628,0],[0,0,58.628,0],[0,0,58.8,0],[0,0,58.971,0],[0,3,58.971,0],[0,0,59.142,0],[0,0,59.314,0],[0,3,59.314,0],[0,0,59.485,0],[0,0,59.657,0],[0,3,59.657,0],[0,0,59.828,0],[0,0,60,0],[0,3,60,0],[0,0,60.171,0],[0,0,60.342,0],[0,3,60.342,0],[0,1,60.514,0],[0,2,60.514,0],[0,0,60.685,0],[0,3,60.685,0],[0,0,60.857,0],[0,3,61.028,0],[0,0,61.2,0],[0,2,61.371,0],[0,1,61.542,0],[1,0,61.714,62.057],[1,3,61.714,62.057],[1,1,62.142,62.314],[1,2,62.142,62.314],[1,0,62.4,63.085],[1,3,63.171,63.685],[0,1,63.857,0],[0,2,64.028,0],[0,1,64.2,0],[0,2,64.371,0],[1,1,64.457,64.714],[1,2,64.457,64.8],[1,2,64.971,65.228],[1,1,64.971,65.314],[0,1,65.571,0],[0,2,65.571,0],[0,0,65.828,0],[0,3,65.828,0],[0,3,66.171,0],[0,3,66.514,0],[0,0,66.857,0],[0,3,66.857,0],[0,0,67.2,0],[0,0,67.542,0],[0,0,67.885,0],[0,3,67.885,0],[0,3,68.228,0],[0,3,68.571,0],[0,0,68.571,0],[0,0,68.742,0],[0,0,68.914,0],[0,3,68.914,0],[0,3,69.085,0],[0,3,69.257,0],[0,0,69.257,0],[0,1,69.428,0],[0,2,69.428,0],[0,1,69.6,0],[0,2,69.6,0],[0,1,69.771,0],[0,2,69.771,0],[0,1,69.942,0],[0,2,69.942,0],[0,1,70.114,0],[0,2,70.114,0],[0,1,70.285,0],[0,2,70.285,0],[0,1,70.457,0],[0,2,70.457,0],[0,0,70.628,0],[0,3,70.628,0],[0,0,70.8,0],[0,3,70.8,0],[0,0,70.971,0],[0,3,70.971,0],[0,0,71.142,0],[0,3,71.142,0],[0,0,71.314,0],[0,3,71.314,0],[0,3,71.657,0],[0,0,72,0],[0,3,72,0],[0,0,72.342,0],[0,0,72.685,0],[0,3,72.685,0],[0,2,73.028,0],[0,0,73.371,0],[0,3,73.371,0],[0,1,73.714,0],[0,0,74.057,0],[0,3,74.057,0],[0,1,74.228,0],[0,2,74.228,0],[0,1,74.4,0],[0,2,74.4,0],[0,1,74.571,0],[0,2,74.571,0],[0,1,74.742,0],[0,2,74.742,0],[0,0,74.914,0],[0,3,74.914,0],[0,0,75.085,0],[0,3,75.085,0],[0,0,75.257,0],[0,3,75.257,0],[1,0,75.428,76.2],[1,3,75.428,76.2],[0,1,76.8,0],[0,2,76.8,0],[1,2,77.314,77.657],[1,1,77.828,78],[1,0,78.085,78.6],[1,3,78.771,79.028],[1,1,79.2,79.285],[1,0,79.542,80.142],[1,3,79.542,80.142],[1,1,80.914,81.085],[1,2,81.171,81.428],[1,1,81.6,81.771],[1,3,81.857,82.028],[1,0,82.2,83.057],[1,1,83.657,84],[1,2,83.828,84],[1,0,84.257,84.771],[1,3,84.514,84.771],[1,3,85.028,86.314],[1,0,85.285,86.314],[0,1,87.857,0],[0,2,87.857,0],[1,2,88.457,88.714],[1,0,88.8,88.971],[1,3,89.142,89.314],[1,2,89.657,90],[1,3,90.171,90.342],[1,0,90.514,91.285],[1,1,91.885,92.485],[1,3,92.228,92.485],[1,3,92.657,93.171],[1,0,92.914,93.171],[1,0,93.428,93.6],[1,3,93.428,93.6],[1,0,94.628,94.885],[1,3,94.628,94.885],[1,0,95.057,95.142],[1,3,95.057,95.142],[0,1,95.314,0],[0,2,95.314,0],[0,1,95.571,0],[0,2,95.571,0],[1,0,95.828,96],[1,3,95.828,96.257],[0,0,96.514,0],[0,3,96.514,0],[1,2,97.371,97.8],[1,1,97.885,98.314],[0,0,98.742,0],[0,3,98.828,0],[0,0,98.914,0],[0,3,99.085,0],[0,0,99.171,0],[0,3,99.257,0],[0,0,99.428,0],[0,3,99.428,0],[0,0,99.6,0],[0,3,99.6,0],[0,1,99.771,0],[0,2,99.771,0],[0,0,99.942,0],[0,3,99.942,0],[0,0,100.114,0],[0,3,100.114,0],[0,1,100.285,0],[0,2,100.285,0],[0,1,100.457,0],[0,2,100.457,0],[0,1,100.628,0],[0,2,100.628,0],[0,0,100.8,0],[0,3,100.885,0],[0,0,100.971,0],[0,1,101.228,0],[0,2,101.228,0],[0,0,101.485,0],[0,3,101.485,0],[0,0,101.571,0],[0,3,101.571,0],[0,0,101.657,0],[0,3,101.657,0],[0,1,101.828,0],[0,2,101.828,0],[0,1,102,0],[0,2,102,0],[0,1,102.171,0],[0,2,102.171,0],[0,3,102.342,0],[0,0,102.428,0],[0,3,102.514,0],[0,0,102.685,0],[0,3,102.685,0],[0,0,102.857,0],[0,3,102.857,0],[0,1,103.028,0],[0,2,103.028,0],[0,1,103.2,0],[0,2,103.2,0],[0,0,103.371,0],[0,2,103.457,0],[0,3,103.457,0],[0,3,103.628,0],[0,1,103.714,0],[0,0,103.714,0],[1,1,103.885,104.142],[1,2,103.885,104.142],[0,0,104.228,0],[0,3,104.228,0],[0,1,104.4,0],[0,2,104.4,0],[0,0,104.571,0],[0,3,104.571,0],[0,0,104.914,0],[0,3,104.914,0],[0,0,105.257,0],[0,3,105.257,0],[0,1,105.428,0],[0,2,105.428,0],[0,1,105.6,0],[0,2,105.6,0],[0,1,105.771,0],[0,2,105.857,0],[0,1,105.942,0],[0,2,106.028,0],[0,1,106.114,0],[0,2,106.285,0],[0,1,106.371,0],[0,2,106.457,0],[0,1,106.542,0],[0,2,106.628,0],[0,1,106.714,0],[0,2,106.8,0],[0,0,106.971,0],[0,3,106.971,0],[0,0,107.142,0],[0,3,107.142,0],[0,1,107.314,0],[0,2,107.314,0],[0,0,107.485,0],[0,3,107.485,0],[0,1,107.657,0],[0,2,107.657,0],[0,0,107.828,0],[0,3,107.828,0],[0,0,108,0],[0,3,108,0],[0,0,108.171,0],[0,3,108.171,0],[0,0,108.342,0],[0,3,108.342,0],[0,1,108.514,0],[0,3,108.685,0],[0,0,108.685,0],[0,2,108.857,0],[0,0,109.028,0],[0,3,109.028,0],[0,3,109.2,0],[0,2,109.285,0],[0,1,109.371,0],[0,0,109.457,0],[0,0,109.714,0],[0,3,109.714,0],[0,1,109.885,0],[0,2,109.885,0],[0,0,110.057,0],[0,3,110.057,0],[0,1,110.228,0],[0,2,110.228,0],[0,0,110.4,0],[0,3,110.4,0],[0,0,110.571,0],[0,3,110.571,0],[0,0,110.742,0],[0,3,110.742,0],[0,1,110.914,0],[0,2,110.914,0],[0,1,111.085,0],[0,2,111.085,0],[0,3,111.257,0],[0,0,111.428,0],[0,1,111.428,0],[0,3,111.6,0],[0,0,111.771,0],[0,1,111.771,0],[0,3,111.942,0],[0,0,112.114,0],[0,1,112.114,0],[0,3,112.285,0],[0,1,112.457,0],[0,0,112.457,0],[0,0,112.628,0],[0,2,112.8,0],[0,3,112.8,0],[0,0,112.971,0],[0,2,113.142,0],[0,3,113.142,0],[0,0,113.314,0],[0,2,113.485,0],[0,3,113.485,0],[0,0,113.657,0],[0,2,113.828,0],[0,3,113.828,0],[0,3,114,0],[0,0,114.171,0],[0,1,114.171,0],[0,1,114.342,0],[0,0,114.514,0],[0,1,114.514,0],[0,1,114.685,0],[0,0,114.857,0],[0,1,114.857,0],[0,1,115.028,0],[0,0,115.2,0],[0,1,115.2,0],[0,3,115.371,0],[0,2,115.371,0],[0,2,115.542,0],[0,2,115.714,0],[0,3,115.714,0],[0,2,115.885,0],[0,2,116.057,0],[0,3,116.057,0],[0,2,116.228,0],[0,2,116.4,0],[0,3,116.4,0],[1,0,116.571,116.828],[1,3,116.571,116.828],[1,1,116.914,117.085],[1,2,116.914,117.085],[1,3,117.257,117.6],[1,0,117.685,118.628],[1,1,119.314,120.342],[1,2,119.828,120.342],[0,1,120.514,0],[0,2,120.514,0],[0,0,120.685,0],[0,3,120.685,0],[0,2,120.857,0],[0,0,121.028,0],[0,3,121.028,0],[0,0,121.2,0],[0,3,121.2,0],[0,1,121.371,0],[0,2,121.371,0],[0,0,121.542,0],[0,3,121.542,0],[1,2,121.714,121.8],[1,1,121.885,122.057],[0,3,122.285,0],[0,0,122.4,0],[0,3,122.485,0],[0,1,122.742,0],[0,0,122.742,0],[0,1,122.914,0],[0,2,122.914,0],[0,1,123.085,0],[0,0,123.085,0],[0,3,123.257,0],[0,0,123.342,0],[0,3,123.428,0],[0,0,123.6,0],[0,3,123.6,0],[0,0,123.771,0],[0,3,123.771,0],[0,0,123.942,0],[0,3,123.942,0],[0,3,124.114,0],[0,0,124.2,0],[0,3,124.285,0],[0,0,124.457,0],[0,3,124.457,0],[0,2,124.628,0],[0,1,124.8,0],[0,2,124.8,0],[0,1,124.971,0],[0,1,125.142,0],[0,2,125.142,0],[0,1,125.314,0],[0,2,125.314,0],[0,2,125.485,0],[0,3,125.485,0],[0,1,125.657,0],[0,2,125.657,0],[0,2,125.828,0],[0,3,125.828,0],[1,1,126,126.171],[1,2,126,126.171],[0,3,126.342,0],[0,0,126.428,0],[0,3,126.514,0],[0,0,126.685,0],[0,3,126.685,0],[0,0,126.857,0],[0,3,126.857,0],[0,0,127.028,0],[0,3,127.028,0],[0,1,127.2,0],[0,2,127.2,0],[0,1,127.371,0],[0,2,127.371,0],[0,0,127.542,0],[0,3,127.542,0],[0,3,127.714,0],[0,0,127.714,0],[0,3,127.885,0],[0,0,127.885,0],[0,1,128.057,0],[0,2,128.057,0],[0,0,128.228,0],[0,2,128.4,0],[0,3,128.4,0],[0,3,128.571,0],[0,1,128.742,0],[0,0,128.742,0],[0,1,128.914,0],[0,2,128.914,0],[0,0,129.085,0],[0,3,129.085,0],[0,1,129.257,0],[0,2,129.257,0],[1,0,129.428,129.771],[1,3,129.6,129.771],[0,0,129.942,0],[0,3,129.942,0],[0,1,130.114,0],[0,2,130.114,0],[0,0,130.285,0],[0,3,130.285,0],[0,1,130.457,0],[0,2,130.457,0],[0,1,130.628,0],[0,2,130.628,0],[0,3,130.8,0],[0,2,130.8,0],[0,0,130.971,0],[0,1,130.971,0],[1,1,131.142,131.657],[1,2,131.142,131.657],[0,0,131.828,0],[0,1,131.828,0],[0,2,132,0],[0,3,132,0],[0,0,132.171,0],[0,1,132.171,0],[0,1,132.342,0],[0,2,132.342,0],[0,1,132.514,0],[0,2,132.514,0],[0,1,132.685,0],[0,2,132.685,0],[0,1,132.857,0],[0,2,132.857,0],[0,1,133.028,0],[0,2,133.028,0],[0,0,133.2,0],[0,3,133.2,0],[0,0,133.371,0],[0,3,133.371,0],[0,0,133.542,0],[0,3,133.542,0],[0,0,133.714,0],[0,3,133.714,0],[0,0,133.885,0],[0,3,133.885,0],[0,0,134.057,0],[0,3,134.057,0],[0,0,134.228,0],[0,3,134.228,0],[0,0,134.4,0],[0,3,134.4,0],[0,1,134.571,0],[0,2,134.571,0],[0,2,134.742,0],[0,1,134.914,0],[0,2,134.914,0],[0,1,135.085,0],[0,1,135.257,0],[0,2,135.257,0],[0,3,135.428,0],[0,1,135.6,0],[0,2,135.6,0],[0,0,135.771,0],[0,1,135.942,0],[0,2,135.942,0],[0,3,136.114,0],[0,2,136.285,0],[0,0,136.285,0],[0,1,136.457,0],[0,1,136.628,0],[0,3,136.628,0],[0,0,136.8,0],[0,1,136.971,0],[0,3,136.971,0],[0,3,137.142,0],[0,0,137.314,0],[0,2,137.314,0],[0,1,137.485,0],[0,0,137.657,0],[0,3,137.657,0],[0,3,137.828,0],[0,0,138,0],[0,3,138,0],[0,0,138.171,0],[0,0,138.342,0],[0,3,138.342,0],[0,2,138.514,0],[0,0,138.685,0],[0,3,138.685,0],[0,1,138.857,0],[0,1,139.028,0],[0,2,139.028,0],[0,0,139.2,0],[0,2,139.371,0],[0,3,139.371,0],[0,0,139.542,0],[0,1,139.714,0],[0,2,139.714,0],[0,3,139.885,0],[0,0,140.057,0],[0,1,140.057,0],[0,0,140.228,0],[0,2,140.4,0],[0,3,140.4,0],[0,1,140.571,0],[0,2,140.571,0],[0,1,140.742,0],[0,2,140.742,0],[0,1,140.914,0],[0,2,140.914,0],[0,1,141.085,0],[0,2,141.085,0],[0,1,141.257,0],[0,2,141.257,0],[0,0,141.428,0],[0,3,141.428,0],[0,0,141.6,0],[0,3,141.6,0],[0,0,141.771,0],[0,3,141.771,0],[0,0,141.942,0],[0,3,141.942,0],[0,0,142.114,0],[0,3,142.114,0],[0,0,142.285,0],[0,3,142.285,0],[0,0,142.457,0],[0,3,142.457,0],[1,1,142.628,145.028],[1,2,142.628,145.028]];
function buildSparkChart(){
  const g=game.notes;
  for(let i=0;i<SPARK_NOTES.length;i++){
    const n=SPARK_NOTES[i];
    const t=n[2]+MUSIC_DELAY-0.1;
    if(n[0]===1){g.push({time:t,lane:n[1],startLane:n[1],type:'hold',end:n[3]+MUSIC_DELAY-0.1,perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});}
    else{g.push({time:t,lane:n[1],startLane:n[1],type:'tap',end:0,perform:false,judged:false,headHit:false,is_chord:false,is_multi:false});}
  }
}

function generateBeatmap(){
  game.notes=[];
  if(selectedSong&&selectedSong.chart==='effulgence')EFF();
  else if(selectedSong&&selectedSong.chart==='spark')buildSparkChart();
  else if(selectedSong&&selectedSong.chart==='corr')buildCorrChart();
  else if(selectedSong&&selectedSong.chart==='still')buildStillChart();
  else if(selectedSong&&selectedSong.chart==='w')buildWChart();
  else if(selectedSong&&selectedSong.chart==='ltzz')buildLtzzChart();
  else if(selectedSong&&selectedSong.chart==='welkin')buildWelkinChart();
  else if(selectedSong&&selectedSong.chart==='init')buildInitChart();
  else if(selectedSong&&selectedSong.chart==='an')buildAnChart();
  else if(selectedSong&&selectedSong.chart==='la')buildLaChart();
  else if(selectedSong&&selectedSong.chart==='lady')buildLadyChart();
  else if(selectedSong&&selectedSong.chart==='pen')buildPenChart();
  else if(selectedSong&&selectedSong.chart==='fb')buildFbChart();
  else if(selectedSong&&selectedSong.chart==='cyber')buildCyberChart();
  finalizeChart();
  applyBreakConversion();
  if(selectedSong)selectedSong.notes=game.notes.reduce((a,n)=>a+(n.perform?0:1),0);
}


function unlockAudio(){
  if(audioUnlocked)return;audioUnlocked=true;
  try{bgm.load();}catch(e){}
  bgm.muted=true;
  const p=bgm.play();
  if(p&&p.then){
    p.then(()=>{
      if(state!=='GAME'&&state!=='RESUMING'){try{bgm.pause();bgm.currentTime=0;}catch(e){}}
      bgm.muted=false;
    }).catch(()=>{bgm.muted=false;});
  }else bgm.muted=false;
}
function startAudio(){
  if(playPending)return false;
  if(!bgm.paused){audioSyncPending=true;return true;}
  if(performance.now()<audioRetryAfter)return false;
  bgm.muted=false;
  const myToken=++playToken;
  playPending=true;playPendingSince=performance.now();
  let p;
  try{p=bgm.play();}catch(e){playPending=false;audioRetryAfter=performance.now()+2000;return false;}
  if(p&&p.then){
    p.then(()=>{if(myToken!==playToken)return;playPending=false;audioSyncPending=true;audioFailCount=0;}).catch(err=>{
      if(myToken!==playToken)return;playPending=false;
      const name=err&&err.name;
      if(name!=='NotAllowedError'&&name!=='AbortError'){audioFailCount++;if(audioFailCount>=3){audioRetryAfter=performance.now()+2000;audioFailCount=0;}}
    });
  }else{playPending=false;audioSyncPending=true;}
  return true;
}
function releaseAudioGate(){
  if(!audioGate)return;
  audioGate=false;audioGateDone=true;audioStarted=true;audioSyncPending=false;
  const t=Math.max(MUSIC_DELAY+AUDIO_DELAY,bgm.currentTime+MUSIC_DELAY+AUDIO_DELAY);
  clockAnchor=performance.now()-t*1000;
  game.clock=t;
}
bgm.addEventListener('playing',releaseAudioGate);
function resetAudioState(){
  playToken++;playPending=false;playPendingSince=0;
  audioStarted=false;audioSyncPending=false;audioFailCount=0;audioRetryAfter=0;
  audioGate=false;audioGateSince=0;audioGateDone=false;
  lastBgTimeChangeAt=0;bgTimeInitialized=false;lastHealthCheck=0;lastSeekTime=0;
  resumePendingStart=false;resumePendingTimer=0;
  bgm.muted=false;
  try{bgm.pause();bgm.currentTime=0;}catch(e){}
}
function updateMusic(){
  if(playPending&&performance.now()-playPendingSince>2500){playPending=false;playToken++;}
  if(!audioStarted&&!audioGateDone&&game.clock>=MUSIC_DELAY+AUDIO_DELAY&&performance.now()>=audioRetryAfter){
    if(!audioGate){
      audioGate=true;audioGateSince=performance.now();
      game.clock=MUSIC_DELAY+AUDIO_DELAY;
      clockAnchor=performance.now()-(MUSIC_DELAY+AUDIO_DELAY)*1000;
    }
    const target=0;
    try{bgm.currentTime=target;}catch(e){}
    if(startAudio())audioStarted=true;
  }
  if(audioStarted&&audioSyncPending&&!bgm.paused&&!playPending){
    audioSyncPending=false;
    if(audioGate)releaseAudioGate();
  }
  if(audioGate&&performance.now()-audioGateSince>1800){
    audioGate=false;audioGateDone=true;audioStarted=false;audioSyncPending=false;
    clockAnchor=performance.now()-game.clock*1000;
  }
}
function updateMusicHealth(){
  if(!isPlaying)return;
  if(game.clock<MUSIC_DELAY+AUDIO_DELAY)return;
  if(!audioStarted)return;
  const now=performance.now();
  if(now-lastHealthCheck<500)return;
  lastHealthCheck=now;
  if(bgm.paused&&!playPending){
    if(!bgTimeInitialized){lastBgTimeChangeAt=now;bgTimeInitialized=true;return;}
    if(now-lastBgTimeChangeAt>2000&&now>=audioRetryAfter){
      const expected=Math.max(0,audioTime(game.clock));
      try{bgm.currentTime=expected;}catch(e){}
      if(startAudio())audioStarted=true;
      lastBgTimeChangeAt=now;bgTimeInitialized=false;
    }
    return;
  }
  bgTimeInitialized=false;
  if(!bgm.paused&&now-lastSeekTime>3000){
    const expected=Math.max(0,audioTime(game.clock));
    if(Math.abs(bgm.currentTime-expected)>.5){try{bgm.currentTime=expected;}catch(e){}lastSeekTime=now;}
  }
}

/* ============================================================
   10. gameplay —judgement
   ============================================================ */
function judgementClock(stamp){
  // 用实时渲染时钟判定（回归到之前验证过的稳定版本）。
  const now=performance.now();
  return isPlaying?(now-clockAnchor)/1000:game.clock;
}
function judgeBreak(n){
  if(n.judged)return;
  n.judged=true;
  game.lastDelta=0;game.lastType='';
  game.perfect++;game.weightSum+=1;game.combo++;
  game.feedback='PERFECT';game.feedbackType='P';game.feedbackTimer=.62;game.comboScale=1.5;feedbackYOffset=0;
  game.judgeLineGlow=1;game.screenShake=Math.max(game.screenShake,2);
  addHitFx(n.lane,0,n.is_chord,n.is_multi);ltzzChordShake(n);welkinChordShake(n);ch2ChordShake(n);playBreakSfx(n.lane);
  if(game.combo>game.maxCombo)game.maxCombo=game.combo;
  if(Math.abs(n.time-FINAL_CHORD_TIME)<.05)game.flashAlpha=.5;
}
function startHold(n,quality){
  n.headHit=true;n.holdActive=true;n.holdQuality=quality;n.judged=true;n.holdFailed=false;
  n.nextHoldCheck=game.clock+.05;
  game.combo++;if(game.combo>game.maxCombo)game.maxCombo=game.combo;
  game.feedback=quality==='P'?'PERFECT':'GOOD';game.feedbackType=quality==='P'?'P':'G';
  game.feedbackTimer=.62;game.comboScale=1.5;feedbackYOffset=0;
  game.judgeLineGlow=quality==='P'?1:.6;game.screenShake=quality==='P'?2:1.5;
  addHitFx(n.lane,quality==='P'?0:1,n.is_chord,n.is_multi);ltzzChordShake(n);welkinChordShake(n);ch2ChordShake(n);
  playHitSfx(n.lane,quality==='P'?0:1);
  if(game.combo>game.maxCombo)game.maxCombo=game.combo;
}
function failHold(n){
  if(n.holdFailed)return;
  n.holdFailed=true;n.holdActive=false;game.miss++;game.combo=0;
  game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
  addMissFx(n.lane);
}
function finishHold(n){
  if(n.holdDone)return;
  n.holdDone=true;n.holdActive=false;n.judged=true;
  if(n.holdFailed)return;             // miss 已在 failHold 计过，避免重复
  if(n.holdQuality==='P'){game.perfect++;game.weightSum+=1;}
  else{game.good++;game.weightSum+=.65;}
}
function updateHolds(){
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.type!=='hold'||n.perform||!n.headHit||n.holdDone)continue;
    if(n.holdFailed){if(game.clock>n.end+.02)finishHold(n);continue;}
    if(game.clock>=n.end-.1){n.holdSafe=true;}
    else if(game.clock>=n.nextHoldCheck){
      n.nextHoldCheck+=.05;
      if(!game.keyHold[n.lane]){failHold(n);continue;}
    }
    if(n.holdActive&&game.keyHold[n.lane]){
      game.laneFlash[n.lane]=Math.max(game.laneFlash[n.lane],.42+.12*Math.sin(game.clock*13+n.lane));
      game.judgeLineGlow=Math.max(game.judgeLineGlow,.38);
    }
    if(game.clock>n.end+.02)finishHold(n);
  }
}
function judgeYellowTouch(lane,stamp){
  const now=judgementClock(stamp)+(settings.inputOffset||0)/1000;
  let hit=false;
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.perform||n.judged||n.type!=='break'||n.lane!==lane)continue;
    if(n.breakArmed){if(now>=n.time)judgeBreak(n);continue;}
    if(Math.abs(n.time-now)<=.1){
      n.breakArmed=true;hit=true;
      if(now>=n.time)judgeBreak(n);
    }
  }
  return hit;
}
function judgeLane(lane,stamp){
  /* 取最早（first-in-window）：一条轨道只消费「最早进入窗口」的那个音符。
     点晚了也吃自己瞄准的那个（最多 GOOD），一跳一音符，绝不顺延。 */
  const nowClock=judgementClock(stamp)+(settings.inputOffset||0)/1000;
  let idx=game.lanePtr[lane]||0;
  while(idx<game.notes.length){
    const n=game.notes[idx];
    if(n.lane!==lane||n.type==='break'){idx++;continue;}
    const ahead=n.time-nowClock;
    if(ahead>BAD_WINDOW){game.lanePtr[lane]=idx;break;}   // 还太远，停，指针不动
    if(ahead<-BAD_WINDOW){idx++;continue;}                // 已过窗：跳过
    if(n.judged){idx++;continue;}                         // 已判定：跳过
    game.lanePtr[lane]=idx+1;                             // 消费「最早在窗内」的音符
    const dt=ahead,bestDt=Math.abs(dt);
    game.lastDelta=dt;game.lastType='';
    if(n.type==='hold'){
      const quality=bestDt<=PERFECT_WINDOW?'P':(bestDt<=GOOD_WINDOW?'G':'B');
      if(bestDt>.012)game.lastType=dt>0?'EARLY':'LATE';
      startHold(n,quality);
      return;
    }
    n.judged=true;
    if(bestDt<=PERFECT_WINDOW){
      game.perfect++;game.weightSum+=1;game.combo++;
      game.feedback='PERFECT';game.feedbackType='P';game.judgeLineGlow=1;game.screenShake=2.0;
      addHitFx(lane,0,n.is_chord,n.is_multi);ltzzChordShake(n);welkinChordShake(n);ch2ChordShake(n);playHitSfx(lane,0);
    }else if(bestDt<=GOOD_WINDOW){
      game.good++;game.weightSum+=.65;game.combo++;
      game.feedback='GOOD';game.feedbackType='G';game.judgeLineGlow=.6;game.screenShake=1.5;
      addHitFx(lane,1,n.is_chord,n.is_multi);ltzzChordShake(n);welkinChordShake(n);ch2ChordShake(n);playHitSfx(lane,1);
    }else{
      game.bad++;game.combo=0;game.feedback='BAD';game.feedbackType='B';
      addHitFx(lane,2,n.is_chord,n.is_multi);
    }
    if(bestDt>.012)game.lastType=dt>0?'EARLY':'LATE';
    game.feedbackTimer=.62;game.comboScale=1.5;feedbackYOffset=0;
    if(game.combo>game.maxCombo)game.maxCombo=game.combo;
    if(Math.abs(n.time-FINAL_CHORD_TIME)<.05)game.flashAlpha=.5;
    if(game.combo>0&&game.combo%50===0)game.whiteFlash=Math.min(.14,game.whiteFlash+.06);
    return;
  }
  game.laneFlash[lane]=Math.min(1,game.laneFlash[lane]+.2);
}

/* ============================================================
   11. gameplay —hit sound & effects
   ============================================================ */
const HIT_B64="T2dnUwACAAAAAAAAAABtCQAAAAAAAPWwJ28BHgF2b3JiaXMAAAAAAUSsAAD/////AO4CAP////+4AU9nZ1MAAAAAAAAAAAAAbQkAAAEAAAAbTsG2EYj////////////////////VA3ZvcmJpcywAAABYaXBoLk9yZyBsaWJWb3JiaXMgSSAyMDE1MDEwNSAo4puE4puE4puE4puEKQYAAAARAAAARU5DT0RFUj1GTCBTdHVkaW8GAAAAVElUTEU9BgAAAEdFTlJFPQcAAABBUlRJU1Q9CAAAAENPTU1FTlQ9CAAAAENPTlRBQ1Q9AQV2b3JiaXMrQkNWAQAIAAAAMUwgxYDQkFUAABAAAGAkKQ6TZkkppZShKHmYlEhJKaWUxTCJmJSJxRhjjDHGGGOMMcYYY4wgNGQVAAAEAIAoCY6j5klqzjlnGCeOcqA5aU44pyAHilHgOQnC9SZjbqa0pmtuziklCA1ZBQAAAgBASCGFFFJIIYUUYoghhhhiiCGHHHLIIaeccgoqqKCCCjLIIINMMumkk0466aijjjrqKLTQQgsttNJKTDHVVmOuvQZdfHPOOeecc84555xzzglCQ1YBACAAAARCBhlkEEIIIYUUUogppphyCjLIgNCQVQAAIACAAAAAAEeRFEmxFMuxHM3RJE/yLFETNdEzRVNUTVVVVVV1XVd2Zdd2ddd2fVmYhVu4fVm4hVvYhV33hWEYhmEYhmEYhmH4fd/3fd/3fSA0ZBUAIAEAoCM5luMpoiIaouI5ogOEhqwCAGQAAAQAIAmSIimSo0mmZmquaZu2aKu2bcuyLMuyDISGrAIAAAEABAAAAAAAoGmapmmapmmapmmapmmapmmapmmaZlmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVlAaMgqAEACAEDHcRzHcSRFUiTHciwHCA1ZBQDIAAAIAEBSLMVyNEdzNMdzPMdzPEd0RMmUTM30TA8IDVkFAAACAAgAAAAAAEAxHMVxHMnRJE9SLdNyNVdzPddzTdd1XVdVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVgdCQVQAABAAAIZ1mlmqACDOQYSA0ZBUAgAAAABihCEMMCA1ZBQAABAAAiKHkIJrQmvPNOQ6a5aCpFJvTwYlUmye5qZibc84555xszhnjnHPOKcqZxaCZ0JpzzkkMmqWgmdCac855EpsHranSmnPOGeecDsYZYZxzzmnSmgep2Vibc85Z0JrmqLkUm3POiZSbJ7W5VJtzzjnnnHPOOeecc86pXpzOwTnhnHPOidqba7kJXZxzzvlknO7NCeGcc84555xzzjnnnHPOCUJDVgEAQAAABGHYGMadgiB9jgZiFCGmIZMedI8Ok6AxyCmkHo2ORkqpg1BSGSeldILQkFUAACAAAIQQUkghhRRSSCGFFFJIIYYYYoghp5xyCiqopJKKKsoos8wyyyyzzDLLrMPOOuuwwxBDDDG00kosNdVWY4215p5zrjlIa6W11lorpZRSSimlIDRkFQAAAgBAIGSQQQYZhRRSSCGGmHLKKaegggoIDVkFAAACAAgAAADwJM8RHdERHdERHdERHdERHc/xHFESJVESJdEyLVMzPVVUVVd2bVmXddu3hV3Ydd/Xfd/XjV8XhmVZlmVZlmVZlmVZlmVZlmUJQkNWAQAgAAAAQgghhBRSSCGFlGKMMcecg05CCYHQkFUAACAAgAAAAABHcRTHkRzJkSRLsiRN0izN8jRP8zTRE0VRNE1TFV3RFXXTFmVTNl3TNWXTVWXVdmXZtmVbt31Ztn3f933f933f933f933f13UgNGQVACABAKAjOZIiKZIiOY7jSJIEhIasAgBkAAAEAKAojuI4jiNJkiRZkiZ5lmeJmqmZnumpogqEhqwCAAABAAQAAAAAAKBoiqeYiqeIiueIjiiJlmmJmqq5omzKruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6QGjIKgBAAgBAR3IkR3IkRVIkRXIkBwgNWQUAyAAACADAMRxDUiTHsixN8zRP8zTREz3RMz1VdEUXCA1ZBQAAAgAIAAAAAADAkAxLsRzN0SRRUi3VUjXVUi1VVD1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXVNE3TNIHQkJUAABkAAOjFCCGEEJKjlloQvlfKOSg1914xZhTE3nulmEGOcvCZYko5KLWnzjGliJFcWyuRIsRhDjpVTimoQefWSQgtB0JDVgQAUQAAAEKIMcQYYoxByCBEjDEIGYSIMQYhg9BBCCWFlDIIIZWQUsQYg9BBySCElEJJGZSQUkilAACAAAcAgAALodCQFQFAnAAAgpBziDEIFWMQOgipdBBSqhiDkDknJXMOSiglpRBKShVjEDLnJGTOSQklpBRKSamDkFIopaVQSmoppRhTSi12EFIKpaQUSmkptRRbSi3GijEImXNSMuekhFJaCqWkljknpYOQUgehlJJSa6Wk1jLnpHTQSekglFJSaamU1FooJbWSUmslldZaazGm1mIMpaQUSmmtpNRiaim21lqsFWMQMuekZM5JCaWkFEpJLXNOSgchlc5BKSWV1kpJqWXOSekglNJBKKWk0lpJpbVQSkslpdZCKa211mJMqbUaSkmtpNRaSam11FqtrbUYOwgphVJaCqW0llqKMaUWYyiltZJSayWl1lprtbbWYgyltFRSaa2k1FpqrcbWWqyppRhTazG21mqNMcYcY805pRRjainG1FqMLbYcY6w1dxBSCqWkFkpJLbUUY2otxlBKaiWV1kpJLbbWakytxRpKaa2k1FpJqbXWWo2ttRpTSjGm1mpMqcUYY8y1tRhzai3G1lqsqbUYY6w1xxhrLQAAYMABACDAhDJQaMhKACAKAAAxBiHGnDMIKcUYhMYgpRiDECnFmHMQIqUYcw5CxphzEErJGHMOQikdhBJKSamDEEopKRUAAFDgAAAQYIOmxOIAhYasBABCAgAYhJRizDnnIJSSUoSQUow55xyEUlKKEFKKMeecg1BKSpVSTDHmHIRSUmqpUkoxxpyDUEpKqWWMMeYchBBKSam1jDHGnIMQQikptdY55xx0EkpJpaXYOuecgxBKKSWl1lrnHIQQSkmlpdZi65yDEEIpJaXUWoshhFJKSSWllmKLMYRSSiklpZRaizGWVFJKqaXWYouxxlJKSiml1lqLMcaaUmqptdZijLHGWlNKqbXWWosxxlprAQAABw4AAAFG0ElGlUXYaMKFB6DQkBUBQBQAAGAMYgwxhpxzEDIIkXMMQgchcs5J6aRkUkJpIaVMSkglpBY556R0UjIpoaVQUiYlpFRaKQAA7MABAOzAQig0ZCUAkAcAACGkFGOMMYaUUooxxhxDSinFGGOMKaUYY4wx55RSjDHGmHOMMcYcc845xhhjzDnnHGPMMeecc44xxpxzzjnHHHPOOeecY84555xzzgkAACpwAAAIsFFkc4KRoEJDVgIAqQAAhDFKMeYchFIahRhzzjkIpTRIMeaccxBKqRhzzjkIpZRSMeaccxBKKSVzzjkIIZSSUuaccxBCKCWlzjkIIYRSSkqdcxBCKKGUlEIIpZRSUkqphRBKKaWUVFoqpZSSUkqptVZKKSWllFpqrQAA8AQHAKACG1ZHOCkaCyw0ZCUAkAEAwBiDkEEGIWMQQgghhBBCCAkAABhwAAAIMKEMFBqyEgBIBQAADFKKMQelpBQpxZhzEEpJKVKKMecglJJSxZhzEEpJqbWKMecglJJSa51zEEpJqbUYO+cglJJSazGGEEpJqbUYYwwhlJJSazHWWkpJqbUYa8y1lJJSazHWWmtKrbUYa60155RaazHWWnPOBQAgNDgAgB3YsDrCSdFYYKEhKwGAPAAASCnGGGOMMaUUY4wxxphSijHGGGOMMcYYY4wxphhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMeYYY4wxxhhjzDnGGGOMOeYcY4wxxpxzTgAAUIEDAECAjSKbE4wEFRqyEgAIBwAAjGHMOecglJBKo5RzEEIoJZVWGqWcgxJCKSm1ljknJaVSUmottsw5KSmVklJrLXYSUmotpdZirLGDkFJrqbUWY40dhFJaii3GGnPtIJSSWmsxxlprKKWl2GKssdaaQymptRZjrTXnXFJqLcZaa82155JSazHGWmutuafWYqyx1lxz7z21FmONteace84FAJg8OABAJdg4w0rSWeFocKEhKwGA3AAARinGnHMOQgghhBBCCJVSjDnnHIQQQgghhBAqpRhzzjkIIYQQQgghZIw55xx0EEIIIYQQQsgYc845CCGEEEIIIYTQOecchBBCCCGEUEIppXPOOQchhBBCCCGEUErnHIQQQgghhBJKKKWUzjkIIYQQQgilhFJKKSGEEEIIIYQSSimllFI6CCGEEEIIpZRSSimlhBBCCCGEEEoppZRSSgkhhBBCCCGUUkoppZQSQgghhBJKKaWUUkopJYQQQgihlFJKKaWUUkoIIYRSSimllFJKKaWUEEIoIZRSSimllFJKKSGEEkoopZRSSimllFJCCCWUUkoppZRSSimlhBBCKKWUUkoppZRSSgkhlFJKKaWUUkoppZRSAADQgQMAQIARlRZipxlXHoEjChkmoEJDVgIA4QAAACGUUkoppZRSaiSllFJKKaWUUiMlpZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKpZRSSimllFJKKaWUUkoppZRSSimlAKjLDAfA6AkbZ1hJOiscDS40ZCUAkBYAABjDmGOOQSehlJRaa5iCUELopKTSSmyxNUpBCCGEUlJKrbXWMuiolJJKSq3FFmOMmYNSUiolpdRijLHWDkJKLbUWW4ux5lprB6GklFqLLcZaa669g5BKa63lGGOwOefaQSgptdhijDXXWnsOqbQWY4y19lxrzTmIUlKKMdYac80199xLSq3FmmuuNQefcxCmpdhqjTXnnHsQOvjUWo255h500EHnHnRKrdZaa849ByF88Lm1WGvNNefegw86CN9qqzXnXGvvPfeeg24x1lxz0MEHIXzwQbgYa8859xyEDjr4HgwAyI1wAEBcMJKQOsuw0ogbT8AQgRQasgoAiAEAIIxBBiGElFJKKaWUYoopxhhjjDHGGGOMMcYYY4wxxgQAACY4AAAEWMGuzNKqjeKmTvKiDwKf0BGbkSGXUjGTE0GP1FCLlWCHVnCDF4CFhqwEAMgAABCIseZac44QlNZi7blUSjlqseeUIYKctJxLyQxBTlprLWTIKCcxthQyhBS02lrplFKMYquxdIwxSanFlkrnIAAAAIIAAAMRMhMIFECBgQwAOEBIkAIACgsMHcNFQEAuIaPAoHBMOCedNgAAQYjMEImIxSAxoRooKqYDgMUFhnwAyNDYSLu4gC4DXNDFXQdCCEIQglgcQAEJODjhhife8IQbnKBTVOogAAAAAAAQAOABACDZACKimZnj6PD4AAkRGSEpMTlBSVEJAAAAAAAgAPgAAEhWgIhoZuY4Ojw+QEJERkhKTE5QUlQCAAAAAAAAAACAgIAAAAAAAEAAAACAgE9nZ1MAAEAfAAAAAAAAbQkAAAIAAAC+WdApF3FzcP//e///Ef//EP/5/9j/7f/n//8BtNREDgSo4P1zfLu5+KRwfd0+Nr3J78vPfG/ktzZfr355+/Rb6ztdH18a5j3L16sub59+a/vOeI8vDd9vMX8//t/3cGnnx3LOA4KQvq9vTRrv8CfqpIpsaJ9Kan5lpUslq//91tLdl1P/Qs9WRiOo8gBEZmkoFXg6XKrpH/vS079en4vLm/zdWbp/wqbF3lj388faW48vbX1wND/FX98yj+sU948dmK4X1Rh/x/54ogmmW8Qmd9oFfkWrSvNrwktubaO0yZB0iomQ3NhKoyK3L4badNdmcqP88mHMwfyb1Sc/mlltxGoDBwU1y/iK+vY3ju3n0/R1yrL77JI/Yd3muN2+pb3Rad7qz37etn6e7zrH+a5/FfNrHLcr6/MsGXq8U5rpJV349HbP4zbt1JmqZv/tmixXxhSq4U+r5wUTx+lx+yN27xMJK3pAC9v8559/3zygEtoXtBRElsC6AfA1XDicfPGscH7/Fw7DdtfV7mP7eOpe9Ru7bnt2YjQDktP6nBxJTUdaR5e/sT1qm9Ss11uTvZ5EY/+HT3xPn7z/hPC44VT2bP2OtA+pFvvb78jzSTgYW9dTeF4MWqFmEmT0KKj+i9C0rhKnmj45gTk5fc4w7+7vY3iskVQ0fWSHfmR2SeehDk9D6kX0kRiu2DaoPOIUzcSc1qqgAlNmWlz9LGrzvTbmdmnM7+2rhWZt8H3obsYf23LJzdrY+d6spb2eRjP7zcChZL76Z/JOo+8a2vvhgjIcpO/aNgJa3xUiv8refW9+spHtsqVHTxnC6YAHvfWxIWqRdxWdstUJnWulBPlgTpUm39Ewfdu8cyj1BtJs2/LrMx9TXl/C4h8n87D3u8+mcoAKTG/bDs9UCu1P7X6FkTWSjs02OROHk4+uS+ff1bK50oWPePuFr6Pr6byfnobma+tmsfveuHg6WrDzoTG+stFz6NIuKzO4q7a0xJQM7unvsFsESfnhjuzdzUIIc+KRaPO+5hj0fz5Z3SyVf349OWXMG+ioEE9fE97/Q9JWGoXd3zXpx1PZiOOYfT3g7zDYyMGOlvdM8jRA9ttW+ofOf/dTOPxHo37Hd2OU8dx0jULbRQ8MJwena7WJYUsrBS+9ivomRVF3iu4pXzgLiLus19oK7Zrz++63kvn4wVtMrnY7eaBIh7zi9YIRakjJWjb/Ez4MzBMAE5/sPJit8F8Gx5TbQQdvSII8Cii6FdDejlMcH+U74kblaF/mGeR6XCe8jZKkpZBZGkIznRZNITGKqvxRZUx4Nw/Ot7s03b9jSL8qXKS7JusIjHkjBR65oxJBBgDAXdXnaN9X0paIwH0sKS15zpKWGjK+LWbrB5U1y/YWjlKH3b4PPVvplpGt0+Z4OhVDJ/VoUwMRdLM2OHbLTCCVuGA46B4kzC2cNPT7wdE4B4OVpQg5vMnNrBvSbPMItrxhP/IsQH4CtFURfpyHMkqm3+6eMf+mq5j1Z8HzLa/f27YZ7STMaeNz9Ea/y984a79jMb1LgOk3wcfFyp/j1p0D4nEgaDT0VsmAoywOhLFevr+rb3Yn6qH1R9djDc+sjWmKl56ufNLcViJRVJTLZI/BiKm1w+Ksqam6pePWDracm3A3sCAoV47LoObKXCtj5/6xT+Mmyrr/3O93gCQOLjr1W1d7SZcItMa/wpu6aQn9dFRwrJbltIOAkVGfRz8kH8MUZnVjxDv5/bX90/+/ths5eShqHQ9nltbQvoqtGk+Q8LEtrSVV8/Zrzd7kQ8S3C2K4HwoNFZQ0SBuNxBHb+R/f55dKu3JDlU+tg/BHe8UurBPTQB2ynG0kR3Ty3F0c2V3l0cHv89U4wRVv3dHHw8YU665tD4sreGix6Sh1xX45HA81MBF8RPNcb0p+4d/p5f3+6+dafHKeJ+RwT0KRPEtwcZWql1nHpE2RrYWSVc3bj1mx6rsyCNUpZ3kosRq5Eb5WcIJoJNkRNCoyFESHlE5s51snK+WM8x8RR4uec+KSKvGZdte/kdk3/mdDGDHkOQALOD0j5Pz76YicSKBzzvkiLUtlrEJFqLlOVrItS+tXz9vWfo1L9ZJ3n9/c+mAyl+vO/Sgut1d8Swax83BER8qyZOxENTpCjG5Gn8e8eHtkx5waRI8NAerY3T2XvFx/+9K0DHb2tqo1T/beU3EM5oDAOaBdrvaCF78UZ/2V8Fg1VNZK2Hsf3xLg3z8aZTEtT/AvpuznJHeQ38nWfztjnEWiS0P1R1pmQvbrVyo94P2R8p9YAaPKyhyfN7/W3OoI9Y+yNPjqPn/S1r4j9v/7MQYU5cljZRznQApNYpvdO8WzaS6ATwvs5zOkX1tnytGz37ESMk4WvJOiU+g1Lvk1IzDdkp+Ku/G1UfHAuJX46KLCX4T+8PY+SqjEfLiVvXNMQqodbOX1XFvJOC6jW/Ya7kS9ge7Wk72o5Qr41OeF+7eDtqhr0mhoTec+7ekYz26u1P5yr3I656M3cvWhfiuxPb3rmN17TCX83WxTiWnhrmkIjvfjeP/jnnmR/XHFCoihXPULSzPGqlKkv1LMjck0jO2YPy9++H3SmMTtlj+/PVR+ONAoIMF2I1p8eeQcG+3FE9kn577P6+TQ2bhBAFe4XtkE85tom8B56uyOPFaB7iiaxMbQkNLxkmThJ+3c+ST1/mFegE36Y2CDewtHh5F4Pnwr4bsxtwSSCl2xOlNue9PR2B3w7Bx2Br6XE4LBwA4A77gwP4xnWeqa7aQhiNLMFx0WDW/GGlQhHbiJ3frCsQStprLBzjBLxU143ycNCVLVMNLTGHHtnwf6YsuP7UlibILJ1F7bp5OTMqje1vp7sZzy1s4/79Bbyg/h1Yx95fxMvu0y35hLVeO+9u0vqtoGo6Oy7qy1v04fdmmY/bOzIxfVVfzNiRM46fb3yWPhLajNveMZjv11D/N+NRmfsU2KXz780QPbxfXwyEyU6xNGQ9/1waOtcpyfJxYwD+58NGUuxerP//3lrXp48yzzOY4i4u7TS+bjsCw0C4SDmzLqwCHfVZ5L81Z+0doNcWUms7xuKrGX1Zh9jvy4Zpudyle4ui+fnY4u4phAYWDW0hjfB3/KjPpfji/P6F63Fr1zzPFvaSHRr37VbIuK/I246Dp15Gy4EtSe/zumuL28vkyD5r9M30GUmp8C7H//7g/5Rib+bwouA9ajd5n6eJ+M1AG//6rbrce5fRjPH+UhhylpapY066Pqp/PbyK+n7OyZFR9T5s9OvM91xPGKM2vJs9hLClmgbelZw9NxUklwtE0WPuT4UEkV3lf46N6NZlOvWVEqcyvTXU3+G90o96f3o83+fZsuMfVwVfM0igjZzUOWULKbqtxs0qWZj+06dbd+V8LOjRMTO/Hrr79urK1xHE9hAH7Hk6AGCAC+VYSNcfTcsofmXqFqrdnO7+esBZM5GnjfX5+juuimrx/0Ge25YKj7fj/h5tx0n9Z8luIcJhsBPtyysnVszBGvverX2va/KTHVbzjqB4W9Dyz0vFMfd5GbQTuftm4Ai/u3Xu70P1hae711aAlgM0eSGHw+L8A58cnR8jobIVZa5BNPhVbn7TCy+7SKJaW72u6H/681Mm3+5IbcmB+gH0yPLUWPNFi/Te2XtVtcTD0VfuYnzuwwC/eYOiXtstkRhps2iy9tkDvdre2DNOH69E6JjEY6rbZq4csyVqbu21puI6PSytc6t/hGfOxdn2XvxmfQ1/K6+xH8zp1VjxySzao0+ZIBH+MTYker+Rgr9252LVMJ1YCLN+3Gdk7JjiiUBlc66vOvdg6E3Gcfd3iXF799bUkrzGcFJXAgjvMMJ6JHntof73C1MQ/3QFFofQiaLuBD9KZ64PaYvRHi3uP9vdlh/OboTXzXHYcZTv04wJQ9s7qz5D2lV4xa8oYydWFLwKfZDVJdwqYfuTB2ePOLzecJTjk0av15Et9luM1MjcDY/qcy+C0boyuskoh1ZzCdklFMCmZCj+6tEyQgOBRD2xVapRc2ErWwTthfDeBNA4B5DD6nc7RlkBAD4D8h6MN3N8Pp9WYRwnuPren4WKRWRQmn5kP67We6fNfIlRM9rnFR44iRnrtTVdKljw5OiellvYwx3Qy0N7XkTBOa6h40bsyxz+HY+xSxWvvhMA6GjeF3PtdzzUFcSLovJNWsbQ6izVLC5PSqP0o9kTlGm8Wb89Z8mNLDbgNFt+yftVwCpchEQtuQxMR807LGPG8nd/7ey1xB1fna/OTTrWErMdT1g85LQKZo2nIq24BVVibONSb8x5sEseT/ZpOTdJ99Tp1QfRxjdh+80TvNtuy+vmboM98P3fV8TMvMx4ODmyipu3Njcu9msTOjXtu7qsdkWcPvTchMPvSJAI0QPyyx08jxdbokPMxVhtufMCP+KZFHy8KE59KCKA/2ZDS3EwP2VgqHh8iKXf+sE07MfYfsR72cexfcAgDeHifn9Gi+HQJjeZPdcwY16M8MQJOJPxbnVQSPJASdjL0wnrfqKbW7l+M6YqKDpfAhsOTxYysZh9lmoJm7G1BcEcXhscYRnDI3qHQMoZV5I5IUQBq7fnVkhgAIgCUhFO1u04bbMSDx/XzEkDPCGNMiIBsfrKDcvY7j18IkuljdUbeRPVTRNOBUEtq81Jcj48/DVzwEvmZXfjdNIEVQasXZAPLPAQDAFQAAAN6W03iCzPyYAiqid9qhaTPnpY6ppDYgQXx6SEuWwfBUXfrpHBY/f6vKGfcrtWptccSV4xy2koOhRWjmPLWkEsQa5IbJyPS9RjQVv/GhtSXDpQnuvZddxyItSa//vE/fD/8W2mbJ5rL3zazmpOr0/F9tv9nVzBzfZDdVcnElm5IbbQaPqIEaw2YuS+TcSnQepNC2LabTbx9nP/MxApCV4mLsr2NeT+6yx4ywlem+3xG3QrwX+8I3XjRNtNNP7wnHRXtH1g3gNyLxVvdSX+FlAr8iDMSgXB6mbwHOUGlfZK4/N++36WB0ndy4XItE8vdh4/rNqbkv3EA/o9S1BwlMZFbWBbWB48B7csfNXRb4TYo3hLVv61NdTrKzy4sdTErvWPVtCexDc9XJkLn8ZVbZgPiZ4AhoVV7mMEGTvf58jXFmUMj9yL/GuDVXrlqrT+MBrt1di7eu7Z8JDQQC4Z3GphdBkxiZBsknOTseUOnpqxKtdtVbJ2+IkNWJfK0F51fvKPJHnx/QVSFXQIuDEAWZTcLs/PSECeRamKPn66exFDDJLy/owuoYeMS4Cw5DooLk1cNDnQzyg6ux6kTBvJ3fDTmMHYbYhF4LDmg8aEttsFjcP6hUogeTv/0A/GiFAA7cWwCgn4C1AV6WY2iCgY/0xITvWBBjf5RPm2VfNxU83J1O3d6vNTBjvIxHp1k0MtKEnUMsQiaDxDh4CLUdl9R9WdLsoA/ieJbUgKASmSbE0pvl4mHnzcHB4lLiw7XxS6+vfxT/YzMIL7UtGUsj9GqoVLwRyyRqE0frWkyMY+FdhP4GjySnWaRVuXZt64bWf61nB27G28wxmrBsl9ETKZvo1aNqD6iBmnw8kFtY7Rpaa3Oc8YV5xVMO9YLblfm83Hbreern2TPO8tIWrwMeS5Xzur2tcH6h8H0SDrSNrI/cFVIzns81qTb9J9S9bqJMhupVNHHeko9eforxV1fuR5uTI1V/HR3i3e9odb3y+Grhzqkdm8lwtG2Dilln+ac2GkOJDiJP8hbrPqIJx8sHjon/cBqGt/DDzoDM57fL8PRAK4stM4nGqvi1f5LduR+bbDdemv9TpvbPNocsnM6jwYeXAklPvVMN27ylbDf/X4t45QPE50yY/CwPkYvpG/Jkq3Ar3lfNsAt0AmDdLqpwDGmt1ATglYGd/t6RDvDMV/PW21HT32pf/D/yiwJFQe+1rF2TDL2FAt/zHTuCOa401s+I0MZq9rMqQLnRHRpU5NCNO+F8ChH5lP+iw04cJ6RveUJQ+RHBOX0fribkQQQAYEIUyuppvz9A4eIfGzTMjW2YmZXBbs4CyQxPZ2dTAARpKQAAAAAAAG0JAAADAAAApe3jIQj//wf//yH/1r6VY3hi2MiPcGBZ804QRuuba1s3oB/MkmOvRw8Xg4lsmUh3S87RsrmEdndvraTvqVhJfTDJ0nBsJK2eF83SnufMjbY+htIVjruuWu8m+oxzR0ekI5vp6sPXmv4hOJXWCacHfGwjp9unOy3zeNrj3NOX2Eq3BrrIvcxBL92cWFoepOfDBW//g/r3vLv/wu3kK7nvR+vROdpzTl4ishzoRZvMZsphwrcNExODtfipH7/35f4FxhieVUF1x3rdVCWJfPewj7zas1uLwCz39a04aV1C7zv+G6SE4XLMaULUiiZkHvbF3w1xYQwOjcm3/9jvKu9svcfpQ7JcCFqsgvbG1tuaRkSESPOO77+XvO+09u1NR0lVe7/kxgjJ+uXvJqvHLGm3FuF0zZNdim/5WUFUxL08vJUID1S7FzyqDItvIsz9nBnNomSklJaZJiczjKW/1Ynu/Z8+A3D3c12zguSZ2JWzOH6y/HgIWtZN96MhmNZZe4o8nwf/cp0IVZNAXzNCvMHvaNivuzRDhJiBNzTu30GYmAF23pjHUS/64UuqDORkg8mpjMNH/d4nJjWbdMTzhSbMKOOiXPO58L97A0eBXPArwRaOx02yOFrGBugx7x4xA9hsIFBK/Etq44GGheAgrVD+CQlBgkX5Us55QKoJ72LexA4AaMGagHVpaAksDQBPAAAAAAA+dnN6zSYg+wDcQ6B3U/fLrzpSt8ycY/aRxGw+nejHCcORODISj8bE5Vxp9V0aJMapnKR93pj9WDxKS/Rw3hWMaPgwSHsTZ2NnnPHWLpfF1drameZgLDxPyjTt4ZPrVkmH+WRJTP3N0vKHY97p23YCRyfGJEIehs1A08XgR+d+1Gca32d0ZbGbJnm6fyINOV1e6dF+6NTKdTdH593Wbsa1TOdVlanWbmuO2qUbkz7Hd5D7LWsX+dEkdLzgG7U2gLo/DC4weDWXhTXW2l5y4J/VDywtlM2aK7r+1b1VRWOtMRylgN+g7sA2+V16jBabsvsyMxs/P7RMLR33d2Dv7mvU2cS3pYLb7MIaSI0629l2ji8Xxkjpe9nb7/9t1lkbk3B2L/QbSj4eyp57FjUbDzydvGHUlqiAK9xffHS/hrxV09EnsjqX/psUah37OrT/XEor83rIfRhdQaWbF2WOOSwR1wVPbz+YVjwLnx40vBbSiquJLu9zgveTEbtlrauGMSf4y04uewTM5z5vKIY7llvZxl715AdSIrfnq/U1CCvbMfFYqtWdUmVTyea+NNKQMKbjpz9fy19r/eo+l37nxWL+pfCjTnM/mLsBGt+/O4YssRFy8aauqR2TuHvafZO8/73P4EAm1yY/+v68j2j+BGfsLMaXSMwT5fUxuU+d5kkq5VUDGwCQqYJH91BRsU0SB3QGQEoAAAAAYJYu/g8NQAB+dFvH47oQjikRduFw6MeOLDcTh7tGdsbCynAkPAxPJ/uxw/NpPMwwXXxY1T7/M3I+em45Z9fsIyNRDxLj9D/7bt0RntPeTPa75v0G+Ei40v3IvN/Yw5GoVBaPDEfq6fKVxT9o1R/elpvjjpYlM9w11kymPYJ3WI4rt2OunH8++vJzjfHljVl8xXIMduorObq8GnpXuST6G7CrURLAgTMq67J4ZVOVN9ovNAkLqVxswfIQxHPRZdP4vEycylq0vZuGAZiDF0Z3+jrrn32WOm9OYJ/KdW+BdtVXQO+8Y2/G5rFiX5yDw2KIWhHhD5K/grxCuOlYFmw3nRLZdjPMLYjHxp4QZPdXN7l8BJpjnKgFDD5HMbT/W9fzkHFvE59ts64oNh1CpLGs3YHS9HBNz2IfJva5/KcsdQe+bKg7pH/XhAOwpD9MXP+sbQvCcpgDtDOxW2rZT2hcpo9xjNuEncv4/tiSxiFr/P7F7DZ+6+zTv/N710DD7HDU1Toko95Tz/bZ6KZcbGpkDNoeUywtLenRnqzs37SX6f7AeMUX8vPidFO3PMX97pTzbd6m/CZchjA6l8MxrhajDr35zlv2os59UBIS8xvvzJ38Tn7+J1Ergp0OxywA";
let hitBuffer=null,hitLoadPromise=null;
function makeFallbackHit(c){
  const sr=c.sampleRate,len=Math.floor(sr*.09);
  const b=c.createBuffer(1,len,sr),d=b.getChannelData(0);
  for(let i=0;i<len;i++){
    const t=i/len;
    const env=Math.pow(1-t,12);
    const noise=(Math.random()*2-1)*Math.pow(1-t,30)*.3;
    const tone=Math.sin(Math.PI*2*1850*(i/sr))*Math.pow(1-t,7)*.5+
               Math.sin(Math.PI*2*920*(i/sr))*Math.pow(1-t,5)*.18;
    d[i]=(noise+tone)*env;
  }
  return b;
}
function buildHitSounds(){
  if(hitBuffer)return Promise.resolve(hitBuffer);
  if(hitLoadPromise)return hitLoadPromise;
  const c=ensureAudioCtx();if(!c)return Promise.resolve(null);
  hitLoadPromise=(async()=>{
    try{
      const bin=atob(HIT_B64),arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      hitBuffer=await c.decodeAudioData(arr.buffer);
    }catch(e){
      hitBuffer=makeFallbackHit(c);
    }
    return hitBuffer;
  })();
  return hitLoadPromise;
}
function playHitSfx(lane,type){
  if(!settings.hit)return;
  const c=ensureAudioCtx();if(!c)return;
  const fire=()=>{
    if(!hitBuffer)return;
    try{
      if(c.state==='suspended')c.resume().catch(()=>{});
      const s=c.createBufferSource();s.buffer=hitBuffer;s.playbackRate.value=1;
      const g=c.createGain();g.gain.value=(type===0?0.44:0.34)*(settings.hitVol/100);
      s.connect(g);g.connect(c.destination);s.start();
    }catch(e){}
  };
  if(hitBuffer)fire();
  else{const p=buildHitSounds();if(p)p.then(fire);}
}
function playBreakSfx(lane){
  if(!settings.hit)return;
  const c=ensureAudioCtx();if(!c)return;
  const fire=()=>{
    try{
      const t=c.currentTime;
      const out=c.createGain();out.gain.value=.22*(settings.hitVol/100);out.connect(c.destination);
      const base=1+lane*.003;
      const voices=[
        {f:659.25,g:.14,d:.24,type:'sine'},
        {f:987.77,g:.045,d:.30,type:'sine'},
        {f:329.63,g:.05,d:.20,type:'sine'}
      ];
      voices.forEach(v=>{
        const o=c.createOscillator(),g=c.createGain();
        o.type=v.type;o.frequency.value=v.f*base;
        g.gain.setValueAtTime(.0001,t);
        g.gain.exponentialRampToValueAtTime(v.g,t+.014);
        g.gain.exponentialRampToValueAtTime(.0001,t+v.d);
        o.connect(g);g.connect(out);o.start(t);o.stop(t+v.d+.05);
      });
    }catch(e){}
  };
  if(c.state==='suspended')c.resume().then(fire).catch(()=>{});
  else fire();
}

function addHitFx(lane,type,chord,multi){
  const x=V.x+lane*V.laneW+V.laneW/2,y=V.judgeY;
  game.laneFlash[lane]=Math.min(1,game.laneFlash[lane]+(type===0?0.55:0.34));
  game.effects.push({k:'ring',x,y,life:.46,max:.46,type});
  game.effects.push({k:'wave',x,y,life:.38,max:.38,type});
  const count=V.lowFx?8:14;
  const colors=['#d6fbff','#9fc8ff','#ffb066'];
  const color=colors[type]||'#fff';
  const power=V.h/760;
  for(let i=0;i<count;i++){
    const ang=rand(-Math.PI*.96,-Math.PI*.04);
    const sp=rand(130,440)*power;
    game.effects.push({k:'spark',x:x+rand(-V.laneW*.24,V.laneW*.24),y:y+rand(-5,5),vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,g:rand(220,420)*power,life:rand(.28,.55),max:.55,size:rand(1.6,4.2),color});
  }
  game.effects.push({k:'beam',lane,life:.4,max:.4,type});
  if(game.effects.length>620)game.effects.splice(0,game.effects.length-620);
  if(type===0)game.whiteFlash=Math.min(.2,game.whiteFlash+.022);
}
/* LTZZ (テリトリーバトル) — 双押/三押/四押按时间段触发屏幕抖动，增强手感。
   只在命中(P/G)时触发；同一次和弦靠 ltzzChordShakeAt 去重，双押的两个键不会各抖一次。 */
function ltzzChordShake(n){
  if(!selectedSong||selectedSong.chart!=='ltzz')return;
  const size=n.chordSize||1;
  if(size<2)return;
  const mt=n.time-MUSIC_DELAY;
  if(Math.abs(mt-game.ltzzChordShakeAt)<0.03)return;
  game.ltzzChordShakeAt=mt;
  let amt=0;
  if(mt>=0&&mt<=13.017)amt=9;
  else if(mt>=16.6&&mt<=19.6)amt=size>=3?14:10;
  else if(mt>=55&&mt<=59)amt=size>=3?15:11;
  else if(mt>=62)amt=size>=4?15:size>=3?12:9;
  if(amt>0)game.screenShake=Math.max(game.screenShake,amt);
}
/* WELKIN (第一章魔王曲) — 双押/三押按时间段触发屏幕抖动，增强打击感。
   只在命中(P/G)时触发；同一次和弦靠 welkinChordShakeAt 去重，双押的两个键不会各抖一次。 */
function welkinChordShake(n){
  if(!selectedSong||selectedSong.chart!=='welkin')return;
  const size=n.chordSize||1;
  if(size<2)return;
  const mt=n.time-MUSIC_DELAY;
  if(Math.abs(mt-game.welkinChordShakeAt)<0.03)return;
  game.welkinChordShakeAt=mt;
  let amt=0;
  if(mt>=30.35&&mt<=39.7)amt=size>=3?20:14;
  else if(mt>=72&&mt<84.9)amt=size>=3?22:15;
  else if(mt>=123&&mt<=126)amt=size>=3?22:15;
  else if(mt>=130&&mt<=135)amt=size>=3?26:18;
  else if(mt>=209)amt=size>=3?24:16;
  if(amt>0)game.screenShake=Math.max(game.screenShake,amt);
}
/* 承章（第二章）— 双押/多押按时间段触发屏幕抖动，增强打击感。
   只在命中(P/G)时触发；同一次和弦靠 ch2ChordShakeAt 去重，双押的两个键不会各抖一次。
   各曲规则：
   - init：16-20s 双押、59-85s 双押、112s 起双押（更猛）
   - la：71s 起每个双押/多押
   - lady：全程双押/多押，56s 起多押更猛
   - pen：全程双押
   - fb：17s 起双押/多押
   - cyber：全程双押/多押 */
function ch2ChordShake(n){
  if(!selectedSong)return;
  const chart=selectedSong.chart;
  if(chart!=='init'&&chart!=='la'&&chart!=='lady'&&chart!=='pen'&&chart!=='fb'&&chart!=='cyber')return;
  const size=n.chordSize||1;
  if(size<2)return;
  const mt=n.time-MUSIC_DELAY;
  if(Math.abs(mt-game.ch2ChordShakeAt)<0.03)return;
  game.ch2ChordShakeAt=mt;
  let amt=0;
  if(chart==='init'){
    if(mt>=16&&mt<=20)amt=size>=3?16:12;
    else if(mt>=59&&mt<=85)amt=size>=3?16:12;
    else if(mt>=112)amt=size>=3?23:17;
  }else if(chart==='la'){
    if(mt>=71)amt=size>=3?18:13;
  }else if(chart==='lady'){
    if(mt>=56)amt=size>=3?24:17;
    else amt=size>=3?16:12;
  }else if(chart==='pen'){
    amt=size>=3?16:11;
  }else if(chart==='fb'){
    if(mt>=17)amt=size>=3?18:13;
  }else if(chart==='cyber'){
    amt=size>=3?16:12;
  }
  if(amt>0)game.screenShake=Math.max(game.screenShake,amt);
}
function addMissFx(lane){
  const x=V.x+lane*V.laneW+V.laneW/2;
  for(let i=0;i<6;i++)game.effects.push({k:'spark',x,y:V.judgeY,vx:rand(-60,60),vy:rand(-90,-20),g:160,life:rand(.2,.45),max:.45,size:rand(1.2,2.6),color:'#ff6b8f'});
  game.laneFlash[lane]=Math.min(1,game.laneFlash[lane]+.3);
}
function comboMilestone(n){
  game.effects.push({k:'ring',x:V.w/2,y:V.judgeY,life:1,max:1,type:0,chord:true,multi:false,big:true});
  game.whiteFlash=Math.min(.36,game.whiteFlash+.14);
}

/* ============================================================
   12. gameplay —layout & sprites
   ============================================================ */
const spr={note:null,chord:null,multi:null,final:null,break:null,hold:null,ring:null};
function updateScrollSpeed(){
  if(!V.judgeY)return;
  V.scrollSpeed=V.judgeY/(.6667/Math.max(.5,settings.speed));
}
function layoutGame(){
  const w=Math.max(320,window.innerWidth||360),h=Math.max(360,window.innerHeight||640);
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||Math.min(w,h)<820;
  const tablet=Math.min(w,h)>=600&&Math.max(w,h)>=900;
  const phone=!tablet&&mobile;
  V.ultraFx=settings.perfMode==='ultra';
  V.lowFx=V.ultraFx?true:(settings.perfMode==='low'?true:(settings.perfMode==='high'?false:mobile));
  const dprCap=V.ultraFx?0.75:(V.lowFx?1:1.25);
  const dpr=clamp(window.devicePixelRatio||1,1,dprCap);
  V.w=w;V.h=h;V.dpr=dpr;V.portrait=h>w*1.02;
  const aspect=w/h;
  if(V.portrait)V.trackW=Math.min(w*(tablet?.97:.985),h*(tablet?.60:.62),tablet?800:700);
  else if(aspect>1.7)V.trackW=Math.min(w*(tablet?.66:(phone?.74:.70)),h*(tablet?1.47:(phone?1.52:1.45)),tablet?1140:(phone?1260:1200));
  else V.trackW=Math.min(w*(tablet?.61:(phone?.66:.66)),h*1.35,tablet?1060:1100);
  V.laneW=V.trackW/4;
  V.x=(w-V.trackW)/2;
  /* 平板横屏：判定线比 0.87 再往下压一点（0.90），轨道视角整体下移、竖直可视距离变长 */
  V.judgeY=h*(V.portrait?0.79:(tablet?0.90:0.82));
  V.noteH=clamp(V.laneW*.15,14,28);
  updateScrollSpeed();
  stage.width=Math.round(w*dpr);stage.height=Math.round(h*dpr);
  stage.style.width=w+'px';stage.style.height=h+'px';
  stageGeo.stale=true;
  bgCache=null;
  pfCache=null;
  buildGameSprites();
  buildStars();
}
function makeSprite(w,h,paint){
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.ceil(w*V.dpr));c.height=Math.max(1,Math.ceil(h*V.dpr));
  const g=c.getContext('2d');g.scale(V.dpr,V.dpr);paint(g,w,h);
  return {c,w,h};
}
function rr(g,x,y,w,h,r){
  if(!isFinite(x)||!isFinite(y)||!isFinite(w)||!isFinite(h)||w<=0||h<=0)return;
  r=Math.max(0,Math.min(r,Math.min(w,h)/2));
  g.beginPath();g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}
function shapePath(g,bx,by,bw,bh,shape){
  const cx=bx+bw/2,cy=by+bh/2;
  g.beginPath();
  if(shape==='hex'){
    const t=Math.min(bh*.62,bw*.4);
    g.moveTo(bx+t,by);g.lineTo(bx+bw-t,by);g.lineTo(bx+bw,cy);
    g.lineTo(bx+bw-t,by+bh);g.lineTo(bx+t,by+bh);g.lineTo(bx,cy);g.closePath();
  }else if(shape==='chamfer'){
    const d=Math.min(bh*.42,bw*.18);
    g.moveTo(bx+d,by);g.lineTo(bx+bw-d,by);g.lineTo(bx+bw,by+d);g.lineTo(bx+bw,by+bh-d);
    g.lineTo(bx+bw-d,by+bh);g.lineTo(bx+d,by+bh);g.lineTo(bx,by+bh-d);g.lineTo(bx,by+d);g.closePath();
  }else if(shape==='gem'){
    /* 宝石切面：左右尖、上下各斜切（横长八面） */
    const tx=Math.min(bw*.16,bh*.9),ty=Math.min(bh*.28,bw*.1);
    g.moveTo(bx,cy);g.lineTo(bx+tx,by+ty);g.lineTo(bx+bw-tx,by+ty);g.lineTo(bx+bw,cy);
    g.lineTo(bx+bw-tx,by+bh-ty);g.lineTo(bx+tx,by+bh-ty);g.closePath();
  }else if(shape==='arch'){
    /* 哥特尖拱：底平、上沿两侧斜升到中央尖顶 */
    const leg=bh*.34;
    g.moveTo(bx,by+bh);g.lineTo(bx,by+leg);g.lineTo(cx,by);
    g.lineTo(bx+bw,by+leg);g.lineTo(bx+bw,by+bh);g.closePath();
  }else{
    rr(g,bx,by,bw,bh,bh*.34);
  }
}
/* 皮肤化按键的填充：ring 画成空心环，其余按 shape 填渐变 + 宝石切面高光 + 双层描边 */
function paintNoteShape(g,bx,by,bw,bh,shape,fill,edgeColor,glowC,glowA,rim,rim2){
  if(shape==='ring'){
    const lw=Math.max(3,bh*.3),ins=lw/2;
    rr(g,bx+ins,by+ins,bw-ins*2,bh-ins*2,Math.min(bw-ins*2,bh-ins*2)*.5);
    g.lineWidth=lw;g.strokeStyle=fill;g.shadowBlur=PERF_LITE?0:12;g.shadowColor=rgba(glowC,glowA);g.stroke();g.shadowBlur=0;
    g.fillStyle='rgba(255,255,255,.06)';g.fill();
    g.fillStyle='rgba(255,255,255,.92)';
    g.fillRect(bx+bw*.3,by+bh*.34,bw*.4,Math.max(2,bh*.32));
  }else if(rim){
    /* 皇室奢华材质：宝石切面高光 + 金属镶嵌双层描边 */
    shapePath(g,bx,by,bw,bh,shape);
    g.save();g.clip();
    g.fillStyle=fill;g.fillRect(bx,by,bw,bh);
    const hi=g.createLinearGradient(0,by,0,by+bh*.5);
    hi.addColorStop(0,'rgba(255,255,255,.94)');hi.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=hi;g.fillRect(bx,by,bw,bh*.4);
    g.fillStyle='rgba(255,255,255,.96)';
    g.fillRect(bx+bw*.16,by+bh*.24,bw*.68,Math.max(1,bh*.09));
    g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1;
    g.beginPath();g.moveTo(bx+bw*.14,by+bh*.64);g.lineTo(bx+bw*.86,by+bh*.64);g.stroke();
    const re=g.createLinearGradient(0,by+bh*.72,0,by+bh);
    re.addColorStop(0,'rgba(255,255,255,0)');re.addColorStop(1,'rgba(255,255,255,.20)');
    g.fillStyle=re;g.fillRect(bx,by+bh*.72,bw,bh*.28);
    g.restore();
    shapePath(g,bx,by,bw,bh,shape);
    g.lineWidth=1.4;g.strokeStyle=rim2||edgeColor;g.stroke();
    shapePath(g,bx+1.7,by+1.7,bw-3.4,bh-3.4,shape);
    g.lineWidth=1;g.strokeStyle=rim;g.stroke();
  }else{
    shapePath(g,bx,by,bw,bh,shape);
    g.save();g.clip();
    g.fillStyle=fill;g.fillRect(bx,by,bw,bh);
    g.fillStyle='rgba(255,255,255,.9)';
    g.fillRect(bx+bw*.16,by+bh*.24,bw*.68,Math.max(1,bh*.1));
    g.restore();
    shapePath(g,bx,by,bw,bh,shape);
    g.lineWidth=1;g.strokeStyle=edgeColor;g.stroke();
  }
}
/* 默认皮肤：最初那套原样绘制，一行没改 */
function buildClassicNoteSprite(kind,bw,bh,pad){
  return makeSprite(bw+pad*2,bh+pad*2,(g,W,H)=>{
    const cx=W/2,cy=H/2;
    let glow='rgba(34,228,255,.45)',top='#f4ffff',mid='#6fe4ff',bot='#086d9c',edge='rgba(225,252,255,.92)';
    if(kind==='break'){
      const x0=pad,y0=pad,w=bw,h=bh,tip=Math.max(6,h*.62),core=Math.max(3,h*.15);
      g.save();
      const bloom=g.createRadialGradient(cx,cy,0,cx,cy,bw*.78);
      bloom.addColorStop(0,'rgba(255,190,70,.22)');bloom.addColorStop(.55,'rgba(255,170,40,.06)');bloom.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=bloom;g.fillRect(0,0,W,H);
      const hex=()=>{g.beginPath();g.moveTo(x0+tip,y0);g.lineTo(x0+w-tip,y0);g.lineTo(x0+w,cy);g.lineTo(x0+w-tip,y0+h);g.lineTo(x0+tip,y0+h);g.lineTo(x0,cy);g.closePath();};
      hex();const bg=g.createLinearGradient(0,y0,0,y0+h);
      bg.addColorStop(0,'#3a2a0c');bg.addColorStop(.35,'#100b04');bg.addColorStop(.6,'#211605');bg.addColorStop(1,'#060403');
      g.fillStyle=bg;g.fill();
      g.fillStyle='rgba(255,186,55,.10)';g.fill();
      g.lineWidth=2.4;g.strokeStyle='rgba(255,209,102,.98)';g.shadowBlur=16;g.shadowColor='rgba(255,190,60,.65)';g.stroke();
      g.shadowBlur=0;
      hex();g.lineWidth=1;g.strokeStyle='rgba(255,240,190,.5)';g.stroke();
      // 4px hot core, scaled to the 28px design height
      const cw=w-tip*2.4;
      const coreGrad=g.createLinearGradient(x0+tip*1.2,0,x0+w-tip*1.2,0);
      coreGrad.addColorStop(0,'rgba(255,190,40,0)');coreGrad.addColorStop(.12,'#ffd36a');coreGrad.addColorStop(.5,'#fffdf0');coreGrad.addColorStop(.88,'#ffd36a');coreGrad.addColorStop(1,'rgba(255,190,40,0)');
      g.fillStyle=coreGrad;g.shadowBlur=16;g.shadowColor='rgba(255,215,110,.9)';
      g.fillRect(x0+tip*1.2,cy-core/2,cw,core);g.shadowBlur=0;
      g.fillStyle='rgba(255,255,255,.96)';
      for(const px of [x0+w*.17,x0+w*.83]){
        g.beginPath();g.arc(px,cy,Math.max(1.2,h*.07),0,Math.PI*2);g.fill();
        g.fillStyle='rgba(255,255,255,.3)';g.beginPath();g.arc(px,cy,Math.max(3,h*.18),0,Math.PI*2);g.fill();
        g.fillStyle='rgba(255,255,255,.96)';
      }
      g.restore();return;
    }
    if(kind==='final'){glow='rgba(255,255,255,.6)';top='#fff';mid='#fff';bot='#ffd479';edge='#fff';}
    if(kind==='hold'){glow='rgba(34,228,255,.32)';top='#dffcff';mid='#22b4d4';bot='#062b3a';edge='rgba(190,250,255,.9)';}
    const goldBorder=(kind==='chord'||kind==='multi');
    if(goldBorder)edge='rgba(235,253,255,.95)';
    g.save();g.translate(cx,cy);g.scale(1,.6);
    const rg=g.createRadialGradient(0,0,bw*.05,0,0,bw*.95);
    rg.addColorStop(0,glow);rg.addColorStop(.55,glow.replace(/[\d.]+\)$/,'0.14)'));rg.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=rg;g.beginPath();g.arc(0,0,bw*.95,0,Math.PI*2);g.fill();g.restore();
    const bx=pad,by=pad;
    rr(g,bx,by,bw,bh,bh*.34);
    const bg=g.createLinearGradient(0,by,0,by+bh);
    bg.addColorStop(0,top);bg.addColorStop(.38,mid);bg.addColorStop(1,bot);
    g.fillStyle=bg;g.fill();
    g.lineWidth=1;g.strokeStyle=edge;g.stroke();
    if(goldBorder){
      const y1=by-5,y2=by+bh+5,ex=Math.max(7,bw*.065);
      g.strokeStyle='#ffd166';g.lineWidth=1.5;g.lineCap='round';g.lineJoin='round';
      g.shadowBlur=9;g.shadowColor='rgba(255,196,32,.75)';
      g.beginPath();g.moveTo(bx-ex,y1);g.lineTo(bx+bw+ex,y1);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y2);g.lineTo(bx+bw+ex,y2);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y1-4);g.lineTo(bx-ex,y1+4);g.moveTo(bx+bw+ex,y1-4);g.lineTo(bx+bw+ex,y1+4);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y2-4);g.lineTo(bx-ex,y2+4);g.moveTo(bx+bw+ex,y2-4);g.lineTo(bx+bw+ex,y2+4);g.stroke();
      g.shadowBlur=5;g.fillStyle='#ffd166';g.font='600 '+Math.max(6,bh*.38).toFixed(1)+'px '+FONT_M;
      g.textAlign='center';g.textBaseline='middle';
      g.fillText(kind==='multi'?'×3+':'×2',cx,y1-11);
      g.shadowBlur=0;
    }
    g.fillStyle=kind==='break'?'rgba(255,252,225,.95)':'rgba(255,255,255,.9)';
    g.fillRect(bx+bw*.14,by+bh*.18,bw*.72,Math.max(1,bh*.1));
    if(kind==='final'){
      rr(g,bx-4,by-4,bw+8,bh+8,bh*.42);
      g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=1.3;g.shadowBlur=14;g.shadowColor='#fff';g.stroke();g.shadowBlur=0;
    }
  });
}
/* 白昼 / 晨曦：配色语义跟原皮肤一致（蓝键蓝、押键=蓝键+金括号、碎点金、终结白），
   只换轮廓，绝不靠"换个颜色"来表达多押。 */
function buildShapedNoteSprite(kind,bw,bh,pad,SK){
  return makeSprite(bw+pad*2,bh+pad*2,(g,W,H)=>{
    const cx=W/2,cy=H/2,SH=SK.shape,bx=pad,by=pad;
    if(kind==='break'){
      g.save();
      const bloom=g.createRadialGradient(cx,cy,0,cx,cy,bw*.78);
      bloom.addColorStop(0,'rgba(255,190,70,.22)');bloom.addColorStop(.55,'rgba(255,170,40,.06)');bloom.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=bloom;g.fillRect(0,0,W,H);
      shapePath(g,bx,by,bw,bh,SH);
      g.save();g.clip();
      const bg=g.createLinearGradient(0,by,0,by+bh);
      bg.addColorStop(0,'#3a2a0c');bg.addColorStop(.35,'#100b04');bg.addColorStop(.6,'#211605');bg.addColorStop(1,'#060403');
      g.fillStyle=bg;g.fillRect(bx,by,bw,bh);
      g.fillStyle='rgba(255,186,55,.10)';g.fillRect(bx,by,bw,bh);
      /* 顶部金色高光（宝石切面反光） */
      const topHi=g.createLinearGradient(0,by,0,by+bh*.45);
      topHi.addColorStop(0,'rgba(255,224,150,.55)');topHi.addColorStop(1,'rgba(255,224,150,0)');
      g.fillStyle=topHi;g.fillRect(bx,by,bw,bh*.45);
      const core=Math.max(3,bh*.15);
      const coreGrad=g.createLinearGradient(bx,0,bx+bw,0);
      coreGrad.addColorStop(0,'rgba(255,190,40,0)');coreGrad.addColorStop(.12,'#ffd36a');coreGrad.addColorStop(.5,'#fffdf0');coreGrad.addColorStop(.88,'#ffd36a');coreGrad.addColorStop(1,'rgba(255,190,40,0)');
      g.fillStyle=coreGrad;g.shadowBlur=16;g.shadowColor='rgba(255,215,110,.9)';
      g.fillRect(bx,cy-core/2,bw,core);g.shadowBlur=0;
      /* 白金星点（高光） */
      g.fillStyle='rgba(255,255,255,.96)';
      for(const px of [bx+bw*.17,bx+bw*.83]){
        g.beginPath();g.arc(px,cy,Math.max(1.2,bh*.07),0,Math.PI*2);g.fill();
        g.fillStyle='rgba(255,255,255,.3)';g.beginPath();g.arc(px,cy,Math.max(3,bh*.18),0,Math.PI*2);g.fill();
        g.fillStyle='rgba(255,255,255,.96)';
      }
      g.restore();
      /* 金属镶嵌：外深金棕 + 内亮金白 */
      shapePath(g,bx,by,bw,bh,SH);
      g.lineWidth=2.4;g.strokeStyle='rgba(122,80,24,.95)';g.shadowBlur=16;g.shadowColor='rgba(255,190,60,.65)';g.stroke();
      g.shadowBlur=0;
      shapePath(g,bx+1.7,by+1.7,bw-3.4,bh-3.4,SH);
      g.lineWidth=1.2;g.strokeStyle='rgba(255,224,150,.85)';g.stroke();
      g.restore();return;
    }
    /* 押键（双押/多押）就是蓝键 + 金色双向括号，跟原皮肤一套语义：
       金色只留给碎点/黄键，绝不拿"变黄"来表示多押，否则分不清黄键和押键。 */
    let top,mid,bot,edgeC,glowC,glowA,rim,rim2;
    if(kind==='final'){top='#fff';mid='#fff';bot='#ffd479';edgeC='#fff';glowC=[255,255,255];glowA=.6;rim=null;rim2=null;}
    else if(kind==='hold'){top='#dffcff';mid='#22b4d4';bot='#062b3a';edgeC='rgba(190,250,255,.9)';glowC=[34,228,255];glowA=.32;rim=null;rim2=null;}
    else{const B=SK.blue;top=B.top;mid=B.mid;bot=B.bot;edgeC=rgba(B.edge,B.edgeA);glowC=B.glow;glowA=B.glowA;rim=B.rim;rim2=B.rim2;}
    g.save();g.translate(cx,cy);g.scale(1,.6);
    const rg=g.createRadialGradient(0,0,bw*.05,0,0,bw*.95);
    rg.addColorStop(0,rgba(glowC,glowA));
    rg.addColorStop(.55,rgba(glowC,glowA*.14));
    rg.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=rg;g.beginPath();g.arc(0,0,bw*.95,0,Math.PI*2);g.fill();g.restore();
    const bg=g.createLinearGradient(0,by,0,by+bh);
    bg.addColorStop(0,top);bg.addColorStop(.38,mid);bg.addColorStop(1,bot);
    paintNoteShape(g,bx,by,bw,bh,SH,bg,edgeC,glowC,glowA,rim,rim2);
    if(kind==='final'){
      shapePath(g,bx-4,by-4,bw+8,bh+8,SH);
      g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=1.3;g.shadowBlur=14;g.shadowColor='#fff';g.stroke();g.shadowBlur=0;
    }
    if(kind==='chord'||kind==='multi'){
      const y1=by-5,y2=by+bh+5,ex=Math.max(7,bw*.065);
      g.strokeStyle='#ffd166';g.lineWidth=1.5;g.lineCap='round';g.lineJoin='round';
      g.shadowBlur=9;g.shadowColor='rgba(255,196,32,.75)';
      g.beginPath();g.moveTo(bx-ex,y1);g.lineTo(bx+bw+ex,y1);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y2);g.lineTo(bx+bw+ex,y2);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y1-4);g.lineTo(bx-ex,y1+4);g.moveTo(bx+bw+ex,y1-4);g.lineTo(bx+bw+ex,y1+4);g.stroke();
      g.beginPath();g.moveTo(bx-ex,y2-4);g.lineTo(bx-ex,y2+4);g.moveTo(bx+bw+ex,y2-4);g.lineTo(bx+bw+ex,y2+4);g.stroke();
      g.shadowBlur=5;g.fillStyle='#ffd166';g.font='600 '+Math.max(6,bh*.38).toFixed(1)+'px '+FONT_M;
      g.textAlign='center';g.textBaseline='middle';
      g.fillText(kind==='multi'?'×3+':'×2',cx,y1-11);
      g.shadowBlur=0;
    }
  });
}
function buildNoteSprite(kind){
  const bw=Math.max(24,V.laneW*.86),bh=Math.max(10,V.noteH);
  const pad=Math.max(24,V.laneW*.32);
  const SK=getNoteSkin();
  if(SK.classic)return buildClassicNoteSprite(kind,bw,bh,pad);
  return buildShapedNoteSprite(kind,bw,bh,pad,SK);
}
function buildGameSprites(){
  spr.note=buildNoteSprite('note');
  spr.chord=buildNoteSprite('chord');
  spr.multi=buildNoteSprite('multi');
  spr.final=buildNoteSprite('final');
  spr.break=buildNoteSprite('break');
  spr.hold=buildNoteSprite('hold');
  spr.ring=makeSprite(220,220,g=>{
    const c=110;
    g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=5;g.shadowBlur=26;g.shadowColor='#22e4ff';
    g.beginPath();g.arc(c,c,78,0,Math.PI*2);g.stroke();
    g.shadowBlur=10;g.strokeStyle='rgba(34,228,255,.7)';g.lineWidth=2;g.beginPath();g.arc(c,c,66,0,Math.PI*2);g.stroke();g.shadowBlur=0;
  });
}
function buildStars(){
  V.stars=[];
  const n=Math.round(clamp(V.w*V.h/14000,40,150)*(V.lowFx?0.58:1));
  for(let i=0;i<n;i++)V.stars.push({x:Math.random()*V.w,y:Math.random()*V.h,r:Math.random()*1.4+.2,p:Math.random()*6.28,z:.3+Math.random()*.7});
  V.dust=[];
  const dn=V.lowFx?24:54;
  for(let i=0;i<dn;i++)V.dust.push({a:Math.random()*6.28,r0:Math.random(),sp:rand(.08,.3),size:rand(.8,2.2)});
}

/* ============================================================
   13. gameplay —loop & state flow
   ============================================================ */
function resetGameData(){
  const meta=CHART_META[selectedSong&&selectedSong.chart]||CHART_META.effulgence;
  SONG_DURATION=meta.duration;
  /* 表里的值若比音频还长（换过文件、编码头不同），压到音频长度，别让结束点跑到音乐后面去干等。
     只对承章这么做：其它章的时长是原来定好的，这次不动。 */
  if(selectedSong&&selectedSong.chapterId==='ch2'&&AUDIO_LOADED_DURATION>0)SONG_DURATION=Math.min(SONG_DURATION,AUDIO_LOADED_DURATION);
  FINAL_CHORD_TIME=meta.final;
  LTZZ_END_FOG.ready=false; // 尾杀黑雾的区间每局按当前谱面重新算
  welkinPopups=[];
  ch2ResetFxCaches(); // 承章各曲的「最后一根长条」区间每局按当前谱面重算
  AUDIO_DELAY=(selectedSong&&selectedSong.chart==='corr')?0.2:0;
  game={
    clock:-3,perfect:0,good:0,bad:0,miss:0,combo:0,maxCombo:0,weightSum:0,
    feedback:'',feedbackType:'',feedbackTimer:0,comboScale:1,screenShake:0,
    judgeLineGlow:0,bpmPulse:0,flashAlpha:0,whiteFlash:0,
    notes:[],effects:[],keyHold:[false,false,false,false],laneFlash:[0,0,0,0],
    lastDelta:0,lastType:'',lastShakeBeat:-1,ltzzChordShakeAt:-999,welkinChordShakeAt:-999,ch2ChordShakeAt:-999,lanePtr:[0,0,0,0]
  };
  generateBeatmap();
  // Mirror：谱面沿 y 轴左右翻转（只翻转显示/判定用的轨道，不改谱面配置与计分）。
  if(settings.mirror){
    for(let i=0;i<game.notes.length;i++){
      const n=game.notes[i];
      n.lane=3-n.lane;
      if(n.startLane!==undefined)n.startLane=3-n.startLane;
    }
  }
  // 换歌/重开时按当前 V 重建音符贴图：避免上一局中浏览器 UI 变化（地址栏/旋转）
  // 留下的旧尺寸贴图在下一首歌里表现为“变小 + 半透明”的残留。
  buildGameSprites();
  displayScore=0;displayAcc=100;feedbackYOffset=0;
  const hudSong=document.querySelector('.gh-song b'),hudArtist=document.querySelector('.gh-song small');
  if(hudSong)hudSong.textContent=selectedSong?selectedSong.title:'—';
  if(hudArtist)hudArtist.textContent=selectedSong?selectedSong.artist:'—';
  const pSong=document.querySelector('.pause-song b'),pMeta=document.querySelector('.pause-song span');
  if(pSong)pSong.textContent=selectedSong?selectedSong.title:'—';
  if(pMeta)pMeta.textContent=(selectedSong?selectedSong.artist:'—')+' · '+mmss(SONG_DURATION);
  isPlaying=false;clockAnchor=0;resumeCountdown=0;pausedClock=0;
  gameStartAt=performance.now();resumeEndAt=0;
  pointerLanes={};finalScore=0;resultReveal=0;
  resetAudioState();
}
function startGameLoop(){
  cancelAnimationFrame(gameRaf);
  lastTime=performance.now();
  gameRaf=requestAnimationFrame(gameFrame);
}
let perfAcc=0,perfN=0;
function gameFrame(t){
  if(state!=='GAME'&&state!=='RESUMING'&&state!=='PAUSED'){gameRaf=0;return;}
  let dt=(t-lastTime)/1000;lastTime=t;
  if(!isFinite(dt)||dt<0)dt=0;
  if(dt>.1)dt=.1;
  if(state==='GAME'||state==='RESUMING')stepGame(dt);
  if(state==='GAME'&&!stageGeo.stale&&performance.now()-stageGeo.ts>500)refreshStageGeo();
  if(state==='GAME'&&isPlaying){
    perfAcc+=dt;perfN++;
    if(perfN>=90){
      const avg=perfAcc/perfN;
      if(settings.perfMode==='auto'&&avg>.027)V.lowFx=true;
      perfAcc=0;perfN=0;
    }
  }else{perfAcc=0;perfN=0;}
  if(state!=='PAUSED')drawGame(dt);
  updateGameHud();
  gameRaf=requestAnimationFrame(gameFrame);
}
function stepGame(dt){
  if(resumeCountdown>0){
    resumeCountdown=(resumeEndAt-performance.now())/1000;
    if(resumeCountdown<=0){
      resumeCountdown=0;
      if(pausedClock>=MUSIC_DELAY+AUDIO_DELAY){
        resumePendingStart=true;resumePendingTimer=0;
        try{bgm.currentTime=Math.max(0,audioTime(pausedClock));}catch(e){}
        if(!audioStarted)audioStarted=true;
        startAudio();
      }else{
        clockAnchor=performance.now()-pausedClock*1000;game.clock=pausedClock;
      }
      if(state==='RESUMING')state='GAME';
    }
    return;
  }
  if(resumePendingStart){
    const target=Math.max(0,audioTime(pausedClock));
    const ready=!playPending&&!bgm.paused&&Math.abs(bgm.currentTime-target)<.2;
    resumePendingTimer+=dt;
    if(ready||resumePendingTimer>3){
      // 恢复时直接用暂停位置，不重新读 bgm.currentTime：HTMLAudio 的 seek 有
      // 几毫秒~几十毫秒误差，用它会把这些误差当成音符位置跳变 →「铺面闪回」。
      game.clock=pausedClock;
      if(!ready)audioStarted=false;
      clockAnchor=performance.now()-game.clock*1000;
      resumePendingStart=false;resumePendingTimer=0;audioSyncPending=false;
    }else return;
  }
  if(game.clock<0){
    game.clock=-3+(performance.now()-gameStartAt)/1000;
    if(game.clock>=0){game.clock=0;clockAnchor=performance.now();isPlaying=true;}
  }else if(isPlaying){
    game.clock=(performance.now()-clockAnchor)/1000;
  }
  updateMusic();updateMusicHealth();
  if(audioGate){
    game.clock=MUSIC_DELAY+AUDIO_DELAY;
    clockAnchor=performance.now()-(MUSIC_DELAY+AUDIO_DELAY)*1000;
    return;
  }
  if(!isPlaying)return;

  const phase=(game.clock%.4+.4)%.4;
  game.bpmPulse=Math.pow(1-phase/.4,3);
  const at=game.clock-MUSIC_DELAY;
  const isSpark=selectedSong&&selectedSong.chart==='spark';
  const isCorr=selectedSong&&selectedSong.chart==='corr';
  const isEff=selectedSong&&selectedSong.chart==='effulgence';
  const isW=selectedSong&&selectedSong.chart==='w';
  const isWelkin=selectedSong&&selectedSong.chart==='welkin';
  let shakeBeat=-1,shakeAmt=0;
  if(isCorr&&at>=30&&at<48){shakeBeat=Math.floor((at-30)/0.4);shakeAmt=13;}
  else if(isCorr&&at>=104&&at<120){shakeBeat=Math.floor((at-104)/0.4);shakeAmt=13;}
  else if(isCorr&&at>=125&&at<145){shakeBeat=Math.floor((at-125)/0.5);shakeAmt=16;}
  else if(isCorr&&at>=160){shakeBeat=Math.floor((at-160)/0.4);shakeAmt=19;}
  else if(isSpark&&at>=44&&at<64){shakeBeat=Math.floor((at-44)*2);shakeAmt=8.5;}
  else if(isSpark&&at>=121&&at<140){shakeBeat=Math.floor((at-121)*2);shakeAmt=10.5;}
  else if(isEff&&at>=52.8&&at<61){shakeBeat=Math.floor((at-52.8)*1);shakeAmt=6.5;}
  else if(isEff&&at>=94&&at<96){shakeBeat=Math.floor((at-94)*4);shakeAmt=3.0;}
  else if(isEff&&at>=97&&at<130){shakeBeat=Math.floor(at-97);shakeAmt=5.5;}
  else if(isW&&at>=72.5&&at<73.5){shakeBeat=100000+Math.floor((at-72.5)*20);shakeAmt=26;}
  else if(isW&&((at>=60&&at<61)||(at>=62&&at<63)||(at>=64&&at<65)||(at>=67&&at<68)||(at>=68&&at<69)||(at>=72&&at<72.5))){shakeBeat=Math.floor(at*20);shakeAmt=22;}
  else if(isWelkin&&at>=84.9&&at<109.7){shakeBeat=Math.floor((at-84.9)/0.5);shakeAmt=16;}
  else if(isWelkin&&at>=148&&at<170){shakeBeat=Math.floor((at-148)/0.8);shakeAmt=15;}
  else if(isWelkin&&at>=170&&at<199){shakeBeat=Math.floor((at-170)/0.5);shakeAmt=17;}
  if(shakeBeat<0){const s2=ch2TimedShake(at);if(s2){shakeBeat=s2[0];shakeAmt=s2[1];}}
  if(shakeBeat>=0&&shakeBeat!==game.lastShakeBeat){
    game.lastShakeBeat=shakeBeat;game.screenShake=Math.max(game.screenShake,shakeAmt);
  }
  if(game.screenShake>0)game.screenShake=lerp(game.screenShake,0,dt*15);
  if(game.judgeLineGlow>0)game.judgeLineGlow=lerp(game.judgeLineGlow,0,dt*8);
  if(game.comboScale>1)game.comboScale=lerp(game.comboScale,1,dt*10);
  if(game.flashAlpha>0)game.flashAlpha=lerp(game.flashAlpha,0,dt*5);
  if(game.whiteFlash>0)game.whiteFlash=Math.max(0,game.whiteFlash-dt*2.6);
  for(let i=0;i<4;i++)if(game.laneFlash[i]>0)game.laneFlash[i]=Math.max(0,game.laneFlash[i]-dt*4.5);
  if(game.feedbackTimer>0){game.feedbackTimer-=dt;feedbackYOffset+=dt*50;}

  for(let i=game.effects.length-1;i>=0;i--){
    const e=game.effects[i];e.life-=dt;
    if(e.life<=0){game.effects.splice(i,1);continue;}
    if(e.k==='spark'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=e.g*dt;e.vx*=.985;e.vy*=.985;}
  }
  updateHolds();
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.perform||n.judged||n.type!=='break')continue;
    if(n.breakArmed){
      if(game.clock>=n.time)judgeBreak(n);
      continue;
    }
    if(game.keyHold[n.lane]&&Math.abs(game.clock-n.time)<=.1){
      n.breakArmed=true;
      if(game.clock>=n.time)judgeBreak(n);
    }
  }
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.perform)continue;
    if(n.type==='break'&&!n.judged&&!n.breakArmed&&game.clock>n.time+MISS_DELAY){
      n.judged=true;game.miss++;game.combo=0;
      game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
      addMissFx(n.lane);
      continue;
    }
    if(n.type==='break')continue;
    if(n.type==='hold'&&!n.headHit&&!n.judged&&game.clock>n.time+MISS_DELAY){
      n.judged=true;n.holdFailed=true;game.miss++;game.combo=0;
      game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
      addMissFx(n.lane);
      continue;
    }
    if(!n.judged&&game.clock>n.time+MISS_DELAY){
      n.judged=true;game.miss++;game.combo=0;
      game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
      addMissFx(n.lane);
    }
  }
  const total=Math.max(1,game.notes.reduce((a,n)=>a+(n.perform?0:1),0));
  const target=Math.floor(900000*(game.weightSum/total)+100000*(game.maxCombo/total));
  displayScore=lerp(displayScore,target,dt*15);
  if(Math.abs(displayScore-target)<1)displayScore=target;
  const judged=game.perfect+game.good+game.bad+game.miss;
  const ta=judged===0?100:((game.perfect+game.good*.65)/judged)*100;
  displayAcc=clamp(lerp(displayAcc,ta,dt*15),0,100);
  /* +.2 秒余量：让最后一个尾音真的播完，再切结果页 */
  if(game.clock>SONG_DURATION+MUSIC_DELAY+.2)endGame();
}
function updateGameHud(){
  const sc=pad7(displayScore);
  if(sc!==hudCache.score){hudCache.score=sc;$('#ghScore').textContent=sc;}
  const ac=clamp(displayAcc,0,100).toFixed(2)+'%';
  if(ac!==hudCache.acc){hudCache.acc=ac;$('#ghAcc').textContent=ac;}
  const p=clamp((game.clock-MUSIC_DELAY)/SONG_DURATION,0,1);
  if(Math.abs(p-hudCache.prog)>.0006){
    hudCache.prog=p;
    $('#progFill').style.transform='scaleX('+p.toFixed(4)+')';
    $('#progHead').style.left=(p*100).toFixed(2)+'%';
  }
  const tm=mmss(Math.max(0,game.clock-MUSIC_DELAY))+' / '+mmss(SONG_DURATION);
  if(tm!==hudCache.time){hudCache.time=tm;$('#ghTime').textContent=tm;}
}

/* ============================================================
   14. gameplay —start / pause / quit / result
   ============================================================ */
/* on-demand song loading: only the selected track is fetched.
   =============================================================================
   打歌加载（2026-11-25 重写）

   旧版只是把 mp3 地址塞给 <audio> 等 canplaythrough：缓存命中、或者上一首的
   监听器还挂在同一个元素上时，进度会瞬间跳到满、然后「明明加载完了却没有
   声音」。现在改成按真实数据走，谱面和音频都验过才放人进游戏：

     1. 谱面：确认 *_chart.js 的构建函数已经挂上（index.html 漏了 / 加载失败就
        当场补一个 <script> 等它跑完），再把谱面真的构建一遍，拿到音符数。
     2. 音频：整首 mp3 真正下载完（fetch 读流，进度按收到的字节算）→ 转成
        blob 交给 <audio> → 等 canplaythrough + 时长有效。每次进歌都从 0%
        重新算，绝不拿上一局的残留冒充「已加载」。
     3. 失败：停在加载页，按钮变成 RETRY LINK，重试就是整条链路重走一遍；
        ABORT 照旧退回选歌页。绝不带着坏音频进游戏。

   file:// 下 fetch 不可用，退回 <audio> 强校验（canplaythrough + 时长有效），
   同样每次从头计。
   ============================================================================= */
let songLoadToken=0,songLoadTimer=0,songLoadRetry=null,songLoadAbort=null,songAudioBlobUrl='';
let songAudioHandlers=[];
const SONG_LOAD_TIMEOUT=45000;
function fmtTime(sec){const s=Math.max(0,Math.round(sec||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function songLoadingBytes(txt){const el=$('#slBytes');if(el)el.textContent=txt;}
function songLoadingAction(txt,fn){const b=$('#slCancel');if(b){b.textContent=txt;b.onclick=fn;}}
function songLoadingSet(pct,stateText,hint){
  const p=clamp(pct,0,100);
  $('#slFill').style.width=p.toFixed(1)+'%';
  $('#slPct').textContent=Math.round(p)+'%';
  if(stateText)$('#slState').textContent=stateText;
  if(hint)$('#slHint').textContent=hint;
}
function closeSongLoading(){
  clearTimeout(songLoadTimer);
  songLoading.classList.remove('active');
  const b=$('#btnStartGame');if(b)b.disabled=false;
}
function cancelSongLoading(){
  songLoadToken++;
  songLoadRetry=null;
  dropSongAudio();
  closeSongLoading();
  songLoadingAction('ABORT UPLINK',cancelSongLoading);
  state='SONG';
  navBaseOn();
  showNavLayer(songScreen);
  playUIMusic('select',true);
  uiSound(.7);
}
/* 拆掉这一次加载留下的一切：监听器、下载、blob、<audio> 的 src */
function detachSongAudioListeners(){
  for(let i=0;i<songAudioHandlers.length;i++){
    const h=songAudioHandlers[i];
    try{bgm.removeEventListener(h.t,h.f);}catch(e){}
  }
  songAudioHandlers=[];
}
function bindSongAudio(type,fn){
  bgm.addEventListener(type,fn);
  songAudioHandlers.push({t:type,f:fn});
}
function releaseSongAudioBlob(){
  if(!songAudioBlobUrl)return;
  try{URL.revokeObjectURL(songAudioBlobUrl);}catch(e){}
  songAudioBlobUrl='';
}
function dropSongAudio(){
  if(songLoadAbort){try{songLoadAbort.abort();}catch(e){}songLoadAbort=null;}
  detachSongAudioListeners();
  try{if(!bgm.paused)bgm.pause();}catch(e){}
  try{bgm.removeAttribute('src');bgm.load();}catch(e){}
  releaseSongAudioBlob();
}
/* ---- 谱面：构建函数 → 按需补加载 → 真建一遍拿到音符数 ---------------------- */
const CHART_BUNDLE={
  effulgence:{fn:'EFF'},
  spark:{fn:'buildSparkChart'},
  corr:{fn:'buildCorrChart',file:'corr_chart.js'},
  still:{fn:'buildStillChart',file:'still_chart.js'},
  w:{fn:'buildWChart',file:'wel_chart.js'},
  ltzz:{fn:'buildLtzzChart',file:'ltzz_chart.js'},
  welkin:{fn:'buildWelkinChart',file:'welkin_chart.js'},
  init:{fn:'buildInitChart',file:'init_chart.js'},
  an:{fn:'buildAnChart',file:'an_chart.js'},
  la:{fn:'buildLaChart',file:'la_chart.js'},
  lady:{fn:'buildLadyChart',file:'lady_chart.js'},
  pen:{fn:'buildPenChart',file:'pen_chart.js'},
  fb:{fn:'buildFbChart',file:'fb_chart.js'},
  cyber:{fn:'buildCyberChart',file:'cyber_chart.js'}
};
function chartBuilderReady(chart){
  const def=CHART_BUNDLE[chart];
  return !!(def&&typeof window[def.fn]==='function');
}
function ensureChartReady(song){
  return new Promise(resolve=>{
    const chart=song&&song.chart;
    if(!chart){resolve(false);return;}
    if(chartBuilderReady(chart)){resolve(true);return;}
    const def=CHART_BUNDLE[chart];
    if(!def||!def.file){resolve(false);return;}
    /* 正常情况下 index.html 开机就把谱面脚本带进来了；这里只兜底：
       漏了 / 加载失败时按需补一个 <script>，等它真的执行完。 */
    const el=document.createElement('script');
    let done=false;
    const finish=ok=>{
      if(done)return;done=true;
      clearTimeout(timer);
      el.onload=null;el.onerror=null;
      resolve(!!ok&&chartBuilderReady(chart));
    };
    const timer=setTimeout(()=>finish(false),12000);
    el.onload=()=>finish(true);
    el.onerror=()=>finish(false);
    el.src=def.file;
    document.head.appendChild(el);
  });
}
/* 把谱面真的构建一遍：确认构建器不炸、音符不是空的。构建完立刻清空，
   进游戏后 resetGameData 会按当前设置从头再建（mirror 等都要重算）。
   count = 谱面总数（含 EFFULGENCE 那种不判定的表演键，和曲目表里写的 notes 一致），
   judged = 真正参与判定的音符数（0 就说明谱面是空的）。 */
function validateSongChart(song){
  const keep=game.notes;
  let total=0,judged=0,ok=false;
  try{
    game.notes=[];
    if(song&&selectedSong!==song)selectedSong=song;
    generateBeatmap();
    total=game.notes.length;
    judged=game.notes.reduce((a,n)=>a+(n.perform?0:1),0);
    ok=judged>0;
  }catch(e){
    ok=false;total=0;judged=0;
  }
  game.notes=keep||[];
  return {ok:ok,count:total,judged:judged};
}
/* ---- 音频：真下载（读流算进度）→ blob 交给 <audio> → 等真能播 ------------ */
function fetchSongAudio(url,onProgress,signal){
  return fetch(url,{signal:signal}).then(res=>{
    if(!res.ok)throw new Error('HTTP '+res.status);
    const total=Number(res.headers.get('content-length'))||0;
    if(!res.body||typeof res.body.getReader!=='function'){
      return res.blob().then(b=>{onProgress(b.size,b.size||total);return b;});
    }
    const reader=res.body.getReader();
    const chunks=[];
    let received=0;
    const pump=()=>reader.read().then(step=>{
      if(step.done){
        onProgress(received,total||received);
        return new Blob(chunks,{type:'audio/mpeg'});
      }
      chunks.push(step.value);
      received+=step.value.length;
      onProgress(received,total||0);
      return pump();
    });
    return pump();
  });
}
/* 等 <audio> 真的把这首 blob / 文件读进缓冲：canplaythrough + 时长有效才算过 */
function hydrateSongAudio(src,onTick){
  return new Promise(resolve=>{
    let done=false;
    const finish=ok=>{
      if(done)return;done=true;
      clearTimeout(timer);
      detachSongAudioListeners();
      resolve(!!ok);
    };
    const tick=()=>{
      if(done)return;
      try{onTick&&onTick();}catch(e){}
      if(bgm.readyState>=4&&bgm.duration>0)finish(true);
    };
    const timer=setTimeout(()=>{
      /* 兜底：元数据 + 缓冲都到位就算过；否则判失败，绝不带坏文件进游戏 */
      finish(bgm.readyState>=2&&bgm.duration>0&&isFinite(bgm.duration));
    },30000);
    bindSongAudio('loadedmetadata',tick);
    bindSongAudio('loadeddata',tick);
    bindSongAudio('canplay',tick);
    bindSongAudio('progress',tick);
    bindSongAudio('canplaythrough',tick);
    bindSongAudio('error',()=>finish(false));
    try{bgm.preload='auto';bgm.src=src;bgm.load();}catch(e){finish(false);return;}
    tick();
    /* 整段都已缓冲时某些内核不会再补发 canplaythrough，补一次检查 */
    if(bgm.readyState>=4&&bgm.duration>0)setTimeout(()=>finish(true),0);
  });
}
function loadSongForSession(song,done){
  const token=++songLoadToken;
  const startedAt=performance.now();
  const alive=()=>token===songLoadToken;
  ensureAudioCtx();unlockAudio();buildHitSounds();
  stopAllUIMusic();
  state='LOADING';
  songLoadRetry=null;
  const b=$('#btnStartGame');if(b)b.disabled=true;
  songLoading.classList.add('active');
  $('#slTitle').textContent=String(song.title||'').toUpperCase();
  $('#slChapter').textContent=(song.chapterEn||'ORIGIN')+' / '+song.no;
  songLoadingBytes('0.00 MB');
  songLoadingSet(0,'REQUESTING','OPENING AUDIO CHANNEL');
  songLoadingAction('ABORT UPLINK',cancelSongLoading);
  AUDIO_LOADED_DURATION=0;
  /* 每次进歌都从零开始：上一首的监听器 / 下载 / blob / src 全拆干净 */
  clearTimeout(songLoadTimer);
  dropSongAudio();
  let settled=false,lastPct=0;
  const setPct=(p,stateText,hint)=>{
    if(!alive()||settled)return;
    lastPct=Math.max(lastPct,clamp(p,0,100));
    songLoadingSet(lastPct,stateText,hint);
  };
  const fail=hint=>{
    if(!alive()||settled)return;
    settled=true;clearTimeout(songLoadTimer);
    songLoadingSet(lastPct,'LINK FAILED',hint||'AUDIO FILE UNAVAILABLE');
    songLoadRetry=()=>{if(!alive())return;loadSongForSession(song,done);};
    songLoadingAction('RETRY LINK',()=>{if(songLoadRetry)songLoadRetry();});
    uiSound(.5);
  };
  const finish=()=>{
    if(!alive()||settled)return;
    settled=true;clearTimeout(songLoadTimer);
    songLoadingSet(98,'LINKED','AUDIO READY');
    const wait=Math.max(0,720-(performance.now()-startedAt));
    setTimeout(()=>{
      if(!alive())return;
      songLoadingSet(100,'LINKED','AUDIO READY');
      songLoadRetry=null;
      songLoadingAction('ABORT UPLINK',cancelSongLoading);
      setTimeout(()=>{
        if(!alive())return;
        closeSongLoading();
        done();
      },180);
    },wait);
  };
  /* 总超时：文件在但一直下不完 / 解不开，就当失败处理，别让人干等 */
  songLoadTimer=setTimeout(()=>fail('AUDIO LOAD TIMEOUT'),SONG_LOAD_TIMEOUT);

  (async()=>{
    /* ---- 1. 谱面 ---- */
    setPct(2,'SCANNING','CHART DATA');
    const chartOk=await ensureChartReady(song);
    if(!alive()||settled)return;
    if(!chartOk){fail('CHART DATA UNAVAILABLE');return;}
    setPct(6,'SYNCED','CHART READY');
    const chart=validateSongChart(song);
    if(!alive()||settled)return;
    if(!chart.ok){fail('CHART DATA EMPTY');return;}
    songLoadingSet(lastPct,'SYNCED','NOTES '+chart.count);

    /* ---- 2. 音频：真下载一遍（file:// 下 fetch 不可用，直接交给 <audio>） ---- */
    let src=song.audio;
    if(typeof fetch==='function'&&location.protocol!=='file:'){
      const ac=(typeof AbortController!=='undefined')?new AbortController():null;
      songLoadAbort=ac;
      try{
        const blob=await fetchSongAudio(song.audio,(recv,total)=>{
          if(!alive()||settled)return;
          /* 服务器没给 Content-Length 时按「这首歌大概 3.2MB」估一个进度，
             不然进度条会一直卡在 6% 直到下完（下载量本身还是真的）。 */
          const assumed=total||3355443;
          const ratio=clamp(recv/assumed,0,total?1:0.96);
          setPct(6+ratio*78,'STREAMING','RECEIVING PACKETS');
          songLoadingBytes(total
            ?(recv/1048576).toFixed(2)+' / '+(total/1048576).toFixed(2)+' MB'
            :(recv/1048576).toFixed(2)+' MB');
        },ac?ac.signal:undefined);
        if(!alive()||settled)return;
        if(!blob||!blob.size){fail('AUDIO FILE EMPTY');return;}
        songLoadingBytes((blob.size/1048576).toFixed(2)+' MB · 100%');
        releaseSongAudioBlob();
        songAudioBlobUrl=URL.createObjectURL(blob);
        src=songAudioBlobUrl;
      }catch(err){
        if(err&&err.name==='AbortError')return;
        /* 网络 / 权限问题：退回让 <audio> 直接读源文件，至少还有机会出声 */
        src=song.audio;
      }
    }
    if(!alive()||settled)return;

    /* ---- 3. 解码 / 缓冲 ---- */
    setPct(86,'DECODING','BUILDING WAVEFORM');
    const ok=await hydrateSongAudio(src,()=>{
      let p=86;
      try{
        if(bgm.readyState>=4)p=96;
        else if(bgm.readyState>=3)p=94;
        else if(bgm.readyState>=2)p=90;
        else if(bgm.readyState>=1)p=87;
      }catch(e){}
      setPct(p,'DECODING','BUILDING WAVEFORM');
      try{
        if(bgm.duration>0&&isFinite(bgm.duration))songLoadingBytes('DUR '+fmtTime(bgm.duration));
      }catch(e){}
    });
    if(!alive()||settled)return;
    if(!ok){fail('AUDIO FILE UNREADABLE');return;}
    try{
      AUDIO_LOADED_DURATION=bgm.duration||0;
      if(AUDIO_LOADED_DURATION>0)song.length=fmtTime(AUDIO_LOADED_DURATION);
    }catch(e){AUDIO_LOADED_DURATION=0;}
    songLoadingBytes('DUR '+fmtTime(AUDIO_LOADED_DURATION));
    finish();
  })().catch(()=>{
    if(!alive()||settled)return;
    fail('LINK ERROR');
  });
}
function beginSession(){
  stopAllUIMusic();
  state='LOADING';
  wipe(()=>{
    songScreen.classList.remove('active');
    chapterScreen.classList.remove('active');
    songSelectScreen.classList.remove('active');
    songLoading.classList.remove('active');
    gameWrap.classList.add('active');
    gameHud.classList.add('active');
    resultLayer.classList.remove('active');
    pauseLayer.classList.remove('active');
    stageGeo.stale=true;
    resetGameData();
    lastTime=performance.now();
    state='GAME';
    startGameLoop();
  });
}
function startGame(){
  if(state!=='SONG')return;
  if(!songScreen.classList.contains('active'))return;
  if(!selectedSong||!selectedSong.chart)return;
  if(performance.now()-detailReadyAt<220)return;
  loadSongForSession(selectedSong,beginSession);
}
function pauseGame(){
  if(state!=='GAME')return;
  state='PAUSED';
  pausedClock=game.clock;
  audioGate=false;audioGateSince=0;
  stopAllUIMusic();
  try{bgm.pause();}catch(e){}
  pauseLayer.classList.add('active');
  uiSound(.9);
}
function resumeGame(){
  if(state!=='PAUSED')return;
  pauseLayer.classList.remove('active');
  state='RESUMING';
  resumeEndAt=performance.now()+3400;
  resumeCountdown=3.4;
  resumePendingStart=false;resumePendingTimer=0;
  lastTime=performance.now();
  uiSound(1.1);
}
function restartGame(){
  if(state!=='PAUSED')return;
  pauseLayer.classList.remove('active');
  resetGameData();
  lastTime=performance.now();
  state='GAME';
  startGameLoop();
}
function quitToSong(){
  if(state!=='PAUSED')return;
  pauseLayer.classList.remove('active');
  cancelAnimationFrame(gameRaf);gameRaf=0;
  state='LOADING';
  resetAudioState();
  songLoadRetry=null;
  dropSongAudio();
  stopAllUIMusic();
  gameWrap.classList.remove('active');
  gameHud.classList.remove('active');
  wipe(()=>{
    openSongDetail(selectedSong,detailSource);
  });
}
function rankOf(score){
  // Score-based grade bands (0..1000000):
  if(score>=1000000)return 'AP';
  if(score>=960001)return 'SSS';
  if(score>=900001)return 'S';
  if(score>=800001)return 'A';
  if(score>=600000)return 'B';
  return 'C';
}
function endGame(){
  cancelAnimationFrame(gameRaf);gameRaf=0;
  stopAllUIMusic();
  try{bgm.pause();}catch(e){}
  state='RESULT';
  gameHud.classList.remove('active');
  const total=Math.max(1,game.notes.reduce((a,n)=>a+(n.perform?0:1),0));
  finalScore=Math.floor(900000*(game.weightSum/total)+100000*(game.maxCombo/total));
  const judged=game.perfect+game.good+game.bad+game.miss;
  const unjudged=Math.max(0,total-judged);
  const missShown=game.miss+unjudged;
  resultAcc=total?((game.perfect+game.good*.65)/total)*100:100;
  const isAP=game.perfect===total;
  const isFC=missShown===0&&game.bad===0&&(game.perfect+game.good)===total;
  const rank=rankOf(finalScore);
  const isRankAP=rank==='AP';

  const prev=getBestFor(selectedSong?selectedSong.id:'song');
  const scoreBetter=finalScore>prev.score;
  best={
    score:Math.max(prev.score,finalScore),
    acc:Math.max(prev.acc||0,resultAcc),
    ap:prev.ap||isAP,
    fc:prev.fc||isFC,
    combo:Math.max(prev.combo,game.maxCombo),
    rank:Math.max(prev.score,finalScore)===finalScore?rank:prev.rank
  };
  if(selectedSong)saveBestFor(selectedSong.id,best);
  unlockExIfPossible();
  markSongCleared(selectedSong);

  /* 苍穹星：0 分不给；按难度 / 评级 / AP / 全连 结算 */
  const starLv=selectedSong?selectedSong.level:1;
  const star=stardustFor(starLv,rank,isAP,isFC,finalScore);
  if(star>0){account.currency+=star;saveAccount();}
  const starEl=$('#resStar');
  if(starEl){
    starEl.innerHTML=starSVG(18)+'<b>+'+star+'</b> 苍穹星';
    /* 鼠标悬停能看到这一笔怎么算出来的：难度基数 × AP / 全连 / 评级 */
    const how=isAP?('ALL PERFECT ×'+STAR_MULT_AP):(isFC?('FULL COMBO ×'+STAR_MULT_FC):('RANK '+rank));
    starEl.title='LV.'+starLv+' · '+how+' · 难度基数 '+Math.round(starAPFor(starLv));
  }

  $('#resRank').textContent=rank;
  $('#resRank').classList.toggle('ap',isRankAP);
  $('#resRank').classList.toggle('fc',isFC&&!isRankAP);
  $('#resScore').textContent='0000000';
  $('#resAcc').textContent=resultAcc.toFixed(2)+'%';
  $('#resP').textContent=game.perfect;
  $('#resG').textContent=game.good;
  $('#resB').textContent=game.bad;
  $('#resM').textContent=missShown;
  $('#resC').textContent=game.maxCombo;
  const v=$('#resVerdict');
  v.textContent=isAP?'ALL PERFECT':(isFC?'FULL COMBO':'');
  v.style.color=isAP?'#ffcf6a':(isFC?'#b18cff':'#22e4ff');
  $('#resBest').innerHTML='PERSONAL BEST <b>'+pad7(best.score)+'</b>'+(scoreBetter?' <span class="new">· NEW RECORD</span>':'');
  resultReveal=0;
  resultLayer.classList.add('active');
  songScreen.classList.remove('active');
  revealResult();
}
function retryGame(){
  if(state!=='RESULT')return;
  resultLayer.classList.remove('active');
  resetGameData();
  lastTime=performance.now();
  state='GAME';
  gameHud.classList.add('active');
  startGameLoop();
  uiSound(1.15);
}
function backToSong(){
  if(state!=='RESULT')return;
  resultLayer.classList.remove('active');
  resetAudioState();
  /* 回选歌页就把这首的 blob 和监听器都放掉，下次再进是干净的一次加载 */
  songLoadRetry=null;
  dropSongAudio();
  stopAllUIMusic();
  gameWrap.classList.remove('active');
  gameHud.classList.remove('active');
  openSongDetail(selectedSong,detailSource);
  uiSound(.9);
}
function wipe(cb){
  wipeEl.classList.add('on');
  setTimeout(()=>{
    try{cb();}catch(e){console.error(e);}
    setTimeout(()=>wipeEl.classList.remove('on'),160);
  },280);
}

/* ============================================================
   15. gameplay —input
   ============================================================ */
/* Touch architecture (rebuilt):
   1. Stage geometry is CACHED. getBoundingClientRect() forces a synchronous
      layout pass; calling it inside touchstart/touchmove is what stalls the
      main thread on phones during fast taps and eats judgements. The cache is
      refreshed only on layout/resize/game start.
   2. The tap clock is sampled ONCE at the very top of the handler and passed
      down, so nothing in between can shift the judged instant.
   3. Lane mapping uses the cached geometry scaled into the V.w coordinate
      system — identical to how notes are drawn. */
const stageGeo={left:0,width:1,ts:0,stale:true};
function refreshStageGeo(){
  try{
    const r=stage.getBoundingClientRect();
    if(r.width>0){
      stageGeo.left=r.left;
      stageGeo.width=r.width;
      stageGeo.ts=performance.now();
      stageGeo.stale=false;
    }
  }catch(e){}
}
/* Hit zone per lane: for TAPS it is very slightly narrower than the lane column
   (centered), leaving a hairline dead gap at each boundary.
   NOTE: 之前是 90%（两侧各留 5%），实机上手指稍微偏一点就落进死区，
   变成"点了完全没判定 → 后面连着一串 MISS"，比串轨更伤手感。
   现在收到 99.6%（两侧各 0.2%，手机上不到 1px），只在真正压线时才不判。 */
const LANE_HIT_SCALE=.996;
function laneFromClientX(clientX,shrink){
  if(stageGeo.stale)refreshStageGeo();
  const x=(clientX-stageGeo.left)/stageGeo.width*V.w;
  const f=(x-V.x)/V.laneW;
  const i=Math.floor(f);
  if(i<0||i>3)return -1;
  if(shrink){
    const c=f-i;
    const m=(1-LANE_HIT_SCALE)/2;
    if(c<m||c>1-m)return -1;   // boundary dead gap: judge nothing
  }
  return i;
}
function handleDown(clientX,clientY,id,stamp){
  if(state!=='GAME'||resumeCountdown>0||resumePendingStart)return;
  const nowClock=judgementClock(stamp);
  if(nowClock<0)return;
  if(audioStarted&&bgm.paused&&!playPending&&nowClock>=MUSIC_DELAY+AUDIO_DELAY){
    const expected=Math.max(0,audioTime(nowClock));
    try{bgm.currentTime=expected;}catch(e){}
    if(startAudio())audioSyncPending=true;
  }
  const lane=laneFromClientX(clientX);
  if(lane>=0&&lane<4){
    pointerLanes[id]=lane;game.keyHold[lane]=true;
    judgeLane(lane,stamp);
    judgeYellowTouch(lane,stamp);
  }
}
function handleUp(id){
  const lane=pointerLanes[id];
  if(lane!==undefined){
    delete pointerLanes[id];
    let hold=false;
    for(const k in pointerLanes)if(pointerLanes[k]===lane){hold=true;break;}
    if(!hold)game.keyHold[lane]=false;
  }
}
function handleSlide(clientX,id,stamp){
  const lane=laneFromClientX(clientX);
  const old=pointerLanes[id];
  if(lane===old)return;
  const valid=lane>=0&&lane<4;
  if(old!==undefined){delete pointerLanes[id];let hold=false;for(const k in pointerLanes)if(pointerLanes[k]===old){hold=true;break;}if(!hold)game.keyHold[old]=false;}
  if(!valid)return;
  pointerLanes[id]=lane;game.keyHold[lane]=true;
  // sliding is a yellow-only touch event; it must never judge blue notes
  if(old===undefined){judgeYellowTouch(lane,stamp);return;}
  const dir=lane>old?1:-1;
  for(let l=old+dir;dir>0?l<=lane:l>=lane;l+=dir)judgeYellowTouch(l,stamp);
}
/* 触屏用 Touch Events（回归到之前稳定的输入层）；鼠标/触控笔用 Pointer Events。 */
stage.addEventListener('touchstart',e=>{
  if(e.cancelable)e.preventDefault();
  for(let i=0;i<e.changedTouches.length;i++){
    const t=e.changedTouches[i];
    handleDown(t.clientX,t.clientY,t.identifier,e.timeStamp);
  }
},{passive:false});
stage.addEventListener('touchmove',e=>{
  if(e.cancelable)e.preventDefault();
  for(let i=0;i<e.changedTouches.length;i++){
    const t=e.changedTouches[i];
    handleSlide(t.clientX,t.identifier,e.timeStamp);
  }
},{passive:false});
window.addEventListener('touchend',e=>{
  for(let i=0;i<e.changedTouches.length;i++)handleUp(e.changedTouches[i].identifier);
},{passive:true});
window.addEventListener('touchcancel',e=>{
  for(let i=0;i<e.changedTouches.length;i++)handleUp(e.changedTouches[i].identifier);
},{passive:true});

stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.cancelable)e.preventDefault();
  try{stage.setPointerCapture(e.pointerId);}catch(err){}
  handleDown(e.clientX,e.clientY,e.pointerId,e.timeStamp);
},{passive:false});
window.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')handleUp(e.pointerId);},{passive:true});
window.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')handleUp(e.pointerId);},{passive:true});
stage.addEventListener('contextmenu',e=>e.preventDefault());

window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const dm=$('#devModal');
    if(dm&&dm.classList.contains('active')){closeDevModal();return;}
    /* 加载中按 ESC = 中断这次加载（否则会退回选歌页、加载层却还挂着） */
    if(songLoading.classList.contains('active')){cancelSongLoading();return;}
    if(settingsApp.classList.contains('active')){closeSettings();return;}
    if(imApp.classList.contains('active')){
      if($('#imDetail').classList.contains('active')){$('#imDetail').classList.remove('active');uiSound(.9);}
      else closeIM();
      return;
    }
    const gdEl=$('#proGuide');
    if(gdEl&&gdEl.classList.contains('active')){closeProGuide();return;}
    if(prologueScreen.classList.contains('active')||exScreen.classList.contains('active')){closeSolo();return;}
    if(songScreen.classList.contains('active')){closeSong();return;}
    if(songSelectScreen.classList.contains('active')){closeSongSelect();return;}
    if(chapterScreen.classList.contains('active')){closeChapterSelect();return;}
    if(state==='RESULT'){backToSong();return;}
    if(state==='GAME')pauseGame();
    else if(state==='PAUSED')resumeGame();
    return;
  }
  if(state==='RESULT'&&(e.key==='r'||e.key==='R')){retryGame();return;}
  if(state==='GAME'&&game.clock>=0&&resumeCountdown<=0&&!e.repeat){
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea')return;
    const idx=KEYS.indexOf((e.key||'').toLowerCase());
    if(idx>=0){if(e.cancelable)e.preventDefault();game.keyHold[idx]=true;judgeLane(idx,e.timeStamp);judgeYellowTouch(idx,e.timeStamp);}
  }
});
window.addEventListener('keyup',e=>{
  const idx=KEYS.indexOf((e.key||'').toLowerCase());
  if(idx>=0)game.keyHold[idx]=false;
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(state==='GAME')pauseGame();
    playUIMusic(null);
    if(storeAppEl&&storeAppEl.classList.contains('active'))stopStoreMusic();
  }else{
    syncUIMusic();
  }
});

/* ============================================================
   16. gameplay —renderer
   ============================================================ */
function drawGame(dt){
  const c=sctx;
  const isCorr=selectedSong&&selectedSong.chart==='corr';
  const isStill=selectedSong&&selectedSong.chart==='still';
  const isW=selectedSong&&selectedSong.chart==='w';
  const isLtzz=selectedSong&&selectedSong.chart==='ltzz';
  const isWelkin=selectedSong&&selectedSong.chart==='welkin';
  const isCyber=selectedSong&&selectedSong.chart==='cyber';
  const isAn=selectedSong&&selectedSong.chart==='an';
  const mt=game.clock-MUSIC_DELAY;
  // Corr: lanes + background go grayscale (0 -> 70% over the countdown, stays 70%).
  // Notes/receptors/judgement stay full color, so we only wrap the backdrop+playfield.
  const gp=clamp((game.clock+3)/3,0,1);
  const mono=isCorr?0.7*gp*gp*(3-2*gp):0;
  // WELKIN 的去饱和不在这里做：它要吃掉整帧（按键/音符/判定特效/粒子全都算），
  // 所以放到 drawGame 最后一步用 saturation 混合模式一次性套上去。
  clearWelkinDesat();
  c.setTransform(V.dpr,0,0,V.dpr,0,0);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  let bgFilter='';
  if(mono>0.001)bgFilter='grayscale('+mono.toFixed(3)+')';
  if(bgFilter)c.filter=bgFilter;
  drawBackdrop();
  if(isLtzz&&!V.ultraFx)drawLtzzNobleLight();

  const shake=game.screenShake*(V.h/720);
  c.save();
  if(shake>.2)c.translate(rand(-shake,shake),rand(-shake,shake));
  if(isStill){const wa=stillWaveAmp(mt);if(wa>0)c.translate(Math.sin(mt*2.2)*wa*5,Math.sin(mt*1.6)*wa*4);}
  if(isLtzz){const wa=ltzzWaterAmp(mt);if(wa>0){const s=V.h/720;c.translate(Math.sin(mt*2.0)*wa*10*s,Math.sin(mt*1.4)*wa*8*s);}}
  if(isWelkin){const wa=welkinWaterAmp(mt);if(wa>0){const s=V.h/720;c.translate(Math.sin(mt*2.4)*wa*16*s,Math.sin(mt*1.7)*wa*12*s);}}
  drawPlayfield();
  c.filter='none';
  if(settings.dim>0){
    c.fillStyle='rgba(0,0,0,'+(settings.dim/100*.58).toFixed(3)+')';
    c.fillRect(0,0,V.w,V.h);
  }
  if(!V.ultraFx){drawFog();drawStageLight();}
  if(isCorr)drawCorrFog();
  if(isW)drawWFlash();
  if(isW)drawWFog();
  if(isWelkin)drawWelkinFog();
  if(isStill)drawStillRays();
  drawCh2Fog();
  if(!V.ultraFx)drawCh2Ambient();
  drawNotes();
  drawTopFade();
  drawHitLine();
  if(!V.ultraFx)drawFx();
  if(isLtzz)drawLtzzEndFog();
  drawReceptors();
  c.restore();
  c.filter='none';

  drawCombo();
  drawJudgement();
  drawBottomMeta();
  if(!V.ultraFx)drawSectionFx();
  drawCountdown();
  if(isWelkin)drawWelkinVignette();
  if(isCorr)drawCorrGlitch();
  if(isW)drawWGlitch();
  if(isStill)drawStillFog();
  if(isWelkin)drawWelkinGlitch(dt);
  drawCh2TextFx(dt);

  if(game.flashAlpha>0){c.fillStyle='rgba(225,250,255,'+(game.flashAlpha*.3).toFixed(3)+')';c.fillRect(0,0,V.w,V.h);}
  if(game.whiteFlash>0){c.fillStyle='rgba(170,235,255,'+game.whiteFlash.toFixed(3)+')';c.fillRect(0,0,V.w,V.h);}
  if(isLtzz)drawLtzzEndFogVeil();
  drawCh2FinalVeil();
  /* WELKIN 203s→208s：整帧去饱和到 70%（之后停在 70%）。
     用 saturation 混合模式铺一层灰：B(Cb,Cs) 会把底色的饱和度换成源色的饱和度(0)，
     即「保亮度、去颜色」，按键、音符、长条、判定/PERFECT 特效、粒子、黑雾暗角一起变黑白。 */
  if(isWelkin){
    const desat=clamp(1-welkinSaturation(mt),0,1);
    if(desat>0.001){
      if(welkinBlendOk(c)){
        c.save();
        c.globalCompositeOperation='saturation';
        c.globalAlpha=desat;
        c.fillStyle='#808080';
        c.fillRect(0,0,V.w,V.h);
        c.restore();
        // 画布外还有一层 HUD（进度/分数），一并压成灰，做到「整个屏幕」
        const q=Math.round(desat*100)/100;
        if(q!==welkinHudDesat){welkinHudDesat=q;gameHud.style.filter='grayscale('+q+')';}
      }else{
        stage.style.filter='grayscale('+desat.toFixed(3)+')';
        gameHud.style.filter='grayscale('+desat.toFixed(3)+')';
        welkinHudDesat=-1;
      }
    }
  }
  /* CYBER 11s 起整帧去饱和 30%（155.5s 起再 +20% = 50%），与 WELKIN 同一套 saturation 混合模式，
     按键/音符/长条/判定特效/粒子/黑雾一起变黑白。 */
  if(isCyber){
    const desat=clamp(1-cyberSaturation(mt),0,1);
    if(desat>0.001){
      if(welkinBlendOk(c)){
        c.save();
        c.globalCompositeOperation='saturation';
        c.globalAlpha=desat;
        c.fillStyle='#808080';
        c.fillRect(0,0,V.w,V.h);
        c.restore();
        const q=Math.round(desat*100)/100;
        if(q!==welkinHudDesat){welkinHudDesat=q;gameHud.style.filter='grayscale('+q+')';}
      }else{
        stage.style.filter='grayscale('+desat.toFixed(3)+')';
        gameHud.style.filter='grayscale('+desat.toFixed(3)+')';
        welkinHudDesat=-1;
      }
    }
  }
  /* 时逝：10s 淡入黑白 10%、18-20s 淡回全彩，同套 saturation 混合模式。 */
  if(isAn){
    const desat=clamp(1-anSaturation(mt),0,1);
    if(desat>0.001){
      if(welkinBlendOk(c)){
        c.save();
        c.globalCompositeOperation='saturation';
        c.globalAlpha=desat;
        c.fillStyle='#808080';
        c.fillRect(0,0,V.w,V.h);
        c.restore();
        const q=Math.round(desat*100)/100;
        if(q!==welkinHudDesat){welkinHudDesat=q;gameHud.style.filter='grayscale('+q+')';}
      }else{
        stage.style.filter='grayscale('+desat.toFixed(3)+')';
        gameHud.style.filter='grayscale('+desat.toFixed(3)+')';
        welkinHudDesat=-1;
      }
    }
  }
  const dimHud=false;
  gameHud.classList.toggle('dim',dimHud);
}

function drawBackground(){
  const c=sctx,t=game.clock;
  const bg=c.createLinearGradient(0,0,0,V.h);
  bg.addColorStop(0,'#040a14');bg.addColorStop(.45,'#03070f');bg.addColorStop(1,'#010307');
  c.fillStyle=bg;c.fillRect(0,0,V.w,V.h);

  const pulse=game.bpmPulse;
  // aurora
  const a1=c.createRadialGradient(V.w*.5,V.h*.38,0,V.w*.5,V.h*.38,V.w*.62);
  a1.addColorStop(0,'rgba(18,100,160,'+(.10+pulse*.05)+')');a1.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=a1;c.fillRect(0,0,V.w,V.h);
  const a2=c.createRadialGradient(V.w*.18,V.h*.72,0,V.w*.18,V.h*.72,V.w*.4);
  a2.addColorStop(0,'rgba(90,60,200,'+(.07+pulse*.03)+')');a2.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=a2;c.fillRect(0,0,V.w,V.h);

  // stars
  for(const s of V.stars){
    const tw=.5+.5*Math.sin(t*1.4+s.p);
    c.fillStyle='rgba(160,225,255,'+((.08+.42*s.z)*tw).toFixed(3)+')';
    c.fillRect(s.x,s.y,s.r,s.r);
  }

  // floor grid
  const horizon=V.h*.74;
  c.save();
  c.strokeStyle='rgba(40,160,220,'+(0.055+pulse*.04)+')';
  c.lineWidth=1;
  for(let i=0;i<=18;i++){
    const f=i/18;
    const x0=V.w/2+(f-.5)*V.w*.16;
    const x1=V.w/2+(f-.5)*V.w*2.4;
    c.beginPath();c.moveTo(x0,horizon);c.lineTo(x1,V.h);c.stroke();
  }
  const off=(t*.13)%1;
  for(let i=0;i<14;i++){
    const tt=(i/14+off)%1;
    const y=horizon+Math.pow(tt,2.5)*(V.h-horizon);
    c.strokeStyle='rgba(40,170,225,'+(0.07*(1-tt)*(0.6+pulse)).toFixed(3)+')';
    c.beginPath();c.moveTo(0,y);c.lineTo(V.w,y);c.stroke();
  }
  c.restore();

  // orbital rings behind track
  c.save();
  c.translate(V.w/2,V.h*.5);
  c.globalCompositeOperation='lighter';
  for(let i=0;i<3;i++){
    const r=V.trackW*(.52+i*.17);
    const rot=t*(.08+i*.05)*(i%2?-1:1);
    c.save();c.rotate(rot);
    c.strokeStyle='rgba('+(i===1?'143,108,255':'34,228,255')+','+(.07+i*.015)+')';
    c.lineWidth=1;
    c.beginPath();c.ellipse(0,0,r,r*.34,0,0,Math.PI*2);c.stroke();
    c.setLineDash([2,14]);
    c.strokeStyle='rgba(120,220,255,'+(.18+pulse*.12)+')';
    c.beginPath();c.ellipse(0,0,r*1.02,r*.35,0,0,Math.PI*2);c.stroke();
    c.setLineDash([]);
    c.restore();
  }
  c.restore();

  // dust
  c.save();c.globalCompositeOperation='lighter';
  for(const d of V.dust){
    const y=((d.y-t*d.s)%V.h+V.h)%V.h;
    const x=d.x+Math.sin(t*.4+d.p)*10;
    c.fillStyle='rgba(120,220,255,.18)';
    c.fillRect(x,y,d.r,d.r);
  }
  c.restore();

  // side data rails
  c.save();
  c.strokeStyle='rgba(34,228,255,.12)';c.lineWidth=1;
  const railOff=(t*26)%60;
  for(let side=0;side<2;side++){
    const x=side?V.w-26:26;
    c.beginPath();c.moveTo(x,0);c.lineTo(x,V.h);c.stroke();
    for(let y=-60+railOff;y<V.h;y+=60){
      c.beginPath();c.moveTo(side?x-5:x,y);c.lineTo(side?x+6:x+6,y);c.stroke();
    }
  }
  c.restore();

  // vignette
  const vg=c.createRadialGradient(V.w/2,V.h*.5,V.h*.18,V.w/2,V.h*.5,V.h*.9);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.62)');
  c.fillStyle=vg;c.fillRect(0,0,V.w,V.h);
}

let bgCache=null,bgCacheKey='';
function buildBackdropCache(w,h){
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(w*V.dpr));
  cv.height=Math.max(1,Math.round(h*V.dpr));
  const g=cv.getContext('2d');
  g.setTransform(V.dpr,0,0,V.dpr,0,0);
  const bg=g.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#04101c');bg.addColorStop(.46,'#030812');bg.addColorStop(1,'#010306');
  g.fillStyle=bg;g.fillRect(0,0,w,h);
  const hg=g.createRadialGradient(w/2,h*.56,0,w/2,h*.56,w*.66);
  hg.addColorStop(0,'rgba(20,120,180,.16)');hg.addColorStop(.55,'rgba(10,60,110,.05)');hg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=hg;g.fillRect(0,0,w,h);
  const horizon=h*.7;
  for(let i=0;i<=20;i++){
    const f=i/20,x0=w/2+(f-.5)*w*.18,x1=w/2+(f-.5)*w*2.5;
    g.strokeStyle='rgba(40,165,225,.07)';g.lineWidth=1;
    g.beginPath();g.moveTo(x0,horizon);g.lineTo(x1,h);g.stroke();
  }
  for(let i=0;i<14;i++){
    const tt=i/14,y=horizon+Math.pow(tt,2.4)*(h-horizon);
    g.strokeStyle='rgba(46,180,232,'+(.1*(1-tt)*.6).toFixed(3)+')';
    g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();
  }
  return cv;
}
function drawBackdrop(){
  const c=sctx,t=game.clock,pulse=game.bpmPulse,w=V.w,h=V.h;
  const key=Math.round(w)+'x'+Math.round(h)+'@'+V.dpr;
  if(!bgCache||bgCacheKey!==key){bgCache=buildBackdropCache(w,h);bgCacheKey=key;}
  c.drawImage(bgCache,0,0,w,h);
  if(pulse>.01){c.save();c.globalAlpha=pulse*.06;c.fillStyle='rgba(20,120,180,1)';c.fillRect(0,0,w,h);c.restore();}

  // vertical light shafts
  c.save();c.globalCompositeOperation='lighter';
  const shaftN=V.lowFx?0:4;
  for(let i=0;i<shaftN;i++){
    const sx=w*(.1+i*(.8/(shaftN-1||1)))+Math.sin(t*.18+i*1.7)*34;
    const g=c.createLinearGradient(sx-80,0,sx+80,0);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(.5,'rgba(34,228,255,'+(.022+pulse*.012)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(sx-80,0,160,h);
  }
  c.restore();

  // stars
  for(const s of V.stars){
    const tw=.5+.5*Math.sin(t*1.5+s.p);
    c.fillStyle='rgba(165,228,255,'+((.1+.5*s.z)*tw).toFixed(3)+')';
    c.fillRect(s.x,s.y,s.r,s.r);
  }

  // perspective floor — static grid is cached; only the moving scan-lines stay dynamic
  if(!V.lowFx){
    const horizon=h*.7,off=(t*.15)%1;
    c.save();
    for(let i=0;i<14;i++){
      const tt=(i/14+off)%1,y=horizon+Math.pow(tt,2.4)*(h-horizon);
      c.strokeStyle='rgba(46,180,232,'+(.1*(1-tt)*(.6+pulse)).toFixed(3)+')';
      c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();
    }
    c.restore();
  }

  // lane beat pulses travelling down the conduit
  const phase=((t%.4)+.4)%.4/0.4;
  c.save();c.globalCompositeOperation='lighter';
  for(let i=0;i<4;i++){
    const lx=V.x+i*V.laneW;
    const py=phase*V.judgeY;
    const lg=c.createLinearGradient(0,py-120,0,py+30);
    lg.addColorStop(0,'rgba(34,228,255,0)');
    lg.addColorStop(.7,'rgba(60,225,255,'+(.11*(1-phase)+.03)+')');
    lg.addColorStop(1,'rgba(34,228,255,0)');
    c.fillStyle=lg;c.fillRect(lx,py-120,V.laneW,150);
  }
  c.restore();

  // side data streams
  c.save();c.globalCompositeOperation='lighter';
  const streamN=V.lowFx?7:14;
  for(let i=0;i<streamN;i++){
    const left=i<Math.ceil(streamN/2);
    const x=left?18+((i*37)%90):w-18-((i*53)%90);
    const y=((t*(28+i*3)+i*97)%(h+120))-60;
    c.fillStyle=i%3===0?'rgba(255,77,157,.18)':'rgba(34,228,255,.16)';
    c.fillRect(x,y,1,14+((i*7)%16));
  }
  c.restore();

  // orbital rings + nodes
  c.save();c.translate(w/2,h*.5);c.globalCompositeOperation='lighter';
  const ringN=V.lowFx?2:4;
  for(let i=0;i<ringN;i++){
    const r=V.trackW*(.58+i*.15);
    const rot=t*(.06+i*.025)*(i%2?-1:1);
    c.save();c.rotate(rot);
    c.strokeStyle=i===1?'rgba(143,108,255,.24)':'rgba(34,228,255,.22)';
    c.lineWidth=1.2;
    c.beginPath();c.ellipse(0,0,r,r*.36,0,0,Math.PI*2);c.stroke();
    c.setLineDash([2,16]);
    c.strokeStyle='rgba(130,235,255,'+(.26+pulse*.14)+')';
    c.beginPath();c.ellipse(0,0,r*1.01,r*.365,0,0,Math.PI*2);c.stroke();
    c.setLineDash([]);
    for(let k=0;k<4;k++){
      const ang=k*Math.PI/2+t*(.25+i*.08);
      const px=Math.cos(ang)*r,py=Math.sin(ang)*r*.36;
      c.fillStyle='rgba(180,250,255,'+(.35+pulse*.25)+')';
      c.beginPath();c.arc(px,py,1.4,0,Math.PI*2);c.fill();
    }
    c.restore();
  }
  c.restore();

  // inward tunnel particles
  c.save();c.globalCompositeOperation='lighter';
  const dustN=V.lowFx?24:V.dust.length;
  for(let di=0;di<dustN;di++){
    const d=V.dust[di];
    const r=((d.r0+t*d.sp)%1);
    const rad=r*w*.72;
    const x=w/2+Math.cos(d.a)*rad*1.3;
    const y=h*.5+Math.sin(d.a)*rad*.62;
    const a=(1-r)*.55;
    c.fillStyle='rgba(130,225,255,'+a.toFixed(3)+')';
    c.fillRect(x,y,d.size,d.size);
  }
  c.restore();

  // ghost V
  c.save();
  c.globalAlpha=.035;c.fillStyle='#7fe6ff';
  c.font='700 '+(h*.62).toFixed(0)+'px '+FONT_D;
  c.textAlign='center';c.textBaseline='middle';
  c.fillText('W',w/2,h*.52);
  c.restore();

  // beat shockwave at the judgement line
  if(pulse>.01){
    const bp=1-pulse;
    c.save();c.globalCompositeOperation='lighter';
    c.strokeStyle='rgba(120,240,255,'+(pulse*.26).toFixed(3)+')';
    c.lineWidth=1.2;
    c.beginPath();
    c.ellipse(w/2,V.judgeY,V.trackW*(.42+bp*.9),V.trackW*(.1+bp*.22),0,0,Math.PI*2);
    c.stroke();
    c.restore();
  }

  // scan band
  const sy=((t*70)%(h+240))-120;
  const sg=c.createLinearGradient(0,sy-70,0,sy+70);
  sg.addColorStop(0,'rgba(34,228,255,0)');
  sg.addColorStop(.5,'rgba(34,228,255,.045)');
  sg.addColorStop(1,'rgba(34,228,255,0)');
  c.fillStyle=sg;c.fillRect(0,sy-70,w,140);
  c.fillStyle='rgba(120,235,255,.10)';c.fillRect(0,sy,w,1);

  // edge vignette
  const vg=c.createRadialGradient(w/2,h*.5,h*.16,w/2,h*.5,h*.92);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.66)');
  c.fillStyle=vg;c.fillRect(0,0,w,h);
}

/* ---- 20 track skins: WELKIN conduit theme pack ------------------------ */
function rgba(c,a){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
const TRACK_SKINS=[
  {name:'经典 WELKIN',a:[34,228,255],b:[120,220,255],col:'solid',div:'line',dim:1},
  {name:'极光',a:[94,234,255],b:[167,139,250],c:[34,211,238],col:'grad',div:'line',dim:1},
  {name:'深海',a:[56,130,246],b:[96,165,250],col:'fade',div:'dot',dim:.7},
  {name:'赛博',a:[255,77,157],b:[34,228,255],col:'stripe',div:'dash',dim:.85},
  {name:'白昼',a:[224,242,254],b:[125,211,252],col:'solid',div:'double',dim:.5},
  {name:'星轨',a:[147,197,253],b:[165,180,252],col:'dots',div:'dot',dim:.8},
  {name:'熔炉',a:[251,146,60],b:[253,224,71],col:'fade',div:'line',dim:.8},
  {name:'翡翠',a:[52,211,153],b:[110,231,183],col:'solid',div:'dash',dim:.7},
  {name:'极夜',a:[165,243,252],b:[103,232,249],col:'fade',div:'double',dim:.45},
  {name:'数据流',a:[74,222,128],b:[34,197,94],col:'dots',div:'line',dim:.8},
  {name:'霓虹粉',a:[244,114,182],b:[34,228,255],col:'stripe',div:'line',dim:.9},
  {name:'白金',a:[226,232,240],b:[148,163,184],col:'solid',div:'double',dim:.5},
  {name:'幽蓝',a:[125,211,252],b:[186,230,253],col:'fade',div:'dot',dim:.35},
  {name:'日蚀',a:[253,224,71],b:[251,146,60],col:'beam',div:'line',dim:.85},
  {name:'全息',a:[34,228,255],b:[255,77,157],c:[124,58,237],col:'grad',div:'dash',dim:.9},
  {name:'水晶',a:[45,212,191],b:[153,246,228],col:'beam',div:'double',dim:.55},
  {name:'雷霆',a:[250,204,21],b:[59,130,246],col:'stripe',div:'dash',dim:.85},
  {name:'月面',a:[203,213,225],b:[148,163,184],c:[196,181,253],col:'grad',div:'dot',dim:.5},
  {name:'紫霞',a:[167,139,250],b:[233,213,255],col:'fade',div:'line',dim:.55},
  {name:'晨曦',a:[254,215,170],b:[253,186,116],c:[56,189,248],col:'grad',div:'double',dim:.7},
  {name:'黄金奢华',a:[255,211,102],b:[232,200,118],c:[255,176,64],col:'grad',div:'double',dim:.9}
];

/* 黄金奢华轨道 · 鎏金雕花纹样（菱形嵌饰 + 连珠 + 回纹横带），仅 index 20 启用。
   一次绘制进缓存画布，不参与逐帧渲染，零额外开销。 */
function drawGoldenFiligree(c,x,tw,h,laneW){
  const gold=(a)=>'rgba(255,214,120,'+a+')';
  const pale=(a)=>'rgba(255,244,205,'+a+')';
  const deep=(a)=>'rgba(180,138,58,'+a+')';
  const diamond=(cx,cy,r)=>{c.beginPath();c.moveTo(cx,cy-r);c.lineTo(cx+r,cy);c.lineTo(cx,cy+r);c.lineTo(cx-r,cy);c.closePath();c.fill();};
  // 轨道左右内侧鎏金描边
  c.strokeStyle=gold(.5);c.lineWidth=1.2;
  c.beginPath();c.moveTo(x+2,0);c.lineTo(x+2,h);c.moveTo(x+tw-2,0);c.lineTo(x+tw-2,h);c.stroke();
  // 分界线：串菱形鎏金嵌饰（大菱形套高光芯）
  for(let i=0;i<=4;i++){
    const lx=Math.round(x+i*laneW)+.5;
    for(let yy=12;yy<h;yy+=44){
      c.fillStyle=gold(.8);diamond(lx,yy,5.2);
      c.fillStyle=pale(.95);diamond(lx,yy,2.1);
    }
  }
  // 车道中心：斜向连珠小菱形纹路（低透明，衬出层次）
  for(let i=0;i<4;i++){
    const cx2=x+i*laneW+laneW/2;
    for(let yy=34;yy<h;yy+=62){
      c.fillStyle=gold(.28);diamond(cx2,yy,3.4);
      c.fillStyle=pale(.32);diamond(cx2,yy,1.2);
    }
  }
  // 上下端鎏金回纹横带
  const band=(by)=>{
    const g=c.createLinearGradient(x,0,x+tw,0);
    g.addColorStop(0,deep(0));g.addColorStop(.5,gold(.55));g.addColorStop(1,deep(0));
    c.fillStyle=g;c.fillRect(x,by,tw,2);
    c.fillStyle=gold(.3);
    for(let bx=x+6;bx<x+tw-6;bx+=18)diamond(bx,by+1,2.4);
  };
  band(4);band(h-6);
}
let pfCache=null,pfCacheKey='';
function buildPlayfieldCache(){
  const w=V.w,h=V.h,x=V.x,tw=V.trackW;
  const sk=getTrackSkin();
  const A=sk.a,B=sk.b,C=sk.c||sk.a;
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(w*V.dpr));
  cv.height=Math.max(1,Math.round(h*V.dpr));
  const c=cv.getContext('2d');
  c.setTransform(V.dpr,0,0,V.dpr,0,0);

  // lane gradient
  const tg=c.createLinearGradient(0,0,0,h);
  tg.addColorStop(0,'rgba(5,12,22,0)');
  tg.addColorStop(.2,'rgba(6,16,29,.55)');
  tg.addColorStop(1,'rgba(9,22,39,.74)');
  c.fillStyle=tg;c.fillRect(x,0,tw,h);

  // lane columns — six visual recipes (static; tiny pulse folded out, negligible)
  if(sk.col==='grad'){
    const hg=c.createLinearGradient(x,0,x+tw,0);
    hg.addColorStop(0,rgba(A,(.05*sk.dim)));
    hg.addColorStop(.5,rgba(C,(.07*sk.dim)));
    hg.addColorStop(1,rgba(B,(.05*sk.dim)));
    c.fillStyle=hg;c.fillRect(x,0,tw,h);
  }else if(sk.col==='dots'){
    c.fillStyle=rgba(A,(.13*sk.dim));
    for(let i=0;i<4;i++){
      const bx=x+i*V.laneW;
      for(let yy=0;yy<h;yy+=20){
        c.fillRect(bx+V.laneW*.18,yy,2,2);
        c.fillRect(bx+V.laneW*.78,yy,2,2);
      }
    }
  }else if(sk.col==='stripe'){
    c.save();c.beginPath();c.rect(x,0,tw,h);c.clip();
    c.strokeStyle=rgba(A,(.06*sk.dim));c.lineWidth=3;
    for(let i=0;i<4;i++){
      const bx=x+i*V.laneW;
      for(let xx=-h;xx<tw;xx+=26){
        c.beginPath();c.moveTo(bx+xx,0);c.lineTo(bx+xx-h,h);c.stroke();
      }
    }
    c.restore();
  }else if(sk.col==='beam'){
    for(let i=0;i<4;i++){
      const bx=x+i*V.laneW+V.laneW/2;
      const beam=c.createLinearGradient(bx-V.laneW*.16,0,bx+V.laneW*.16,0);
      beam.addColorStop(0,'rgba(0,0,0,0)');
      beam.addColorStop(.5,rgba(A,(.08*sk.dim)));
      beam.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=beam;c.fillRect(bx-V.laneW*.16,0,V.laneW*.32,h);
    }
  }else if(sk.col==='fade'){
    for(let i=0;i<4;i++){
      const lg=c.createLinearGradient(0,0,0,h);
      lg.addColorStop(0,'rgba(0,0,0,0)');
      lg.addColorStop(.6,rgba(A,((i%2?0.02:0.035)*sk.dim)));
      lg.addColorStop(1,rgba(A,(.06*sk.dim)));
      c.fillStyle=lg;c.fillRect(x+i*V.laneW,0,V.laneW,h);
    }
  }else{ // solid
    for(let i=0;i<4;i++){
      const lg=c.createLinearGradient(0,0,0,h);
      lg.addColorStop(0,'rgba(0,0,0,0)');
      lg.addColorStop(.65,rgba(A,((i%2?0.028:0.045)*sk.dim)));
      lg.addColorStop(1,rgba(A,(.07*sk.dim)));
      c.fillStyle=lg;c.fillRect(x+i*V.laneW,0,V.laneW,h);
    }
  }

  // dividers — four recipes
  const dg=c.createLinearGradient(0,0,0,h);
  dg.addColorStop(0,'rgba(0,0,0,0)');
  dg.addColorStop(.55,rgba(B,.16));
  dg.addColorStop(.92,rgba(B,.42));
  dg.addColorStop(1,rgba(B,.1));
  c.strokeStyle=dg;c.lineWidth=1;
  for(let i=0;i<=4;i++){
    const lx=Math.round(x+i*V.laneW)+.5;
    if(sk.div==='dot'){c.setLineDash([1,9]);c.lineWidth=1.6;}
    else if(sk.div==='dash'){c.setLineDash([7,8]);}
    else if(sk.div==='double'){c.setLineDash([]);c.lineWidth=1;}
    else{c.setLineDash([]);}
    c.beginPath();c.moveTo(lx,0);c.lineTo(lx,h);c.stroke();
    if(sk.div==='double'){
      c.strokeStyle=rgba(B,.12);c.lineWidth=1;
      c.beginPath();c.moveTo(lx-3,0);c.lineTo(lx-3,h);c.moveTo(lx+3,0);c.lineTo(lx+3,h);c.stroke();
      c.strokeStyle=dg;
    }
  }
  c.setLineDash([]);
  c.strokeStyle=rgba(A,.32);
  c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,h);c.moveTo(x+tw-.5,0);c.lineTo(x+tw-.5,h);c.stroke();
  if(activeTrackSkin===20){drawGoldenFiligree(c,x,tw,h,V.laneW);}
  return cv;
}
function drawPlayfield(){
  const c=sctx,x=V.x,w=V.trackW,y=V.judgeY;
  const pulse=game.bpmPulse;
  const sk=getTrackSkin();
  const A=sk.a,B=sk.b;

  const halo=c.createRadialGradient(x+w/2,y,0,x+w/2,y,w*.95);
  halo.addColorStop(0,rgba(A,(.13+pulse*.08)));halo.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=halo;c.fillRect(0,0,V.w,V.h);
  const under=c.createRadialGradient(x+w/2,y,0,x+w/2,y,w*.7);
  under.addColorStop(0,rgba(A,(.16+pulse*.1)));
  under.addColorStop(.5,rgba(A,.05));
  under.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=under;c.fillRect(x-w*.2,y-w*.6,w*1.4,w*1.2);

  // static lane columns + dividers, cached (rebuilds on resize / skin change)
  const key=Math.round(w)+'x'+Math.round(V.h)+'@'+V.dpr+'#'+activeTrackSkin;
  if(!pfCache||pfCacheKey!==key){pfCache=buildPlayfieldCache();pfCacheKey=key;}
  c.drawImage(pfCache,0,0,V.w,V.h);

  // holds / lane flash
  for(let i=0;i<4;i++){
    const a=Math.max(game.keyHold[i]?0.34:0,game.laneFlash[i]);
    if(a<=.01)continue;
    const bx=x+i*V.laneW;
    const bg=c.createLinearGradient(0,y,0,V.h);
    bg.addColorStop(0,rgba(A,(.32*a)));
    bg.addColorStop(.6,rgba(A,(.1*a)));
    bg.addColorStop(1,'rgba(20,80,140,0)');
    c.fillStyle=bg;c.fillRect(bx+1.5,y,V.laneW-3,V.h-y);
    const top=c.createLinearGradient(0,y-90,0,y);
    top.addColorStop(0,'rgba(0,0,0,0)');
    top.addColorStop(1,rgba(A,(.1*a)));
    c.fillStyle=top;c.fillRect(bx+1.5,y-90,V.laneW-3,90);
  }

  // scan band inside the conduit
  const sy=((game.clock*150)%(V.h+160))-80;
  const scan=c.createLinearGradient(0,sy-80,0,sy+80);
  scan.addColorStop(0,'rgba(0,0,0,0)');
  scan.addColorStop(.5,rgba(A,.055));
  scan.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=scan;c.fillRect(x,sy-80,w,160);
  c.fillStyle=rgba(A,.12);c.fillRect(x,sy,w,1);

  // side brackets / ticks
  c.strokeStyle=rgba(A,.22);
  const tick=(game.clock*40)%26;
  for(let yy=-26+tick;yy<V.h;yy+=26){
    if(yy<0)continue;
    c.beginPath();c.moveTo(x-6,yy);c.lineTo(x-1,yy);c.moveTo(x+w+1,yy);c.lineTo(x+w+6,yy);c.stroke();
  }
}

function drawHoldObject(n,cx,y,ty,alpha,isFinal,bodyOnly){
  const c=sctx,hw=Math.max(14,V.laneW*.46),top=Math.min(y,ty),bottom=Math.max(y,ty),bh=bottom-top;
  const failed=!!n.holdFailed,SK=getNoteSkin(),H=SK.hold;
  const edgeC=failed?'rgba(150,155,158,.45)':(isFinal?'rgba(255,244,205,.85)':H.edge);
  const capShape=SK.classic?'round':(SK.shape==='ring'?'round':SK.shape);
  c.save();
  c.globalAlpha=failed?Math.min(alpha,.38):alpha*.96;
  // 玻璃长条本体：默认皮肤就是原来那块黑玻璃，只是把亮度抬了一点点
  const bodyGrad=c.createLinearGradient(0,top,0,bottom);
  bodyGrad.addColorStop(0,H.body[0]);
  bodyGrad.addColorStop(.45,H.body[1]);
  bodyGrad.addColorStop(1,H.body[2]);
  c.fillStyle=bodyGrad;c.fillRect(cx-hw,top,hw*2,bh);
  c.strokeStyle=edgeC;
  c.lineWidth=2;c.shadowBlur=PERF_LITE?0:(failed?0:12);c.shadowColor=failed?'transparent':(isFinal?'rgba(255,220,150,.7)':'rgba(34,228,255,.7)');
  c.beginPath();c.moveTo(cx-hw+1,top);c.lineTo(cx-hw+1,bottom);c.moveTo(cx+hw-1,top);c.lineTo(cx+hw-1,bottom);c.stroke();
  c.shadowBlur=0;
  // central ion rail
  c.strokeStyle=failed?'rgba(170,170,170,.25)':(isFinal?'rgba(255,250,220,.8)':'rgba(170,250,255,.72)');
  c.lineWidth=1;c.beginPath();c.moveTo(cx,top+3);c.lineTo(cx,bottom-2);c.stroke();
  if(bodyOnly&&!failed){
    const pulse=.5+.5*Math.sin(game.clock*14+n.lane);
    c.shadowBlur=PERF_LITE?0:18;c.shadowColor='rgba(34,228,255,.75)';
    c.strokeStyle='rgba(150,248,255,'+(.28+pulse*.22).toFixed(3)+')';c.lineWidth=2;
    c.strokeRect(cx-hw+2,top+1,hw*2-4,Math.max(0,bh-2));
    const hg=c.createRadialGradient(cx,bottom,0,cx,bottom,Math.max(24,hw*1.2));
    hg.addColorStop(0,'rgba(190,255,255,'+(.13+pulse*.10).toFixed(3)+')');hg.addColorStop(1,'rgba(34,228,255,0)');
    c.fillStyle=hg;c.fillRect(cx-hw*1.3,bottom-18,hw*2.6,36);
    // persistent hit ring at the judgment edge
    c.strokeStyle='rgba(190,255,255,'+(.38+pulse*.28).toFixed(3)+')';c.lineWidth=2;
    c.beginPath();c.ellipse(cx,V.judgeY-3,hw*(.78+pulse*.06),7+pulse*2,0,0,Math.PI*2);c.stroke();
    c.fillStyle='rgba(190,255,255,'+(.10+pulse*.06).toFixed(3)+')';
    c.beginPath();c.ellipse(cx,V.judgeY-3,hw*.72,5,0,0,Math.PI*2);c.fill();
    c.shadowBlur=0;
  }
  // glass scan lines
  c.strokeStyle=failed?'rgba(180,180,180,.05)':'rgba(150,245,255,.10)';
  c.lineWidth=1;
  for(let yy=top+7;yy<bottom-2;yy+=7){c.beginPath();c.moveTo(cx-hw+3,yy);c.lineTo(cx+hw-3,yy);c.stroke();}
  // cyan tail line
  if(ty>0&&ty<V.h){
    c.fillStyle=failed?'rgba(170,170,170,.4)':'rgba(140,248,255,.55)';
    c.fillRect(cx-hw,ty-1,hw*2,3);
  }
  if(!bodyOnly&&y>-40&&y<V.h+40){
    const capH=Math.max(8,V.noteH*.72),capW=hw*1.03;
    const cap=c.createLinearGradient(0,y-capH/2,0,y+capH/2);
    cap.addColorStop(0,'#f4ffff');
    cap.addColorStop(.45,failed?'#8a8a8a':(isFinal?'#fff1c4':H.cap[1]));
    cap.addColorStop(1,failed?'#555':(isFinal?'#148eb0':H.cap[2]));
    c.fillStyle=cap;
    c.shadowBlur=PERF_LITE?0:(failed?0:20);c.shadowColor=failed?'transparent':(isFinal?'rgba(255,220,140,.85)':'rgba(34,228,255,.85)');
    if(SK.classic){c.fillRect(cx-capW,y-capH/2,capW*2,capH);}
    else{shapePath(c,cx-capW,y-capH/2,capW*2,capH,capShape);c.fill();}
    c.shadowBlur=0;
    c.fillStyle=failed?'rgba(200,200,200,.6)':'rgba(255,255,255,.95)';
    c.fillRect(cx-capW+3,y-1,capW*2-6,2);
    // 多押提示：长条底部金色边框 + 向上淡出
    if(!failed&&(n.is_chord||n.is_multi)){
      const headY=y+capH/2+1,fadeH=Math.min(160,Math.max(28,bh*.22));
      const gg=c.createLinearGradient(0,headY-fadeH,0,headY);
      gg.addColorStop(0,'rgba(255,209,102,0)');
      gg.addColorStop(.55,'rgba(255,209,102,.22)');
      gg.addColorStop(1,'rgba(255,209,102,.72)');
      c.fillStyle=gg;c.fillRect(cx-hw-3,headY-fadeH,hw*2+6,fadeH);
      c.strokeStyle='#ffd166';c.lineWidth=1.6;c.lineCap='round';c.lineJoin='round';
      c.shadowBlur=PERF_LITE?0:10;c.shadowColor='rgba(255,196,32,.7)';
      c.beginPath();
      c.moveTo(cx-hw-4,headY);c.lineTo(cx+hw+4,headY);
      c.moveTo(cx-hw-4,headY-5);c.lineTo(cx-hw-4,headY+3);
      c.moveTo(cx+hw+4,headY-5);c.lineTo(cx+hw+4,headY+3);
      c.stroke();c.shadowBlur=0;
    }
  }
  c.restore();
}
function drawNotes(){
  const c=sctx,t=game.clock;
  c.save();
  c.beginPath();c.rect(V.x-70,0,V.trackW+140,V.judgeY);c.clip();
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.perform){
      if(t<93.45||t>95.55)continue;
      const cx=V.x+n.lane*V.laneW+V.laneW/2;
      const bob=Math.sin(t*5.2+n.lane)*10;
      const y=V.judgeY-V.h*.17+bob;
      const sp=spr.break;if(!sp)continue;
      c.save();c.globalAlpha=.88;c.shadowBlur=PERF_LITE?0:22;c.shadowColor='rgba(255,207,106,.8)';
      c.drawImage(sp.c,cx-sp.w*.34,y-sp.h*.34,sp.w*.68,sp.h*.68);c.restore();
      continue;
    }
    const heldTail=n.type==='hold'&&n.judged&&n.headHit&&n.end>t;
    const holdGhost=n.type==='hold'&&n.judged&&!n.headHit&&n.holdFailed&&n.end>t;
    if(n.judged&&!heldTail&&!holdGhost)continue;
    if(holdGhost){
      const y=V.judgeY-(n.time-t)*V.scrollSpeed;
      const ty=V.judgeY-(n.end-t)*V.scrollSpeed;
      const cx=V.x+n.lane*V.laneW+V.laneW/2;
      drawHoldObject(n,cx,y,ty,.38,false,true);
      continue;
    }
    if(heldTail){
      const y=V.judgeY-(n.time-t)*V.scrollSpeed;
      const ty=V.judgeY-(n.end-t)*V.scrollSpeed;
      const cx=V.x+n.lane*V.laneW+V.laneW/2;
      drawHoldObject(n,cx,y,ty,.82,false,true);
      continue;
    }
    const y=V.judgeY-(n.time-t)*V.scrollSpeed;
    if(y<-160||y>V.h+120)continue;
    const progress=clamp((y+V.noteH)/(V.judgeY+V.noteH),0,1);
    const smooth=easeOutQuad(Math.min(1,progress/.6));
    const sx=V.x+n.startLane*V.laneW+V.laneW/2;
    const ex=V.x+n.lane*V.laneW+V.laneW/2;
    const cx=lerp(sx,ex,smooth);
    const alpha=clamp((y+90)/160,0,1);
    // 终结键（白色外观 + 头顶 16 层光柱残影）已移除：结尾那组键和其它键一样画，音符本身保留。
    if(n.type==='hold'){
      const ty=V.judgeY-(n.end-t)*V.scrollSpeed;
      drawHoldObject(n,cx,y,ty,alpha,false,false);
      continue;
    }
    const sp=n.type==='break'?spr.break:(n.is_multi?spr.multi:(n.is_chord?spr.chord:spr.note));
    if(!sp)continue;
    c.globalAlpha=alpha;
    const tw=V.laneW*.58;
    for(let k=1;k<=3;k++){
      c.globalAlpha=alpha*.12/k;
      c.fillStyle='#6fe6ff';
      c.fillRect(cx-tw/2,y-k*V.noteH*.95,tw,V.noteH*.62);
    }
    c.globalAlpha=alpha;
    if(n.startLane!==n.lane&&y>0){
      c.save();c.setLineDash([5,9]);c.strokeStyle='rgba(255,207,106,'+(.22*alpha)+')';c.lineWidth=1;
      c.beginPath();c.moveTo(ex,y);c.lineTo(ex,V.judgeY+8);c.stroke();c.restore();
    }
    c.drawImage(sp.c,cx-sp.w/2,y-sp.h/2,sp.w,sp.h);
    c.globalAlpha=1;
  }
  c.restore();
}

function drawTopFade(){
  const c=sctx;
  const fg=c.createLinearGradient(0,0,0,V.h*.18);
  fg.addColorStop(0,'rgba(3,7,14,.96)');fg.addColorStop(1,'rgba(3,7,14,0)');
  c.fillStyle=fg;c.fillRect(0,0,V.w,V.h*.18);
}

function drawHitLine(){
  const c=sctx,x=V.x,w=V.trackW,y=V.judgeY;
  const glow=game.judgeLineGlow,pulse=game.bpmPulse;
  const h=6+glow*12+pulse*3;
  const gg=c.createLinearGradient(0,y-h,0,y+h);
  gg.addColorStop(0,'rgba(34,228,255,0)');
  gg.addColorStop(.5,'rgba(110,235,255,'+(.24+glow*.44).toFixed(3)+')');
  gg.addColorStop(1,'rgba(34,228,255,0)');
  c.fillStyle=gg;c.fillRect(x-w*.05,y-h,w*1.1,h*2);

  c.save();c.globalCompositeOperation='lighter';
  c.strokeStyle='rgba(120,240,255,'+(.24+glow*.4).toFixed(3)+')';c.lineWidth=1.4;
  c.beginPath();
  for(let px=0;px<=w;px+=5){
    const wy=y+Math.sin(px*.035+game.clock*7)*1.6*(.4+pulse)+Math.sin(px*.011-game.clock*3)*1.2;
    if(px===0)c.moveTo(x+px,wy);else c.lineTo(x+px,wy);
  }
  c.stroke();
  c.strokeStyle='rgba(143,108,255,'+(.14+glow*.16).toFixed(3)+')';
  c.beginPath();
  for(let px=0;px<=w;px+=5){
    const wy=y+2+Math.sin(px*.035+game.clock*7+1.2)*2.1*(.35+pulse);
    if(px===0)c.moveTo(x+px,wy);else c.lineTo(x+px,wy);
  }
  c.stroke();
  c.restore();

  c.fillStyle='rgba(240,253,255,'+(.86+glow*.14).toFixed(3)+')';
  c.fillRect(x,y-1.5,w,3);
  c.fillStyle='rgba(255,255,255,.9)';c.fillRect(x+w/2-28,y-1,56,2);

  c.strokeStyle='rgba(34,228,255,'+(.25+glow*.3).toFixed(3)+')';c.lineWidth=1;
  c.beginPath();c.moveTo(x-w*.16,y);c.lineTo(x-6,y);c.moveTo(x+w+6,y);c.lineTo(x+w*1.16,y);c.stroke();

  // travelling ticks
  for(let i=0;i<16;i++){
    const px=((game.clock*110+i*w/16)%w+w)%w;
    c.fillStyle='rgba(160,245,255,'+(.14+glow*.2)+')';
    c.fillRect(x+px,y-2.5,1.2,5);
  }
}

function drawReceptors(){
  const c=sctx,y=V.judgeY;
  /* 原实现的每条轨道都会把 game.notes 整个扫一遍找"最近的未判定音符"，
     四轨 × 1300+ 音符 = 每帧五千多次循环，长条一多主线程就被拖住
     （实测按住长条时 touchmove 的 gap 会飙到 300ms+，表现为迟判定）。
     改成只扫一个窗口：从 lanePtr 附近找一个起点，超过 0.45s 的未来就停。 */
  for(let i=0;i<4;i++){
    const cx=V.x+i*V.laneW+V.laneW/2;
    const flash=game.laneFlash[i],hold=game.keyHold[i]?1:0;
    let near=null;
    const start=Math.max(0,(game.lanePtr[i]||0)-2);
    for(let k=start;k<game.notes.length;k++){
      const n=game.notes[k];
      if(n.lane!==i||n.judged)continue;
      const d=n.time-game.clock;
      if(d>.45)break;                 // 后面的更远，直接停
      if(d>0&&(!near||d<near))near=d;
    }
    if(near!==null){
      const k=1-near/.45;
      c.save();c.globalCompositeOperation='lighter';
      c.strokeStyle='rgba(120,240,255,'+((1-k)*.4).toFixed(3)+')';
      c.lineWidth=1;
      c.beginPath();c.arc(cx,y,6+k*20,0,Math.PI*2);c.stroke();
      c.restore();
    }
    const a=.2+flash*.5+hold*.25;
    c.fillStyle='rgba(34,228,255,'+Math.min(.95,a)+')';
    c.beginPath();c.moveTo(cx,y+12);c.lineTo(cx+7,y+19);c.lineTo(cx-7,y+19);c.closePath();c.fill();
    if(!V.portrait){
      c.font='500 10px '+FONT_M;c.textAlign='center';c.textBaseline='middle';
      c.fillStyle='rgba(160,215,240,'+(.4+flash*.4)+')';
      c.fillText(KEYS[i].toUpperCase(),cx,y+35);
    }
  }
}

function drawFx(){
  const c=sctx;
  c.save();c.globalCompositeOperation='lighter';
  for(let i=0;i<game.effects.length;i++){
    const e=game.effects[i],p=1-e.life/e.max;
    if(e.k==='ring'){
      const base=V.laneW*.88;
      const s=base*(.4+easeOutQuint(p)*.95);
      const a=Math.pow(1-p,1.35);
      c.globalAlpha=a*.92;c.drawImage(spr.ring.c,e.x-s/2,e.y-s/2,s,s);
    }else if(e.k==='spark'){
      c.globalAlpha=Math.pow(1-p,1.5);c.fillStyle=e.color;
      const s=e.size*(1-p*.4);c.fillRect(e.x-s/2,e.y-s/2,s,s);
    }else if(e.k==='beam'){
      const lx=V.x+e.lane*V.laneW,a=Math.pow(1-p,1.2);
      const bg=c.createLinearGradient(0,V.judgeY,0,V.h);
      bg.addColorStop(0,e.type===0?'rgba(120,240,255,'+(.28*a)+')':'rgba(120,180,255,'+(.18*a)+')');
      bg.addColorStop(1,'rgba(0,0,0,0)');
      c.globalAlpha=1;c.fillStyle=bg;c.fillRect(lx+2,V.judgeY,V.laneW-4,V.h-V.judgeY);
    }else if(e.k==='wave'){
      const span=V.laneW*(.35+p*.75),a=Math.pow(1-p,1.7);
      const wg=c.createLinearGradient(e.x-span,0,e.x+span,0);
      wg.addColorStop(0,'rgba(0,0,0,0)');
      wg.addColorStop(.5,e.type===0?'rgba(190,250,255,'+(a*.75)+')':'rgba(120,170,255,'+(a*.45)+')');
      wg.addColorStop(1,'rgba(0,0,0,0)');
      c.globalAlpha=1;c.fillStyle=wg;c.fillRect(e.x-span,e.y-1.2,span*2,2.4);
    }
  }
  c.restore();c.globalAlpha=1;
}

function drawBottomMeta(){
  if(V.h<620)return;
  const c=sctx,y=V.h-20;
  c.save();
  c.font='500 9px '+FONT_M;c.textBaseline='middle';
  c.textAlign='left';c.fillStyle='rgba(120,170,200,.3)';
  c.fillText('4 LANES   ·   '+sessionLabel(selectedSong),V.x,y);
  c.textAlign='right';c.fillText('SYNC '+settings.speed.toFixed(2)+'×',V.x+V.trackW,y);
  c.restore();
}

function drawCombo(){
  if(game.combo<=2||state==='RESULT')return;
  const c=sctx,isAP=game.good===0&&game.bad===0&&game.miss===0,isFC=game.miss===0&&game.bad===0;
  const size=clamp(V.h*.075,30,74)*game.comboScale;
  const cx=V.w/2,cy=V.h*(V.portrait?0.25:0.22);
  const txt=String(game.combo);
  c.save();c.translate(cx,cy);c.textAlign='center';c.textBaseline='middle';
  c.font='700 '+size.toFixed(1)+'px '+FONT_D;
  const tw=Math.min(c.measureText(txt).width,size*3.2);
  let fill;
  if(isAP){fill=c.createLinearGradient(-tw/2,0,tw/2,0);fill.addColorStop(0,'#ffcf5a');fill.addColorStop(.45,'#fff3c4');fill.addColorStop(1,'#ff9f43');}
  else if(isFC){fill=c.createLinearGradient(-tw/2,0,tw/2,0);fill.addColorStop(0,'#d3b3ff');fill.addColorStop(1,'#6fe6ff');}
  else fill='#eefcff';
  c.fillStyle=fill;c.fillText(txt,0,0);
  c.font='500 '+clamp(size*.19,9,15).toFixed(1)+'px '+FONT_M;
  c.fillStyle='rgba(160,202,226,.72)';c.fillText('C O M B O',0,size*.62);
  c.fillStyle=isAP?'rgba(255,207,90,.6)':'rgba(110,230,255,.45)';
  c.fillRect(-tw*.32,size*.85,tw*.64,1);
  c.restore();
}

function drawJudgement(){
  if(game.feedbackTimer<=0)return;
  const c=sctx,a=Math.min(1,game.feedbackTimer*4),y=V.judgeY-150-feedbackYOffset;
  const size=clamp(V.h*.042,20,34);
  const colors={P:'#ffd75e',G:'#7fb8ff',B:'#b00024',M:'#ff6b8f'};
  const col=colors[game.feedbackType]||'#fff';
  const isP=game.feedbackType==='P',isB=game.feedbackType==='B';
  const chromaA=isP?'rgba(255,168,36,.42)':(isB?'rgba(110,0,18,.55)':'rgba(255,46,110,.45)');
  const chromaB=isP?'rgba(255,246,198,.42)':(isB?'rgba(255,44,76,.32)':'rgba(34,228,255,.45)');
  c.save();c.globalAlpha=a;c.textAlign='center';c.textBaseline='middle';
  c.font='700 '+size.toFixed(1)+'px '+FONT_D;
  if('letterSpacing' in c)c.letterSpacing='4px';
  c.fillStyle=chromaA;c.fillText(game.feedback,V.w/2-2.5,y);
  c.fillStyle=chromaB;c.fillText(game.feedback,V.w/2+2.5,y-1);
  c.fillStyle=col;c.shadowBlur=PERF_LITE?0:(isP?28:22);c.shadowColor=isP?'rgba(255,196,46,.95)':(isB?'rgba(140,0,26,.95)':col);c.fillText(game.feedback,V.w/2,y);c.shadowBlur=0;
  if('letterSpacing' in c)c.letterSpacing='0px';
  if(settings.early&&game.lastType&&game.feedbackType==='G'){
    const fast=game.lastType==='EARLY';
    c.font='600 11px '+FONT_M;
    if('letterSpacing' in c)c.letterSpacing='2px';
    c.fillStyle=fast?'rgba(120,205,255,.95)':'rgba(255,166,92,.95)';
    c.fillText(fast?'FAST':'SLOW',V.w/2,y+size*.78);
    if('letterSpacing' in c)c.letterSpacing='0px';
  }
  c.restore();
}

function drawCountdown(){
  if(state==='PAUSED'||state==='RESULT')return;
  let n=0,frac=0,label='READY';
  if(resumeCountdown>0){n=Math.ceil(resumeCountdown);frac=resumeCountdown-Math.floor(resumeCountdown);label='RESUME';}
  else if(state==='GAME'&&game.clock<0){n=Math.ceil(-game.clock);frac=(-game.clock)-Math.floor(-game.clock);}
  if(n<1||n>3)return;
  const c=sctx,cx=V.w/2,cy=V.h*.45,R=Math.min(V.w,V.h)*.075,pop=.82+frac*.26;
  c.save();c.textAlign='center';c.textBaseline='middle';
  c.globalAlpha=.18;c.strokeStyle='#22e4ff';c.lineWidth=1.5;c.beginPath();c.arc(cx,cy,R*1.55,0,Math.PI*2);c.stroke();
  c.globalAlpha=.9;c.strokeStyle='#22e4ff';c.lineWidth=3;c.shadowBlur=PERF_LITE?0:26;c.shadowColor='#22e4ff';
  c.beginPath();c.arc(cx,cy,R*1.55,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-frac,0,1));c.stroke();c.shadowBlur=0;
  c.globalAlpha=.55;c.fillStyle='rgba(255,46,110,.55)';c.font='700 '+(R*2.5*pop).toFixed(1)+'px '+FONT_D;c.fillText(String(n),cx-2.5,cy+1);
  c.fillStyle='rgba(34,228,255,.75)';c.fillText(String(n),cx+2.5,cy-1);
  c.globalAlpha=1;c.fillStyle='#eaffff';c.shadowBlur=PERF_LITE?0:24;c.shadowColor='rgba(34,228,255,.8)';c.fillText(String(n),cx,cy);c.shadowBlur=0;
  c.font='500 9px '+FONT_M;c.fillStyle='rgba(150,200,228,.8)';
  if('letterSpacing' in c)c.letterSpacing='6px';
  c.fillText(label,cx,cy+R*1.55+22);
  if('letterSpacing' in c)c.letterSpacing='0px';
  c.restore();
}

/* ============================================================
   16b. EFFULGENCE stage light / dark / blade / tech effects
   ============================================================ */
function effAudioTime(){return game.clock-MUSIC_DELAY;}
function effLightLevel(){
  const t=effAudioTime();
  if(t<0)return 0;
  if(t<10)return t/10;
  if(t<31)return 1;
  if(t<32)return 1-(t-31);
  return 0;
}
function drawFog(){
  if(!selectedSong||selectedSong.chart!=='effulgence')return;
  const c=sctx,t=effAudioTime();
  let fog=0;
  if(t<31)fog=.56;
  else if(t<34)fog=.56*(1-clamp((t-32)/2,0,1));
  else if(t>=140&&t<160)fog=.80*clamp((t-140)/20,0,1);
  else if(t>=160)fog=.80;
  if(fog<=0)return;
  const g=c.createRadialGradient(V.w/2,V.h*.5,V.h*.1,V.w/2,V.h*.5,Math.hypot(V.w,V.h)*.68);
  g.addColorStop(0,'rgba(0,3,7,'+(fog*.42).toFixed(3)+')');
  g.addColorStop(.62,'rgba(0,3,7,'+(fog*.78).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,2,5,'+fog.toFixed(3)+')');
  c.fillStyle=g;c.fillRect(0,0,V.w,V.h);
}
/* CORRUPTED ENTITY exclusive FX — never drawn for other charts. */
function corrFogLevel(mt){
  let l=0,full=false;
  if(mt<5)l=Math.max(l,.9*(mt<0?1:1-clamp(mt/5,0,1)));
  if(mt>=80&&mt<96)l=Math.max(l,.35*fxEnv(mt,80,96,2));
  if(mt>=160){l=Math.max(l,Math.min(1,.42+.58*clamp((mt-160)/3,0,1)));full=true;}
  return {l,full};
}
function drawCorrFog(){
  const mt=game.clock-MUSIC_DELAY;
  const {l,full}=corrFogLevel(mt);
  if(l<=.01)return;
  const c=sctx;
  const bandL=V.x+V.laneW,bandR=V.x+3*V.laneW;
  c.save();
  let g=c.createLinearGradient(0,0,bandL,0);
  g.addColorStop(0,'rgba(0,0,0,'+l.toFixed(3)+')');
  g.addColorStop(.7,'rgba(0,0,0,'+(l*.55).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,0,0,'+(l*.12).toFixed(3)+')');
  c.fillStyle=g;c.fillRect(0,0,bandL,V.h);
  g=c.createLinearGradient(V.w,0,bandR,0);
  g.addColorStop(0,'rgba(0,0,0,'+l.toFixed(3)+')');
  g.addColorStop(.7,'rgba(0,0,0,'+(l*.55).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,0,0,'+(l*.12).toFixed(3)+')');
  c.fillStyle=g;c.fillRect(bandR,0,V.w-bandR,V.h);
  const t=game.clock;
  for(let i=0;i<5;i++){
    const yy=(i*97+t*12)%V.h;
    const xx=(i%2?V.x*.3:V.w-V.x*.3);
    const r=Math.max(60,Math.min(V.w,V.h)*.22);
    const rg=c.createRadialGradient(xx,yy,0,xx,yy,r);
    rg.addColorStop(0,'rgba(0,0,0,'+(l*.6).toFixed(3)+')');rg.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=rg;c.fillRect(0,0,V.w,V.h);
  }
  g=c.createLinearGradient(0,0,0,V.h*.18);
  g.addColorStop(0,'rgba(0,0,0,'+(l*.8).toFixed(3)+')');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;c.fillRect(0,0,V.w,V.h*.18);
  g=c.createLinearGradient(0,V.h,0,V.h*.82);
  g.addColorStop(0,'rgba(0,0,0,'+(l*.8).toFixed(3)+')');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;c.fillRect(0,V.h*.82,V.w,V.h*.18);
  c.restore();
}
const CORR_GLYPH='█▓▒░#%&@$XYZ0123456789αβγΔΦΨ01';
function drawCorrGlitch(){
  const mt=game.clock-MUSIC_DELAY;
  if(mt<160)return;
  const l=Math.min(1,.42+.58*clamp((mt-160)/3,0,1));
  const n=Math.min(64,Math.floor((mt-160)*9)+3);
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+(l*.55).toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  for(let i=0;i<n;i++){
    const x=Math.random()*V.w;
    const y=Math.random()*V.h;
    const sz=8+Math.random()*22;
    c.font='700 '+sz.toFixed(0)+'px '+FONT_M;
    c.fillStyle=Math.random()<.35?'rgba(255,70,110,'+(.12+Math.random()*.3).toFixed(3)+')':'rgba(180,240,255,'+(.10+Math.random()*.3).toFixed(3)+')';
    c.fillText(CORR_GLYPH[(Math.random()*CORR_GLYPH.length)|0],x,y);
  }
  c.restore();
}
/* STILL (piano version) exclusive FX — never drawn for other charts. */
function stillWaveAmp(mt){
  if(mt<1||mt>23)return 0;
  return fxEnv(mt,1,23,1.5);
}
function stillFogLevel(mt){
  let f=0;
  if(mt>=23&&mt<45)f=.7*((mt-23)/22);
  else if(mt>=45&&mt<46)f=.7;
  else if(mt>=46&&mt<48)f=.7*(1-(mt-46)/2);
  else if(mt>=66&&mt<75)f=.85*clamp((mt-66)/.3,0,1);
  else if(mt>=75&&mt<76.2)f=.85*(1-(mt-75)/1.2);
  return f;
}
function drawStillFog(){
  const mt=game.clock-MUSIC_DELAY;
  const f=stillFogLevel(mt);
  if(f<=.01)return;
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+f.toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  c.restore();
}
function drawStillRays(){
  const mt=game.clock-MUSIC_DELAY;
  if(mt<76||mt>90)return;
  const env=fxEnv(mt,76,90,2);
  if(env<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
  // dawn glow across the top edge — the light source
  const tg=c.createRadialGradient(w/2,-h*.08,0,w/2,-h*.08,h*.6);
  tg.addColorStop(0,'rgba(210,242,255,.30)');
  tg.addColorStop(.45,'rgba(150,215,255,.12)');
  tg.addColorStop(1,'rgba(150,215,255,0)');
  c.fillStyle=tg;c.fillRect(0,0,w,h*.66);
  // volumetric shafts: stretched soft light-teardrops, gently swaying — no hard edges
  const n=5;
  for(let i=0;i<n;i++){
    const f=i/(n-1);
    const x0=w*(.15+f*.7)+Math.sin(mt*.42+i*2.1)*w*.022;
    const bw=w*.11*(.8+.25*Math.sin(mt*.33+i*1.4));
    const len=h*(.5+.22*Math.sin(mt*.37+i*2.6));
    const sway=Math.sin(mt*.3+i*1.7)*.06;
    c.save();
    c.translate(x0,0);
    c.rotate(sway);
    c.scale(1,Math.max(.01,len/Math.max(1,bw*2)));
    const rg=c.createRadialGradient(0,0,0,0,0,bw*2);
    rg.addColorStop(0,'rgba(228,247,255,'+(.2+.07*Math.sin(mt*.8+i)).toFixed(3)+')');
    rg.addColorStop(.55,'rgba(170,225,255,'+(.1+.05*Math.sin(mt*.6+i*2)).toFixed(3)+')');
    rg.addColorStop(1,'rgba(170,225,255,0)');
    c.fillStyle=rg;
    c.fillRect(-bw*2,0,bw*4,bw*2);
    c.restore();
  }
  // drifting light motes inside the beams
  for(let k=0;k<16;k++){
    const px=w*.08+((k*137+mt*8)%(w*.84));
    const py=((k*83+mt*13)%(h*.6));
    c.fillStyle='rgba(225,246,255,'+(.06+.1*Math.sin(mt*2+k)).toFixed(3)+')';
    c.fillRect(px,py,1.3,1.3);
  }
  c.restore();
}
/* LTZZ (テリトリーバトル) exclusive FX — water sway + noble light, never drawn for other charts. */
function ltzzWaterAmp(mt){
  if(mt<19.714||mt>27)return 0;
  return fxEnv(mt,19.714,27,1.0);
}
/* 软光点：径向渐变的小圆（pen / ltzz / init 共用），替代硬方块光尘。 */
function fxGlowDot(c,x,y,r,inner){
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,inner);
  g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
/* 上帝光：从 (cx,cy) 沿 ang 方向铺开的锥形柔光，近端收窄、远端散开，无硬边。 */
function fxGodRay(c,cx,cy,len,spread,ang,colA,colB){
  c.save();c.translate(cx,cy);c.rotate(ang);
  const g=c.createLinearGradient(0,0,len,0);
  g.addColorStop(0,colA);
  g.addColorStop(1,colB);
  c.fillStyle=g;
  c.beginPath();
  c.moveTo(0,-spread*.14);
  c.quadraticCurveTo(len*.5,-spread,len,-spread);
  c.lineTo(len,spread);
  c.quadraticCurveTo(len*.5,spread,0,spread*.14);
  c.closePath();c.fill();
  c.restore();
}
function drawLtzzNobleLight(){
  const mt=game.clock-MUSIC_DELAY;
  if(mt<30||mt>36)return;
  const env=fxEnv(mt,30,36,1.3);
  if(env<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
  const cx=w*.5,cy=h*.54;
  // 中央暖金核心：双层径向光晕，纯渐变不叠块（整体再放大一圈）
  const core=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.84);
  core.addColorStop(0,'rgba(255,242,200,.30)');
  core.addColorStop(.34,'rgba(255,212,130,.13)');
  core.addColorStop(.66,'rgba(255,196,120,.05)');
  core.addColorStop(1,'rgba(255,196,120,0)');
  c.fillStyle=core;c.fillRect(0,0,w,h);
  const flare=c.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*.64);
  flare.addColorStop(0,'rgba(255,250,230,.32)');
  flare.addColorStop(.28,'rgba(255,232,172,.11)');
  flare.addColorStop(1,'rgba(255,232,172,0)');
  c.fillStyle=flare;c.fillRect(0,0,w,h);
  // 高贵光「冠冕」：向上、左右对称展开的柔光扇——与 pen 的冷白下坠光柱方向/色相都相反
  const n=V.lowFx?6:11;
  for(let i=0;i<n;i++){
    const f=i/(n-1)-.5;
    const ang=-Math.PI/2+f*1.9+Math.sin(mt*.22+i*2.3)*.02;
    const len=Math.min(w,h)*(.58+.14*Math.sin(mt*.34+i*1.7));
    const spread=V.laneW*(.52+.12*Math.sin(mt*.26+i*2.1));
    const baseX=cx+Math.sin(mt*.2+i*2.4)*w*.012;
    fxGodRay(c,baseX,cy,len,spread,ang,
      'rgba(255,206,120,.16)',
      'rgba(255,200,112,0)');
    // 光束中心亮芯
    c.save();c.translate(baseX,cy);c.rotate(ang);
    const cc=c.createLinearGradient(0,0,len,0);
    cc.addColorStop(0,'rgba(255,246,208,.20)');
    cc.addColorStop(.55,'rgba(255,228,160,.055)');
    cc.addColorStop(1,'rgba(255,228,160,0)');
    c.fillStyle=cc;
    c.beginPath();c.moveTo(0,-spread*.05);c.lineTo(len,-spread*.36);c.lineTo(len,spread*.36);c.lineTo(0,spread*.05);c.closePath();c.fill();
    c.restore();
  }
  // 上升的金色光尘：圆形柔光点，不是方块
  const dust=V.lowFx?16:30;
  for(let k=0;k<dust;k++){
    const px=cx+(((k*137)%100)/100-.5)*w*.90+Math.sin(mt*.5+k*1.3)*7;
    const py=h*.80-((k*83+mt*24)%(h*.64));
    const tw=.4+.6*Math.sin(mt*1.6+k*1.7);
    const rr=1.2+((k*7)%3)*.9;
    fxGlowDot(c,px,py,rr*2.4,'rgba(255,244,214,'+(.12+.16*tw).toFixed(3)+')');
  }
  // 底部一条优雅的金色地平线光带
  const band=c.createLinearGradient(0,h*.72,0,h*.94);
  band.addColorStop(0,'rgba(255,226,150,0)');
  band.addColorStop(.5,'rgba(255,226,150,'+(.12+.04*Math.sin(mt*1.1)).toFixed(3)+')');
  band.addColorStop(1,'rgba(255,226,150,0)');
  c.fillStyle=band;c.fillRect(0,h*.72,w,h*.22);
  c.restore();
}
/* LTZZ 尾杀黑雾 — 最后一组双押长条一按住，黑雾就从判定线往上漫过铺面，
   长条到尾判的那一刻整块屏幕吃黑（完全盖住）。
   起止时间不写死：直接取谱面里最晚结束的那根长条，以后改 .qua 也不会错位。 */
const LTZZ_END_FOG={start:0,end:0,ready:false};
function ltzzEndFogWindow(){
  if(LTZZ_END_FOG.ready)return LTZZ_END_FOG;
  let start=Infinity,end=0;
  if(selectedSong&&selectedSong.chart==='ltzz'){
    for(let i=0;i<game.notes.length;i++){
      const n=game.notes[i];
      if(n.type!=='hold')continue;
      const tail=Math.max(n.end||0,n.time);
      if(tail>end){end=tail;start=n.time;}
    }
  }
  LTZZ_END_FOG.ready=end>0;
  LTZZ_END_FOG.start=end>0?start-MUSIC_DELAY:0;
  LTZZ_END_FOG.end=end>0?end-MUSIC_DELAY:0;
  return LTZZ_END_FOG;
}
function ltzzEndFogProgress(mt){
  const w=ltzzEndFogWindow();
  if(!w.ready)return 0;
  const span=Math.max(.25,w.end-w.start);
  return clamp((mt-w.start)/span,0,1);
}
function drawLtzzEndFog(){
  if(!selectedSong||selectedSong.chart!=='ltzz')return;
  const p=ltzzEndFogProgress(game.clock-MUSIC_DELAY);
  if(p<=.002)return;
  const c=sctx,h=V.h,x=V.x,tw=V.trackW;
  // 铺面里的雾：整体先压暗（判定线那侧最厚，往上淡出去），
  // 再叠三道从底下慢慢漫上来的雾带，让「涨」这件事看得出来
  const d=Math.pow(p,1.35)*.85;
  const mt=game.clock-MUSIC_DELAY;
  c.save();
  c.beginPath();c.rect(x,0,tw,h);c.clip();
  const g=c.createLinearGradient(0,V.judgeY,0,0);
  g.addColorStop(0,'rgba(0,0,0,'+Math.min(1,d).toFixed(3)+')');
  g.addColorStop(.5,'rgba(0,0,0,'+Math.min(1,d*.6).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,0,0,'+Math.min(1,d*.18).toFixed(3)+')');
  c.fillStyle=g;c.fillRect(x,0,tw,h);
  const edge0=V.judgeY-(V.judgeY+h*.3)*Math.min(1,p*1.1);
  const bands=V.lowFx?2:3;
  for(let i=0;i<bands;i++){
    const e=edge0+(i-1)*h*.06*Math.sin(mt*.6+i*1.9);
    const y0=Math.max(0,e-h*.06);
    const bg=c.createLinearGradient(0,y0,0,y0+h*.24);
    const a=Math.min(1,d*(i?.72:.95));
    bg.addColorStop(0,'rgba(0,0,0,0)');
    bg.addColorStop(1,'rgba(0,0,0,'+a.toFixed(3)+')');
    c.fillStyle=bg;c.fillRect(x,y0,tw,h);
  }
  c.restore();
}
/* 收尾那一下：黑雾越过铺面边界，把整块屏幕（连 UI 一起）吃掉 */
function drawLtzzEndFogVeil(){
  if(!selectedSong||selectedSong.chart!=='ltzz')return;
  const p=ltzzEndFogProgress(game.clock-MUSIC_DELAY);
  const s=clamp((p-.55)/.45,0,1);
  if(s<=.002)return;
  const v=s*s*(3-2*s);
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+v.toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  c.restore();
}
/* W. (prologue) exclusive FX — black fog + corruption, never drawn for other charts. */
function wFogLevel(mt){
  let f=0;
  if(mt>=25&&mt<31)f=.70*clamp((mt-25)/.35,0,1);
  else if(mt>=31&&mt<32)f=.70*(1-(mt-31));
  if(mt>=56)f=Math.max(f,.75);
  if(mt>=73)f=Math.max(f,.75+.15*Math.min(1,(mt-73)/9));
  return f;
}
function drawWFog(){
  const mt=game.clock-MUSIC_DELAY;
  const f=wFogLevel(mt);
  if(f<=.01)return;
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+f.toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  c.restore();
}
/* W. — lamp-flicker right before the second black fog (56s): two soft flashes
   that briefly light the scene, then hand off into the darkness. Kept gentle. */
function wFlashLevel(mt){
  if(mt<55||mt>=56)return 0;
  const p=mt-55; // 0..1 within the 1s window
  const hump=c=>{const d=Math.abs(p-c)/.15;return d<1?Math.pow(Math.cos(d*Math.PI/2),1.6):0;};
  return .7*Math.max(hump(.15),hump(.65));
}
function drawWFlash(){
  const mt=game.clock-MUSIC_DELAY;
  const l=wFlashLevel(mt);
  if(l<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=l;
  c.fillStyle='rgba(188,220,255,.42)';
  c.fillRect(0,0,w,h);
  const g=c.createRadialGradient(w/2,h*.46,0,w/2,h*.46,Math.hypot(w,h)*.5);
  g.addColorStop(0,'rgba(235,248,255,.5)');
  g.addColorStop(.55,'rgba(180,220,255,.2)');
  g.addColorStop(1,'rgba(180,220,255,0)');
  c.fillStyle=g;c.fillRect(0,0,w,h);
  c.restore();
}
const W_GLYPH='█▓▒░#%&@$XYZ0123456789αβγΔΦΨ01';
function drawWGlitch(){
  const mt=game.clock-MUSIC_DELAY;
  if(mt<73)return;
  const l=Math.min(1,(mt-73)/9);
  const n=Math.min(72,Math.floor((mt-73)*8)+4);
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+(l*.35).toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  for(let i=0;i<n;i++){
    const x=Math.random()*V.w;
    const y=Math.random()*V.h;
    const sz=6+Math.random()*(14+16*l);
    c.font='700 '+sz.toFixed(0)+'px '+FONT_M;
    c.fillStyle=Math.random()<.35?'rgba(255,70,110,'+(.10+.30*l+Math.random()*.2).toFixed(3)+')':'rgba(180,240,255,'+(.08+.30*l+Math.random()*.2).toFixed(3)+')';
    c.fillText(W_GLYPH[(Math.random()*W_GLYPH.length)|0],x,y);
  }
  c.restore();
}
/* WELKIN (第一章魔王曲) exclusive FX — never drawn for other charts. */
function welkinFogLevel(mt){
  // 倒计时结束(约-0.3s)快速淡入 80% 黑雾，第一组长条双押(1.6~1.9s)中快速淡出。
  let f=0;
  if(mt<-0.3)f=0;
  else if(mt<0)f=0.8*clamp((mt+0.3)/0.3,0,1);
  else if(mt<1.6)f=0.8;
  else if(mt<1.95)f=0.8*(1-clamp((mt-1.6)/0.35,0,1));
  return f;
}
function drawWelkinFog(){
  if(!selectedSong||selectedSong.chart!=='welkin')return;
  const f=welkinFogLevel(game.clock-MUSIC_DELAY);
  if(f<=.01)return;
  const c=sctx;
  c.save();
  c.fillStyle='rgba(0,0,0,'+f.toFixed(3)+')';
  c.fillRect(0,0,V.w,V.h);
  c.restore();
}
/* 暗角：从开场黑雾淡出后一直持续到歌曲结束，强度随时间轴变化（59s +35% / 83s +65% / 84s 恢复 / 199s +20% / 203s 恢复）。 */
function welkinVignetteLevel(mt){
  if(mt>=242.833)return 1.0;   // 最后四押长条结束 → 拉满
  if(mt<2.5)return 0;          // 开场黑雾期间不叠加暗角
  const BASE=0.55;
  if(mt<59)return BASE;
  if(mt<83)return BASE*1.35;
  if(mt<84)return BASE*1.35*1.65;
  if(mt<199)return BASE*1.35;
  if(mt<203)return BASE*1.35*1.2;
  return BASE*1.35;
}
function drawWelkinVignette(){
  if(!selectedSong||selectedSong.chart!=='welkin')return;
  const vig=welkinVignetteLevel(game.clock-MUSIC_DELAY);
  if(vig<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  const a=Math.min(1,vig);
  const inner=Math.max(0.16,0.5-vig*0.22); // vig 越大暗角越向内收
  c.save();
  const g=c.createRadialGradient(w/2,h/2,h*inner,w/2,h/2,Math.hypot(w,h)*0.56);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.55,'rgba(0,0,0,'+(a*0.18).toFixed(3)+')');
  g.addColorStop(0.82,'rgba(0,0,0,'+(a*0.62).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,0,0,'+a.toFixed(3)+')');
  c.fillStyle=g;c.fillRect(0,0,w,h);
  c.restore();
}
function welkinWaterAmp(mt){
  if(mt<110||mt>120)return 0;
  return fxEnv(mt,110,120,1.0);
}
function welkinSaturation(mt){
  if(mt<203)return 1;
  if(mt>=208)return 0.3;
  return 1-0.7*clamp((mt-203)/5,0,1);
}
/* 老浏览器不支持 canvas 的 saturation 混合模式时，退化成给 canvas 挂 CSS grayscale。 */
let welkinDesatOk=null,welkinHudDesat=-1;
function welkinBlendOk(c){
  if(welkinDesatOk!==null)return welkinDesatOk;
  const prev=c.globalCompositeOperation;
  c.globalCompositeOperation='saturation';
  welkinDesatOk=(c.globalCompositeOperation==='saturation');
  c.globalCompositeOperation=prev;
  return welkinDesatOk;
}
function clearWelkinDesat(){
  if(welkinHudDesat!==-1){welkinHudDesat=-1;gameHud.style.filter='';}
  if(stage.style.filter)stage.style.filter='';
}
/* 收尾乱码弹窗：最后四押长条结束后屏幕拉满变黑，之后一直冒「不同风格」的小尺寸乱码弹窗。
   频率高、尺寸小、同时上限 8 个，每个只画 1 块底 + 1 圈边 + 3 行乱码，开销极小，避免掉帧/发热。 */
const WELKIN_GLYPH='█▓▒░#%&@$XYZ0123456789αβγΔΦΨ01?!><';
let welkinPopups=[];
function welkinRandGlyph(a,b){
  const n=a+((Math.random()*(b-a+1))|0);
  let s='';
  for(let i=0;i<n;i++)s+=WELKIN_GLYPH[(Math.random()*WELKIN_GLYPH.length)|0];
  return s;
}
function spawnWelkinPopup(){
  const w=rand(70,150),h=rand(36,82);
  return {
    x:rand(0,Math.max(1,V.w-w)),y:rand(0,Math.max(1,V.h-h)),
    w,h,life:rand(0.4,1.0),
    col:['#ff5f7a','#5ff0ff','#7dffb0','#ffd45f','#c9a7ff'][(Math.random()*5)|0],
    title:welkinRandGlyph(4,9),
    lines:[welkinRandGlyph(8,18),welkinRandGlyph(6,14),welkinRandGlyph(3,9)]
  };
}
function drawWelkinGlitch(dt){
  if(!selectedSong||selectedSong.chart!=='welkin')return;
  const mt=game.clock-MUSIC_DELAY;
  if(mt<242.833)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();
  const black=clamp((mt-242.833)/0.3,0,1);
  c.fillStyle='rgba(0,0,0,'+black.toFixed(3)+')';
  c.fillRect(0,0,w,h);
  if(black>=1){
    if(welkinPopups.length<8&&Math.random()<0.7)welkinPopups.push(spawnWelkinPopup());
    for(let i=welkinPopups.length-1;i>=0;i--){
      const p=welkinPopups[i];
      p.life-=dt;
      if(p.life<=0){welkinPopups.splice(i,1);continue;}
      const a=Math.min(1,p.life*4);
      c.globalAlpha=a;
      c.fillStyle='rgba(4,8,16,0.88)';
      c.fillRect(p.x,p.y,p.w,p.h);
      c.strokeStyle=p.col;c.lineWidth=1.4;
      c.strokeRect(p.x+.7,p.y+.7,p.w-1.4,p.h-1.4);
      c.fillStyle=p.col;
      c.fillRect(p.x,p.y,p.w,11);
      c.fillStyle='rgba(0,0,0,0.85)';
      c.font='700 8px '+FONT_M;
      c.fillText(p.title,p.x+3,p.y+8);
      c.fillStyle='rgba(190,240,255,0.88)';
      c.font='500 9px '+FONT_M;
      c.fillText(p.lines[0],p.x+3,p.y+25);
      c.fillText(p.lines[1],p.x+3,p.y+37);
      c.font='500 8px '+FONT_M;
      c.fillText(p.lines[2],p.x+3,p.y+49);
    }
    c.globalAlpha=1;
  }
  c.restore();
}
/* ============================================================
   承章（第二章）exclusive FX — 抖动已拆到 ch2ChordShake / ch2TimedShake，
   这里只管黑雾 / 去饱和 / 雨 / 风 / 科技光 / 史诗光 / 乱码文字。
   全部按音乐时间 mt（= .qua 秒）走，跟谱面对齐。
   ============================================================ */
const CH2_GLYPH='█▓▒░#%&@$XYZ0123456789αβγΔΦΨ01?!<>';
let _ch2LastHoldOf={};
function ch2ResetFxCaches(){_ch2LastHoldOf={};}
/* 找「最晚结束、且 chordSize>=minChord」的那根长条，返回音乐时间 {start,end}。
   lady 尾杀黑屏、an 的定时抖动截止、pen 的双押长条黑屏、fb 的四押长条黑雾都用它，
   改 .qua 也不会错位。 */
function ch2LastHoldOf(minChord){
  const k=''+minChord;
  if(_ch2LastHoldOf[k])return _ch2LastHoldOf[k];
  let start=-Infinity,end=-Infinity;
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.type!=='hold'||(n.chordSize||0)<minChord)continue;
    if(n.end>end){end=n.end;start=n.time;}
  }
  const r=end>0?{start:start-MUSIC_DELAY,end:end-MUSIC_DELAY}:{start:0,end:0};
  _ch2LastHoldOf[k]=r;
  return r;
}
/* 定时抖动（每 X 秒抖一次 / 单次剧烈抖）：返回 [shakeBeat, shakeAmt]，无则 null。 */
function ch2TimedShake(at){
  if(!selectedSong)return null;
  const c=selectedSong.chart;
  if(c==='init'){
    if(at>=43.2&&at<59)return [Math.floor((at-43.2)/0.65),11];
  }else if(c==='an'){
    if(at>=20&&at<67)return [Math.floor((at-20)/0.7),10];
    if(at>=94.5&&at<ch2LastHoldOf(2).end)return [Math.floor((at-94.5)/0.5),12];
  }else if(c==='la'){
    if(at>=34.286&&at<56)return [Math.floor((at-34.286)/0.6),10];
  }else if(c==='pen'){
    if(at>=150.5&&at<151.0)return [100000+Math.floor((at-150.5)*20),28];
  }else if(c==='fb'){
    if(at>=86&&at<87)return [100000+Math.floor((at-86)*15),22];
  }else if(c==='cyber'){
    if(at>=157.466&&at<171)return [Math.floor((at-157.466)/0.5),12];
    if(at>=176.2)return [Math.floor((at-176.2)/0.5),13];
  }
  return null;
}
/* 蓝键→黄键转换（在 finalizeChart 之后做，此时 chordSize 已知）：
   - 时逝：69s–73.719s 所有蓝键（tap）变黄键
   - CyberAttack：124.299s–137.697s 的「单点」蓝键（chordSize<2，即不成双押/多押）变黄键 */
const BREAK_RANGES={
  an:{start:69,end:73.719,singleOnly:false},
  cyber:{start:124.299,end:137.697,singleOnly:true}
};
function applyBreakConversion(){
  if(!selectedSong)return;
  const cfg=BREAK_RANGES[selectedSong.chart];
  if(!cfg)return;
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.type!=='tap'||n.perform)continue;
    const mt=n.time-MUSIC_DELAY;
    if(mt<cfg.start||mt>cfg.end)continue;
    if(cfg.singleOnly&&(n.chordSize||0)>=2)continue;
    n.type='break';n.end=0;
  }
}
/* 承章黑雾的总强度。所有黑雾都从 ch2FillFog 出去（an / la / lady / pen / cyber 的定时黑雾、
   fb 尾杀长条黑雾），所以要整体增强/减弱只改这一个数：1.2 = 黑雾出现时在原来基础上再浓 20%。 */
const CH2_FOG_BOOST=1.2;
function ch2FillFog(level){
  level=Math.min(1,level*CH2_FOG_BOOST);
  if(level<=.005)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();
  const g=c.createRadialGradient(w/2,h*.5,h*.14,w/2,h*.5,Math.hypot(w,h)*.66);
  g.addColorStop(0,'rgba(1,3,7,'+(level*.34).toFixed(3)+')');
  g.addColorStop(.5,'rgba(0,2,5,'+(level*.66).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,1,4,'+Math.min(1,level).toFixed(3)+')');
  c.fillStyle=g;c.fillRect(0,0,w,h);
  c.restore();
}
function anFogLevel(mt){if(mt<68||mt>78)return 0;return .4*Math.min(clamp((mt-68)/.9,0,1),clamp((78-mt)/.9,0,1));}
function laFogLevel(mt){
  let f=0;
  if(mt<13)f=.5*clamp(mt/1.5,0,1);
  else if(mt<25)f=.4;
  else if(mt<30)f=.4*(1-clamp((mt-25)/5,0,1));
  if(mt>=58){
    let f4=0;
    if(mt<59)f4=.5*clamp((mt-58)/1,0,1);
    else if(mt<70)f4=.5;
    else if(mt<71)f4=.5*(1-clamp((mt-70)/1,0,1));
    f=Math.max(f,f4);
  }
  if(mt>=80){
    let f5=0;
    if(mt<81.5)f5=.7*clamp((mt-80)/1.5,0,1);
    else if(mt<93)f5=.7;
    else if(mt<94)f5=.7*(1-clamp((mt-93)/1,0,1));
    f=Math.max(f,f5);
  }
  return f;
}
function ladyFogLevel(mt){if(mt<16.8||mt>18.3)return 0;return .7*Math.min(clamp((mt-16.8)/.3,0,1),clamp((18.3-mt)/.5,0,1));}
function penFogLevel(mt){if(mt<53||mt>57)return 0;return .4*Math.min(clamp((mt-53)/.9,0,1),clamp((57-mt)/.9,0,1));}
function cyberFogLevel(mt){
  if(mt<11)return 0;
  const base=.2*clamp((mt-11)/.8,0,1);
  if(mt>=124&&mt<125)return Math.max(base,lerp(.2,.7,clamp((mt-124)/1,0,1)));
  if(mt>=125&&mt<137)return .7;
  if(mt>=137&&mt<138)return lerp(.7,.2,clamp((mt-137)/1,0,1));
  return base;
}
function cyberSaturation(mt){
  let sat=1;
  if(mt>=11)sat=Math.min(sat,1-.3*clamp((mt-11)/.6,0,1));
  if(mt>=155.5)sat=Math.min(sat,1-.5*clamp((mt-155.5)/1,0,1));
  return sat;
}
/* 时逝：10s 淡入到 90% 饱和度（黑白 10%），18-20s 花 2 秒淡回全彩。 */
function anSaturation(mt){
  if(mt<10)return 1;
  if(mt<11)return 1-.1*clamp((mt-10)/1,0,1);
  if(mt<18)return .9;
  if(mt<20)return .9+.1*clamp((mt-18)/2,0,1);
  return 1;
}
function drawCh2Fog(){
  if(!selectedSong)return;
  const chart=selectedSong.chart,mt=game.clock-MUSIC_DELAY;
  let lvl=0;
  if(chart==='an')lvl=anFogLevel(mt);
  else if(chart==='la')lvl=laFogLevel(mt);
  else if(chart==='lady')lvl=ladyFogLevel(mt);
  else if(chart==='pen')lvl=penFogLevel(mt);
  else if(chart==='cyber')lvl=cyberFogLevel(mt);
  if(lvl>.005)ch2FillFog(lvl);
}
/* ---------- init：开局科技光芒迸发 + 64-80s 科技风光柱 ---------- */
function initBurstLevel(mt){if(mt<.4||mt>3.5)return 0;return Math.min(clamp((mt-.4)/.5,0,1),clamp((3.5-mt)/1,0,1));}
function drawInitBurst(mt){
  const l=initBurstLevel(mt);if(l<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=l;
  const cx=w/2,cy=h*.42;
  const core=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.5);
  core.addColorStop(0,'rgba(230,255,255,.5)');core.addColorStop(.22,'rgba(150,235,255,.22)');core.addColorStop(.55,'rgba(90,190,255,.08)');core.addColorStop(1,'rgba(90,190,255,0)');
  c.fillStyle=core;c.fillRect(0,0,w,h);
  const rings=V.lowFx?3:5;
  for(let i=0;i<rings;i++){
    const r=(i+1)/rings*Math.min(w,h)*.34*(.7+.3*Math.sin(mt*2+i*1.7));
    c.strokeStyle='rgba('+(i%2?'255,220,150':'150,245,255')+','+(.3*(1-i/rings)).toFixed(3)+')';
    c.lineWidth=1.2;
    c.beginPath();c.ellipse(cx,cy,r,r*.5,0,0,Math.PI*2);c.stroke();
  }
  const beams=V.lowFx?10:18;
  for(let i=0;i<beams;i++){
    const a=i/beams*Math.PI*2+mt*.25;
    const len=Math.min(w,h)*.42*(.75+.25*Math.sin(mt*3+i*2.1));
    const g=c.createLinearGradient(cx,cy,cx+Math.cos(a)*len,cy+Math.sin(a)*len);
    g.addColorStop(0,'rgba(210,250,255,.30)');g.addColorStop(1,'rgba(210,250,255,0)');
    c.strokeStyle=g;c.lineWidth=1;
    c.beginPath();c.moveTo(cx+Math.cos(a)*14,cy+Math.sin(a)*14);c.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len);c.stroke();
  }
  for(let k=0;k<(V.lowFx?14:26);k++){
    const px=cx+Math.cos(k*2.399+mt*.5)*Math.min(w,h)*.4*(k%7*.12+.2);
    const py=cy+Math.sin(k*2.399+mt*.5)*Math.min(w,h)*.4*(k%7*.12+.2);
    c.fillStyle='rgba(220,250,255,'+(.15+.25*Math.sin(mt*3+k)).toFixed(3)+')';
    c.fillRect(px,py,1.6,1.6);
  }
  c.restore();
}
function initPillarLevel(mt){if(mt<64||mt>80)return 0;return Math.min(clamp((mt-64)/2,0,1),clamp((80-mt)/1.5,0,1));}
// init 64–80s 科技光柱的整体亮度系数：1=原版，.5=压掉一半。只调这一个数就能整体亮/暗。
const INIT_PILLAR_ALPHA=.5;
function drawInitPillars(mt){
  const env=initPillarLevel(mt);if(env<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  const P=INIT_PILLAR_ALPHA;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
  // 地面一条横向「启动」光带，作光柱落点
  const floorY=h*(.72+.02*Math.sin(mt*.8));
  const fg=c.createLinearGradient(0,floorY-2,0,floorY+30);
  fg.addColorStop(0,'rgba(120,235,255,'+(.18*P).toFixed(3)+')');
  fg.addColorStop(1,'rgba(120,235,255,0)');
  c.fillStyle=fg;c.fillRect(0,floorY-2,w,32);
  const n=V.lowFx?3:4;
  for(let i=0;i<n;i++){
    const f=i/(n-1);
    const x=V.x+V.trackW*(.16+f*.68)+Math.sin(mt*.5+i*1.9)*V.trackW*.012;
    const base=floorY;
    const len=h*(.44+.15*Math.sin(mt*.7+i*1.3));
    const tipY=base-len;
    const halfW=V.laneW*(.34+.05*Math.sin(mt*.6+i*2.1));
    // 体积光主体：横向软边 + 顶部收窄（锥形），替代硬方块
    const body=c.createLinearGradient(x-halfW,0,x+halfW,0);
    body.addColorStop(0,'rgba(96,225,255,0)');
    body.addColorStop(.35,'rgba(130,240,255,'+(.10*P).toFixed(3)+')');
    body.addColorStop(.5,'rgba(205,252,255,'+(.22*P).toFixed(3)+')');
    body.addColorStop(.65,'rgba(130,240,255,'+(.10*P).toFixed(3)+')');
    body.addColorStop(1,'rgba(96,225,255,0)');
    c.fillStyle=body;
    c.beginPath();
    c.moveTo(x-halfW,base);
    c.lineTo(x+halfW,base);
    c.quadraticCurveTo(x+halfW*.5,tipY+len*.12,x+halfW*.16,tipY);
    c.quadraticCurveTo(x,tipY-len*.05,x-halfW*.16,tipY);
    c.quadraticCurveTo(x-halfW*.5,tipY+len*.12,x-halfW,base);
    c.closePath();c.fill();
    // 中心亮核：细的纵向渐变线
    const core=c.createLinearGradient(0,tipY,0,base);
    core.addColorStop(0,'rgba(210,255,255,0)');
    core.addColorStop(.45,'rgba(225,255,255,'+(.55*P).toFixed(3)+')');
    core.addColorStop(1,'rgba(255,225,160,'+(.26*P).toFixed(3)+')');
    c.strokeStyle=core;c.lineWidth=1.1;
    c.beginPath();c.moveTo(x,tipY+2);c.lineTo(x,base);c.stroke();
    // 顶部光晕（椭圆柔光，替代菱形头）
    const head=c.createRadialGradient(x,tipY,0,x,tipY,halfW*2.1);
    head.addColorStop(0,'rgba(230,255,255,'+(.5*P).toFixed(3)+')');
    head.addColorStop(.4,'rgba(150,240,255,'+(.16*P).toFixed(3)+')');
    head.addColorStop(1,'rgba(150,240,255,0)');
    c.fillStyle=head;
    c.beginPath();c.ellipse(x,tipY,halfW*2.1,halfW*.6,0,0,Math.PI*2);c.fill();
    // 底部落点光池
    const pool=c.createRadialGradient(x,base,0,x,base,halfW*1.6);
    pool.addColorStop(0,'rgba(210,250,255,'+(.24*P).toFixed(3)+')');
    pool.addColorStop(1,'rgba(120,220,255,0)');
    c.fillStyle=pool;
    c.beginPath();c.ellipse(x,base,halfW*1.6,halfW*.4,0,0,Math.PI*2);c.fill();
    // 沿柱上升的扫描环
    const scanY=base-((mt*120+i*97)%Math.max(20,len));
    const sg=c.createLinearGradient(x-halfW,0,x+halfW,0);
    sg.addColorStop(0,'rgba(200,250,255,0)');
    sg.addColorStop(.5,'rgba(230,255,255,'+(.5*P).toFixed(3)+')');
    sg.addColorStop(1,'rgba(200,250,255,0)');
    c.fillStyle=sg;c.fillRect(x-halfW,scanY-1,halfW*2,2);
    // 上升的光尘（圆形柔光）
    const dots=V.lowFx?4:6;
    for(let q=0;q<dots;q++){
      const y=base-((q*73+mt*90+i*41)%Math.max(20,len));
      const rr=1.2+(q%3)*.8;
      fxGlowDot(c,x+Math.sin(mt*1.3+q*2+i)*2,y,rr*2.2,'rgba(210,252,255,'+(.5*P).toFixed(3)+')');
    }
  }
  c.restore();
}
/* ---------- lady：开局下雨（0-13s，粒子少、只做位移不做物理） ---------- */
function drawLadyRain(mt){
  if(mt<0||mt>13)return;
  const env=Math.min(clamp(mt/1,0,1),clamp((13-mt)/1,0,1));if(env<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalAlpha=env*.9;c.globalCompositeOperation='lighter';
  const n=V.lowFx?26:50;
  for(let i=0;i<n;i++){
    const x=((i*97.3)%1000)/1000*w;
    const sp=760+((i*53)%420);
    const y=((mt*sp+i*137.7)%(h+46))-23;
    const len=11+((i*31)%11);
    const a=.28+((i*17)%30)/100;
    c.strokeStyle='rgba(168,214,244,'+a.toFixed(2)+')';c.lineWidth=1;
    c.beginPath();c.moveTo(x,y);c.lineTo(x-1.6,y+len);c.stroke();
  }
  c.restore();
}
/* ---------- fb：开局风暴（0-17s 循环，11s 起 200%） ---------- */
function fbWindLevel(mt){
  if(mt<0||mt>17)return 0;
  const a=clamp(mt/.8,0,1);
  const boost=mt>=11?2:1;
  return Math.min(1,a*boost);
}
const FB_WIND_ALPHA=.10;   // fb 气流整体可见度：1=原亮度，.10=只剩 10%（三层流线与风痕同比例淡出）
function drawFbWind(mt){
  const l=fbWindLevel(mt);if(l<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=Math.min(1,l)*FB_WIND_ALPHA;
  const boost=mt>=11?1:0;
  const gust=.5+.5*Math.sin(mt*1.9);                 // 阵风包络
  const amp=8+14*gust+16*boost;                      // 起伏幅度随阵风增大
  const layers=V.lowFx?2:3;
  for(let layer=0;layer<layers;layer++){
    const yy=h*(.15+layer*.24);
    const ribbons=V.lowFx?4:6;
    for(let r=0;r<ribbons;r++){
      const seed=r*2.399+layer*1.7;
      const y0=yy+Math.sin(seed)*h*.05;
      const ra=amp*(.5+.5*Math.sin(seed*1.3));
      const wl=2.1+((r*7+layer*5)%18)/10;            // 波长
      const phase=seed+mt*(1.8+boost*1.2);
      const len=w*.5+((r*53+layer*37)%Math.floor(w*.55));
      const head=((r*173+layer*91)%Math.floor(w*.7))+mt*(w*.14)*(1+boost*.7);
      const x0=-len+head%(w+len*2);
      c.beginPath();
      const SEG=26;
      for(let s=0;s<=SEG;s++){
        const f=s/SEG,xx=x0+len*f;
        const yy2=y0+Math.sin(f*wl*Math.PI*2+phase)*ra
                 +Math.sin(f*wl*4*Math.PI-phase*.6+mt*3.1)*ra*.38;
        if(s===0)c.moveTo(xx,yy2);else c.lineTo(xx,yy2);
      }
      // 外圈软光 + 内芯亮线，形成气流的两层质感（再压一档透明，让风更「空气感」而不是一片实色）
      c.strokeStyle='rgba(150,220,255,'+(.088+.034*Math.sin(mt*3+r)).toFixed(3)+')';
      c.lineWidth=(V.lowFx?12:20)+layer*4.0;
      c.stroke();
      c.strokeStyle='rgba(222,248,255,'+(.170+.060*Math.sin(mt*2.6+r*1.3)).toFixed(3)+')';
      c.lineWidth=(V.lowFx?5.2:7.4);
      c.stroke();
    }
  }
  // 快速掠过的风痕：短促亮线，随阵风加速
  const streaks=V.lowFx?10:20;
  for(let i=0;i<streaks;i++){
    const sp=(1.6+((i*17)%24)/10)*(1+boost);
    const x=((i*211+mt*sp*900)%(w+260))-130;
    const y=((i*149)%Math.floor(h*.85))+h*.04;
    const sl=26+((i*7)%34)*(1+boost*.6);
    const gg=c.createLinearGradient(x-sl,0,x,0);
    gg.addColorStop(0,'rgba(190,244,255,0)');
    gg.addColorStop(1,'rgba(230,252,255,'+(.152+.055*Math.sin(mt*5+i)).toFixed(3)+')');
    c.strokeStyle=gg;c.lineWidth=(V.lowFx?4.8:6.6)+(i%2)*2.6;
    c.beginPath();c.moveTo(x-sl,y+Math.sin(i+mt*2)*2);c.lineTo(x,y);c.stroke();
  }
  c.restore();
}
function penEpicAmp(mt){
  if(mt>=70&&mt<80)return Math.min(clamp((mt-70)/2.5,0,1),clamp((80-mt)/2,0,1));
  if(mt>=98&&mt<124)return .6*Math.min(clamp((mt-98)/4,0,1),clamp((124-mt)/4,0,1));
  return 0;
}
/* ---------- pen：史诗光（70-80s 主 / 98-124s 弱），魔王战前奏 ----------
   以前是每帧现场建 7 个径向渐变、往整块画布铺 3 次，再叠 4 根巨型光柱；
   中段 98–124s 连着 26 秒这么画，手机/平板直接掉帧。
   现在把不动的那几层（顶部天窗、核心辉光、耀斑、光柱、底部光带）按当前画布尺寸
   烘焙成一张离屏贴图，每帧只 drawImage 一次；只有光尘还在动，用缓存的小光点画。
   画布尺寸变了（旋转、地址栏收放）就重建贴图。 */
const _penEpicLayer={main:null,weak:null,w:0,h:0};
let _glowDotSpr=null;
function glowDotSprite(){
  if(_glowDotSpr)return _glowDotSpr;
  const S=64,cv=document.createElement('canvas');
  cv.width=cv.height=S;
  const g=cv.getContext('2d');
  const rg=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  rg.addColorStop(0,'rgba(222,238,255,1)');
  rg.addColorStop(1,'rgba(222,238,255,0)');
  g.fillStyle=rg;g.fillRect(0,0,S,S);
  _glowDotSpr=cv;
  return cv;
}
function buildPenEpicLayer(weak,w,h){
  const cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(w));cv.height=Math.max(1,Math.round(h));
  const c=cv.getContext('2d');
  c.globalCompositeOperation='lighter';
  const cx=w*.5,cy=h*.26;
  // 顶部宽幅柔光：让主光柱像是从一片「天窗」漏下来，而不是一个点
  const win=c.createRadialGradient(cx,cy*.9,0,cx,cy*.9,Math.max(w,h)*.60);
  win.addColorStop(0,'rgba(228,240,255,'+(weak?.09:.14)+')');
  win.addColorStop(.30,'rgba(196,218,248,'+(weak?.04:.07)+')');
  win.addColorStop(.64,'rgba(150,196,244,'+(weak?.02:.035)+')');
  win.addColorStop(1,'rgba(140,190,240,0)');
  c.fillStyle=win;c.fillRect(0,0,w,h);
  // 核心：冷白银蓝、克制亮度（与 ltzz 的暖金高贵光明确区分）
  const core=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.7);
  core.addColorStop(0,'rgba(226,238,255,'+(weak?.10:.16)+')');
  core.addColorStop(.30,'rgba(190,214,248,'+(weak?.05:.08)+')');
  core.addColorStop(.62,'rgba(140,190,240,'+(weak?.02:.04)+')');
  core.addColorStop(1,'rgba(140,190,240,0)');
  c.fillStyle=core;c.fillRect(0,0,w,h);
  const flare=c.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*.48);
  flare.addColorStop(0,'rgba(240,246,255,'+(weak?.08:.14)+')');
  flare.addColorStop(.28,'rgba(200,224,250,.05)');
  flare.addColorStop(1,'rgba(200,224,250,0)');
  c.fillStyle=flare;c.fillRect(0,0,w,h);
  // 宽幅光柱：纵向拉长的柔光叠出体积感，边缘自然淡出——上帝光/体积光的柔边，不出硬条纹
  const pillar=(bx,rx,ry,alpha)=>{
    c.save();c.translate(bx,cy);c.scale(1,ry/rx);
    const g=c.createRadialGradient(0,0,0,0,0,rx);
    g.addColorStop(0,'rgba(232,244,255,'+alpha.toFixed(3)+')');
    g.addColorStop(.40,'rgba(202,224,251,'+(alpha*.5).toFixed(3)+')');
    g.addColorStop(1,'rgba(178,208,244,0)');
    c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();
    c.restore();
  };
  /* 呼吸幅度只有 ±6%，烘焙时取中间相位，看不出来，但把每帧 4 次巨型填充省掉了。 */
  pillar(cx-w*.10, w*.15, h*1.96, (weak?.08:.12));
  pillar(cx+w*.10, w*.15, h*1.96, (weak?.08:.12));
  pillar(cx,        w*.19, h*2.16, (weak?.09:.13));
  // 中心亮芯：细而柔，给光柱一个「心」
  pillar(cx,        w*.045,h*2.25, (weak?.16:.23));
  // 底部冷白地平线光带（暗）
  const band=c.createLinearGradient(0,h*.74,0,h*.94);
  band.addColorStop(0,'rgba(200,224,255,0)');
  band.addColorStop(.5,'rgba(200,224,255,'+(weak?.03:.05)+')');
  band.addColorStop(1,'rgba(200,224,255,0)');
  c.fillStyle=band;c.fillRect(0,h*.74,w,h*.2);
  return cv;
}
function drawPenEpic(mt){
  const env=penEpicAmp(mt);if(env<=.01)return;
  const w=V.w,h=V.h;if(w<2||h<2)return;
  const weak=mt>=98;
  if(_penEpicLayer.w!==w||_penEpicLayer.h!==h){
    _penEpicLayer.main=null;_penEpicLayer.weak=null;
    _penEpicLayer.w=w;_penEpicLayer.h=h;
  }
  const key=weak?'weak':'main';
  let layer=_penEpicLayer[key];
  if(!layer)layer=_penEpicLayer[key]=buildPenEpicLayer(weak,w,h);
  const c=sctx;
  const base=env*(weak?.7:.8);
  c.save();c.globalCompositeOperation='lighter';
  c.globalAlpha=base;
  c.drawImage(layer,0,0,w,h);
  // 下落的冷白光尘：更少、更暗（缓存的软光点，不再每颗现建渐变）
  const dust=V.lowFx?10:18,spr=glowDotSprite();
  for(let k=0;k<dust;k++){
    const px=w*.5+(((k*137)%100)/100-.5)*w*.86+Math.sin(mt*.5+k*1.3)*5;
    const py=h*.72-((k*83+mt*18)%(h*.5));
    const tw=.4+.6*Math.sin(mt*1.6+k*1.7);
    const rr=(1.0+((k*7)%3)*.6)*2.2;
    c.globalAlpha=base*(.05+.07*tw);
    c.drawImage(spr,px-rr,py-rr,rr*2,rr*2);
  }
  c.restore();
}
function drawCh2Ambient(){
  if(!selectedSong)return;
  const chart=selectedSong.chart,mt=game.clock-MUSIC_DELAY;
  if(chart==='init'){drawInitBurst(mt);drawInitPillars(mt);}
  else if(chart==='lady')drawLadyRain(mt);
  else if(chart==='fb')drawFbWind(mt);
  else if(chart==='pen')drawPenEpic(mt);
}
/* ---------- cyber：文字特效（No Sign / Cyberattack / 灰白乱码） ---------- */
function cyberGlyphStr(a,b){
  const n=a+((Math.random()*(b-a+1))|0);let s='';
  for(let i=0;i<n;i++)s+=CH2_GLYPH[(Math.random()*CH2_GLYPH.length)|0];
  return s;
}
/* ---------- 自制破碎字体：离屏采样字形 → 切成碎块错位重绘（灰白 + 竖向裂纹），
   不再直接 fillText 系统字体。按 text+size 缓存，帧间只 drawImage。 ---------- */
const _shatterCache={};
function buildShatteredText(text,sz){
  const key=text+'@'+Math.round(sz);
  if(_shatterCache[key])return _shatterCache[key];
  const pad=Math.ceil(sz*.22);
  const probe=document.createElement('canvas');
  const pg=probe.getContext('2d');
  const font='900 '+sz+'px '+FONT_D;
  pg.font=font;
  const mw=pg.measureText(text).width;
  const W=Math.ceil(mw+pad*2),H=Math.ceil(sz*1.5+pad*2);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const g=cv.getContext('2d',{willReadFrequently:true});
  g.font=font;g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='#fff';
  g.fillText(text,W/2,H/2);
  const id=g.getImageData(0,0,W,H);
  let minX=W,maxX=0,minY=H,maxY=0;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      if(id.data[(y*W+x)*4+3]>42){
        if(x<minX)minX=x;if(x>maxX)maxX=x;
        if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
    }
  }
  if(maxX<=minX||maxY<=minY){_shatterCache[key]=cv;return cv;}
  const out=document.createElement('canvas');out.width=W;out.height=H;
  const oc=out.getContext('2d');
  const cell=Math.max(3,Math.round(sz*.075));
  const gap=Math.max(1,Math.ceil(cell*.16));
  let seed=(text.length*131+Math.round(sz))%100000;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
  for(let y=minY;y<=maxY;y+=cell){
    for(let x=minX;x<=maxX;x+=cell){
      let hit=false;
      for(let yy=y;yy<y+cell&&yy<H&&!hit;yy++){
        for(let xx=x;xx<x+cell&&xx<W;xx++){
          if(id.data[(yy*W+xx)*4+3]>42){hit=true;break;}
        }
      }
      if(!hit)continue;
      const gr=.58+.42*rnd();
      const jx=(rnd()-.5)*cell*.7, jy=(rnd()-.5)*cell*.7;
      const a=.78+.22*rnd();
      oc.fillStyle='rgba('+Math.floor(gr*228)+','+Math.floor(gr*232)+','+Math.floor(gr*242)+','+a.toFixed(3)+')';
      oc.fillRect(x+jx,y+jy,cell-gap,cell-gap);
    }
  }
  // 竖向为主的裂纹：深色细线穿字形，形成「碎裂」裂缝
  oc.strokeStyle='rgba(6,9,14,.85)';
  oc.lineWidth=Math.max(1,Math.ceil(sz*.012));
  const cracks=Math.max(5,Math.round(sz/13));
  for(let i=0;i<cracks;i++){
    const x0=minX+(maxX-minX)*rnd();
    const y0=minY+(maxY-minY)*rnd();
    const ang=Math.PI/2+((rnd()-.5)*.9);
    const len=(maxX-minX)*(.35+.65*rnd());
    oc.beginPath();oc.moveTo(x0,y0);
    oc.lineTo(x0+Math.cos(ang)*len,y0+Math.sin(ang)*len);
    oc.stroke();
  }
  _shatterCache[key]=out;
  return out;
}
function drawNoSign(mt){
  if(mt<.8||mt>11)return;
  const c=sctx,w=V.w,h=V.h;
  const spots=[[.18,.22],[.78,.3],[.5,.6],[.26,.78],[.66,.14]];
  const flick=Math.random()<.94?1:.25;
  c.save();
  for(let i=0;i<spots.length;i++){
    const s=spots[i];
    const x=w*s[0],y=h*s[1];
    const sz=11+((i*7)%6);
    const jx=(Math.random()-.5)*2,jy=(Math.random()-.5)*1.5;
    c.save();c.translate(x+jx,y+jy);
    c.font='700 '+sz+'px '+FONT_M;c.textAlign='center';c.textBaseline='middle';
    const col=i%2?'rgba(96,104,112,'+(.5*flick).toFixed(3)+')':'rgba(170,176,184,'+(.38*flick).toFixed(3)+')';
    c.fillStyle=col;
    c.fillText('No Sign',0,0);
    c.fillStyle='rgba(198,206,216,'+(.20*flick).toFixed(3)+')';
    c.fillText('No Sign',(Math.random()-.5)*2.5,(Math.random()-.5)*2);
    c.restore();
    c.fillStyle='rgba(40,46,52,'+(.4*flick).toFixed(3)+')';
    c.fillRect(x-sz*2.4,y+sz*.7,sz*4.8,1);
  }
  c.restore();
}
function drawCyberTitle(mt){
  if(mt<108.69||mt>109.29)return;
  const p=(mt-108.69)/(109.29-108.69);
  const env=Math.min(clamp(p/.12,0,1),clamp((1-p)/.14,0,1));
  if(env<=.01)return;
  const c=sctx,w=V.w,h=V.h;
  c.save();c.globalAlpha=env;
  c.fillStyle='rgba(2,4,7,.5)';c.fillRect(0,0,w,h);
  const txt='Cyberattack';
  const sz=clamp(w*.09,44,120);
  const cx=w/2,cy=h/2;
  const shat=buildShatteredText(txt,sz);
  const dw=shat.width,dh=shat.height;
  // 水平切片随机错位，保留 glitch 抖动；字形本身已是破碎灰白
  const slices=14;
  for(let i=0;i<slices;i++){
    const y0=cy-dh/2+i*(dh/slices);
    const off=(Math.random()<.4?(Math.random()-.5)*sz*.10:0);
    c.save();c.beginPath();c.rect(0,y0,w,dh/slices+1);c.clip();
    c.drawImage(shat,cx-dw/2+off,cy-dh/2);
    c.restore();
  }
  c.fillStyle='rgba(220,228,236,.14)';
  for(let i=0;i<6;i++){
    const y=cy-dh/2+((i*47)%dh);
    c.fillRect(0,y,w,1);
  }
  c.restore();
}
function drawCyberGrayGlitch(dt){
  if(!selectedSong||selectedSong.chart!=='cyber')return;
  const mt=game.clock-MUSIC_DELAY;
  if(mt<194)return;
  const c=sctx,w=V.w,h=V.h;
  const p=clamp((mt-194)/1.8,0,1);
  c.save();
  c.fillStyle='rgba(0,0,0,'+(p*.8).toFixed(3)+')';
  c.fillRect(0,0,w,h);
  const n=Math.min(90,Math.floor(p*110)+4);
  for(let i=0;i<n;i++){
    const x=Math.random()*w,y=Math.random()*h;
    const sz=7+Math.random()*20;
    c.font='700 '+sz.toFixed(0)+'px '+FONT_M;
    const g=(.4+Math.random()*.5);
    c.fillStyle=Math.random()<.3?'rgba(255,70,110,'+(.06+Math.random()*.16).toFixed(3)+')':'rgba('+Math.floor(g*255)+','+Math.floor(g*255)+','+Math.floor(g*255)+','+(.10+Math.random()*.26).toFixed(3)+')';
    c.fillText(CH2_GLYPH[(Math.random()*CH2_GLYPH.length)|0],x,y);
  }
  c.restore();
}
function drawCh2TextFx(dt){
  if(!selectedSong||selectedSong.chart!=='cyber')return;
  const mt=game.clock-MUSIC_DELAY;
  drawNoSign(mt);
  drawCyberTitle(mt);
  drawCyberGrayGlitch(dt);
}
/* 尾杀黑屏：lady 135s 渐变到黑、pen 最后双押长条黑屏、fb 最后四押长条黑雾黑屏。 */
function drawCh2FinalVeil(){
  if(!selectedSong)return;
  const chart=selectedSong.chart,mt=game.clock-MUSIC_DELAY;
  const c=sctx,w=V.w,h=V.h;
  if(chart==='lady'){
    if(mt<135)return;
    const end=ch2LastHoldOf(1).end;
    let v;
    if(end>0&&mt<end)v=.8*clamp((mt-135)/(end-135),0,1);
    else v=1;
    if(v>.005){c.save();c.fillStyle='rgba(0,0,0,'+v.toFixed(3)+')';c.fillRect(0,0,w,h);c.restore();}
  }else if(chart==='pen'){
    const h=ch2LastHoldOf(2);
    if(h.end<=0||mt<h.end)return;
    const v=clamp((mt-h.end)/.4,0,1);
    if(v>.005){c.save();c.fillStyle='rgba(0,0,0,'+v.toFixed(3)+')';c.fillRect(0,0,w,h);c.restore();}
  }else if(chart==='fb'){
    const h=ch2LastHoldOf(4);
    if(h.end<=0||mt<h.start)return;
    if(mt<h.end){
      const v=.6*clamp((mt-h.start)/(h.end-h.start),0,1);
      if(v>.005)ch2FillFog(v);
    }else{
      const v=clamp((mt-h.end)/.3,0,1);
      if(v>.005){c.save();c.fillStyle='rgba(0,0,0,'+v.toFixed(3)+')';c.fillRect(0,0,w,h);c.restore();}
    }
  }
}
function drawStageLight(){
  if(!selectedSong||selectedSong.chart!=='effulgence')return;
  const c=sctx,b=effLightLevel();
  if(b<=.001)return;
  const t=effAudioTime();
  c.save();c.globalCompositeOperation='lighter';
  for(let i=0;i<4;i++){
    const cx=V.x+i*V.laneW+V.laneW/2;
    const w=V.laneW*.82;
    const g=c.createLinearGradient(0,0,0,V.judgeY+30);
    g.addColorStop(0,'rgba(180,220,255,'+(.105*b).toFixed(3)+')');
    g.addColorStop(.55,'rgba(130,190,230,'+(.06*b).toFixed(3)+')');
    g.addColorStop(1,'rgba(255,225,170,'+(.075*b).toFixed(3)+')');
    c.fillStyle=g;
    c.beginPath();c.moveTo(cx-w*.18,0);c.lineTo(cx+w*.18,0);c.lineTo(cx+w*.38,V.judgeY+34);c.lineTo(cx-w*.38,V.judgeY+34);c.closePath();c.fill();
    const pool=c.createRadialGradient(cx,V.judgeY+8,0,cx,V.judgeY+10,w*.55);
    pool.addColorStop(0,'rgba(255,226,170,'+(.18*b).toFixed(3)+')');
    pool.addColorStop(1,'rgba(255,210,140,0)');
    c.fillStyle=pool;c.fillRect(cx-w*.7,V.judgeY-24,w*1.4,42);
  }
  // faint dust in the cones
  c.fillStyle='rgba(220,240,255,'+(.10*b).toFixed(3)+')';
  for(let i=0;i<16;i++){
    const x=V.x+((i*97+Math.sin(t*.35+i)*40)%V.trackW);
    const y=((i*131+t*14)%Math.max(1,V.judgeY));
    c.fillRect(x,y,1,2);
  }
  c.restore();
}
function fxEnv(t,a,b,d=.1){return clamp(Math.min((t-a)/d,(b-t)/d),0,1);}
function drawSectionFx(){
  /* only Effulgence and The Spark own these section effects — every other chart (incl. W.) must not inherit them */
  const isSpark=selectedSong&&selectedSong.chart==='spark';
  if(!isSpark&&(!selectedSong||selectedSong.chart!=='effulgence'))return;
  const c=sctx,t=effAudioTime();
  // THE SPARK 44-64s: corner light pillars + beat pulse
  if(isSpark&&t>=44&&t<=64){
    const env=fxEnv(t,44,64);
    const beat=Math.floor((t-44)*2);
    const pulse=.75+.45*(beat%2===0?1:.3);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    const corners=[[0,0,V.w*.32,V.h*.36],[V.w,0,-V.w*.32,V.h*.36],[0,V.h,V.w*.32,-V.h*.36],[V.w,V.h,-V.w*.32,-V.h*.36]];
    for(const co of corners){
      const g=c.createLinearGradient(co[0],co[1],co[0]+co[2],co[1]+co[3]);
      g.addColorStop(0,'rgba(170,240,255,'+(.45*pulse).toFixed(3)+')');
      g.addColorStop(.55,'rgba(34,228,255,'+(.16*pulse).toFixed(3)+')');
      g.addColorStop(1,'rgba(34,228,255,0)');
      c.fillStyle=g;
      c.beginPath();
      c.moveTo(co[0],co[1]);
      c.lineTo(co[0]+co[2]*.10,co[1]+(co[2]>0?10:-10));
      c.lineTo(co[0]+co[2],co[1]+co[3]);
      c.lineTo(co[0]+(co[3]>0?10:-10),co[1]+co[3]*.10);
      c.closePath();
      c.fill();
      // hot inner core
      c.strokeStyle='rgba(240,255,255,'+(.5*pulse).toFixed(3)+')';
      c.lineWidth=1.6;
      c.beginPath();c.moveTo(co[0],co[1]);c.lineTo(co[0]+co[2]*.92,co[1]+co[3]*.92);c.stroke();
      c.lineWidth=1;
    }
    c.strokeStyle='rgba(190,250,255,'+(.34*pulse).toFixed(3)+')';
    for(const co of corners){c.beginPath();c.moveTo(co[0],co[1]);c.lineTo(co[0]+co[2],co[1]+co[3]);c.stroke();}
    c.restore();
  }
  // THE SPARK 76-98s: restrained tech net (fade in/out)
  if(isSpark&&t>=76&&t<=98){
    const env=fxEnv(t,76,98,.5);
    const ph=(t-76)%1.6/1.6;
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    for(let k=0;k<4;k++){
      const ay=V.h*(.20+k*.17)+Math.sin(t*.8+k*2.1)*10;
      const g=c.createLinearGradient(0,0,V.w,0);
      g.addColorStop(0,'rgba(70,190,255,0)');g.addColorStop(.3,'rgba(70,190,255,.08)');g.addColorStop(.5,'rgba(190,247,255,.16)');g.addColorStop(.7,'rgba(70,190,255,.08)');g.addColorStop(1,'rgba(70,190,255,0)');
      c.fillStyle=g;c.fillRect(0,ay-1,V.w,2);
    }
    const sweepX=V.w*(.06+.88*ph);
    const sg=c.createLinearGradient(sweepX-60,0,sweepX+60,0);
    sg.addColorStop(0,'rgba(150,235,255,0)');sg.addColorStop(.5,'rgba(210,250,255,.34)');sg.addColorStop(1,'rgba(150,235,255,0)');
    c.fillStyle=sg;c.fillRect(sweepX-60,0,120,V.judgeY);
    c.strokeStyle='rgba(190,245,255,.5)';c.lineWidth=1;
    c.beginPath();c.moveTo(sweepX,0);c.lineTo(sweepX,V.judgeY);c.stroke();
    for(let i=0;i<18;i++){
      const x=((i*173+t*40)%V.trackW)+V.x;
      const y=((i*97+t*26)%V.judgeY);
      c.fillStyle='rgba(170,240,255,.4)';
      c.fillRect(x,y,2,2);
    }
    c.strokeStyle='rgba(160,240,255,.5)';
    c.beginPath();c.ellipse(V.w*.5,V.h*.30,98+Math.sin(t*1.4)*14,28,0,0,Math.PI*2);c.stroke();
    c.setLineDash([10,7]);
    c.beginPath();c.ellipse(V.w*.5,V.h*.30,124+Math.sin(t*1.1)*16,36,0,0,Math.PI*2);c.stroke();
    c.setLineDash([]);
    c.beginPath();c.ellipse(V.w*.5,V.h*.30,52,15,0,0,Math.PI*2);c.stroke();
    c.restore();
  }
  // 10s prism cathedral during the long hold, 60.2-70.2
  if(!isSpark&&t>=60.2&&t<=70.2){
    const p=(t-60.2)/10,env=fxEnv(t,60.2,70.2);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    const cx=V.w/2,cy=V.h*.46;
    for(let i=0;i<(V.lowFx?3:4);i++){
      const R=Math.min(V.w,V.h)*(.20+i*.065);
      c.save();c.translate(cx,cy);c.rotate(t*(.16+i*.035)+i*.7);
      c.strokeStyle=i%2?'rgba(255,215,140,.13)':'rgba(140,245,255,.16)';
      c.lineWidth=i%2?1.4:1;
      c.setLineDash([18+i*5,10+i*3]);
      c.beginPath();c.ellipse(0,0,R,R*(.38+i*.05),0,0,Math.PI*2);c.stroke();
      c.restore();
    }
    c.setLineDash([]);
    for(let i=0;i<(V.lowFx?2:4);i++){
      const x=V.x+V.trackW*(.1+i*.27);
      const g=c.createLinearGradient(0,V.h*.16,0,V.h*.86);
      g.addColorStop(0,'rgba(34,228,255,0)');
      g.addColorStop(.3,'rgba(90,235,255,.05)');
      g.addColorStop(.55,'rgba(255,228,160,.08)');
      g.addColorStop(1,'rgba(34,228,255,0)');
      c.fillStyle=g;c.fillRect(x-1.4,V.h*.16,2.8,V.h*.7);
    }
    for(let i=0;i<(V.lowFx?12:22);i++){
      const a=i*2.399+t*.35;
      const rr=Math.min(V.w,V.h)*(.18+(i%7)*.045);
      const x=cx+Math.cos(a)*rr*1.55,y=cy+Math.sin(a)*rr*.62;
      c.save();c.translate(x,y);c.rotate(a*.7);
      c.fillStyle=i%3===0?'rgba(255,225,155,.55)':'rgba(170,250,255,.5)';
      c.fillRect(-1.2,-1.2,2.4,2.4);c.restore();
    }
    const sweep=c.createLinearGradient(0,0,V.w,0);
    sweep.addColorStop(0,'rgba(34,228,255,0)');sweep.addColorStop(.4,'rgba(120,240,255,.06)');sweep.addColorStop(.5,'rgba(255,245,210,.12)');sweep.addColorStop(.6,'rgba(120,240,255,.06)');sweep.addColorStop(1,'rgba(34,228,255,0)');
    c.fillStyle=sweep;c.fillRect(0,V.h*(.12+p*.72),V.w,1);
    c.restore();
  }
  // prismatic diagonal blades, 27s-30s
  if(!isSpark&&t>=26.9&&t<=29.9){
    const ph=((t-26.9)%0.4)/0.4,env=fxEnv(t,26.9,29.9);
    const y=-V.h*.24+ph*V.h*1.42;
    const len=V.w*1.9,ang=-.29;
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    for(let pass=0;pass<(V.lowFx?2:3);pass++){
      c.save();
      c.translate(V.w*.5,y+(pass-1)*9);
      c.rotate(ang+(pass-1)*.014);
      const g=c.createLinearGradient(-len/2,0,len/2,0);
      if(pass===0){g.addColorStop(0,'rgba(34,228,255,0)');g.addColorStop(.25,'rgba(34,228,255,.12)');g.addColorStop(.5,'rgba(120,245,255,.30)');g.addColorStop(.75,'rgba(34,228,255,.12)');g.addColorStop(1,'rgba(34,228,255,0)');}
      else if(pass===1){g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.3,'rgba(255,255,255,.16)');g.addColorStop(.5,'rgba(255,255,255,.38)');g.addColorStop(.7,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');}
      else{g.addColorStop(0,'rgba(255,70,170,0)');g.addColorStop(.3,'rgba(255,70,170,.08)');g.addColorStop(.5,'rgba(255,150,210,.22)');g.addColorStop(.7,'rgba(255,70,170,.08)');g.addColorStop(1,'rgba(255,70,170,0)');}
      c.fillStyle=g;c.fillRect(-len/2,-8,len,16);
      const core=c.createLinearGradient(-len/2,0,len/2,0);
      core.addColorStop(0,'rgba(255,255,255,0)');core.addColorStop(.22,'rgba(220,255,255,.28)');core.addColorStop(.5,'rgba(255,255,255,.72)');core.addColorStop(.78,'rgba(220,255,255,.28)');core.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=core;c.fillRect(-len/2,-.65,len,1.3);
      c.fillStyle='rgba(190,250,255,.16)';
      for(let d=0;d<(V.lowFx?14:26);d++){const dx=-len/2+d*len/(V.lowFx?14:26)+((t*140+d*17)%14);c.fillRect(dx,-2.4,len/90,4.8);}
      c.restore();
    }
    c.strokeStyle='rgba(210,250,255,.08)';c.lineWidth=1;
    c.beginPath();c.moveTo(0,y-28);c.lineTo(V.w,y-28-V.w*.29);c.moveTo(0,y+28);c.lineTo(V.w,y+28-V.w*.29);c.stroke();
    c.fillStyle='rgba(220,255,255,.55)';
    for(let i=0;i<(V.lowFx?5:9);i++){
      const px=(i/(V.lowFx?4:8))*V.w,py=y+(px-V.w*.5)*Math.tan(ang)+Math.sin(t*8+i)*9;
      c.fillRect(px,py,1.4,1.4);
    }
    c.restore();
  }
  // holographic tech pillars, 75s-93s
  if(!isSpark&&t>=75&&t<=93){
    const ph=((t-75)%0.4)/0.4,env=fxEnv(t,75,93);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    // distant data arcs
    for(let k=0;k<(V.lowFx?2:3);k++){
      const ay=V.h*(.2+k*.13)+Math.sin(t*.6+k)*8;
      const ag=c.createLinearGradient(0,0,V.w,0);
      ag.addColorStop(0,'rgba(34,228,255,0)');ag.addColorStop(.25,'rgba(34,228,255,.05)');ag.addColorStop(.5,'rgba(255,225,160,.09)');ag.addColorStop(.75,'rgba(34,228,255,.05)');ag.addColorStop(1,'rgba(34,228,255,0)');
      c.fillStyle=ag;c.beginPath();c.moveTo(0,ay);c.quadraticCurveTo(V.w*.5,ay-34,V.w,ay);c.lineTo(V.w,ay+1);c.quadraticCurveTo(V.w*.5,ay-31,0,ay+1);c.closePath();c.fill();
    }
    for(let i=0;i<5;i++){
      const drift=Math.sin(t*.5+i*1.7)*.014;
      const x=V.x+((i+.5)/5+drift)*V.trackW;
      const base=V.h*(.60+.07*Math.sin(i*1.3+t*.7)+.14*(i/4));
      const beamH=base*(.68+.24*Math.sin(t*1.2+i));
      const g=c.createLinearGradient(0,base-beamH,0,base);
      g.addColorStop(0,'rgba(80,210,255,0)');
      g.addColorStop(.22,'rgba(90,225,255,'+(.035+i*.004).toFixed(3)+')');
      g.addColorStop(.76,'rgba(185,250,255,'+(.07+i*.005).toFixed(3)+')');
      g.addColorStop(1,'rgba(255,220,150,.035)');
      c.fillStyle=g;c.fillRect(x-4,base-beamH,8,beamH);
      // split chromatic edges
      c.strokeStyle='rgba(34,228,255,.30)';c.lineWidth=.8;c.beginPath();c.moveTo(x-2.1,base-beamH);c.lineTo(x-2.1,base);c.stroke();
      c.strokeStyle='rgba(255,110,190,.16)';c.beginPath();c.moveTo(x+2.1,base-beamH);c.lineTo(x+2.1,base);c.stroke();
      c.fillStyle='rgba(235,255,255,.55)';c.fillRect(x-.6,base-beamH,.9,beamH);
      // floating data tiles
      for(let k=0;k<(V.lowFx?4:7);k++){
        const yy=base-(((k*61+t*80+i*37)%Math.max(20,beamH))+Math.max(20,beamH))%Math.max(20,beamH);
        const ww=7+(k%3)*4;
        c.fillStyle=k%3===0?'rgba(255,225,160,.18)':'rgba(175,250,255,.20)';
        c.fillRect(x-ww/2,yy,ww,1.2);
        c.fillStyle='rgba(220,255,255,.10)';c.fillRect(x-ww/2,yy+3,ww*.6,.8);
      }
      // diamond head
      const hy=base-beamH;
      c.fillStyle='rgba(210,255,255,.65)';
      c.beginPath();c.moveTo(x,hy-4);c.lineTo(x+3,hy);c.lineTo(x,hy+4);c.lineTo(x-3,hy);c.closePath();c.fill();
      // base halo and ring
      const ring=c.createRadialGradient(x,base,0,x,base,30);
      ring.addColorStop(0,'rgba(220,255,255,.22)');ring.addColorStop(1,'rgba(34,228,255,0)');
      c.fillStyle=ring;c.fillRect(x-32,base-15,64,30);
      c.strokeStyle='rgba(190,250,255,.22)';c.lineWidth=1;
      c.beginPath();c.ellipse(x,base,15,4.5,0,0,Math.PI*2);c.stroke();
      c.strokeStyle='rgba(255,220,150,.14)';c.beginPath();c.ellipse(x,base,8,2.4,0,0,Math.PI*2);c.stroke();
    }
    const sy=V.h*.22+ph*V.h*.5;
    const sg=c.createLinearGradient(0,0,V.w,0);
    sg.addColorStop(0,'rgba(34,228,255,0)');sg.addColorStop(.32,'rgba(160,245,255,.08)');sg.addColorStop(.5,'rgba(255,245,210,.18)');sg.addColorStop(.68,'rgba(160,245,255,.08)');sg.addColorStop(1,'rgba(34,228,255,0)');
    c.fillStyle=sg;c.fillRect(0,sy,V.w,.8);
    c.restore();
  }
  // darkness / black fog is drawn beneath light + notes
}


function revealResult(){
  const t0=performance.now();
  const el=$('#resScore');
  function tick(){
    const k=clamp((performance.now()-t0)/1100,0,1);
    el.textContent=pad7(finalScore*easeOutCubic(k));
    if(k<1)requestAnimationFrame(tick);
  }
  tick();
}

/* ============================================================
   18. wiring
   ============================================================ */
/* 序章 / EX 的曲绘和主线章节一样是「保护」的：没有长按存图，也没有下载入口。 */
function wireUI(){
  bind('#avatarPick','click',()=>$('#avatarFile').click());
  bind('#avatarFile','change',e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    compressAvatar(f,data=>{
      if(!data)return;
      tempAvatar=data;
      const p=$('#avatarPreview');p.src=data;p.hidden=false;
      $('#avatarHint').style.display='none';
    });
    e.target.value='';
  });
  bind('#btnEnter','click',enterTerminal);
  bind('#nameInput','keydown',e=>{if(e.key==='Enter'){e.preventDefault();enterTerminal();}});

  bind('#btnPlay','click',openSong);
  document.addEventListener('pointerdown',()=>{
    if(uiCurrent&&uiPlayer.paused&&!songLoading.classList.contains('active')){
      try{const p=uiPlayer.play();if(p&&p.then)p.then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});}catch(e){}
    }
  },{passive:true});
  bind('#btnSet','click',()=>openSettings('PHONE'));
  bind('#btnIM','click',openIM);
  bind('#pwMsg','click',()=>{if(state==='PHONE'){phoneRig.classList.remove('is-hidden');openIM();}});
  /* Dock activation is defined FIRST and assigned to window before any coordinate listener is registered,
     so no later wiring failure can ever leave the dock dead while the hide-phone toggle keeps working. */
  const CTRL_IDS='#btnPlay,#btnIM,#btnSet,#pwMsg,#btnEnter,#chapterBack,#ssBack,#songBack,#imBack,#setBack,#btnStartGame,#btnSongSet,#btnPauseSet,#slCancel';
  let lastControlId='',lastControlAt=0;
  const ensurePhone=()=>{
    if(state==='WAKE'){
      wakeLayer.classList.remove('active','open','flash','blink');
      room.classList.remove('waking');
      phoneBoot.classList.add('done');
      state='PHONE';
      syncUIMusic(true);
    }
  };
  const activateControl=id=>{
    const now=Date.now();
    if(id===lastControlId&&now-lastControlAt<500)return;
    lastControlId=id;lastControlAt=now;
    ensurePhone();
    switch(id){
      case 'btnPlay':openSong();break;
      case 'btnIM':openIM();break;
      case 'btnSet':openSettings('PHONE');break;
      case 'pwMsg':{const r=$('#phoneRig');if(r)r.classList.remove('is-hidden');openIM();}break;
      case 'btnEnter':enterTerminal();break;
      case 'chapterBack':closeChapterSelect();break;
      case 'ssBack':closeSongSelect();break;
      case 'songBack':closeSong();break;
      case 'imBack':closeIM();break;
      case 'setBack':closeSettings();break;
      case 'btnStartGame':startGame();break;
      case 'btnSongSet':openSettings('SONG');break;
      case 'btnPauseSet':openSettings('PAUSE');break;
      case 'slCancel':cancelSongLoading();break;
    }
  };
  window.__dockAct=activateControl;
  /* Coordinate-based phone UI activation: immune to overlays and broken click synthesis.
     Runs only in PHONE/WAKE states, so it never touches gameplay or other screens. */
  const phoneDockIds=['btnPlay','btnIM','btnSet','pwMsg'];
  const phonePointDown=(x,y)=>{
    if(state!=='PHONE'&&state!=='WAKE')return;
    for(let i=0;i<phoneDockIds.length;i++){
      const el=document.getElementById(phoneDockIds[i]);if(!el)continue;
      const r=el.getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
        if(window.__dockAct)window.__dockAct(phoneDockIds[i]);
        return;
      }
    }
    const pr=phoneRig.getBoundingClientRect();
    if(!(x>=pr.left&&x<=pr.right&&y>=pr.top&&y<=pr.bottom)){
      phoneRig.classList.toggle('is-hidden');
      syncUIMusic();
      uiSound(.85);
    }
  };
  window.addEventListener('pointerdown',e=>{phonePointDown(e.clientX,e.clientY);},{capture:true,passive:true});
  // 不再另挂 touchstart：触屏一次点击会同时触发 pointerdown 和 touchstart，
  // 两个都调 phonePointDown 会 toggle 两次 = 收不起手机。

  bind('#songBack','click',closeSong);
  bind('#btnStartGame','click',startGame);
  bind('#slCancel','click',cancelSongLoading);
  bind('#btnSongSet','click',()=>openSettings('SONG'));
  bind('#chapterBack','click',closeChapterSelect);
  bind('#ssBack','click',closeSongSelect);
  bind('#chapterPreview','click',()=>{
    if(performance.now()<uiLockUntil)return;
    enterChapter(CHAPTERS[chapterFocus]);
  });
  bind('#letterOverlay','click',e=>{if(e.target===e.currentTarget)closeStillLetter();});

  bind('#imBack','click',closeIM);
  bind('#imDetailBack','click',()=>{$('#imDetail').classList.remove('active');uiSound(.9);});
  $$('.im-tab').forEach(tab=>tab.addEventListener('click',()=>{
    $$('.im-tab').forEach(t=>t.classList.toggle('active',t===tab));
    renderFeed(tab.dataset.tab);
    uiSound(1);
  }));

  bind('#setBack','click',closeSettings);
  bind('#btnDev','click',openDevModal);
  bind('#devCancel','click',closeDevModal);
  bind('#devConfirm','click',confirmDevKey);
  bind('#devDisable','click',disableDevMode);
  bind('#devModal','click',e=>{if(e.target===e.currentTarget)closeDevModal();});
  bind('#devKeyInput','keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();confirmDevKey();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDevModal();}
  });
  bind('#btnPauseSet','click',()=>openSettings('PAUSE'));
  /* ---- Store + 存档码 + 皮肤收藏开关 ---- */
  bind('#storeBack','click',closeStore);
  bind('#btnDrawOne','click',()=>doDraw(false));
  bind('#btnDrawTen','click',()=>doDraw(true));
  bind('#btnPrizeDetail','click',()=>{const m=$('#prizeModal');if(m){renderPrizeDetail();m.classList.add('active');}uiSound(1.1);});
  bind('#prizeModalClose','click',()=>$('#prizeModal').classList.remove('active'));
  bind('#prizeModal','click',e=>{if(e.target===e.currentTarget)$('#prizeModal').classList.remove('active');});
  bind('#tPhone','click',()=>{
    if(!account.phone){showExNotice('LOCKED','抽中「鎏金终端」后解锁');uiSound(.6);return;}
    account.phoneOn=!account.phoneOn;saveAccount();applySkins();
    setSwitch('#tPhone',account.phoneOn);syncSettingsUI();uiSound(1.3);
  });
  bind('#tLobby','click',()=>{
    if(!account.lobby){showExNotice('LOCKED','抽中「金殿 · 皇室大厅」后解锁');uiSound(.6);return;}
    account.lobbyOn=!account.lobbyOn;saveAccount();applySkins();
    setSwitch('#tLobby',account.lobbyOn);syncSettingsUI();uiSound(1.3);
  });
  bind('#tScenery','click',()=>{
    if(!account.scenery){showExNotice('LOCKED','抽中「黄金奢华外景」后解锁');uiSound(.6);return;}
    account.sceneryOn=!account.sceneryOn;saveAccount();applySkins();
    setSwitch('#tScenery',account.sceneryOn);syncSettingsUI();uiSound(1.3);
  });
  bind('#tPhoneui','click',()=>{
    if(!account.phoneui){showExNotice('LOCKED','抽中「鎏金天幕 · 皇室天气屏」后解锁');uiSound(.6);return;}
    account.phoneuiOn=!account.phoneuiOn;saveAccount();applySkins();
    setSwitch('#tPhoneui',account.phoneuiOn);syncSettingsUI();uiSound(1.3);
  });
  bind('#tLobbyMusic','click',()=>{
    if(!account.lobbyMusic){showExNotice('LOCKED','抽中「大厅奢华钢琴 · 背景音乐」后解锁');uiSound(.6);return;}
    account.lobbyMusicOn=!account.lobbyMusicOn;saveAccount();
    setSwitch('#tLobbyMusic',account.lobbyMusicOn);syncSettingsUI();
    /* 设置页里开关时不要用钢琴曲盖掉设置 BGM：等关掉设置、回大厅时由 syncUIMusic 接管；
       关掉开关就立刻停，别拖到下一屏。 */
    if(!account.lobbyMusicOn)stopLobbyBgm();
    else if(state==='PHONE'&&!settingsApp.classList.contains('active'))syncUIMusic(true);
    uiSound(1.3);
  });
  bind('#btnExport','click',async()=>{
    uiSound(1.3);
    const code=await exportSave();
    if(!code){showExNotice('EXPORT FAILED','无法生成存档码');return;}
    openSaveModal('export',code);
    const copied=await copyTextSmart(code);
    const meta=$('#saveModalMeta');
    if(meta)meta.textContent=(copied?'✓ 已自动复制 · ':'')+'共 '+code.length+' 个字符 · 含进度 / 苍穹星 / 皮肤 / 设置';
    if(copied)showExNotice('COPIED','存档码已复制');
  });
  bind('#btnImport','click',()=>{openSaveModal('import','');uiSound(1.3);});
  bind('#saveModalCancel','click',closeSaveModal);
  bind('#saveModal','click',e=>{if(e.target===e.currentTarget)closeSaveModal();});
  bind('#saveModalOk','click',async()=>{
    if(saveModalMode==='export'){
      const ok=await copyTextSmart(saveModalCode);
      const meta=$('#saveModalMeta');
      if(ok){if(meta)meta.textContent='✓ 已复制 · 共 '+saveModalCode.length+' 个字符';showExNotice('COPIED','存档码已复制');}
      else{
        const ta=$('#saveCodeArea');if(ta){ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);}
        if(meta)meta.textContent='没复制上 · 请在框里长按「全选 → 复制」';
        showExNotice('SELECT ALL','点住框里全选后复制');
      }
      uiSound(1.3);
      return;
    }
    const ta=$('#saveCodeArea');
    const code=ta?(ta.value||'').trim():'';
    if(!code){showExNotice('EMPTY','先粘贴存档码');return;}
    const ok=await importSave(code);
    if(ok){
      closeSaveModal();
      syncSettingsUI();renderUser();applyUnlocks();
      showExNotice('IMPORT OK','进度已恢复');
      uiSound(1.4);
    }else{
      showExNotice('IMPORT FAILED','存档码无效');
      uiSound(.6);
    }
  });
  bind('#btnSwitchUser','click',()=>{
    closeSettings();
    stopAllUIMusic();
    try{localStorage.removeItem('welkin_os_user');localStorage.removeItem('rhythm_user');localStorage.removeItem(LAST_USER_KEY);}catch(e){}
    user=null;
    bestMap=readBestMap();
    best=emptyBest();
    if(typeof cancelAnimationFrame==='function'){}
    cancelAnimationFrame(gameRaf);gameRaf=0;
    resetAudioState();
    gameWrap.classList.remove('active');gameHud.classList.remove('active');
    songScreen.classList.remove('active');imApp.classList.remove('active');
    chapterScreen.classList.remove('active');songSelectScreen.classList.remove('active');
    navBaseOff();
    state='LOGIN';showLogin();
  });

  const sp=$('#sSpeed'),dm=$('#sDim'),vo=$('#sVol'),hv=$('#sHitVol');
  bind('#sSpeed','input',()=>{settings.speed=clamp(parseFloat(sp.value)||1,.5,1.5);$('#vSpeed').textContent=settings.speed.toFixed(2)+'×';updateScrollSpeed();saveSettings();});
  bind('#sDim','input',()=>{settings.dim=clamp(parseInt(dm.value,10)||0,0,80);$('#vDim').textContent=Math.round(settings.dim)+'%';saveSettings();});
  bind('#sVol','input',()=>{settings.volume=clamp(parseInt(vo.value,10)||0,0,100);$('#vVol').textContent=Math.round(settings.volume)+'%';applySettings();});
  bind('#sHitVol','input',()=>{settings.hitVol=clamp(parseInt(hv.value,10)||0,0,100);$('#vHitVol').textContent=Math.round(settings.hitVol)+'%';saveSettings();});
  bind('#sInputOffset','input',()=>{settings.inputOffset=clamp(parseInt($('#sInputOffset').value,10)||0,-150,150);$('#vInputOffset').textContent=(settings.inputOffset>0?'+':'')+settings.inputOffset+'ms';saveSettings();});
  bind('#btnSkinPrev','click',()=>{cycleTrackSkin(-1);uiSound(1.3);});
  bind('#btnSkinNext','click',()=>{cycleTrackSkin(1);uiSound(1.3);});
  bind('#btnNoteSkinPrev','click',()=>{cycleNoteSkin(-1);});
  bind('#btnNoteSkinNext','click',()=>{cycleNoteSkin(1);});
  bind('#tEarly','click',()=>{settings.early=!settings.early;setSwitch('#tEarly',settings.early);saveSettings();uiSound(1.4);});
  bind('#tHit','click',()=>{settings.hit=!settings.hit;setSwitch('#tHit',settings.hit);saveSettings();uiSound(1.4);});
  bind('#tUI','click',()=>{settings.ui=!settings.ui;setSwitch('#tUI',settings.ui);saveSettings();});
  bind('#tMotion','click',()=>{
    settings.motion=!settings.motion;
    setSwitch('#tMotion',settings.motion);
    applySettings();
    city.last=0;
    if(!settings.motion)drawWindowCity(performance.now());
    uiSound(1.2);
  });
  $$('.seg').forEach(b=>b.addEventListener('click',()=>{
    if(!['auto','high','low','ultra'].includes(b.dataset.pm))return;
    settings.perfMode=b.dataset.pm;
    syncPerfSeg();
    saveSettings();
    layoutGame();
    uiSound(1.3);
  }));

  bind('#btnPause','click',pauseGame);
  bind('#btnResume','click',resumeGame);
  bind('#btnRestart','click',restartGame);
  bind('#btnQuit','click',quitToSong);
  bind('#btnRetry','click',retryGame);
  bind('#btnBackSong','click',backToSong);

  document.addEventListener('pointerdown',()=>{ensureAudioCtx();buildHitSounds();unlockAudio();retryUIMusic();},{once:true,passive:true});
  document.addEventListener('touchstart',()=>{ensureAudioCtx();buildHitSounds();unlockAudio();retryUIMusic();},{once:true,passive:true});
  /* Android / WeChat WebViews: never block native click; add a pending fallback only when the browser fails to fire click. */
  const touchFallbackFor=el=>{
    if(!el||el.disabled||el.__fbPending)return;
    el.__fbPending=true;
    setTimeout(()=>{
      if(el.__fbPending){
        el.__fbPending=false;
        try{el.click();}catch(err){}
        kickUIMusic();
      }
    },240);
  };
  document.addEventListener('touchend',e=>{
    const t=e.target;
    touchFallbackFor(t&&t.closest?t.closest('button, #pwMsg, .pw-msg'):null);
  },{passive:true});
  document.addEventListener('pointerup',e=>{
    if(e.pointerType==='touch'){
      const t=e.target;
      touchFallbackFor(t&&t.closest?t.closest('button, #pwMsg, .pw-msg'):null);
    }
  },{passive:true});
  document.addEventListener('click',e=>{
    const t=e.target;
    const el=t&&t.closest?t.closest('button, #pwMsg, .pw-msg'):null;
    if(el)el.__fbPending=false;
  },true);
  /* The per-id dock activation (CTRL_IDS / activateControl / window.__dockAct) is defined earlier,
     right before the coordinate listener, so a failure here can never kill the dock. */
  document.addEventListener('pointerdown',retryUIMusic,{passive:true});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('click',e=>{
    if(e.target&&e.target.closest&&e.target.closest('.dock,.btn,.back-btn,.im-tab,.set-mini,.link'))uiSound(1.05);
  });

  let rt=0;
  window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{
    layoutGame();buildCity();
    if(state==='GAME'||state==='PAUSED'||state==='RESUMING')drawGame(0);
    if(songSelectScreen.classList.contains('active')){fitSongTitles();refreshSongMapScale();}
  },140);});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{layoutGame();buildCity();},260));
}

/* ============================================================
   19. init
   ============================================================ */
function init(){
  // attach every UI listener first: any later renderer/audio failure must never kill the buttons
  wireUI();
  const safe=fn=>{try{fn();}catch(e){try{console.error(e);}catch(_){}}};
  safe(layoutGame);
  safe(()=>{updateTime();updatePhone();applyWeather();});
  safe(initBattery);
  safe(updatePhonePanels);
  safe(buildCity);
  safe(()=>requestAnimationFrame(cityLoop));
  safe(renderUser);
  safe(syncSettingsUI);
  safe(applySettings);
  safe(loadWeather);
  safe(()=>{
    try{preload();$('#loading').classList.add('active');}
    catch(e){try{$('#loading').classList.remove('active');afterLoad();}catch(_){}}
  });
}
/* 先等一次 AVIF 探测：init 之后各处才渲染图片，必须让 IMG_CAN_AVIF 先落定，
   否则老机器第一帧会用错扩展名。探测本身是 data URI，几十毫秒，还在 loading 里。 */
IMG_PROBE.then(init,init);

