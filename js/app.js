/* app.js —— 应用外壳：导航、路由、刷新、拉取、弹窗/Toast */
(function () {
  "use strict";

  var ORDER = ["dashboard", "library", "favorites", "rankings", "journal", "sources", "terms", "prefs", "settings"];
  var ICONS = { dashboard: "总", library: "库", favorites: "藏", rankings: "榜", journal: "报", sources: "源", terms: "词", prefs: "趣", settings: "设" };
  var COLORS = { dashboard: "#2f7fd1", library: "#0f766e", favorites: "#b06a1b", rankings: "#0e7490", journal: "#b7791f", sources: "#5b4b8a", terms: "#a34f6d", prefs: "#d97706", settings: "#4a5568" };

  var current = "dashboard";
  var pulling = false;
  var pullDoneOnce = false;

  function mod(key) { return window.WB.modules[key]; }

  function renderNav() {
    var nav = document.getElementById("nav");
    nav.innerHTML = ORDER.map(function (k) {
      var m = mod(k);
      return '<button data-view="' + k + '" class="' + (current === k ? "active" : "") + '">' +
        '<span class="ico" style="background:' + COLORS[k] + '">' + ICONS[k] + "</span>" +
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
      b.innerHTML = '<span class="mail-ico">✉</span><span>收件箱</span>' + (un ? '<span class="mail-badge">' + un + "</span>" : "");
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
      var urls = [
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
      if (pulling) { App.toast("正在拉取中，请稍候"); return Promise.resolve(false); }
      pulling = true;
      if (!opts || !opts.silent) App.toast("正在拉取官方信源镜像…");
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
        App.toast(added > 0 ? "更新完成，新增 " + added + " 条" : "已是最新（无新增条目）", "ok");
        App.refresh();
        App.maybeAutoClean(true).catch(function () {});
        if (window.BRIEF) BRIEF.tryAuto().catch(function () {});
        return 0;
      }).catch(function (err) {
        pulling = false;
        App.toast(err && err.message ? err.message : "拉取失败", "err");
        App.refresh();
        return false;
      });
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
      // 打开页面自动拉取（可关闭；30 分钟内有数据则不重复）
      setTimeout(function () {
        var s = Store.settings;
        if (s.autoPull && !pullDoneOnce && navigator.onLine !== false) {
          if (!s.lastPullAt || (Date.now() - s.lastPullAt > 30 * 60 * 1000)) {
            pullDoneOnce = true;
            App.pullNow({ silent: true });
          }
        }
      }, 900);
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
