/* app.js —— 应用外壳：导航、路由、刷新、拉取、弹窗/Toast */
(function () {
  "use strict";

  var ORDER = ["dashboard", "library", "favorites", "rankings", "journal", "sources", "terms", "prefs", "settings"];
  var COLORS = { dashboard: "#2f7fd1", library: "#0f766e", favorites: "#b06a1b", rankings: "#0e7490", journal: "#b7791f", sources: "#5b4b8a", terms: "#a34f6d", prefs: "#d97706", settings: "#4a5568" };
  /* 模块图标（线性图形，替代单字缩写） */
  var ICO = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    library: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    favorites: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>',
    rankings: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    journal: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    sources: '<svg viewBox="0 0 24 24"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
    terms: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    prefs: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };
  var MAIL_ICO = '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';

  var current = "dashboard";
  var pulling = false;
  var pullDoneOnce = false;

  function mod(key) { return window.WB.modules[key]; }

  function renderNav() {
    var nav = document.getElementById("nav");
    nav.innerHTML = ORDER.map(function (k) {
      var m = mod(k);
      return '<button data-view="' + k + '" class="' + (current === k ? "active" : "") + '" title="' + m.label + '">' +
        '<span class="ico" style="background:' + COLORS[k] + '">' + ICO[k] + "</span>" +
        "<span>" + m.label + "</span></button>";
    }).join("");
    nav.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { App.route("#/" + b.dataset.view); });
    });
    var foot = document.getElementById("sideFoot");
    if (foot) foot.textContent = "v" + (Store.settings.appVersion || "1.0.0") + " · 本地静态应用 · 数据在本设备";
  }

  var App = {
    refreshMail: function () {
      var b = document.getElementById("mailEntry");
      if (!b) return;
      var un = Store.inboxUnread();
      b.innerHTML = '<span class="mail-ico">' + MAIL_ICO + "</span><span>收件箱</span>" + (un ? '<span class="mail-badge">' + un + "</span>" : "");
      b.title = "收件箱（" + un + " 条未读）";
    },
    refresh: function () {
      var el = document.getElementById("content");
      var m = mod(current);
      renderNav();
      App.refreshMail();
      if (m && typeof m.render === "function") {
        m.render(el).catch(function (err) {
          el.innerHTML = '<div class="card"><div class="note">页面渲染出错：' + H.esc(err && err.message ? err.message : err) + "</div></div>";
        });
      }
    },
    route: function (hash) {
      var parts = String(hash || "").replace(/^#\/?/, "").split("?");
      var key = parts[0] || "dashboard";
      var q = parts[1] ? decodeURIComponent(parts[1].replace(/^q=/, "")) : "";
      if (!mod(key)) key = "dashboard";
      current = key;
      if (q && window.WB.modules.library && window.WB.modules.library.state) {
        window.WB.modules.library.state.q = q;
      }
      if (location.hash !== hash) location.hash = hash;
      App.refresh();
    },
    toast: function (msg, type) {
      var wrap = document.getElementById("toastWrap");
      var d = document.createElement("div");
      d.className = "toast" + (type === "ok" ? " ok" : type === "err" ? " err" : "");
      d.textContent = msg;
      wrap.appendChild(d);
      setTimeout(function () { d.remove(); }, type === "err" ? 5000 : 3200);
    },
    applyFont: function () {
      var s = Store.settings;
      var px = parseInt(s.fontSizePx, 10);
      if (!px) px = { M: 16, L: 18, XL: 21 }[s.fontZoom || "M"] || 16;
      px = Math.min(24, Math.max(12, px));
      document.documentElement.style.fontSize = px + "px";
    },
    maybeAutoClean: function (silent) {
      // 录入即判断：打开页面/拉取后自动去重；过期清理遵循设置里的自动清理开关
      var jobs = [];
      if (Store.settings.autoClean) {
        jobs.push(MIRROR.cleanupOld().then(function (n) { return n > 0 ? "过期 " + n + " 篇" : ""; }));
      }
      jobs.push(MIRROR.cleanupDups().then(function (n) { return n > 0 ? "重复 " + n + " 篇" : ""; }));
      return Promise.all(jobs).then(function (parts) {
        var arr = parts.filter(Boolean);
        if (arr.length && !silent) App.toast("已自动清理：" + arr.join("、"), "ok");
        return arr.length ? 1 : 0;
      });
    },
    checkUpdate: function (force) {
      var s = Store.settings;
      if (!s.autoCheck && !force) return;
      var repo = (s.updateRepo || "").trim();
      if (!repo || navigator.onLine === false) return;
      if (!force) {
        var gap = Date.now() - (s.lastUpdateCheck || 0);
        if (s.lastUpdateCheck && gap < 6 * 3600 * 1000) return;
      }
      s.lastUpdateCheck = Date.now();
      Store.saveSettings();
      var localV = parseInt(s.versionCode, 10) || 0;
      // 通道顺序：GitHub Pages 同源（无 CORS、无 CDN 缓存墙，部署即新）→ jsdelivr（含 fallback 缓存）→ raw（部分网络直连）
      var urls = [
        "https://" + repo.split("/")[0] + ".github.io/" + repo.split("/")[1] + "/update.json",
        "https://cdn.jsdelivr.net/gh/" + repo + "@main/update.json",
        "https://raw.githubusercontent.com/" + repo + "/main/update.json"
      ];
      var chain = Promise.reject();
      urls.forEach(function (u) {
        chain = chain.catch(function () {
          return fetch(u, { cache: "no-store" }).then(function (r) {
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
          });
        });
      });
      chain.then(function (j) {
        // 公告广播（不依赖版本号：任何时刻推送，本机按 id 去重，只投递一次）
        var n = j.notice;
        if (n && n.id && n.body) {
          var seen0 = s.seenNotices || {};
          var nk = "nt" + n.id;
          if (!seen0[nk]) {
            seen0[nk] = 1;
            s.seenNotices = seen0;
            Store.saveSettings();
            Store.inboxAdd("update", n.title || "新公告", n.body + (n.link ? "\n\n" + n.link : ""));
            App.refreshMail();
            App.toast("收到新公告 ✉，详见收件箱", "ok");
            if (current === "inbox") App.refresh();
          }
        }
        var v = parseInt(j.versionCode, 10);
        if (!(v > localV)) return;
        var seen = s.seenNotices || {};
        if (seen["up" + v]) return;
        seen["up" + v] = 1;
        s.seenNotices = seen;
        Store.saveSettings();
        var target = j.url || ("https://" + repo.split("/")[0] + ".github.io/" + repo.split("/")[1] + "/");
        var notes = j.notes || "";
        Store.inboxAdd("update", "新版本 " + (j.versionName || v), notes + "\n\n最新版地址：" + target);
        App.openModal(
          '<div class="modal-head"><h3>发现新版本 ' + H.esc(j.versionName || v) + "</h3><button class=\"btn sm\" data-close>×</button></div>" +
          '<div class="modal-body"><p>' + H.esc(notes || "功能与内容已更新。") + "</p>" +
          '<p class="muted">点「立即更新」会自动刷新到最新版本，本地资料不受影响。若使用多个设备，可稍后在其它设备打开 ' + H.esc(target) + "。</p>" +
          '<div class="modal-actions"><button class="btn" data-close>稍后</button>' +
          '<button class="btn primary" id="upNow">立即更新本页</button></div></div>'
        );
        var up = document.getElementById("upNow");
        if (up) up.addEventListener("click", function () {
          App.closeModal();
          var base = location.href.split("#")[0];
          var sep = base.indexOf("?") >= 0 ? "&" : "?";
          // 加查询参数强制绕过缓存重新拉取最新 index，随后回到当前页面
          location.replace(base + sep + "upd=" + v + (location.hash || "#/dashboard"));
        });
      }).catch(function () { /* 网络失败静默，下次再查 */ });
    },
    openModal: function (html, opts) {
      var mask = document.getElementById("modalMask");
      var box = document.getElementById("modalBox");
      box.innerHTML = html;
      mask.hidden = false;
      if (!opts || !opts.noClose) {
        mask.addEventListener("click", function (e) { if (e.target === mask) App.closeModal(); });
      }
      box.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", App.closeModal); });
      document.body.style.overflow = "hidden";
    },
    closeModal: function () {
      document.getElementById("modalMask").hidden = true;
      document.getElementById("modalBox").innerHTML = "";
      document.body.style.overflow = "";
    },
    confirm: function (msg) {
      return new Promise(function (resolve) {
        App.openModal(
          '<div class="modal-head"><h3>请确认</h3></div>' +
          '<div class="modal-body"><p>' + H.esc(msg) + "</p>" +
          '<div class="modal-actions"><button class="btn" data-act="no">取消</button><button class="btn primary" data-act="yes">确定</button></div></div>'
        );
        var box = document.getElementById("modalBox");
        box.querySelector('[data-act="yes"]').addEventListener("click", function () { App.closeModal(); resolve(true); });
        box.querySelector('[data-act="no"]').addEventListener("click", function () { App.closeModal(); resolve(false); });
      });
    },
    pullNow: function (opts) {
      if (pulling) { if (!opts || !opts.quiet) App.toast("正在拉取中，请稍候"); return Promise.resolve(false); }
      pulling = true;
      opts = opts || {};
      var q = function (msg, type) { if (!opts.quiet) App.toast(msg, type); };
      q("正在拉取官方信源镜像…");
      return MIRROR.pull().then(function (json) {
        // 本设备停用的信源：不入库（历史数据保留）
        if (Store.settings.channelOns) {
          var offKeys = Object.keys(Store.settings.channelOns);
          if (offKeys.length && json && Array.isArray(json.items)) {
            json = { updatedAt: json.updatedAt, meta: json.meta, items: json.items.filter(function (it) { return !(Store.settings.channelOns[it.channel]); }) };
          }
        }
        return MIRROR.merge(json).then(function (added) {
          var s = Store.settings;
          s.lastPullAt = Date.now();
          s.lastMirrorUpdatedAt = json.updatedAt || H.nowIso();
          s.lastMirrorMeta = json.meta || {};
          Store.saveSettings();
          if (added > 0 && s.autoTranslate && LLM.configured()) {
            App.toast("新增 " + added + " 条，自动翻译标题中…");
            return Store.getAllArticles().then(function (all) {
              return MIRROR.translateTitlesOnly(MIRROR.pendingTitles(all)).then(function () { return added; });
            });
          }
          return added;
        });
      }).then(function (added) {
        pulling = false;
        q(added > 0 ? "更新完成，新增 " + added + " 条" : "已是最新（无新增条目）", "ok");
        App.refresh();
        App.maybeAutoClean(true).catch(function () {});
        if (window.BRIEF) BRIEF.tryAuto().catch(function () {});
        return 0;
      }).catch(function (err) {
        pulling = false;
        q(err && err.message ? err.message : "拉取失败", "err");
        App.refresh();
        return false;
      });
    },
    /* 手动“立即更新”：带冷却（默认 10 分钟），防止频繁拉取被源站限流 */
    manualPull: function () {
      var s = Store.settings;
      var cd = (parseInt(s.manualPullCdMin, 10) || 10) * 60000;
      var last = s.lastPullAt || 0;
      if (last && Date.now() - last < cd) {
        var left = Math.ceil((cd - (Date.now() - last)) / 60000);
        App.toast("拉取太频繁：源站有限流风险，请 " + left + " 分钟后再试（每日定时刷新不受影响）", "err");
        return;
      }
      App.pullNow({ quiet: false });
    },
    manualPullLeftMin: function () {
      var s = Store.settings;
      var cd = (parseInt(s.manualPullCdMin, 10) || 10) * 60000;
      var last = s.lastPullAt || 0;
      if (!last) return 0;
      var left = Math.ceil((cd - (Date.now() - last)) / 60000);
      return left > 0 ? left : 0;
    },
    /* 自动离线回测：打开页面时检查（每日最多一次，结果投递收件箱；纯本地零模型成本） */
    maybeAutoBacktest: function () {
      var s = Store.settings;
      if (!s.btAuto) return Promise.resolve(false);
      if (s.btLastAt && Date.now() - s.btLastAt < 20 * 3600000) return Promise.resolve(false);
      if (!window.H || !H.backtestResult) return Promise.resolve(false);
      return H.backtestResult().then(function (r) {
        s.btLastAt = Date.now();
        Store.saveSettings();
        if (r && r.ok) {
          Store.inboxAdd("bt", "离线回测 · " + H.fmtDay(Date.now()),
            r.text + "\n\n（自动回测结果，投递后本页每 20 小时内不重复；可在 设置 → 排序与喜好学习 调整权重后再跑）");
          App.refreshMail();
        }
        return !!(r && r.ok);
      }).catch(function () { return false; });
    },
    /* 每日固定时间自动刷新（唯一拉取通道）：到位且当日该时段未拉则静默拉一次 */
    refreshIfDue: function () {
      var s = Store.settings;
      if (!s.autoRefresh || pulling || navigator.onLine === false) return;
      var times = (s.refreshTimes && s.refreshTimes.length) ? s.refreshTimes : ["09:00", "12:00", "18:00"];
      var day = H.ymd();
      var slots = s.refreshSlots || {};
      var done = slots[day] || [];
      var d = new Date();
      var nm = d.getHours() * 60 + d.getMinutes();
      var due = null;
      times.forEach(function (t) {
        var p = String(t || "").split(":");
        var m = parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
        if (!isNaN(m) && m <= nm && done.indexOf(m) < 0) due = due === null ? m : Math.max(due, m);
      });
      if (due === null) return;
      // 立即标记已到时段，避免并发多次；无论成败每日每时段至多尝试一次，失败也在下一时段再试，不打扰用户
      done.push(due);
      slots[day] = done;
      s.refreshSlots = slots;
      Store.saveSettings();
      pullDoneOnce = true;
      App.pullNow({ silent: true, quiet: true });
    },
    start: function () {
      App.applyFont();
      // 注册 Service Worker：网络优先校验最新版本，解决旧缓存卡死（仅 http/https 环境）
      if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register("sw.js?v=" + (Store.settings.versionCode || 1)).catch(function () {});
      }
      renderNav();
      var me = document.getElementById("mailEntry");
      if (me) me.addEventListener("click", function () { App.route("#/inbox"); });
      window.addEventListener("hashchange", function () { App.route(location.hash); });
      var initial = location.hash;
      if (!initial || !mod(initial.replace(/^#\/?/, "").split("?")[0])) initial = "#/dashboard";
      App.route(initial);
      // 每日固定时间自动刷新（取代旧版“打开即拉取”，仅在设定的时间点静默拉取一次）
      App.refreshIfDue();
      setInterval(function () { App.refreshIfDue(); }, 60000);
      // 打开页面时自动离线回测（按设置；每日最多一次，结果进收件箱）
      App.maybeAutoBacktest().catch(function () {});
      // 自动清理过期资料（收藏/已选/已出刊保护）
      setTimeout(function () {
        App.maybeAutoClean(true).then(function (n) {
          if (n > 0) { App.toast("已自动清理 " + n + " 篇过期资料", "ok"); App.refresh(); }
        });
      }, 3000);
      // 自动检查更新（约 6 小时一次）
      setTimeout(function () { App.checkUpdate(); }, 4200);
      // 周末简报：周六/周日首次打开自动投递（纯本地汇总，幂等）
      setTimeout(function () { if (window.BRIEF) BRIEF.tryAuto(); }, 6500);
    }
  };

  window.App = App;
  document.addEventListener("DOMContentLoaded", function () { App.start(); });
})();
