/* store.js —— 数据层：设置(localStorage) + 文章/学报(IndexedDB)，每设备独立 */
(function () {
  "use strict";

  var SETTINGS_KEY = "xuebao-settings-v1";
  var DB_NAME = "xuebao-db-v1";
  var DB_VER = 1;

  var DEFAULTS = {
    version: 1,
    mirrorRepo: "ccxxxx-create/xuebao-feeds",
    // 模型（在线 OpenAI 兼容）
    provider: "custom",        // preset id 或 custom
    preset: "",                // 厂商预置 label
    baseUrl: "",
    model: "",
    apiKey: "",
    // 资料刷新（唯一拉取通道：每日固定时间自动刷新）
    autoRefresh: true,         // 定时自动刷新总开关（用户明确要求仅保留此机制，故默认开）
    refreshTimes: ["09:00", "12:00", "18:00"],  // 每天固定刷新时间点
    refreshSlots: {},          // 已完成刷新记录：{YYYYMMDD:[日内分钟数]}
    retentionDays: 90,         // 保留期：7~365 天
    // 自动化（除定时刷新外一律默认关闭，用户手动开启）
    autoTranslate: false,      // 拉取后自动翻译新标题（旧开关，可手动开）
    autoTitleTr: true,         // 打开资料库时自动翻译新标题（默认开启，可按需关闭）
    favAutoTr: false,          // 收藏时自动：生成中文标题+摘要
    favAutoFull: false,        // 收藏时自动：全文翻译
    compareAutoFull: false,    // 中英对照时缺译文自动翻译全文
    autoClean: false,          // 自动清理过期资料
    weeklyBrief: false,        // 周末简报自动投递
    briefAi: false,            // 简报 AI 增强：全期综述 + 逐条点评
    lastBriefWeek: "",         // 最近已自动投递简报的“周一日期”，防同周重复
    // 旧版字段（不再触发生成，仅兼容已有设置）
    autoPull: false,           // 已停用“打开即自动拉取”，不再使用
    autoCheck: true,           // 自动检查更新（每约 6 小时一次，仅读公告不耗模型，默认开以保障新版本/公告及时送达）
    fontZoom: "M",             // 旧版字号档位（迁移到 fontSizePx）
    fontSizePx: null,          // 字号基准 px（默认 16，迁移函数兜底）
    theme: "",                 // 界面主题：""=蓝天 / night=深空夜航 / paper=纸面学报 / gray=极简灰
    autoTune: false,           // 自动微调排序权重（可关；每日最多一次；尊重手动）
    lastAutoTuneAt: 0,         // 上次自动微调时间戳
    lastManualRankAt: 0,       // 上次手动调权时间戳（供自动微调短时回避）
    allowLearn: true,          // 允许本机记录喜好（收藏/取消/出刊信号），仅存本设备
    interestKeywords: "",      // 兴趣关键词（模糊匹配，用于“按相关度”排序）
    exploreRate: 0.1,          // 榜单探索率（防茧房）：给非关键词内容保留的比例（档位 低5/中10/高20%）
    rankWeights: { rel: 90, fresh: 50, source: 50, heat: 20 },  // 排序权重档位值（高90/中50/低20：兴趣高/新鲜中/来源中/热度低）
    btAuto: false,             // 打开页面自动离线回测（每日最多一次，结果进收件箱）
    btLastAt: 0,               // 上次自动回测时间戳
    manualPullCdMin: 10,       // 手动“立即更新”的冷却分钟数（防频繁拉取被源站限流）
    channelOns: {},            // 信源开关：{channelId:0}=本设备停用（保留历史数据，不再收录）
    signatureText: "（XX大学XX学院XXX  XX  供稿）",   // 供稿署名默认（范文同款占位，Word 里可改）
    // 状态
    lastPullAt: 0,
    lastMirrorUpdatedAt: null,
    appVersion: "1.7.12",
    versionCode: 40,
    libDualTitle: true,          // 资料库标题：中英双语展示；关=仅英文
    updateRepo: "ccxxxx-create/xuebao-web",   // 更新通知仓库：update.json（部署网址为 gh-pages 时本仓库 Pages）
    lastUpdateCheck: 0,
    lastNotifiedVersion: 0,     // 本设备已告知过的最高版本号：被静默更新/老版本用户也能收到“已更新”通知
    seenNotices: {}
  };

  function loadSettings() {
    var s = DEFAULTS;
    var oldVer = 0;
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        oldVer = parseInt(parsed.versionCode, 10) || 0;
        s = Object.assign({}, DEFAULTS, parsed);
      }
    } catch (e) { /* ignore */ }
    // 字号迁移：旧版 fontZoom(M/L/XL) → fontSizePx
    if (s.fontSizePx == null) {
      s.fontSizePx = { M: 16, L: 18, XL: 21 }[s.fontZoom || "M"] || 16;
    }
    // v1.4.0 迁移：所有自动化功能强制默认关闭（仅保留定时自动刷新），让用户按需在设置里手动开启
    if (oldVer > 0 && oldVer < DEFAULTS.versionCode) {
      s.autoTranslate = false;
      s.favAutoTr = false;
      s.favAutoFull = false;
      s.compareAutoFull = false;
      s.autoClean = false;
      s.weeklyBrief = false;
      s.briefAi = false;
      s.autoTune = false;
      s.autoRefresh = true;                       // 用户明确要求保留定时刷新机制
      s.refreshTimes = DEFAULTS.refreshTimes;
      s.refreshSlots = s.refreshSlots || {};
    }
    // 版本号以“当前运行的代码”为准：避免老用户因本地旧版本号被反复提示更新
    s.appVersion = DEFAULTS.appVersion;
    s.versionCode = DEFAULTS.versionCode;
    return s;
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  /* ---------- IndexedDB 封装 ---------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("articles")) {
          var st = db.createObjectStore("articles", { keyPath: "url" });
          st.createIndex("pubDate", "pubDate");
          st.createIndex("channel", "channel");
        }
        if (!db.objectStoreNames.contains("journals")) {
          db.createObjectStore("journals", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("terms")) {
          db.createObjectStore("terms", { keyPath: "term_en" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(db, store, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(store, mode);
      var out = fn(t.objectStore(store));
      var res;
      if (out && typeof out.then === "function") res = out; else res = Promise.resolve(out);
      t.oncomplete = function () { resolve(res); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  }

  var Store = {
    settings: loadSettings(),
    saveSettings: function () { saveSettings(this.settings); },

    /* 喜好学习信号（本机 localStorage，仅用于价值排序建议，不上传） */
    PREFS_KEY: "xuebao-prefs-v1",
    loadPrefs: function () {
      try {
        var raw = localStorage.getItem(this.PREFS_KEY);
        return raw ? JSON.parse(raw) : { events: [] };
      } catch (e) { return { events: [] }; }
    },
    savePrefs: function (p) {
      try { localStorage.setItem(this.PREFS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
    },
    logPreference: function (kind, url, title) {
      if (!this.settings.allowLearn) return;
      var p = this.loadPrefs();
      p.events.push({ k: kind, url: url, t: title || "", at: Date.now() });
      if (p.events.length > 2000) p.events = p.events.slice(-1500);
      this.savePrefs(p);
    },
    getPrefStats: function () {
      var p = this.loadPrefs();
      var s = { total: p.events.length, fav: 0, unfav: 0, journal: 0, other: 0 };
      p.events.forEach(function (e) {
        if (e.k === "fav") s.fav++;
        else if (e.k === "unfav") s.unfav++;
        else if (e.k === "journal") s.journal++;
        else s.other++;
      });
      return s;
    },
    clearPrefs: function () {
      try { localStorage.removeItem(this.PREFS_KEY); } catch (e) { /* ignore */ }
    },

    /* 收件箱（本机通知中心：更新公告/简报/系统消息） */
    INBOX_KEY: "xuebao-inbox-v1",
    loadInbox: function () {
      try {
        var raw = localStorage.getItem(this.INBOX_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },
    saveInbox: function (arr) {
      try { localStorage.setItem(this.INBOX_KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
    },
    inboxAdd: function (kind, title, body) {
      // 去重：同 kind 且同正文（作者发重复公告/版本提示）不再新增一条，避免收两条
      var arr = this.loadInbox().filter(function (x) { return !(x.kind === kind && x.body && x.body === body); });
      arr.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: kind, title: title || "", body: body || "", at: Date.now(), read: 0 });
      if (arr.length > 60) arr = arr.slice(0, 60);
      this.saveInbox(arr);
      return arr;
    },
    /* 收件箱去重补收：同 (kind+正文) 只留最新一条，其余（含旧重复公告）删除；返回删除条数 */
    inboxDedup: function () {
      var arr = this.loadInbox();
      if (!arr.length) return 0;
      var groups = {}, keep = {}, out = [];
      arr.forEach(function (x) { var k = x.kind + ":" + (x.body || ""); (groups[k] = groups[k] || []).push(x); });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k].slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        keep[g[0].id] = 1;
      });
      arr.forEach(function (x) { if (keep[x.id]) out.push(x); });
      out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      this.saveInbox(out);
      return arr.length - out.length;
    },
    inboxUnread: function () {
      return this.loadInbox().filter(function (x) { return !x.read; }).length;
    },
    inboxMarkRead: function (id) {
      var arr = this.loadInbox();
      arr.forEach(function (x) { if (x.id === id) x.read = 1; });
      this.saveInbox(arr);
    },
    inboxMarkAllRead: function () {
      var arr = this.loadInbox();
      arr.forEach(function (x) { x.read = 1; });
      this.saveInbox(arr);
    },
    inboxClear: function () {
      try { localStorage.removeItem(this.INBOX_KEY); } catch (e) { /* ignore */ }
    },

    /* 信源开关（本设备级） */
    channelOn: function (id) {
      return !(this.settings.channelOns || {})[id];
    },
    setChannelOn: function (id, on) {
      if (!this.settings.channelOns) this.settings.channelOns = {};
      this.settings.channelOns[id] = on ? 0 : 1;
      if (on) delete this.settings.channelOns[id];
      this.saveSettings();
    },

    dbPromise: null,
    db: function () {
      if (!this.dbPromise) this.dbPromise = openDB();
      return this.dbPromise;
    },

    /* 文章 */
    putArticle: function (art) {
      return this.db().then(function (db) {
        return tx(db, "articles", "readwrite", function (s) { return s.put(art); });
      });
    },
    bulkPutArticles: function (list) {
      return this.db().then(function (db) {
        return tx(db, "articles", "readwrite", function (s) {
          list.forEach(function (a) { s.put(a); });
        });
      });
    },
    getAllArticles: function () {
      return this.db().then(function (db) {
        return tx(db, "articles", "readonly", function (s) {
          return new Promise(function (resolve, reject) {
            var r = s.getAll();
            r.onsuccess = function () { resolve(r.result || []); };
            r.onerror = function () { reject(r.error); };
          });
        });
      });
    },
    getArticle: function (url) {
      return this.db().then(function (db) {
        return tx(db, "articles", "readonly", function (s) {
          return new Promise(function (resolve, reject) {
            var r = s.get(url);
            r.onsuccess = function () { resolve(r.result || null); };
            r.onerror = function () { reject(r.error); };
          });
        });
      });
    },
    deleteArticle: function (url) {
      return this.db().then(function (db) {
        return tx(db, "articles", "readwrite", function (s) { return s.delete(url); });
      });
    },
    clearArticles: function () {
      return this.db().then(function (db) {
        return tx(db, "articles", "readwrite", function (s) { return s.clear(); });
      });
    },

    /* 学报记录 */
    addJournal: function (j) {
      return this.db().then(function (db) {
        return tx(db, "journals", "readwrite", function (s) { return s.add(j); });
      });
    },
    getAllJournals: function () {
      return this.db().then(function (db) {
        return tx(db, "journals", "readonly", function (s) {
          return new Promise(function (resolve, reject) {
            var r = s.getAll();
            r.onsuccess = function () { resolve((r.result || []).sort(function (a, b) { return (b.id || 0) - (a.id || 0); })); };
            r.onerror = function () { reject(r.error); };
          });
        });
      });
    },
    deleteJournal: function (id) {
      return this.db().then(function (db) {
        return tx(db, "journals", "readwrite", function (s) { return s.delete(id); });
      });
    },

    /* 术语 */
    getAllTerms: function () {
      return this.db().then(function (db) {
        return tx(db, "terms", "readonly", function (s) {
          return new Promise(function (resolve, reject) {
            var r = s.getAll();
            r.onsuccess = function () { resolve(r.result || []); };
            r.onerror = function () { reject(r.error); };
          });
        });
      });
    },
    putTerm: function (t) {
      return this.db().then(function (db) {
        return tx(db, "terms", "readwrite", function (s) { return s.put(t); });
      });
    },
    deleteTerm: function (key) {
      return this.db().then(function (db) {
        return tx(db, "terms", "readwrite", function (s) { return s.delete(key); });
      });
    },

    /* 存储占用（浏览器配额） */
    usage: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return navigator.storage.estimate().then(function (e) {
        return { usage: e.usage || 0, quota: e.quota || 0 };
      }).catch(function () { return null; });
    }
  };

  window.Store = Store;
})();
