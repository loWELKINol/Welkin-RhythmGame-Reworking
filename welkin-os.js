'use strict';
/* ============================================================
   WELKIN OS — 0. utilities & shell
   ============================================================ */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeOutQuad=t=>t*(2-t);
const easeOutQuint=t=>1-Math.pow(1-t,5);
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const pad7=n=>String(Math.max(0,Math.floor(n))).padStart(7,'0');
const mmss=s=>{s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const rand=(a,b)=>a+Math.random()*(b-a);
const FONT_D="'Bahnschrift SemiCondensed','Bahnschrift','Arial Narrow','Segoe UI',sans-serif";
const FONT_M="'Consolas','Cascadia Mono','SF Mono',monospace";

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
const songLoading=$('#songLoading');
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

/* ============================================================
   1. settings / user / best
   ============================================================ */
const SET_KEY='welkin_os_settings_v1';
const DEFAULT_SETTINGS={speed:1,dim:45,volume:85,hit:true,ui:true,early:true,motion:false};
let settings={...DEFAULT_SETTINGS};
try{
  const raw=localStorage.getItem(SET_KEY);
  if(raw){const o=JSON.parse(raw);if(o&&typeof o==='object')settings={...DEFAULT_SETTINGS,...o};}
}catch(e){}
settings.speed=clamp(Number(settings.speed)||1,0.5,2);
settings.dim=clamp(Number(settings.dim)||0,0,80);
settings.volume=clamp(Number(settings.volume)||0,0,100);
settings.hit=!!settings.hit;settings.ui=!!settings.ui;settings.early=!!settings.early;settings.motion=!!settings.motion;
function saveSettings(){try{localStorage.setItem(SET_KEY,JSON.stringify(settings));}catch(e){}}

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
async function loadWeather(){
  syntheticWeather();
  let pos=null;
  if(navigator.geolocation){
    pos=await new Promise(res=>{
      let done=false;
      const t=setTimeout(()=>{if(!done){done=true;res(null);}},4500);
      navigator.geolocation.getCurrentPosition(p=>{if(!done){done=true;clearTimeout(t);res(p.coords);}},()=>{if(!done){done=true;clearTimeout(t);res(null);}},{timeout:4000,maximumAge:900000});
    });
  }
  const lat=pos?pos.latitude:31.2304;
  const lon=pos?pos.longitude:121.4737;
  try{
    const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lon.toFixed(3)+'&current=temperature_2m,weather_code,is_day&timezone=auto');
    if(!r.ok)throw new Error('http');
    const j=await r.json();
    const c=j.current||{};
    weather.temp=Number(c.temperature_2m);
    weather.code=Number(c.weather_code)||0;
    weather.isDay=!!c.is_day;
    weather.live=true;
    weather.city=pos?'LOCAL SECTOR':((Intl.DateTimeFormat().resolvedOptions().timeZone||'local').split('/').pop().replace(/_/g,' ')||'LOCAL');
    weather.updated=Date.now();
  }catch(e){
    weather.live=false;
  }
  applyWeather();
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
  return {a,b,light:lerp(s.light,n.light,t),star:lerp(s.star,n.star,t)*(k==='cloud'||k==='rain'||k==='storm'?.25:1),sun:lerp(s.sun,n.sun,t)};
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
  const cloudAlpha=kind==='cloud'||kind==='rain'||kind==='storm'||kind==='snow'?.22:(kind==='fog'?.3:.07);
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
  const hazeA=.12*pal.light+(kind==='fog'?.1:0);
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

function cityLoop(ts){
  requestAnimationFrame(cityLoop);
  if(document.hidden)return;
  if(gameWrap.classList.contains('active')||imApp.classList.contains('active')||settingsApp.classList.contains('active')||songScreen.classList.contains('active')||chapterScreen.classList.contains('active')||songSelectScreen.classList.contains('active'))return;
  if(Math.min(window.innerWidth,window.innerHeight)<820&&ts-city.last<50)return;
  if(settings.motion&&ts-city.last<400)return;
  city.last=ts;
  drawWindowCity(ts);
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
    img.src=src;
  });
}
function preload(){
  const jobs=[
    {label:'SELECT CHANNEL',w:.26,run:()=>waitAudioReady(getUITrack('select'),14000)},
    {label:'PHONE CHANNEL',w:.18,run:()=>waitAudioReady(getUITrack('phone'),10000)},
    {label:'CONFIG CHANNEL',w:.08,run:()=>waitAudioReady(getUITrack('setting'),10000)},
    {label:'NEURAL FEED',w:.18,run:()=>waitAudioReady(getUITrack('im'),10000)},
    {label:'UI AUDIO BUS',w:.02,run:()=>{try{uiPlayer.src=UI_TRACK_FILES.select;uiPlayer.load();uiPlayerKey='select';}catch(e){}}},
    {label:'VISUAL ARCHIVE',w:.16,run:()=>waitImage('cover.jpg')},
    {label:'OPERATOR 01',w:.05,run:()=>waitImage('avatar_im.jpg')},
    {label:'OPERATOR 02',w:.04,run:()=>waitImage('nick_avatar.jpg')},
    {label:'OPERATOR 03',w:.03,run:()=>waitImage('bb.im.jpg')}
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
function enterTerminal(){
  if(state!=='LOGIN')return;
  const name=($('#nameInput').value||'').trim().replace(/\s+/g,' ').slice(0,10);
  if(!name){
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
  return [{id:prefix+'-boss',chapterId:prefix,no:'FINAL',title:'—',artist:'—',charter:'—',bpm:'—',length:'—',notes:0,level:bossLevel,boss:true,chart:null,cover:null,state:'locked'},...normal];
}
const EFFULGENCE={
  id:'ch1-2',chapterId:'ch1',no:'TRACK 01',title:'Effulgence',artist:'WELKIN',charter:'Welkin',
  bpm:'—',length:'02:41',notes:479,level:7,boss:false,chart:'effulgence',audio:'Effulgence.mp3',cover:'Effulgence.jpg',state:'available'
};
const CHAPTERS=[
  {id:'ch1',no:'01',cn:'主线 · 初章',en:'ORIGIN',sub:'THE FIRST SIGNAL',theme:'ch1',layout:'HELIX',progress:'0 / 5',songs:makeMainSongs('ch1',[2,4,6,8],12)},
  {id:'ch2',no:'02',cn:'主线 · 承章',en:'ASCENT',sub:'THE SECOND CURRENT',theme:'ch2',layout:'ORBIT',progress:'0 / 5',songs:makeMainSongs('ch2',[4,6,8,10],14)},
  {id:'ch3',no:'03',cn:'主线 · 终章',en:'TERMINUS',sub:'THE LAST HORIZON',theme:'ch3',layout:'CIRCUIT',progress:'0 / 5',songs:makeMainSongs('ch3',[6,8,10,12],15)},
  {id:'ex',no:'EX',cn:'EX 章节',en:'ANOMALY',sub:'BEYOND THE LINE',theme:'ex',layout:'DIRECT',progress:'LOCKED',locked:true,songs:[]}
];
CHAPTERS[0].songs[1]=EFFULGENCE;
CHAPTERS[0].songs[4]=Object.assign({},CHAPTERS[0].songs[4],{title:'—',artist:'—',charter:'—',chart:null,cover:null,state:'locked'});
CHAPTERS.forEach(ch=>ch.songs.forEach(s=>{s.chapterCn=ch.cn;s.chapterEn=ch.en;s.chapterNo=ch.no;}));
for(const id of ['ch2','ch3']){const ch=CHAPTERS.find(c=>c.id===id);if(ch)ch.songs.forEach(s=>{s.state='locked';});}
const CLEAR_KEY='welkin_os_clears_v1';
let clears={};
try{const raw=JSON.parse(localStorage.getItem(CLEAR_KEY)||'{}');if(raw&&typeof raw==='object')clears=raw;}catch(e){}
function saveClears(){try{localStorage.setItem(CLEAR_KEY,JSON.stringify(clears));}catch(e){}}
function syncChapterProgress(){
  CHAPTERS.forEach(ch=>{
    if(ch.locked){ch.cleared=0;ch.progress='LOCKED';return;}
    const ids=Array.isArray(clears[ch.id])?clears[ch.id]:[];
    ch.cleared=ids.length;
    ch.progress=`${ids.length} / ${ch.songs.length}`;
    ch.songs.forEach(s=>{if(ids.includes(s.id))s.state='clear';});
  });
}
function markSongCleared(song){
  if(!song)return;
  const ch=CHAPTERS.find(c=>c.id===song.chapterId);if(!ch)return;
  if(!Array.isArray(clears[ch.id]))clears[ch.id]=[];
  if(!clears[ch.id].includes(song.id))clears[ch.id].push(song.id);
  song.state='clear';
  ch.cleared=clears[ch.id].length;
  ch.progress=`${ch.cleared} / ${ch.songs.length}`;
  saveClears();
}
syncChapterProgress();
let currentChapter=CHAPTERS[0],chapterFocus=0,selectedChapter=CHAPTERS[0];
let selectedSong=EFFULGENCE,detailSource='songselect',detailReadyAt=0,uiLockUntil=0;
const SS_POS={
  ch1:[[50,1],[67,79],[33,60],[67,41],[33,22]],
  ch2:[[50,1],[67,79],[33,60],[67,41],[33,22]],
  ch3:[[50,1],[67,79],[33,60],[67,41],[33,22]]
};
const SS_POS_M={
  ch1:[[50,1],[70,80],[30,61],[70,42],[30,23]],
  ch2:[[50,1],[70,80],[30,61],[70,42],[30,23]],
  ch3:[[50,1],[70,80],[30,61],[70,42],[30,23]]
};
function chapterPreviewHTML(ch){
  return `<div class="ch-art"></div><div class="ch-big">${ch.no}</div>
    <div class="ch-info"><span>${ch.locked?'ACCESS DENIED':'NOW SELECTING'}</span><h2>${ch.cn}</h2><p>${ch.en} — ${ch.sub}</p><b>${ch.locked?'CHAPTER LOCKED':'ENTER CHAPTER →'}</b></div>
    <div class="ch-progress"><b>${ch.progress}</b>CHAPTER PROGRESS</div>`;
}
function updateChapterFocus(i){
  chapterFocus=i;
  $$('#chapterCards .ch-card').forEach((el,j)=>el.classList.toggle('on',j===i));
  const ch=CHAPTERS[i];
  $('#chapterPreview').innerHTML=chapterPreviewHTML(ch);
  $('#chapterPreview').classList.toggle('attack',ch.id==='ch2');
}
function renderChapterSelect(){
  $('#chapterPreview').innerHTML=chapterPreviewHTML(CHAPTERS[chapterFocus]);
  $('#chapterPreview').classList.toggle('attack',CHAPTERS[chapterFocus].id==='ch2');
  $('#chapterCards').innerHTML=CHAPTERS.map((ch,i)=>`<button type="button" class="ch-card ${i===chapterFocus?'on':''} ${ch.id==='ex'?'ex':''} ${ch.locked?'locked':''} ${ch.id==='ch2'?'attack':''}" data-i="${i}">
    <span class="ch-no">${ch.no}</span><span class="ch-en">${ch.en}</span><h3>${ch.cn}</h3><p>${ch.sub}</p>${ch.locked?'<span class="ch-lock">ACCESS LOCKED</span>':''}<span class="ch-bar"><i style="width:${ch.locked?0:Math.round((ch.cleared||0)/Math.max(1,ch.songs.length)*100)}%"></i></span>
  </button>`).join('');
  $$('#chapterCards .ch-card').forEach(el=>{
    const i=Number(el.dataset.i);
    el.addEventListener('mouseenter',()=>{if(i!==chapterFocus)updateChapterFocus(i);});
    el.addEventListener('focus',()=>{if(i!==chapterFocus)updateChapterFocus(i);});
    el.addEventListener('click',()=>{
      if(performance.now()<uiLockUntil)return;
      const ch=CHAPTERS[i];chapterFocus=i;
      if(ch.locked){
        updateChapterFocus(i);
        const card=$('#chapterCards .ch-card[data-i="'+i+'"]');
        if(card){card.classList.add('denied');setTimeout(()=>card.classList.remove('denied'),420);}
        uiSound(.55);
        return;
      }
      if(ch.id==='ex'){selectedChapter=ch;return;}
      openSongSelect(ch);
    });
  });
}
function openChapterSelect(){
  if(state==='GAME'||state==='PAUSED'||state==='RESULT'||state==='CHAPTER'||state==='SONGSELECT'||state==='LOADING')return;
  chapterFocus=0;selectedChapter=CHAPTERS[0];
  chapterScreen.classList.add('active');
  chapterScreen.classList.remove('closing');
  songSelectScreen.classList.remove('active');
  songScreen.classList.remove('active');
  state='CHAPTER';
  uiLockUntil=performance.now()+300;
  renderChapterSelect();
  playUIMusic('select',true);
  uiSound(1.15);
}
function closeChapterSelect(){
  if(!chapterScreen.classList.contains('active'))return;
  chapterScreen.classList.remove('active');
  if(state==='CHAPTER')state='PHONE';
  syncUIMusic(true);
  uiSound(.9);
}
function openSongSelect(ch){
  if(!ch||ch.id==='ex')return;
  currentChapter=ch;selectedChapter=ch;
  chapterScreen.classList.remove('active');
  songScreen.classList.remove('active');
  songSelectScreen.classList.add('active');
  state='SONGSELECT';
  uiLockUntil=performance.now()+240;
  renderSongSelect();
  playUIMusic('select',false);
  uiSound(1.05);
}
function closeSongSelect(){
  if(!songSelectScreen.classList.contains('active'))return;
  songSelectScreen.classList.remove('active');
  chapterScreen.classList.add('active');
  state='CHAPTER';
  renderChapterSelect();
  playUIMusic('select',false);
  uiSound(.9);
}
function songNodeHTML(song,i,pos){
  const stateClass=song.state==='available'?'avail':song.state==='clear'?'clear':'locked';
  const disabled=(song.state==='available'||song.state==='clear')?'':'disabled';
  return `<button type="button" class="ss-node ${stateClass} ${song.boss?'boss':''}" data-i="${i}" ${disabled} style="left:${pos[0]}%;top:${pos[1]}%;height:${song.boss?'21%':'18%'}">
    <span class="ss-cover ${song.cover?'art':''}">${song.boss?'<i class="boss-frame"></i>':''}${song.cover?`<img src="${song.cover}" alt="">`:''}</span><span class="ss-copy"><span class="ss-num">${song.boss?'FINAL / 05':song.no}</span><h3>${song.title}</h3><span class="ss-sub">${song.boss?'BOSS / SIGNAL UNKNOWN':song.artist}</span></span>
    <span class="ss-state">${song.state==='available'?'READY':song.state==='clear'?'CLEAR':'LOCKED'}</span>${song.boss?'<i class="glitch"></i>':''}
  </button>`;
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
  const pts=window.innerWidth<700?(SS_POS_M[ch.id]||SS_POS_M.ch1):(SS_POS[ch.id]||SS_POS.ch1);
  $('#ssNodes').innerHTML=ch.songs.map((s,i)=>songNodeHTML(s,i,pts[i])).join('');
  const mob=window.innerWidth<700;
  const centers=pts.map((p,i)=>[p[0],p[1]+(i===0?10.5:9)]);
  const pathOrder=centers.length===5?[0,4,3,2,1]:centers.map((_,i)=>i);
  const pathCenters=pathOrder.map(i=>centers[i]);
  let d='M '+pathCenters[0][0]+' '+pathCenters[0][1];
  for(let i=1;i<pathCenters.length;i++){
    const p=pathCenters[i],q=pathCenters[i-1];
    if(layout==='ORBIT'){const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;d+=` Q ${mx} ${q[1]} ${mx} ${my} T ${p[0]} ${p[1]}`;}
    else if(layout==='CIRCUIT'){d+=` L ${p[0]} ${q[1]} L ${p[0]} ${p[1]}`;}
    else {d+=` C ${q[0]} ${(q[1]+p[1])/2} ${p[0]} ${(q[1]+p[1])/2} ${p[0]} ${p[1]}`;}
  }
  $('#ssPath').innerHTML=`<path class="ss-base" d="${d}" vector-effect="non-scaling-stroke"/><path class="ss-line" d="${d}" vector-effect="non-scaling-stroke"/>${pathCenters.map(p=>`<circle class="ss-dot" cx="${p[0]}" cy="${p[1]}" r=".8" vector-effect="non-scaling-stroke"/>`).join('')}`;
  const avail=ch.songs.find(s=>s.state==='available');
  $('#ssSide').innerHTML=`<span class="ss-kicker">CHAPTER ${ch.no} / ${ch.en}</span><h2>${ch.cn}</h2><p>${ch.sub}<br>BOSS AT TOP · ONE BY ONE UNLOCK</p><div class="ss-rule"></div><div class="ss-prog"><b>${ch.progress}</b>CHAPTER PROGRESS</div><div class="ss-unlock">NEXT UNLOCK<br><b>${avail?avail.no+' — READY':'—'}</b></div>`;
  $$('#ssNodes .ss-node').forEach(el=>{
    el.addEventListener('click',()=>{
      if(performance.now()<uiLockUntil)return;
      const song=ch.songs[Number(el.dataset.i)];
      if(song&&(song.state==='available'||song.state==='clear')){selectedChapter=ch;openSongDetail(song,'songselect');}
    });
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
  $('#songBpm').textContent=song.bpm;
  $('#songLength').textContent=song.length;
  $('#songCharter').textContent=song.charter;
  $('#songLevel').textContent=song.level+' / 15';
  $('#songDiff').innerHTML=Array.from({length:15},(_,i)=>`<i class="${i<song.level?'on':''}"></i>`).join('');
  const hasBest=!!song.chart&&best&&best.score>0;
  $('#songBest').textContent=hasBest?pad7(best.score):'0000000';
  $('#songRank').textContent=hasBest?(best.rank||'—'):'—';
  $('#songAcc').textContent=hasBest&&best.acc!=null?best.acc.toFixed(2)+'%':'—';
  $('#badgeAP').classList.toggle('on',!!(hasBest&&best.ap));
  $('#badgeFC').classList.toggle('on',!!(hasBest&&best.fc&&!best.ap));
  $('#coverImg').style.display=blank?'none':'block';
  $('#coverImg').src=song.cover||'cover.jpg';
  $('#coverInner').classList.toggle('blank',blank);
  $('#coverBlankText').textContent=`${song.chapterCn} / ${song.no}`;
  $('#coverSignTitle').textContent=song.title;
  $('#coverSignArtist').textContent=song.artist;
  $('#coverRailRight').textContent=`${song.chapterNo} / ${song.no}`;
  $('#songBg').style.backgroundImage=blank?'none':`url('${song.cover||'cover.jpg'}')`;
  $('#songMarquee').textContent=`WELKIN AUDIO SYSTEM · ${song.chapterEn} · ${song.bpm==='—'?'BPM PENDING':song.bpm+' BPM'} · FOUR LANES · ${song.chart?'ALL SYSTEMS NOMINAL':'CHART DATA PENDING'} ·`;
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
  chapterScreen.classList.remove('active');
  songSelectScreen.classList.remove('active');
  songScreen.classList.add('active');
  state='SONG';
  renderSongDetail(song);
  playUIMusic('select',false);
  uiSound(1.1);
}
function closeSongDetail(){
  if(!songScreen.classList.contains('active'))return;
  songScreen.classList.remove('active');
  if(detailSource==='chapter'){
    chapterScreen.classList.add('active');
    state='CHAPTER';
    chapterFocus=Math.max(0,CHAPTERS.findIndex(c=>c.id===selectedSong.chapterId));
    renderChapterSelect();
  }else{
    songSelectScreen.classList.add('active');
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
  renderFeed('feed');
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
  $('#vSpeed').textContent=(+settings.speed).toFixed(2)+'×';
  $('#vDim').textContent=Math.round(settings.dim)+'%';
  $('#vVol').textContent=Math.round(settings.volume)+'%';
  setSwitch('#tEarly',settings.early);
  setSwitch('#tHit',settings.hit);
  setSwitch('#tUI',settings.ui);
  setSwitch('#tMotion',settings.motion);
  if(user)$('#setUser').textContent=user.name;
}
function setSwitch(sel,on){
  const el=$(sel);if(!el)return;
  el.setAttribute('aria-checked',on?'true':'false');
}
function applySettings(){
  bgm.volume=clamp(settings.volume/100,0,1);
  try{uiPlayer.volume=uiMusicVolume();}catch(e){}
  Object.keys(uiTracks).forEach(k=>{const a=uiTracks[k];if(a)a.volume=uiMusicVolume();});
  if(typeof updateScrollSpeed==='function')updateScrollSpeed();
  document.body.classList.toggle('reduce-motion',settings.motion);
  saveSettings();
}

/* ============================================================
   7. iM community
   ============================================================ */
const IM_POSTS=[
  {
    id:'welkin',name:'WELKIN',role:'CREATOR',avatar:'avatar_im.jpg',time:'JUST NOW',likes:99,pinned:true,
    text:'大家好！欢迎来到我制作的小音游，以后会加油更新，希望大家多多支持！该网址可以电脑打开游玩，按键控制是cvbn键，对应四个轨道！谢谢大家！',
    comments:[
      {name:'SYSTEM',avatar:'📡',bg:'#9fb6c2',text:'正在更新中！'},
      {name:'—',avatar:'😡',bg:'#ffcccc',text:'啥时候出新歌？'}
    ]
  },
  {
    id:'nick',name:'Nick',role:'OPERATOR',avatar:'nick_avatar.jpg',time:'1H AGO',likes:12,pinned:false,
    text:'祝Welkin天天开心，永远不死',
    comments:[{name:'NEKO',avatar:'🐱',bg:'#ffb6c1',text:'带我一个！(⁎⁍̴̛ᴗ⁍̴̛⁎)'}]
  },
  {
    id:'jirong',name:'季绒',role:'OPERATOR',avatar:'bb.im.jpg',time:'3H AGO',likes:8,pinned:false,
    text:'jj加油！',
    comments:[{name:'NEKO',avatar:'🐱',bg:'#ffb6c1',text:'哇库^o^'}]
  }
];
function updatePhonePanels(){
  const p=IM_POSTS[0];
  if(!p)return;
  const n=$('#msgName'),a=$('#msgAvatar');
  if(n)n.textContent=p.name;
  if(a){a.src=p.avatar;a.onerror=()=>{a.style.display='none';};}
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
    renderFeed($('.im-tab.active')?.dataset.tab||'feed');
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
    uiPlayer.play().then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});
  };
  uiPlayer.oncanplay=()=>{if(uiCurrent===key&&uiPlayer.paused)start();};
  start();
}
function syncUIMusic(restart=false){
  if(settingsApp.classList.contains('active'))return playUIMusic('setting',restart);
  if(imApp.classList.contains('active')&&!imApp.classList.contains('im-closing'))return playUIMusic('im',restart);
  if(state==='PHONE')return playUIMusic('phone',restart);
  if((state==='CHAPTER'||state==='SONGSELECT'||state==='SONG')&&(chapterScreen.classList.contains('active')||songSelectScreen.classList.contains('active')||songScreen.classList.contains('active')))return playUIMusic('select',restart);
  playUIMusic(null);
}
function retryUIMusic(){
  if(!uiCurrent)return;
  if(uiPlayer.paused){try{uiPlayer.currentTime=0;}catch(e){}uiPlayer.volume=0;uiPlayer.play().then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});}
}
function stopAllUIMusic(){
  uiFadeToken++;
  try{uiPlayer.pause();uiPlayer.volume=0;}catch(e){}
  uiCurrent='';
}


/* ============================================================
   9. gameplay —constants, chart, audio clock
   ============================================================ */
const PERFECT_WINDOW=.100,GOOD_WINDOW=.150,BAD_WINDOW=.200,CHART_OFFSET=-.2;
const MISS_GRACE=.09;
const MUSIC_DELAY=.3;
let SONG_DURATION=242.0,FINAL_CHORD_TIME=239.0+CHART_OFFSET;
const CHART_META={
  effulgence:{duration:161,final:157.2}
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
  lastDelta:0,lastType:''
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
      if(Math.abs(game.notes[i].time-game.notes[j].time)<0.03)c++;
    }
    game.notes[i].is_chord=c>=2;
    game.notes[i].is_multi=c>=3;
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
  // 73.6-91: gaps +0.2s, config every 1s, continuous 5-double groups
  const pairs=[[1,2],[0,3],[1,3],[0,2],[2,3],[0,1]];
  t=73.6;
  let guard=0;
  while(t<90.95&&guard++<80){
    for(let k=0;k<5&&t<90.95;k++){
      const et=t;
      const cfg=pairs[Math.floor((et-73.6)/1)%pairs.length];
      D(cfg[0],cfg[1],et,'tap');
      tap((cfg[0]+2)%4,et+0.3);
      t+=0.6;
    }
  }
  D(1,2,91,'tap');
  for(i=0;i<4;i++)tap(2,91.1+i*0.15);
  for(i=0;i<4;i++)tap(1,91.6+i*0.15);
  for(t=92.1;t<=93.401;t+=0.1)tap((Math.round((t-92.1)*10)%2===0)?0:3,t);
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
  brk(1,152.8);brk(2,154.7);brk(3,155.4);
  D(1,2,155.6,'tap');
  D(0,3,157,'hold',159);

}
function generateBeatmap(){
  game.notes=[];
  if(selectedSong&&selectedSong.chart==='effulgence')EFF();
  finalizeChart();
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
  const t=Math.max(MUSIC_DELAY,bgm.currentTime+MUSIC_DELAY);
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
  if(!audioStarted&&!audioGateDone&&game.clock>=MUSIC_DELAY&&performance.now()>=audioRetryAfter){
    if(!audioGate){
      audioGate=true;audioGateSince=performance.now();
      game.clock=MUSIC_DELAY;
      clockAnchor=performance.now()-MUSIC_DELAY*1000;
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
  if(game.clock<MUSIC_DELAY)return;
  if(!audioStarted)return;
  const now=performance.now();
  if(now-lastHealthCheck<500)return;
  lastHealthCheck=now;
  if(bgm.paused&&!playPending){
    if(!bgTimeInitialized){lastBgTimeChangeAt=now;bgTimeInitialized=true;return;}
    if(now-lastBgTimeChangeAt>2000&&now>=audioRetryAfter){
      const expected=Math.max(0,game.clock-MUSIC_DELAY);
      try{bgm.currentTime=expected;}catch(e){}
      if(startAudio())audioStarted=true;
      lastBgTimeChangeAt=now;bgTimeInitialized=false;
    }
    return;
  }
  bgTimeInitialized=false;
  if(!bgm.paused&&now-lastSeekTime>3000){
    const expected=Math.max(0,game.clock-MUSIC_DELAY);
    if(Math.abs(bgm.currentTime-expected)>.5){try{bgm.currentTime=expected;}catch(e){}lastSeekTime=now;}
  }
}

/* ============================================================
   10. gameplay —judgement
   ============================================================ */
function judgementClock(stamp){
  const now=performance.now();
  const et=(typeof stamp==='number'&&stamp>0&&stamp<=now+2&&now-stamp<120)?stamp:now;
  return isPlaying?(et-clockAnchor)/1000:game.clock;
}
function judgeBreak(n){
  if(n.judged)return;
  n.judged=true;
  game.lastDelta=0;game.lastType='';
  game.perfect++;game.weightSum+=1;game.combo++;
  game.feedback='PERFECT';game.feedbackType='P';game.feedbackTimer=.62;game.comboScale=1.5;feedbackYOffset=0;
  game.judgeLineGlow=1;game.screenShake=Math.max(game.screenShake,2);
  addHitFx(n.lane,0,n.is_chord,n.is_multi);playBreakSfx(n.lane);
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
  addHitFx(n.lane,quality==='P'?0:1,n.is_chord,n.is_multi);
  playHitSfx(n.lane,quality==='P'?0:1);
  if(game.combo>game.maxCombo)game.maxCombo=game.combo;
}
function failHold(n){
  if(n.holdFailed)return;
  n.holdFailed=true;n.holdActive=false;game.combo=0;
  game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
  addMissFx(n.lane);
}
function finishHold(n){
  if(n.holdDone)return;
  n.holdDone=true;n.holdActive=false;n.judged=true;
  if(n.holdFailed){game.miss++;return;}
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
  const now=judgementClock(stamp);
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
  const nowClock=judgementClock(stamp);
  let bestIdx=-1,bestTime=Infinity;
  for(let i=0;i<game.notes.length;i++){
    const n=game.notes[i];
    if(n.judged||n.lane!==lane)continue;
    const ahead=n.time-nowClock;
    if(n.type==='break')continue;
    if(ahead>=-BAD_WINDOW&&ahead<=BAD_WINDOW&&n.time<bestTime){
      bestTime=n.time;bestIdx=i;
    }
  }
  if(bestIdx!==-1){
    const n=game.notes[bestIdx];
    const dt=n.time-nowClock,bestDt=Math.abs(dt);
    game.lastDelta=dt;game.lastType='';
    if(n.type==='break'){judgeBreak(n);return;}
    if(n.type==='hold'){
      const quality=bestDt<=PERFECT_WINDOW?'P':'G';
      if(Math.abs(dt)>.012)game.lastType=dt>0?'EARLY':'LATE';
      startHold(n,quality);
      return;
    }
    n.judged=true;
    if(bestDt<=PERFECT_WINDOW){
      game.perfect++;game.weightSum+=1;game.combo++;
      game.feedback='PERFECT';game.feedbackType='P';game.judgeLineGlow=1;game.screenShake=2.0;
      addHitFx(lane,0,n.is_chord,n.is_multi);playHitSfx(lane,0);
    }else if(bestDt<=GOOD_WINDOW){
      game.good++;game.weightSum+=.65;game.combo++;
      game.feedback='GOOD';game.feedbackType='G';game.judgeLineGlow=.6;game.screenShake=1.5;
      addHitFx(lane,1,n.is_chord,n.is_multi);playHitSfx(lane,1);
    }else{
      game.bad++;game.combo=0;game.feedback='BAD';game.feedbackType='B';
      addHitFx(lane,2,n.is_chord,n.is_multi);
    }
    if(Math.abs(dt)>.012)game.lastType=dt>0?'EARLY':'LATE';
    game.feedbackTimer=.62;game.comboScale=1.5;feedbackYOffset=0;
    if(game.combo>game.maxCombo)game.maxCombo=game.combo;
    if(Math.abs(n.time-FINAL_CHORD_TIME)<.05)game.flashAlpha=.5;
    if(game.combo>0&&game.combo%50===0)game.whiteFlash=Math.min(.14,game.whiteFlash+.06);
  }else{
    game.laneFlash[lane]=Math.min(1,game.laneFlash[lane]+.2);
  }
}

/* ============================================================
   11. gameplay —hit sound & effects
   ============================================================ */
const HIT_B64="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";
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
      const g=c.createGain();g.gain.value=type===0?.44:.34;
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
      const out=c.createGain();out.gain.value=.22;out.connect(c.destination);
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
  game.laneFlash[lane]=Math.min(1,game.laneFlash[lane]+(type===0?.55:.34));
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
  const dprCap=mobile?(Math.min(w,h)>=700?1.15:1.25):2;
  const dpr=clamp(window.devicePixelRatio||1,1,dprCap);
  V.w=w;V.h=h;V.dpr=dpr;V.portrait=h>w*1.02;
  const aspect=w/h;
  if(V.portrait)V.trackW=Math.min(w*.94,h*.62,640);
  else if(aspect>1.7)V.trackW=Math.min(w*.70,h*1.45,1200);
  else V.trackW=Math.min(w*.66,h*1.35,1100);
  V.laneW=V.trackW/4;
  V.x=(w-V.trackW)/2;
  V.judgeY=h*(V.portrait?.79:.82);
  V.noteH=clamp(V.laneW*.15,14,28);
  V.lowFx=mobile;
  updateScrollSpeed();
  stage.width=Math.round(w*dpr);stage.height=Math.round(h*dpr);
  stage.style.width=w+'px';stage.style.height=h+'px';
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
function buildNoteSprite(kind){
  const bw=Math.max(24,V.laneW*.86),bh=Math.max(10,V.noteH);
  const pad=Math.max(24,V.laneW*.32);
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
  const n=Math.round(clamp(V.w*V.h/14000,40,150)*(V.lowFx?.58:1));
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
  SONG_DURATION=meta.duration;FINAL_CHORD_TIME=meta.final;
  game={
    clock:-3,perfect:0,good:0,bad:0,miss:0,combo:0,maxCombo:0,weightSum:0,
    feedback:'',feedbackType:'',feedbackTimer:0,comboScale:1,screenShake:0,
    judgeLineGlow:0,bpmPulse:0,flashAlpha:0,whiteFlash:0,
    notes:[],effects:[],keyHold:[false,false,false,false],laneFlash:[0,0,0,0],
    lastDelta:0,lastType:'',lastShakeBeat:-1
  };
  generateBeatmap();
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
  if(state==='GAME'&&isPlaying){
    perfAcc+=dt;perfN++;
    if(perfN>=90){
      const avg=perfAcc/perfN;
      if(avg>.027)V.lowFx=true;
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
      if(pausedClock>=MUSIC_DELAY){
        resumePendingStart=true;resumePendingTimer=0;
        try{bgm.currentTime=Math.max(0,pausedClock-MUSIC_DELAY);}catch(e){}
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
    const target=Math.max(0,pausedClock-MUSIC_DELAY);
    const ready=!playPending&&!bgm.paused&&Math.abs(bgm.currentTime-target)<.2;
    resumePendingTimer+=dt;
    if(ready||resumePendingTimer>3){
      if(ready)game.clock=bgm.currentTime+MUSIC_DELAY;
      else{game.clock=pausedClock;audioStarted=false;}
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
    game.clock=MUSIC_DELAY;
    clockAnchor=performance.now()-MUSIC_DELAY*1000;
    return;
  }
  if(!isPlaying)return;

  const phase=(game.clock%.4+.4)%.4;
  game.bpmPulse=Math.pow(1-phase/.4,3);
  const at=game.clock-MUSIC_DELAY;
  let shakeBeat=-1,shakeAmt=0;
  if(at>=52.8&&at<61){shakeBeat=Math.floor((at-52.8)*1);shakeAmt=6.5;}
  else if(at>=94&&at<96){shakeBeat=Math.floor((at-94)*4);shakeAmt=3.0;}
  else if(at>=97&&at<130){shakeBeat=Math.floor(at-97);shakeAmt=5.5;}
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
    if(n.type==='break'&&!n.judged&&!n.breakArmed&&game.clock>n.time+.11){
      n.judged=true;game.miss++;game.combo=0;
      game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
      addMissFx(n.lane);
      continue;
    }
    if(n.type==='break')continue;
    if(n.type==='hold'&&!n.headHit&&!n.judged&&game.clock>n.time+BAD_WINDOW+MISS_GRACE){
      n.judged=true;n.holdFailed=true;game.miss++;game.combo=0;
      game.feedback='MISS';game.feedbackType='M';game.feedbackTimer=.62;feedbackYOffset=0;
      addMissFx(n.lane);
      continue;
    }
    if(!n.judged&&game.clock>n.time+BAD_WINDOW+MISS_GRACE){
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
  if(game.clock>SONG_DURATION+MUSIC_DELAY)endGame();
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
/* on-demand song loading: only the selected track is fetched */
let songLoadToken=0,songLoadTimer=0;
function fmtTime(sec){const s=Math.max(0,Math.round(sec||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
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
  closeSongLoading();
  try{bgm.pause();}catch(e){}
  state='SONG';
  songScreen.classList.add('active');
  playUIMusic('select',true);
  uiSound(.7);
}
function loadSongForSession(song,done){
  const token=++songLoadToken;
  const startedAt=performance.now();
  ensureAudioCtx();unlockAudio();buildHitSounds();
  stopAllUIMusic();
  state='LOADING';
  const b=$('#btnStartGame');if(b)b.disabled=true;
  songLoading.classList.add('active');
  $('#slTitle').textContent=song.title.toUpperCase();
  $('#slChapter').textContent=`${song.chapterEn||'ORIGIN'} / ${song.no}`;
  $('#slBytes').textContent='0.00 MB';
  songLoadingSet(0,'REQUESTING','OPENING AUDIO CHANNEL');
  try{bgm.pause();bgm.src=song.audio;bgm.preload='auto';bgm.load();}catch(e){}
  let settled=false,lastPct=0;
  const finish=()=>{
    if(settled||token!==songLoadToken)return;
    settled=true;clearTimeout(songLoadTimer);
    songLoadingSet(94,'LINKED','AUDIO READY');
    const wait=Math.max(0,860-(performance.now()-startedAt));
    setTimeout(()=>{
      if(token!==songLoadToken)return;
      songLoadingSet(100,'LINKED','AUDIO READY');
      setTimeout(()=>{
        if(token!==songLoadToken)return;
        closeSongLoading();
        done();
      },180);
    },wait);
  };
  const fail=()=>{
    if(settled||token!==songLoadToken)return;
    settled=true;clearTimeout(songLoadTimer);
    songLoadingSet(lastPct,'LINK FAILED','AUDIO FILE UNAVAILABLE');
    uiSound(.5);
  };
  const readProgress=()=>{
    if(token!==songLoadToken)return;
    let pct=lastPct;
    try{
      if(bgm.duration&&isFinite(bgm.duration)&&bgm.buffered.length){
        const end=bgm.buffered.end(bgm.buffered.length-1);
        pct=clamp(end/bgm.duration*100,0,99);
      }
      const loaded=bgm.readyState>=3?99:bgm.readyState>=2?72:bgm.readyState>=1?28:8;
      pct=Math.max(pct,loaded);
      if(bgm.duration&&isFinite(bgm.duration)){selectedSong.length=fmtTime(bgm.duration);$('#slBytes').textContent='DUR '+fmtTime(bgm.duration);}
    }catch(e){}
    lastPct=Math.max(lastPct,pct);
    songLoadingSet(lastPct,lastPct>70?'DECODING':'STREAMING',lastPct>70?'BUILDING WAVEFORM':'RECEIVING PACKETS');
  };
  bgm.addEventListener('loadedmetadata',readProgress);
  bgm.addEventListener('progress',readProgress);
  bgm.addEventListener('canplay',readProgress);
  bgm.addEventListener('loadeddata',readProgress);
  bgm.addEventListener('canplaythrough',finish,{once:true});
  bgm.addEventListener('error',fail,{once:true});
  readProgress();
  if(bgm.readyState>=4)setTimeout(finish,0);
  songLoadTimer=setTimeout(()=>{
    if(settled||token!==songLoadToken)return;
    if(bgm.readyState>=2)finish();else fail();
  },18000);
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
  stopAllUIMusic();
  gameWrap.classList.remove('active');
  gameHud.classList.remove('active');
  wipe(()=>{
    openSongDetail(selectedSong,detailSource);
  });
}
function rankOf(acc){
  if(acc>=99.5)return 'S+';
  if(acc>=97)return 'S';
  if(acc>=93)return 'A';
  if(acc>=85)return 'B';
  if(acc>=70)return 'C';
  return 'D';
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
  const rank=isAP?'S+':rankOf(resultAcc);

  const prev=getBestFor(selectedSong?selectedSong.id:'song');
  const scoreBetter=finalScore>prev.score;
  best={
    score:Math.max(prev.score,finalScore),
    acc:scoreBetter?resultAcc:prev.acc,
    ap:prev.ap||isAP,
    fc:prev.fc||isFC,
    combo:Math.max(prev.combo,game.maxCombo),
    rank:Math.max(prev.score,finalScore)===finalScore?rank:prev.rank
  };
  if(selectedSong)saveBestFor(selectedSong.id,best);
  markSongCleared(selectedSong);

  $('#resRank').textContent=rank;
  $('#resScore').textContent='0000000';
  $('#resAcc').textContent=resultAcc.toFixed(2)+'%';
  $('#resP').textContent=game.perfect;
  $('#resG').textContent=game.good;
  $('#resB').textContent=game.bad;
  $('#resM').textContent=missShown;
  $('#resC').textContent=game.maxCombo;
  const v=$('#resVerdict');
  v.textContent=isAP?'ALL PERFECT':(isFC?'FULL COMBO':'');
  v.style.color=isAP?'#ffcf6a':'#22e4ff';
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
function handleDown(clientX,clientY,id,stamp){
  if(state!=='GAME'||resumeCountdown>0||resumePendingStart)return;
  const nowClock=judgementClock(stamp);
  if(nowClock<0)return;
  if(audioStarted&&bgm.paused&&!playPending&&nowClock>=MUSIC_DELAY){
    const expected=Math.max(0,nowClock-MUSIC_DELAY);
    try{bgm.currentTime=expected;}catch(e){}
    if(startAudio())audioSyncPending=true;
  }
  const rect=stage.getBoundingClientRect();
  const x=(clientX-rect.left)/Math.max(1,rect.width)*V.w;
  const lane=Math.floor((x-V.x)/V.laneW);
  if(lane>=0&&lane<4){pointerLanes[id]=lane;game.keyHold[lane]=true;judgeLane(lane,stamp);judgeYellowTouch(lane,stamp);}
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
  const rect=stage.getBoundingClientRect();
  const x=(clientX-rect.left)/Math.max(1,rect.width)*V.w;
  const lane=Math.floor((x-V.x)/V.laneW);
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
    if(settingsApp.classList.contains('active')){closeSettings();return;}
    if(imApp.classList.contains('active')){
      if($('#imDetail').classList.contains('active')){$('#imDetail').classList.remove('active');uiSound(.9);}
      else closeIM();
      return;
    }
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
  if(document.hidden){if(state==='GAME')pauseGame();playUIMusic(null);}
  else syncUIMusic();
});

/* ============================================================
   16. gameplay —renderer
   ============================================================ */
function drawGame(dt){
  const c=sctx;
  c.setTransform(V.dpr,0,0,V.dpr,0,0);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  drawBackdrop();

  const shake=game.screenShake*(V.h/720);
  c.save();
  if(shake>.2)c.translate(rand(-shake,shake),rand(-shake,shake));
  drawPlayfield();
  if(settings.dim>0){
    c.fillStyle='rgba(0,0,0,'+(settings.dim/100*.58).toFixed(3)+')';
    c.fillRect(0,0,V.w,V.h);
  }
  drawFog();
  drawStageLight();
  drawNotes();
  drawTopFade();
  drawHitLine();
  drawFx();
  drawReceptors();
  c.restore();

  drawCombo();
  drawJudgement();
  drawBottomMeta();
  drawSectionFx();
  drawCountdown();

  if(game.flashAlpha>0){c.fillStyle='rgba(225,250,255,'+(game.flashAlpha*.3).toFixed(3)+')';c.fillRect(0,0,V.w,V.h);}
  if(game.whiteFlash>0){c.fillStyle='rgba(170,235,255,'+game.whiteFlash.toFixed(3)+')';c.fillRect(0,0,V.w,V.h);}
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

function drawBackdrop(){
  const c=sctx,t=game.clock,pulse=game.bpmPulse,w=V.w,h=V.h;
  const bg=c.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#04101c');bg.addColorStop(.46,'#030812');bg.addColorStop(1,'#010306');
  c.fillStyle=bg;c.fillRect(0,0,w,h);

  const hg=c.createRadialGradient(w/2,h*.56,0,w/2,h*.56,w*.66);
  hg.addColorStop(0,'rgba(20,120,180,'+(.16+pulse*.06)+')');
  hg.addColorStop(.55,'rgba(10,60,110,.05)');
  hg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=hg;c.fillRect(0,0,w,h);

  // vertical light shafts
  c.save();c.globalCompositeOperation='lighter';
  const shaftN=V.lowFx?2:4;
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

  // perspective floor
  const horizon=h*.7;
  c.save();
  for(let i=0;i<=20;i++){
    const f=i/20,x0=w/2+(f-.5)*w*.18,x1=w/2+(f-.5)*w*2.5;
    c.strokeStyle='rgba(40,165,225,'+(.07+pulse*.04)+')';
    c.lineWidth=1;
    c.beginPath();c.moveTo(x0,horizon);c.lineTo(x1,h);c.stroke();
  }
  const off=(t*.15)%1;
  for(let i=0;i<14;i++){
    const tt=(i/14+off)%1,y=horizon+Math.pow(tt,2.4)*(h-horizon);
    c.strokeStyle='rgba(46,180,232,'+(.1*(1-tt)*(.6+pulse)).toFixed(3)+')';
    c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();
  }
  c.restore();

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
  c.fillText('V',w/2,h*.52);
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

function drawPlayfield(){
  const c=sctx,x=V.x,w=V.trackW,y=V.judgeY;
  const pulse=game.bpmPulse;
  const halo=c.createRadialGradient(x+w/2,y,0,x+w/2,y,w*.95);
  halo.addColorStop(0,'rgba(30,150,215,'+(.13+pulse*.08)+')');halo.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=halo;c.fillRect(0,0,V.w,V.h);
  const under=c.createRadialGradient(x+w/2,y,0,x+w/2,y,w*.7);
  under.addColorStop(0,'rgba(70,220,255,'+(.16+pulse*.1)+')');
  under.addColorStop(.5,'rgba(20,120,180,.05)');
  under.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=under;c.fillRect(x-w*.2,y-w*.6,w*1.4,w*1.2);

  const tg=c.createLinearGradient(0,0,0,V.h);
  tg.addColorStop(0,'rgba(5,12,22,0)');
  tg.addColorStop(.2,'rgba(6,16,29,.55)');
  tg.addColorStop(1,'rgba(9,22,39,.74)');
  c.fillStyle=tg;c.fillRect(x,0,w,V.h);

  // lane columns
  for(let i=0;i<4;i++){
    const lg=c.createLinearGradient(0,0,0,V.h);
    lg.addColorStop(0,'rgba(34,228,255,0)');
    lg.addColorStop(.65,'rgba(34,228,255,'+((i%2?.028:.045)+pulse*.016)+')');
    lg.addColorStop(1,'rgba(34,228,255,.07)');
    c.fillStyle=lg;c.fillRect(x+i*V.laneW,0,V.laneW,V.h);
  }

  // holds / lane flash
  for(let i=0;i<4;i++){
    const a=Math.max(game.keyHold[i]?.34:0,game.laneFlash[i]);
    if(a<=.01)continue;
    const bx=x+i*V.laneW;
    const bg=c.createLinearGradient(0,y,0,V.h);
    bg.addColorStop(0,'rgba(60,210,255,'+(.32*a).toFixed(3)+')');
    bg.addColorStop(.6,'rgba(40,150,220,'+(.1*a).toFixed(3)+')');
    bg.addColorStop(1,'rgba(20,80,140,0)');
    c.fillStyle=bg;c.fillRect(bx+1.5,y,V.laneW-3,V.h-y);
    const top=c.createLinearGradient(0,y-90,0,y);
    top.addColorStop(0,'rgba(34,228,255,0)');
    top.addColorStop(1,'rgba(34,228,255,'+(.1*a).toFixed(3)+')');
    c.fillStyle=top;c.fillRect(bx+1.5,y-90,V.laneW-3,90);
  }

  // dividers
  const dg=c.createLinearGradient(0,0,0,V.h);
  dg.addColorStop(0,'rgba(120,220,255,0)');
  dg.addColorStop(.55,'rgba(120,220,255,.16)');
  dg.addColorStop(.92,'rgba(120,220,255,.42)');
  dg.addColorStop(1,'rgba(120,220,255,.1)');
  c.strokeStyle=dg;c.lineWidth=1;
  for(let i=0;i<=4;i++){
    const lx=Math.round(x+i*V.laneW)+.5;
    c.beginPath();c.moveTo(lx,0);c.lineTo(lx,V.h);c.stroke();
  }
  c.strokeStyle='rgba(34,228,255,.32)';
  c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,V.h);c.moveTo(x+w-.5,0);c.lineTo(x+w-.5,V.h);c.stroke();

  // scan band inside the conduit
  const sy=((game.clock*150)%(V.h+160))-80;
  const scan=c.createLinearGradient(0,sy-80,0,sy+80);
  scan.addColorStop(0,'rgba(34,228,255,0)');
  scan.addColorStop(.5,'rgba(34,228,255,.055)');
  scan.addColorStop(1,'rgba(34,228,255,0)');
  c.fillStyle=scan;c.fillRect(x,sy-80,w,160);
  c.fillStyle='rgba(140,240,255,.12)';c.fillRect(x,sy,w,1);

  // side brackets / ticks
  c.strokeStyle='rgba(34,228,255,.22)';
  const tick=(game.clock*40)%26;
  for(let yy=-26+tick;yy<V.h;yy+=26){
    if(yy<0)continue;
    c.beginPath();c.moveTo(x-6,yy);c.lineTo(x-1,yy);c.moveTo(x+w+1,yy);c.lineTo(x+w+6,yy);c.stroke();
  }
}

function drawHoldObject(n,cx,y,ty,alpha,isFinal,bodyOnly){
  const c=sctx,hw=Math.max(14,V.laneW*.46),top=Math.min(y,ty),bottom=Math.max(y,ty),bh=bottom-top;
  const failed=!!n.holdFailed;
  c.save();
  c.globalAlpha=failed?Math.min(alpha,.38):alpha*.96;
  // obsidian body: black glass with cyan edges
  const bodyGrad=c.createLinearGradient(0,top,0,bottom);
  bodyGrad.addColorStop(0,'rgba(2,7,11,.92)');
  bodyGrad.addColorStop(.45,'rgba(7,18,24,.88)');
  bodyGrad.addColorStop(1,'rgba(1,4,7,.94)');
  c.fillStyle=bodyGrad;c.fillRect(cx-hw,top,hw*2,bh);
  c.strokeStyle=failed?'rgba(150,155,158,.45)':(isFinal?'rgba(255,244,205,.85)':'rgba(113,240,255,.82)');
  c.lineWidth=2;c.shadowBlur=failed?0:12;c.shadowColor=failed?'transparent':(isFinal?'rgba(255,220,150,.7)':'rgba(34,228,255,.7)');
  c.beginPath();c.moveTo(cx-hw+1,top);c.lineTo(cx-hw+1,bottom);c.moveTo(cx+hw-1,top);c.lineTo(cx+hw-1,bottom);c.stroke();
  c.shadowBlur=0;
  // central ion rail
  c.strokeStyle=failed?'rgba(170,170,170,.25)':(isFinal?'rgba(255,250,220,.8)':'rgba(170,250,255,.72)');
  c.lineWidth=1;c.beginPath();c.moveTo(cx,top+3);c.lineTo(cx,bottom-2);c.stroke();
  if(bodyOnly&&!failed){
    const pulse=.5+.5*Math.sin(game.clock*14+n.lane);
    c.shadowBlur=18;c.shadowColor='rgba(34,228,255,.75)';
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
    const cap= c.createLinearGradient(0,y-capH/2,0,y+capH/2);
    cap.addColorStop(0,'#f4ffff');cap.addColorStop(.45,failed?'#8a8a8a':(isFinal?'#fff1c4':'#bffcff'));cap.addColorStop(1,failed?'#555':'#148eb0');
    c.fillStyle=cap;c.shadowBlur=failed?0:20;c.shadowColor=failed?'transparent':(isFinal?'rgba(255,220,140,.85)':'rgba(34,228,255,.85)');
    c.fillRect(cx-capW,y-capH/2,capW*2,capH);c.shadowBlur=0;
    c.fillStyle=failed?'rgba(200,200,200,.6)':'rgba(255,255,255,.95)';
    c.fillRect(cx-capW+3,y-1,capW*2-6,2);
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
      c.save();c.globalAlpha=.88;c.shadowBlur=22;c.shadowColor='rgba(255,207,106,.8)';
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
      drawHoldObject(n,cx,y,ty,.82,Math.abs(n.time-FINAL_CHORD_TIME)<.05,true);
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
    const isFinal=Math.abs(n.time-FINAL_CHORD_TIME)<.05;
    if(n.type==='hold'){
      const ty=V.judgeY-(n.end-t)*V.scrollSpeed;
      drawHoldObject(n,cx,y,ty,alpha,isFinal,false);
      continue;
    }
    const sp=isFinal?spr.final:(n.type==='break'?spr.break:(n.is_multi?spr.multi:(n.is_chord?spr.chord:spr.note)));
    if(!sp)continue;
    c.globalAlpha=alpha;
    if(isFinal){
      const tw=V.laneW*.72;
      for(let k=1;k<=16;k++){
        const ty=y-k*V.noteH*1.4;if(ty<-90)break;
        c.fillStyle='rgba(190,240,255,'+(.22*(1-k/16)).toFixed(3)+')';
        const shr=1-k/24;c.fillRect(cx-tw*shr/2,ty,Math.max(1,tw*shr),Math.max(2,V.noteH*.8));
      }
    }else{
      const tw=V.laneW*.58;
      for(let k=1;k<=3;k++){
        c.globalAlpha=alpha*.12/k;
        c.fillStyle='#6fe6ff';
        c.fillRect(cx-tw/2,y-k*V.noteH*.95,tw,V.noteH*.62);
      }
      c.globalAlpha=alpha;
    }
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
  for(let i=0;i<4;i++){
    const cx=V.x+i*V.laneW+V.laneW/2;
    const flash=game.laneFlash[i],hold=game.keyHold[i]?1:0;
    let near=null;
    for(let k=0;k<game.notes.length;k++){
      const n=game.notes[k];
      if(n.judged||n.lane!==i)continue;
      const d=n.time-game.clock;
      if(d>0&&d<.45&&(!near||d<near))near=d;
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
  c.fillText('BPM '+(selectedSong&&selectedSong.bpm!=='—'?selectedSong.bpm:'—')+'   ·   4 LANES   ·   SESSION 001',V.x,y);
  c.textAlign='right';c.fillText('SYNC '+settings.speed.toFixed(2)+'×',V.x+V.trackW,y);
  c.restore();
}

function drawCombo(){
  if(game.combo<=2||state==='RESULT')return;
  const c=sctx,isAP=game.good===0&&game.bad===0&&game.miss===0,isFC=game.miss===0;
  const size=clamp(V.h*.075,30,74)*game.comboScale;
  const cx=V.w/2,cy=V.h*(V.portrait?.25:.22);
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
  c.fillStyle=col;c.shadowBlur=isP?28:22;c.shadowColor=isP?'rgba(255,196,46,.95)':(isB?'rgba(140,0,26,.95)':col);c.fillText(game.feedback,V.w/2,y);c.shadowBlur=0;
  if('letterSpacing' in c)c.letterSpacing='0px';
  if(settings.early&&game.lastType&&(game.feedbackType==='G'||game.feedbackType==='B')){
    c.font='500 9px '+FONT_M;
    c.fillStyle=game.lastType==='EARLY'?'rgba(255,207,106,.85)':'rgba(143,108,255,.9)';
    c.fillText(game.lastType,V.w/2,y+size*.72);
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
  c.globalAlpha=.9;c.strokeStyle='#22e4ff';c.lineWidth=3;c.shadowBlur=26;c.shadowColor='#22e4ff';
  c.beginPath();c.arc(cx,cy,R*1.55,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-frac,0,1));c.stroke();c.shadowBlur=0;
  c.globalAlpha=.55;c.fillStyle='rgba(255,46,110,.55)';c.font='700 '+(R*2.5*pop).toFixed(1)+'px '+FONT_D;c.fillText(String(n),cx-2.5,cy+1);
  c.fillStyle='rgba(34,228,255,.75)';c.fillText(String(n),cx+2.5,cy-1);
  c.globalAlpha=1;c.fillStyle='#eaffff';c.shadowBlur=24;c.shadowColor='rgba(34,228,255,.8)';c.fillText(String(n),cx,cy);c.shadowBlur=0;
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
function drawStageLight(){
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
  const c=sctx,t=effAudioTime();
  // 10s prism cathedral during the long hold, 60.2-70.2
  if(t>=60.2&&t<=70.2){
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
  if(t>=26.9&&t<=29.9){
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
  if(t>=75&&t<=93){
    const ph=((t-75)%0.4)/0.4,env=fxEnv(t,75,93);
    c.save();c.globalCompositeOperation='lighter';c.globalAlpha=env;
    // distant data arcs
    for(let k=0;k<(V.lowFx?2:3);k++){
      const ay=V.h*(.2+k*.13)+Math.sin(t*.6+k)*8;
      const ag=c.createLinearGradient(0,0,V.w,0);
      ag.addColorStop(0,'rgba(34,228,255,0)');ag.addColorStop(.25,'rgba(34,228,255,.05)');ag.addColorStop(.5,'rgba(255,225,160,.09)');ag.addColorStop(.75,'rgba(34,228,255,.05)');ag.addColorStop(1,'rgba(34,228,255,0)');
      c.fillStyle=ag;c.beginPath();c.moveTo(0,ay);c.quadraticCurveTo(V.w*.5,ay-34,V.w,ay);c.lineTo(V.w,ay+1);c.quadraticCurveTo(V.w*.5,ay-31,0,ay+1);c.closePath();c.fill();
    }
    for(let i=0;i<(V.lowFx?4:5);i++){
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
function wireUI(){
  $('#avatarPick').addEventListener('click',()=>$('#avatarFile').click());
  $('#avatarFile').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    compressAvatar(f,data=>{
      if(!data)return;
      tempAvatar=data;
      const p=$('#avatarPreview');p.src=data;p.hidden=false;
      $('#avatarHint').style.display='none';
    });
    e.target.value='';
  });
  $('#btnEnter').addEventListener('click',enterTerminal);
  $('#nameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();enterTerminal();}});

  $('#btnPlay').addEventListener('click',openSong);
  document.addEventListener('pointerdown',()=>{
    if(uiCurrent&&uiPlayer.paused&&!songLoading.classList.contains('active')){
      uiPlayer.play().then(()=>fadeInUIMusic(uiPlayer)).catch(()=>{});
    }
  },{passive:true});
  $('#btnSet').addEventListener('click',()=>openSettings('PHONE'));
  $('#btnIM').addEventListener('click',openIM);
  $('#pwMsg').addEventListener('click',()=>{if(state==='PHONE'){phoneRig.classList.remove('is-hidden');openIM();}});
  room.addEventListener('pointerdown',e=>{
    if(state!=='PHONE')return;
    if(e.target.closest&&e.target.closest('.phone-rig'))return;
    phoneRig.classList.toggle('is-hidden');
    syncUIMusic();
    uiSound(.85);
  });

  $('#songBack').addEventListener('click',closeSong);
  $('#btnStartGame').addEventListener('click',startGame);
  $('#slCancel').addEventListener('click',cancelSongLoading);
  $('#btnSongSet').addEventListener('click',()=>openSettings('SONG'));
  $('#chapterBack').addEventListener('click',closeChapterSelect);
  $('#ssBack').addEventListener('click',closeSongSelect);

  $('#imBack').addEventListener('click',closeIM);
  $('#imDetailBack').addEventListener('click',()=>{$('#imDetail').classList.remove('active');uiSound(.9);});
  $$('.im-tab').forEach(tab=>tab.addEventListener('click',()=>{
    $$('.im-tab').forEach(t=>t.classList.toggle('active',t===tab));
    renderFeed(tab.dataset.tab);
    uiSound(1);
  }));

  $('#setBack').addEventListener('click',closeSettings);
  $('#btnPauseSet').addEventListener('click',()=>openSettings('PAUSE'));
  $('#btnSwitchUser').addEventListener('click',()=>{
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
    state='LOGIN';showLogin();
  });

  const sp=$('#sSpeed'),dm=$('#sDim'),vo=$('#sVol');
  sp.addEventListener('input',()=>{settings.speed=clamp(parseFloat(sp.value)||1,.5,2);$('#vSpeed').textContent=settings.speed.toFixed(2)+'×';updateScrollSpeed();saveSettings();});
  dm.addEventListener('input',()=>{settings.dim=clamp(parseInt(dm.value,10)||0,0,80);$('#vDim').textContent=Math.round(settings.dim)+'%';saveSettings();});
  vo.addEventListener('input',()=>{settings.volume=clamp(parseInt(vo.value,10)||0,0,100);$('#vVol').textContent=Math.round(settings.volume)+'%';applySettings();});
  $('#tEarly').addEventListener('click',()=>{settings.early=!settings.early;setSwitch('#tEarly',settings.early);saveSettings();uiSound(1.4);});
  $('#tHit').addEventListener('click',()=>{settings.hit=!settings.hit;setSwitch('#tHit',settings.hit);saveSettings();uiSound(1.4);});
  $('#tUI').addEventListener('click',()=>{settings.ui=!settings.ui;setSwitch('#tUI',settings.ui);saveSettings();});
  $('#tMotion').addEventListener('click',()=>{
    settings.motion=!settings.motion;
    setSwitch('#tMotion',settings.motion);
    applySettings();
    city.last=0;
    if(!settings.motion)drawWindowCity(performance.now());
    uiSound(1.2);
  });

  $('#btnPause').addEventListener('click',pauseGame);
  $('#btnResume').addEventListener('click',resumeGame);
  $('#btnRestart').addEventListener('click',restartGame);
  $('#btnQuit').addEventListener('click',quitToSong);
  $('#btnRetry').addEventListener('click',retryGame);
  $('#btnBackSong').addEventListener('click',backToSong);

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
  document.addEventListener('pointerdown',retryUIMusic,{passive:true});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('click',e=>{
    if(e.target&&e.target.closest&&e.target.closest('.dock,.btn,.back-btn,.im-tab,.set-mini,.link'))uiSound(1.05);
  });

  let rt=0;
  window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{
    layoutGame();buildCity();
    if(state==='GAME'||state==='PAUSED'||state==='RESUMING')drawGame(0);
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
init();

