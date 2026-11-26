/* ============================================================================
   welkin-save.js — 存档护航 v1（多副本冗余 / 开机自愈 / 链接携带）
   ----------------------------------------------------------------------------
   为什么要有这个文件：

   游戏的全部进度（账号、苍穹星、皮肤、通关、最佳成绩、设置、玩家名）都只写在
   localStorage 一个桶里。微信 / QQ 的内置浏览器（X5、WKWebView）会在下面这些
   情况下把 localStorage 整块清掉，而页面本身没有任何感知：

     · 微信「设置 → 通用 → 存储空间 → 清理缓存」
     · Android 微信 X5 内核升级 / 回退到系统 WebView（两个内核的存储目录不是同一个）
     · iOS 智能防跟踪（ITP）：站点数据连续 7 天没有交互会被清
     · 隐私 / 无痕模式（localStorage 写得进、读不出，或者直接抛异常）
     · 系统存储紧张时的站点数据回收

   一被清空，readUser() 就是 null → 弹注册页 → 玩家再输一次名字 = 一套全新的
   空档案（666 星、零进度）。这就是「退出微信再进来数据直接重置」的根因。

   本文件在 welkin-os.js 之前加载，提供四层保护：

     1. 写穿透镜像：任何 welkin_os_* 的写入（setItem / removeItem / clear）都会
        在防抖后镜像到互相独立的存储桶：
            local    localStorage        （和游戏本体共用，主桶）
            session  sessionStorage      （同标签页重载有效）
            cookie   Cookie              （清缓存时常被保留，独立于 Web Storage）
            indexed  IndexedDB           （配额与回收策略独立于 localStorage）
            cache    Cache Storage       （又一个独立桶）
            link     地址栏 #wks=…       （整站数据全没了也还留在 URL 上）
     2. 开机自愈：开机时把所有桶都读一遍，取「最新的、CRC 校验通过的」那份，
        缺哪补哪（不覆盖本地更新的键），必要时 reload 一次让内存状态对齐。
     3. 链接携带：把压缩后的存档写进 URL 的 #wks= 片段。微信从聊天记录 / 浮窗 /
        最近使用重开同一个地址时，存档跟着 URL 回来 —— 这是唯一能跨过「整站
        数据被清空」的客户端锚点（也是「复制恢复链接」按钮的来源）。
     4. 体检接口：WKSAVE.status() / probe() 给设置页显示每个桶的存活情况。

   设计约定：
     · 只认 welkin_os_* 与 rhythm_user 这两个命名空间，别的一概不碰；
     · 快照带 q（单调递增序号，用毫秒时间戳）和 CRC32，坏数据顶不掉好数据；
     · 开机时如果本机一片空白，先冻结镜像写入，等异步桶读完再决定 —— 否则
       新注册的空档案会反过来盖掉还能救回来的旧存档。
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = null, SS = null, SP = null;
  try { LS = global.localStorage; } catch (e) { LS = null; }
  try { SS = global.sessionStorage; } catch (e) { SS = null; }
  try { SP = LS ? Object.getPrototypeOf(LS) : null; } catch (e) { SP = null; }

  var MIRROR_KEY = 'welkin_os_mirror_v1';
  var LOG_KEY = 'welkin_os_save_log';
  var COOKIE_KEY = 'wk_save_v1';
  var HASH_KEY = 'wks';
  var DB_NAME = 'welkin_os_saves', DB_STORE = 'snap';
  var CACHE_NAME = 'welkin_os_saves_v1', CACHE_URL = '__welkin_save.json';
  var MAX_HASH = 7000;     /* 超过这个长度的 #wks 不往地址栏塞 */
  var MAX_COOKIE = 3800;   /* 单个 cookie 4KB 上限，留点余量 */
  var FLUSH_DELAY = 700;

  /* ------------------------------------------------------------------ 键空间 */
  function managed(k) {
    if (typeof k !== 'string' || !k) return false;
    return k === 'rhythm_user' || k.indexOf('welkin_os_') === 0;
  }
  function excluded(k) {
    if (k === MIRROR_KEY || k === LOG_KEY || k === 'welkin_os_last_error') return true;
    return k.indexOf('welkin_os_mirror') === 0 || k.indexOf('welkin_os_save_') === 0;
  }

  /* ---------------------------------------------------------------- 小工具 */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(str) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < str.length; i++) c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xFF] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0).toString(16);
  }
  var TE = null, TD = null;
  try { TE = new TextEncoder(); TD = new TextDecoder(); } catch (e) { }
  function toU8(str) {
    if (TE) return TE.encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++; c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return new Uint8Array(out);
  }
  function fromU8(u8) {
    if (TD) return TD.decode(u8);
    var s = '', i = 0, c;
    while (i < u8.length) {
      c = u8[i++];
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c < 0xE0) s += String.fromCharCode(((c & 31) << 6) | (u8[i++] & 63));
      else if (c < 0xF0) s += String.fromCharCode(((c & 15) << 12) | ((u8[i++] & 63) << 6) | (u8[i++] & 63));
      else {
        var cp = ((c & 7) << 18) | ((u8[i++] & 63) << 12) | ((u8[i++] & 63) << 6) | (u8[i++] & 63);
        cp -= 0x10000; s += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
      }
    }
    return s;
  }
  function b64u(u8) {
    var s = '', i, n = u8.length;
    for (i = 0; i < n; i += 3) {
      var a = u8[i], b = i + 1 < n ? u8[i + 1] : 0, c = i + 2 < n ? u8[i + 2] : 0;
      s += B64[(a >> 2) & 63] + B64[((a & 3) << 4) | (b >> 4)] +
        (i + 1 < n ? B64[((b & 15) << 2) | (c >> 6)] : '') +
        (i + 2 < n ? B64[c & 63] : '');
    }
    return s;
  }
  function unb64u(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    var pad = s.length % 4; if (pad) s += '===='.slice(pad);
    try {
      var bin = atob(s), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    } catch (e) { return null; }
  }

  function deflateU8(u8) {
    if (typeof global.CompressionStream !== 'function') return Promise.resolve(null);
    try {
      var cs = new global.CompressionStream('deflate-raw');
      return new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer()
        .then(function (b) { return new Uint8Array(b); })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function inflateU8(u8) {
    if (typeof global.DecompressionStream !== 'function') return Promise.resolve(null);
    try {
      var ds = new global.DecompressionStream('deflate-raw');
      return new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer()
        .then(function (b) { return new Uint8Array(b); })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function log(ev) {
    try {
      var arr = [];
      try { arr = JSON.parse(LS.getItem(LOG_KEY) || '[]') || []; } catch (e2) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      arr.push(ev);
      while (arr.length > 12) arr.shift();
      LS.setItem(LOG_KEY, JSON.stringify(arr));
    } catch (e) { }
  }

  /* ------------------------------------------------------------------ 快照 */
  var seq = 0;
  function nextSeq() {
    var t = Date.now();
    seq = t > seq ? t : seq + 1;
    return seq;
  }
  function collect() {
    var o = {};
    if (!LS) return o;
    var keys = [], i, k;
    try {
      for (i = 0; i < LS.length; i++) { k = LS.key(i); if (k && managed(k) && !excluded(k)) keys.push(k); }
    } catch (e) { return o; }
    keys.sort();
    for (i = 0; i < keys.length; i++) { try { o[keys[i]] = LS.getItem(keys[i]); } catch (e) { } }
    return o;
  }
  /* 头像 data URL 动辄几十 KB，cookie / 地址栏扛不住；slim 版把它摘掉，
     恢复出来的档案用默认头像（名字首字母），其余一个字不少。 */
  function slimKeys(keys) {
    var out = {}, k, v;
    for (k in keys) {
      v = keys[k];
      if (k === 'welkin_os_user' && typeof v === 'string') {
        try {
          var u = JSON.parse(v);
          if (u && typeof u === 'object' && u.avatar && String(u.avatar).length > 4096) {
            u.avatar = ''; v = JSON.stringify(u);
          }
        } catch (e) { }
      }
      if (typeof v === 'string' && v.length > 60000) continue;
      out[k] = v;
    }
    return out;
  }
  function seal(keys, q, t) {
    var body = JSON.stringify(keys);
    return { v: 1, q: q, t: t || Date.now(), c: crc32(body), n: Object.keys(keys).length, k: keys };
  }
  function makeSnap(slim) {
    var keys = collect();
    if (slim) keys = slimKeys(keys);
    return seal(keys, nextSeq());
  }
  function snapStr(snap) { return JSON.stringify(snap); }
  function parseSnap(str) {
    if (!str) return null;
    try {
      var o = JSON.parse(str);
      if (!o || o.v !== 1 || !o.k || typeof o.k !== 'object') return null;
      if (!(o.q > 0)) return null;
      if (crc32(JSON.stringify(o.k)) !== o.c) return null;
      return o;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- 各存储桶 */
  var state = { local: 0, session: 0, cookie: 0, indexed: 0, cache: 0, link: 0 };
  var stamp = { local: 0, session: 0, cookie: 0, indexed: 0, cache: 0, link: 0 };
  function mark(id, ok, q) { state[id] = ok ? 1 : -1; if (ok && q) stamp[id] = q; }

  function lsWrite(snap) {
    try { LS.setItem(MIRROR_KEY, snapStr(snap)); mark('local', true, snap.q); return true; }
    catch (e) { mark('local', false); return false; }
  }
  function lsRead() { try { return parseSnap(LS && LS.getItem(MIRROR_KEY)); } catch (e) { return null; } }

  function ssWrite(snap) {
    try {
      if (!SS) return false;
      SS.setItem(MIRROR_KEY, snapStr(snap)); mark('session', true, snap.q); return true;
    } catch (e) { mark('session', false); return false; }
  }
  function ssRead() { try { return parseSnap(SS && SS.getItem(MIRROR_KEY)); } catch (e) { return null; } }

  function cookieWrite(code, q) {
    try {
      if (!code || code.length > MAX_COOKIE) return false;
      var exp = new Date(Date.now() + 63072000000).toUTCString();
      document.cookie = COOKIE_KEY + '=' + code + ';path=/;expires=' + exp + ';SameSite=Lax';
      mark('cookie', true, q);
      return true;
    } catch (e) { mark('cookie', false); return false; }
  }
  function cookieRaw() {
    try {
      var m = ('; ' + document.cookie + ';').match(new RegExp(';\\s*' + COOKIE_KEY + '=([^;]*)'));
      return m ? m[1] : '';
    } catch (e) { return ''; }
  }

  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      try {
        if (!global.indexedDB) return rej(new Error('no idb'));
        var r = global.indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error || new Error('idb')); };
        r.onblocked = function () { rej(new Error('blocked')); };
      } catch (e) { rej(e); }
    });
    return dbP;
  }
  function idbGet(key) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(DB_STORE, 'readonly'), st = tx.objectStore(DB_STORE), req = st.get(key);
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
    });
  }
  function idbPut(pairs) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(DB_STORE, 'readwrite'), st = tx.objectStore(DB_STORE);
        pairs.forEach(function (p) { st.put(p[1], p[0]); });
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  /* 写 latest，并把上一版挪到 prev1 / prev2：单次写坏还能回到上一版 */
  function idbWrite(snap) {
    var str = snapStr(snap);
    return idbGet('latest').catch(function () { return null; }).then(function (old) {
      return idbGet('prev1').catch(function () { return null; }).then(function (p1) {
        var pairs = [['latest', str]];
        if (old && old !== str) pairs.push(['prev1', old]);
        if (p1) pairs.push(['prev2', p1]);
        return idbPut(pairs);
      });
    }).then(function () { mark('indexed', true, snap.q); return true; })
      .catch(function () { mark('indexed', false); return false; });
  }
  function idbRead() {
    return idbGet('latest')
      .then(function (v) {
        var s = parseSnap(v);
        if (s) mark('indexed', true, s.q);
        return s;
      })
      .then(function (s) {
        if (s) return s;
        return idbGet('prev1').then(function (v2) { return parseSnap(v2); });
      })
      .catch(function () { return null; });
  }

  function cachePut(code, q) {
    try {
      if (!global.caches || !code) return Promise.resolve(false);
      return global.caches.open(CACHE_NAME).then(function (c) {
        return c.put(new Request(global.location.origin + '/' + CACHE_URL),
          new Response(code, { headers: { 'content-type': 'text/plain' } }));
      }).then(function () { mark('cache', true, q); return true; })
        .catch(function () { mark('cache', false); return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function cacheRead() {
    try {
      if (!global.caches) return Promise.resolve('');
      return global.caches.open(CACHE_NAME)
        .then(function (c) { return c.match(new Request(global.location.origin + '/' + CACHE_URL)); })
        .then(function (r) { return r ? r.text() : ''; })
        .catch(function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  }

  /* ------------------------------------------------------------ 编解码 */
  function encodeRawCode(snap) { return 'b.' + b64u(toU8(snapStr(snap))); }
  function encodeCode(snap) {
    var raw = toU8(snapStr(snap));
    return deflateU8(raw).then(function (z) {
      return (z && z.length && z.length < raw.length) ? 'z.' + b64u(z) : 'b.' + b64u(raw);
    });
  }
  function decodeCode(code) {
    code = String(code || '').trim();
    if (code.length < 4) return Promise.resolve(null);
    var tag = code.slice(0, 2), u8 = unb64u(code.slice(2));
    if (!u8) return Promise.resolve(null);
    if (tag === 'b.') return Promise.resolve(parseSnap(fromU8(u8)));
    if (tag === 'z.') return inflateU8(u8).then(function (t) { return t ? parseSnap(fromU8(t)) : null; });
    return Promise.resolve(null);
  }

  /* ------------------------------------------------------------ 地址栏携带 */
  function linkOn() {
    try {
      var s = JSON.parse((LS && LS.getItem('welkin_os_settings_v1')) || '{}');
      return !(s && s.linkSave === false);
    } catch (e) { return true; }
  }
  var lastHash = '';
  function hashWrite(code, snap) {
    try {
      if (!linkOn() || !code || code.length > MAX_HASH) return false;
      var url = global.location.pathname + global.location.search + '#' + HASH_KEY + '=' + code;
      if (url === lastHash) return true;
      lastHash = url;
      global.history.replaceState(global.history.state, '', url);
      mark('link', true, snap ? snap.q : 0);
      return true;
    } catch (e) { mark('link', false); return false; }
  }
  function hashCode() {
    try {
      var m = /[#&]wks=([^&]+)/.exec(global.location.hash || '');
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------ 应用 / 回填 */
  function applySnap(entry, mode) {
    var snap = entry.snap, keys = snap.k, wrote = [], k, v;
    for (k in keys) {
      if (!managed(k) || excluded(k)) continue;
      v = keys[k];
      if (typeof v !== 'string') continue;
      try {
        if (mode === 'missing' && LS.getItem(k) !== null) continue;
        LS.setItem(k, v);
        wrote.push(k);
      } catch (e) { }
    }
    if (wrote.length) {
      log({ t: Date.now(), ev: 'restore', from: entry.from, q: snap.q, n: wrote.length, keys: wrote.slice(0, 8) });
    }
    return wrote;
  }
  function slimOf(snap) {
    return seal(slimKeys(snap.k), snap.q, snap.t);
  }
  function pushAll(snap) {
    var slim = slimOf(snap), raw = encodeRawCode(slim);
    lsWrite(snap); ssWrite(snap);
    cookieWrite(raw, snap.q);
    encodeCode(slim).then(function (code) {
      if (!code) return;
      cookieWrite(code, snap.q);
      cachePut(code, snap.q);
      idbWrite(snap);
      hashWrite(code, snap);
    });
  }

  /* ------------------------------------------------------------- 写穿透 */
  var frozen = true, pendingWrite = false, timer = 0;
  var bootWasEmpty = false, restoreTried = false, lastSnap = null;

  function canWrite() { return !bootWasEmpty || restoreTried; }

  function schedule() {
    if (!LS) return;
    pendingWrite = true;
    if (frozen) return;
    if (timer) return;
    timer = setTimeout(function () { timer = 0; flush(); }, FLUSH_DELAY);
  }
  function flush() {
    if (!LS || !canWrite()) return;
    var snap = makeSnap(false);
    if (!snap.n) return;                       /* 空快照绝不落盘，否则会盖掉旧档 */
    lastSnap = snap;
    pushAll(snap);
  }
  function flushSync() {
    /* pagehide 只剩同步窗口：至少把 local / session / cookie / 地址栏塞好 */
    if (!LS || !canWrite()) return;
    try {
      var snap = makeSnap(false);
      if (!snap.n) return;
      lastSnap = snap;
      var slim = slimOf(snap), raw = encodeRawCode(slim);
      lsWrite(snap); ssWrite(snap);
      cookieWrite(raw, snap.q);
      hashWrite(raw, snap);
    } catch (e) { }
  }

  /* ------------------------------------------------------------- 开机 */
  function newest(list) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || !list[i].snap) continue;
      if (!best || list[i].snap.q > best.snap.q) best = list[i];
    }
    return best;
  }

  var bootInfo = { native: false, recovered: false, from: '', reload: false, settled: false };

  function bootSync() {
    var native = collect();
    bootWasEmpty = !(native['welkin_os_account_v1'] || native['welkin_os_user']);
    bootInfo.native = !bootWasEmpty;
    var list = [];
    var a = lsRead(); if (a) list.push({ from: 'local', snap: a });
    var b = ssRead(); if (b) list.push({ from: 'session', snap: b });
    var best = newest(list);
    if (!best && !bootWasEmpty) {
      /* 老玩家第一次装这版补丁：允许写盘，把现有数据播到所有桶里（异步阶段做） */
      restoreTried = true;
      return null;
    }
    if (!best) return null;                    /* 全新设备：等异步阶段再判 */
    if (bootWasEmpty) {
      var wrote = applySnap(best, 'all');
      bootInfo.recovered = wrote.length > 0;
      bootInfo.from = best.from;
      log({ t: Date.now(), ev: 'boot-restore', from: best.from, q: best.snap.q, n: wrote.length });
    } else {
      applySnap(best, 'missing');
    }
    lastSnap = best.snap;
    return best;
  }

  function bootAsync(syncBest) {
    var jobs = [
      idbRead().then(function (s) { return s ? { from: 'indexed', snap: s } : null; }),
      cacheRead().then(function (code) { return code ? decodeCode(code) : null; })
        .then(function (s) { return s ? { from: 'cache', snap: s } : null; }).catch(function () { return null; }),
      (function () {
        var c = cookieRaw();
        return c ? decodeCode(c).then(function (s) { return s ? { from: 'cookie', snap: s } : null; }).catch(function () { return null; }) : Promise.resolve(null);
      })(),
      (function () {
        var c = hashCode();
        return c ? decodeCode(c).then(function (s) { return s ? { from: 'link', snap: s } : null; }).catch(function () { return null; }) : Promise.resolve(null);
      })()
    ];
    return Promise.all(jobs).then(function (rows) {
      var list = rows.filter(Boolean);
      if (syncBest) list.push(syncBest);
      var best = newest(list);
      if (!best) return null;
      if (bootWasEmpty) {
        var wrote = applySnap(best, 'all');
        if (wrote.length) {
          bootInfo.recovered = true; bootInfo.from = best.from; bootInfo.reload = true;
          log({ t: Date.now(), ev: 'boot-restore-async', from: best.from, q: best.snap.q, n: wrote.length });
        }
      } else {
        applySnap(best, 'missing');
      }
      lastSnap = best.snap;
      restoreTried = true;
      pushAll(best.snap);                      /* 自愈：让每个桶都拿到最新的一份 */
      return best;
    });
  }

  function installHooks() {
    if (!SP || SP.__wkHooked) return;
    try {
      Object.defineProperty(SP, '__wkHooked', { value: true, enumerable: false });
      var set = SP.setItem, rem = SP.removeItem, clr = SP.clear;
      SP.setItem = function (k, v) {
        var r = set.call(this, k, v);
        if (this === LS && managed(k) && !excluded(k)) schedule();
        return r;
      };
      SP.removeItem = function (k) {
        var r = rem.call(this, k);
        if (this === LS && managed(k) && !excluded(k)) schedule();
        return r;
      };
      SP.clear = function () {
        var r = clr.call(this);
        if (this === LS) schedule();
        return r;
      };
    } catch (e) { }
  }

  /* --------------------------------------------------------------- 对外 API */
  var ready = Promise.resolve();
  var WKSAVE = {
    version: 1,
    get needsReload() { return !!bootInfo.reload; },
    get bootSettled() { return bootInfo.settled; },
    get recoveredFrom() { return bootInfo.recovered ? bootInfo.from : ''; },
    get hadHistory() { return !!lastSnap || bootInfo.recovered; },
    get ready() { return ready; },
    schedule: schedule,
    flush: flush,
    flushSync: flushSync,
    snapshotNow: function () { return makeSnap(false); },
    decode: decodeCode,
    log: function () { try { return JSON.parse(LS.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } },
    /* 主动探一遍（设置页打开时调用），把每个桶的真实状态刷出来 */
    probe: function () {
      var jobs = [
        idbRead().then(function (s) { return ['indexed', s]; }).catch(function () { return ['indexed', null]; }),
        cacheRead().then(function (code) { return decodeCode(code); }).catch(function () { return null; }).then(function (s) { return ['cache', s]; }),
        Promise.resolve(['cookie', null]).then(function (pair) {
          var c = cookieRaw();
          return c ? decodeCode(c).then(function (s) { return ['cookie', s]; }) : pair;
        }).catch(function () { return ['cookie', null]; }),
        Promise.resolve(['link', null]).then(function (pair) {
          var c = hashCode();
          return c ? decodeCode(c).then(function (s) { return ['link', s]; }) : pair;
        }).catch(function () { return ['link', null]; })
      ];
      return Promise.all(jobs).then(function (rows) {
        rows.forEach(function (r) {
          var id = r[0], s = r[1];
          if (!state[id]) mark(id, !!s, s ? s.q : 0);
        });
        return WKSAVE.status();
      });
    },
    status: function () {
      return [
        { id: 'local', name: 'LOCAL', ok: state.local, q: stamp.local },
        { id: 'cookie', name: 'COOKIE', ok: state.cookie, q: stamp.cookie },
        { id: 'indexed', name: 'INDEXED', ok: state.indexed, q: stamp.indexed },
        { id: 'link', name: 'LINK', ok: state.link, q: stamp.link }
      ];
    },
    linkCode: function () { return encodeCode(slimOf(makeSnap(false))); },
    linkUrl: function () {
      return WKSAVE.linkCode().then(function (code) {
        if (!code) return '';
        return global.location.origin + global.location.pathname + global.location.search + '#' + HASH_KEY + '=' + code;
      });
    }
  };
  global.WKSAVE = WKSAVE;

  /* --------------------------------------------------------------- 启动 */
  installHooks();
  var syncBest = null;
  try { syncBest = bootSync(); } catch (e) { syncBest = null; }

  ready = new Promise(function (res) {
    var done = false;
    var finish = function () { if (done) return; done = true; restoreTried = true; bootInfo.settled = true; res(); };
    try { bootAsync(syncBest).then(finish).catch(finish); } catch (e) { finish(); }
    setTimeout(finish, 2500);                 /* 兜底：任何桶卡住都不许拖住开机 */
  }).then(function () {
    frozen = false;
    if (pendingWrite || bootInfo.recovered) { pendingWrite = false; flush(); }
  });

  /* 关页 / 切后台：同步落盘一次 */
  try {
    global.addEventListener('pagehide', function () { flushSync(); }, true);
    global.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSync();
    }, true);
    global.addEventListener('freeze', function () { flushSync(); }, true);
  } catch (e) { }

})(typeof window !== 'undefined' ? window : this);
