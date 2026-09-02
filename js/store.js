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
    // 行为
    autoTranslate: true,       // 拉取后自动翻译新标题与摘要
    favAutoTr: true,           // 收藏时自动：生成中文标题+摘要
    favAutoFull: false,        // 收藏时自动：全文翻译
    autoClean: true,           // 自动清理过期资料（收藏/已选/已出刊保护）
    retentionDays: 90,         // 保留期：7~365 天
    fontZoom: "M",             // 旧版字号档位（迁移到 fontSizePx）
    fontSizePx: null,          // 字号基准 px（默认 16，迁移函数兜底）
    allowLearn: true,          // 允许本机记录喜好（收藏/取消/出刊信号），仅存本设备
    interestKeywords: "",      // 兴趣关键词（模糊匹配，用于“按相关度”排序）
    compareAutoFull: false,    // 双语对照时如缺译文是否自动翻译全文
    exploreRate: 0.1,          // 榜单探索率（防茧房）：给非关键词内容保留的比例
    autoCheck: true,           // 自动检查更新（每约 6 小时一次，仅读公告不耗模型）
    channelOns: {},            // 信源开关：{channelId:0}=本设备停用（保留历史数据，不再收录）
    signatureText: "（XX大学XX学院XXX  XX  供稿）",   // 供稿署名默认（范文同款占位，Word 里可改）
    autoPull: true,
    // 状态
    lastPullAt: 0,
    lastMirrorUpdatedAt: null,
    appVersion: "1.3.2",
    versionCode: 17,
    updateRepo: "ccxxxx-create/xuebao-web",   // 更新通知仓库：update.json（部署网址为 gh-pages 时本仓库 Pages）
    lastUpdateCheck: 0,
    seenNotices: {}
  };

  function loadSettings() {
    var s = DEFAULTS;
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) s = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    // 字号迁移：旧版 fontZoom(M/L/XL) → fontSizePx
    if (s.fontSizePx == null) {
      s.fontSizePx = { M: 16, L: 18, XL: 21 }[s.fontZoom || "M"] || 16;
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
