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

  /* —— 移动端（安卓手机）底部导航：5 项最高频顶级入口 ——
     其余入口（榜单/学报/信源 → 总览页频道tab；术语库/喜好/设置 → 「我的」页）均保留，只是位置不同 */
  var M_ORDER = ["dashboard", "library", "favorites", "inbox", "me"];
  var M_COLORS = { dashboard: "#2f7fd1", library: "#0f766e", favorites: "#b06a1b", inbox: "#e5484d", me: "#4a5568" };
  var M_ICO = {
    dashboard: ICO.dashboard,
    library: ICO.library,
    favorites: ICO.favorites,
    inbox: MAIL_ICO,
    me: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };
  /* 「我的」页内入口（术语库/喜好/设置 + 榜单/信源），层级聚合。出刊(journal)已从手机端移除，仅桌面/平板保留。 */
  var ME_ENTRIES = [
    { key: "rankings", label: "排行榜", icon: ICO.rankings, desc: "按价值与喜好综合排序" },
    { key: "sources", label: "信源与镜像", icon: ICO.sources, desc: "9 个官方信源状态与启停" },
    { key: "terms", label: "术语库", icon: ICO.terms, desc: "军语/术语命中与候选" },
    { key: "prefs", label: "兴趣与喜好", icon: ICO.prefs, desc: "关键词、喜好学习、偏好档案" },
    { key: "settings", label: "设置", icon: ICO.settings, desc: "模型、字体、主题、数据与更新" }
  ];
  /* 总览页频道 tab（手机端）：出刊(journal)已移除，仅 总览/排行榜/信源 */
  var CHANNEL_TABS = [
    { key: "dashboard", label: "总览" },
    { key: "rankings", label: "排行榜" },
    { key: "sources", label: "信源" }
  ];

  var current = "dashboard";
  var pulling = false;
  var pullDoneOnce = false;
  /* 移动端顶栏返回目标：记录当前从哪个主入口进入（rankings/sources→总览；terms/prefs/settings→我的） */
  var lastRoot = "dashboard";
  var keyDownFrom = { rankings: "dashboard", sources: "dashboard", terms: "me", prefs: "me", settings: "me" };
  /* 主题的浏览器地址栏色：与各主题主色呼应 */
  var THEME_META = { "": "#0b3a6e", night: "#0e1622", paper: "#6d5230", gray: "#4a5868" };

  function mod(key) { return window.WB.modules[key]; }

  /* —— 后台翻译任务栏（浮动小浮标 + 展开面板）：查看后台并行翻译进度，可取消 —— */
  var TASK_UI = {
    panelOpen: false,
    _pastToast: {},
    init: function () {
      var wrap = document.createElement("div");
      wrap.className = "task-ui"; wrap.id = "taskUI";
      wrap.innerHTML =
        '<div class="task-fab" id="taskFab" role="button" tabindex="0" title="后台翻译任务" hidden>' +
        '<span class="tf-ico">◐</span><b class="tf-badge" id="taskBadge">0</b></div>' +
        '<div class="task-panel" id="taskPanel" hidden></div>';
      document.body.appendChild(wrap);
      var fab = document.getElementById("taskFab");
      var panel = document.getElementById("taskPanel");
      fab.addEventListener("click", function () {
        TASK_UI.panelOpen = !TASK_UI.panelOpen;
        panel.hidden = !TASK_UI.panelOpen;
        TASK_UI.renderPanel();
      });
      panel.addEventListener("click", function (e) {
        var b = e.target.closest("[data-cancel]");
        if (b) MIRROR.taskCancel(b.dataset.cancel);
      });
      MIRROR.onTasks(function () { TASK_UI.refresh(); });
      TASK_UI.refresh();
    },
    refresh: function () {
      var ts = MIRROR.tasks();
      var active = ts.filter(function (t) { return t.state === "queued" || t.state === "running"; });
      var fab = document.getElementById("taskFab");
      var badge = document.getElementById("taskBadge");
      // 宠物启用时（桌面/平板有侧栏窝）隐藏右下角任务球，由宠物窝承担入口；手机无侧栏仍保留任务球
      var petOn = !!(Store.settings.pet || "");
      if (fab) fab.hidden = (petOn && !isMobile()) ? true : (ts.length === 0);
      if (badge) badge.textContent = active.length;
      // 有全文翻译完成时给一次轻提示（避免闭门等待）
      ts.forEach(function (t) {
        if (t.kind === "full" && (t.state === "ok" || t.state === "failed" || t.state === "cancelled")) {
          var k = t.id + ":" + t.state;
          if (!TASK_UI._pastToast[k] && active.length === 0) {
            TASK_UI._pastToast[k] = 1;
            App.toast(t.state === "ok" ? "全文翻译完成：" + t.label : "全文翻译" + (t.state === "cancelled" ? "已取消" : "失败"), t.state === "ok" ? "ok" : "err");
          }
        }
      });
      if (TASK_UI.panelOpen) TASK_UI.renderPanel();
    },
    panelHtml: function (ts) {
      if (!ts.length) return '<div class="tp-empty">没有进行中的翻译任务</div>';
      var KIND = { full: "全文", title: "标题", summary: "摘要" };
      return ts.map(function (t) {
        var st = t.state, running = st === "running" || st === "queued";
        var showProgress = t.kind === "full" && t.total > 0;
        var pct = showProgress ? Math.round((t.done / t.total) * 100) : (running ? 0 : 100);
        var bar = showProgress
          ? '<div class="tp-bar"><div class="tp-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="tp-n">' + t.done + ' / ' + t.total + ' 段</div>'
          : (running ? '<span class="spin small dark"></span>' : "");
        var stateLabel = running ? (st === "queued" ? "排队中" : "翻译中") : (st === "ok" ? "已完成" : st === "cancelled" ? "已取消" : "失败");
        var stateCls = st === "ok" ? " state-ok" : (st === "failed" ? " state-error" : "");
        return '<div class="tp-item" data-st="' + st + '">' +
          '<div class="tp-head"><span class="badge ghost">' + (KIND[t.kind] || t.kind) + "</span>" +
          '<b class="tp-title" title="' + (t.label || "") + '">' + (t.label || "") + "</b>" +
          '<span class="tp-st' + stateCls + '">' + stateLabel + "</span></div>" +
          (bar || "") +
          (running ? '<button class="btn sm" data-cancel="' + t.id + '" title="取消该任务">取消</button>' : "") +
          (st === "failed" && t.err ? '<div class="tp-err">' + t.err + "</div>" : "") +
          '</div>';
      }).join("");
    },
    renderPanel: function () {
      var panel = document.getElementById("taskPanel");
      if (!panel) return;
      panel.innerHTML = '<div class="tp-head"><h3>后台翻译任务</h3><button class="btn sm" id="tpClose">收起</button></div>' + '<div class="tp-body">' + TASK_UI.panelHtml(MIRROR.tasks()) + "</div>";
      var c = panel.querySelector("#tpClose");
      if (c) c.addEventListener("click", function () { TASK_UI.panelOpen = false; panel.hidden = true; });
    }
  };

  /* —— 阅读宠物「小翼」：后台任务驱动状态机（工作/等待/完成/出错/待机），点击展开任务面板 —— */
  var PET = {
    el: null,
    state: "idle",          // idle / waiting / working / done / error
    timer: 0,
    _prevActive: 0,
    /* 状态 → [图片尾部, 动效 class]。等待复用「疑惑」神态；完成用欢呼；出错用皱眉。 */
    _MAP: { idle: ["idle", "breathe"], waiting: ["puzzled", "breathe"], working: ["working", "working"], done: ["cheer", "cheer"], error: ["error", "error"] },
    init: function () {
      var nest = document.getElementById("petNest");
      if (!nest) return;
      this.el = nest;
      nest.addEventListener("click", function () {
        var panel = document.getElementById("taskPanel");
        if (panel) { TASK_UI.panelOpen = true; panel.hidden = false; TASK_UI.renderPanel(); }
      });
      if (window.MIRROR && MIRROR.onTasks) MIRROR.onTasks(function () { PET.refresh(); });
      this.apply();
    },
    set: function (st) {
      if (this.timer) clearTimeout(this.timer);
      this.state = st;
      if (st === "done") this.timer = setTimeout(function () { PET.set("idle"); }, 1500);
      this.apply();
    },
    refresh: function () {
      if (!window.MIRROR) return;
      var ts = MIRROR.tasks();
      var running = 0, queued = 0, failed = 0;
      ts.forEach(function (t) {
        if (t.state === "running") running++;
        else if (t.state === "queued") queued++;
        else if (t.state === "failed" && !t.cancel) failed++;
      });
      var activeCount = running + queued;
      var justDone = this._prevActive > 0 && activeCount === 0;   // 上轮在忙、这轮全清空 → 欢呼
      this._prevActive = activeCount;
      var st;
      if (failed) st = "error";
      else if (running) st = "working";
      else if (queued) st = "waiting";
      else if (justDone) st = "done";
      else st = "idle";
      this.set(st);
      this.updateBadge(ts, activeCount, failed);
    },
    updateBadge: function (ts, activeCount, failed) {
      var b = this.el ? this.el.querySelector(".pet-badge") : null;
      if (!b) return;
      if (failed) { b.hidden = false; b.textContent = "!"; b.className = "pet-badge err"; }
      else if (activeCount) { b.hidden = false; b.textContent = activeCount > 9 ? "9+" : activeCount; b.className = "pet-badge"; }
      else { b.hidden = true; }
    },
    apply: function () {
      if (!this.el) return;
      var sp = Store.settings.pet || "";
      if (!sp) { this.el.hidden = true; return; }
      this.el.hidden = false;
      var m = this._MAP[this.state] || this._MAP.idle;
      var img = "assets/pet/xiaoyi/pet_xiaoyi_front_" + m[0] + "@64@2x.png";
      this.el.innerHTML =
        '<img class="pet-img ' + m[1] + '" src="' + img + '" alt="小翼">' +
        '<span class="pet-name">小翼</span>' +
        '<span class="pet-badge" hidden></span>';
      if (window.MIRROR) {
        var run = 0, que = 0, fail = 0;
        MIRROR.tasks().forEach(function (t) {
          if (t.state === "running") run++;
          else if (t.state === "queued") que++;
          else if (t.state === "failed" && !t.cancel) fail++;
        });
        this.updateBadge(MIRROR.tasks(), run + que, fail);
      }
    }
  };

  /* 主题 sprite 图标：ORDER 键 → symbol 名（dashboard→overview；prefs→interests 等） */
  var ICON_KEY = { dashboard: "overview", library: "library", favorites: "favorites", rankings: "ranking", journal: "journal", sources: "sources", terms: "terms", prefs: "interests", settings: "settings" };
  /* 当前主题 sprite 前缀：深空夜航 → ic，纸面/羊皮 → pc；其余主题（蓝天/极简灰）沿用线性图标 */
  function spritePrefix() {
    var t = (Store.settings.theme || "").trim();
    if (t === "night") return "ic";
    if (t === "paper") return "pc";
    return "";
  }

  function renderNav() {
    var nav = document.getElementById("nav");
    var prefix = spritePrefix();
    nav.innerHTML = ORDER.map(function (k) {
      var m = mod(k);
      var icon;
      if (prefix && ICON_KEY[k]) {
        icon = '<span class="ico theme"><svg class="ico-use"><use href="#' + prefix + "-" + ICON_KEY[k] + '"/></svg></span>';
      } else {
        icon = '<span class="ico" style="background:' + COLORS[k] + '">' + ICO[k] + "</span>";
      }
      return '<button data-view="' + k + '" class="' + (current === k ? "active" : "") + '" title="' + m.label + '">' +
        icon + "<span>" + m.label + "</span></button>";
    }).join("");
    nav.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { App.route("#/" + b.dataset.view); });
    });
    var foot = document.getElementById("sideFoot");
    if (foot) foot.textContent = "SENTRA 述势 · v" + (Store.settings.appVersion || "1.0.0");
  }

  /* —— 移动端（安卓手机）外壳：顶栏(标题/返回/收件箱) + 底部导航 ——
     仅当前处于窄视口时更新；桌面/平板仍走侧栏，不启用底部导航逻辑 */
  function isMobile() { return window.matchMedia && window.matchMedia("(max-width:760px)").matches; }

  function renderMobile() {
    renderChannels();
    var t = document.getElementById("mobileTopbar"), n = document.getElementById("bottomNav");
    if (!isMobile()) {
      // 桌面/平板：隐藏移动外壳
      if (t) t.hidden = true; if (n) n.hidden = true;
      return;
    }
    if (t) t.hidden = false; if (n) n.hidden = false;
    renderBottomNav();
    renderTopBar();
  }

  /* 频道 tab：仅在「总览/排行榜/信源」这组内容页出现（手机端），其余隐藏 */
  function renderChannels() {
    var wrap = document.getElementById("mobChannels");
    if (!wrap) return;
    var inGroup = ["dashboard", "rankings", "sources"].indexOf(current) >= 0;
    if (!isMobile() || !inGroup) { wrap.innerHTML = ""; wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.innerHTML = CHANNEL_TABS.map(function (t) {
      return '<button class="' + (current === t.key ? "active" : "") + '" data-v="' + t.key + '">' + t.label + "</button>";
    }).join("");
    wrap.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () { App.route("#/" + b.dataset.v); });
    });
  }

  function renderBottomNav() {
    var nav = document.getElementById("bottomNav");
    if (!nav) return;
    var inboxUn = Store.inboxUnread();
      // 所属底部导航项：子页高亮其父入口。
      // rankings/sources 由总览频道tab进入→高亮总览；terms/prefs/settings 由「我的」进入→高亮我的；
      // brief/inbox 系→高亮收件箱；reader→按来源。出刊(journal)已从手机端移除。
      var groupOf = {
        inbox: "inbox", brief: "inbox",
        rankings: "dashboard", sources: "dashboard",
        terms: "me", prefs: "me", settings: "me",
        reader: (keyDownFrom[current] || lastRoot)
      };
      var activeRoot = groupOf[current] || current;
      nav.innerHTML = M_ORDER.map(function (k) {
        var m = mod(k);
        var l = m ? m.label : k;
        var badge = "";
        if (k === "inbox" && inboxUn) badge = '<i class="bn-badge">' + (inboxUn > 99 ? "99+" : inboxUn) + "</i>";
        var active = activeRoot === k;
        return '<button class="bn-item' + (active ? " active" : "") + '" data-view="' + k + '" title="' + l + '">' +
          M_ICO[k] + badge +
          '<span class="bn-label">' + l + "</span></button>";
      }).join("");
    nav.querySelectorAll(".bn-item").forEach(function (b) {
      b.addEventListener("click", function () { App.route("#/" + b.dataset.view); });
    });
  }

  function renderTopBar() {
    var bar = document.getElementById("mobileTopbar");
    if (!bar) return;
    var m = mod(current);
    var title = document.getElementById("mobTitle");
    if (title) title.textContent = m ? m.label : "总览";
    // 底部导航页（总览/资料库/收藏夹/收件箱/我的）无返回；其它二级页显示返回
    var isRoot = M_ORDER.indexOf(current) >= 0;
    bar.classList.toggle("has-back", !isRoot);
    var back = document.getElementById("mobBack");
    if (back) {
      var target = (current === "brief" || current === "reader") ? lastRoot : (keyDownFrom[current] || lastRoot);
      back.dataset.to = target;
    }
  }

  var App = {
    refreshMail: function () {
      var b = document.getElementById("mailEntry");
      if (b) {
        var un = Store.inboxUnread();
        b.innerHTML = '<span class="mail-ico">' + MAIL_ICO + "</span><span>收件箱</span>" + (un ? '<span class="mail-badge">' + un + "</span>" : "");
        b.title = "收件箱（" + un + " 条未读）";
      }
      // 移动顶栏收件箱徽标
      var mb = document.getElementById("mobMailBadge");
      if (mb) {
        var un2 = Store.inboxUnread();
        mb.textContent = un2 > 99 ? "99+" : un2;
        mb.hidden = un2 === 0;
      }
    },
    refresh: function () {
      var el = document.getElementById("content");
      var m = mod(current);
      el.classList.remove("reader-mode"); // 离开阅读页时清理标记（阅读页渲染时会重新加上）
      renderNav();
      renderMobile();
      App.refreshMail();
      if (m && typeof m.render === "function") {
        m.render(el).catch(function (err) {
          el.innerHTML = '<div class="card"><div class="note">页面渲染出错：' + H.esc(err && err.message ? err.message : err) + "</div></div>";
        });
      }
    },
    route: function (hash) {
      var raw = String(hash || "").replace(/^#\/?/, "");
      var parts = raw.split("?");
      var path = parts[0] || "dashboard";
      var pathParts = path.split("/");
      var key = pathParts[0] || "dashboard";
      var arg = pathParts[1] ? decodeURIComponent(pathParts[1]) : "";
      var q = parts[1] ? decodeURIComponent(parts[1].replace(/^q=/, "")) : "";
      if (!mod(key)) key = "dashboard";
      // 手机端已移除出刊功能：未配置入口或直接访问 #/journal 一律回「总览」；平板/电脑不受影响
      var blocked = false;
      if (key === "journal" && H.isMobile()) { key = "dashboard"; blocked = true; }
      current = key;
      // 拦截后同步纠正路由 hash（避免地址栏停留在被移除的出刊页）
      if (blocked && location.hash !== "#/dashboard") {
        hash = "#/dashboard";
        if (location.hash !== hash) location.hash = hash;
      }
      // 记录「上一级」（供移动端顶栏返回按钮使用）：底部导航页无返回；其下页面返回对应主入口
      if (M_ORDER.indexOf(key) >= 0) lastRoot = key; else {
        lastRoot = (key === "brief" || key === "reader") ? lastRoot
                  : (M_ORDER.indexOf(key) < 0 ? (keyDownFrom[key] || "dashboard") : lastRoot);
      }
      if (q && window.WB.modules.library && window.WB.modules.library.state) {
        window.WB.modules.library.state.q = q;
      }
      // 独立「周末简报」阅读页：把 #/brief/<id> 中的 id 传给模块渲染
      if (key === "brief" && window.WB.modules.brief) {
        window.WB.modules.brief.curId = arg;
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
    /* 多主题：<html data-theme> 切换整套 CSS 变量；更新浏览器地址栏主题色 */
    applyTheme: function () {
      var t = (Store.settings.theme || "").trim();
      var el = document.documentElement;
      if (t) el.setAttribute("data-theme", t); else el.removeAttribute("data-theme");
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", THEME_META[t] || "#0b3a6e");
      renderNav();   // 侧栏图标随主题即时切换（sprite use / 线性两套）
    },
    /* 宠物切换（设置页）：重绘侧栏窝位 */
    updatePet: function () { PET.apply(); },
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
      var none = { state: "none" };
      if (!s.autoCheck && !force) return Promise.resolve(none);
      var repo = (s.updateRepo || "").trim();
      if (!repo || navigator.onLine === false) {
        if (force) App.modalInfo("无法检查更新", "未配置更新仓库，或当前处于离线状态，请联网后重试。");
        return Promise.resolve({ state: "err" });
      }
      // 节流 3 分钟：打开即查一次；切换回标签页也立查（新版本/公告更快送达）；手动点击不受限
      if (!force) {
        var gap = Date.now() - (s.lastUpdateCheck || 0);
        if (s.lastUpdateCheck && gap < 3 * 60 * 1000) return Promise.resolve(none);
      }
      s.lastUpdateCheck = Date.now();
      Store.saveSettings();
      // 通道顺序：GitHub Pages 同源（无 CORS、无 CDN 缓存墙，部署即新）→ jsdelivr（含 fallback 缓存）→ raw（部分网络直连）
      // 加随机参数绕过 Service Worker 缓存（SW 对非导航请求是缓存优先，可能导致公告延迟一期）
      var rnd = "t=" + Date.now();
      var urls = [
        "https://" + repo.split("/")[0] + ".github.io/" + repo.split("/")[1] + "/update.json?" + rnd,
        "https://cdn.jsdelivr.net/gh/" + repo + "@main/update.json?" + rnd,
        "https://raw.githubusercontent.com/" + repo + "/main/update.json?" + rnd
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
      return chain.then(function (j) {
        var v = parseInt(j.versionCode, 10) || 0;
        var curV = parseInt(s.versionCode, 10) || 0;             // 当前运行代码版本
        var seen = s.seenNotices || {};
        var n = j.notice;
        var hasNotice = !!(n && n.id && n.body);
        var newV = v > curV;                                     // 远端版本比本机运行版新 → 可更新
        // 版本升级与公告合并为“一条”投递：有升级用「up+版本」键（正文优先公告全文），
        // 仅同版本下出现的新公告才用「nt+公告id」键 → 不再出现两条内容相似的 1.7.1 通知
        var title = hasNotice ? (n.title || ("新版本 " + (j.versionName || v)))
                              : ("新版本 " + (j.versionName || v));
        var body = hasNotice ? n.body : (j.notes || "功能与内容已更新。");
        var key = newV ? ("up" + v) : (hasNotice ? ("nt" + n.id) : "");
        var firstTime = !!key && !seen[key];
        if (firstTime) {
          seen[key] = 1;
          s.seenNotices = seen;
          if (newV) s.lastNotifiedVersion = v;
          Store.saveSettings();
          Store.inboxAdd("update", title, body);
          App.refreshMail();
        }
        if (newV) {
          // 更新弹窗：自动检查只在首次提醒；手动点击每次都明确反馈结果
          if (firstTime || force) {
            App.openModal(
              '<div class="modal-head"><h3>发现新版本 ' + H.esc(j.versionName || v) + '</h3><button class="btn sm" data-close>×</button></div>' +
              '<div class="modal-body"><p>当前 build ' + curV + '，远端已发布 build ' + v + '。</p>' +
              '<div class="prose" style="max-height:44vh;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0">' + H.esc(body) + '</div>' +
              '<p class="muted">点「立即更新本页」会自动刷新到最新版本，本地资料不受影响。</p>' +
              '<div class="modal-actions"><button class="btn" data-close>稍后再说</button>' +
              '<button class="btn primary" id="upNow">立即更新本页</button></div></div>'
            );
            var up = document.getElementById("upNow");
            if (up) up.addEventListener("click", function () {
              App.closeModal();
              var base = location.href.split("#")[0];
              var sep = base.indexOf("?") >= 0 ? "&" : "?";
              location.replace(base + sep + "upd=" + v + (location.hash || "#/dashboard"));
            });
          }
          return { state: "update", name: j.versionName || "", code: v, notes: body };
        }
        // 同版本下收到新公告：投递收件箱并轻提示（不弹升级窗）
        if (firstTime && hasNotice) {
          App.toast("收到新公告 ✉，详见收件箱", "ok");
          if (current === "inbox") App.refresh();
        }
        // 手动检查且确实没有更新 → 明确弹窗反馈“已是最新”
        if (force) {
          App.modalInfo("检查更新", "当前已是最新版本：v" + H.esc(s.appVersion || "?") + "（build " + curV + "）。新版本与公告会自动检查并提醒，无需手动操作。");
        }
        return { state: "none", code: v };
      }).catch(function () {
        if (force) App.modalInfo("检查更新失败", "网络或服务器暂时不可达，请稍后重试；应用会在后台自动复查。");
        return { state: "err" };
      });
    },
    openModal: function (html, opts) {
      var mask = document.getElementById("modalMask");
      var box = document.getElementById("modalBox");
      box.innerHTML = html;
      if (opts && opts.boxClass) box.classList.add(opts.boxClass);
      mask.hidden = false;
      if (!opts || !opts.noClose) {
        mask.addEventListener("click", function (e) { if (e.target === mask) App.closeModal(); });
      }
      box.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", App.closeModal); });
      document.body.style.overflow = "hidden";
    },
    closeModal: function () {
      document.getElementById("modalMask").hidden = true;
      var box = document.getElementById("modalBox");
      box.classList.remove("modal-lg");
      box.innerHTML = "";
      document.body.style.overflow = "";
    },
    /* 简单信息弹窗：标题 + 正文 + 单个「知道了」按钮（供检查更新等结果反馈） */
    modalInfo: function (title, msg) {
      App.openModal(
        '<div class="modal-head"><h3>' + H.esc(title) + '</h3><button class="btn sm" data-close>×</button></div>' +
        '<div class="modal-body"><p style="white-space:pre-wrap;word-break:break-word;margin:0">' + H.esc(msg) + "</p>" +
        '<div class="modal-actions"><button class="btn primary" data-close>知道了</button></div></div>'
      );
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
        // 通道可达但镜像无新增：视为“已是最新”，非失败
        if (json && json.__fresh__ === false) {
          var ss = Store.settings;
          ss.lastPullAt = Date.now();
          Store.saveSettings();
          // 镜像无新增（数据时间未变），但仍执行 merge 以回填旧文缺失正文（修复“有链接但系统内暂无正文”）
          return MIRROR.merge(json).then(function () { return { added: 0, noFresh: true }; });
        }
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
      }).then(function (r) {
        pulling = false;
        var r0 = (typeof r === "number") ? r : (r ? (r.added || 0) : 0);
        var noFresh = (typeof r !== "number") && !!(r && r.noFresh);
        q(noFresh ? "已是最新：镜像暂无新增条目" : (r0 > 0 ? "更新完成，新增 " + r0 + " 条" : "已是最新（无新增条目）"), "ok");
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
      App.applyTheme();
      // 全局外链守护：任何指向外部绝对 http(s) 地址的 <a>（含动态渲染、正文内链、target 未写），
      // 一律阻止默认跳转并新开标签打开，绝不覆盖系统页面（修复“点新闻下链接被覆盖”）。
      document.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a) return;
        var href = a.getAttribute("href") || "";
        if (!/^https?:\/\//i.test(href)) return;                 // 仅拦截绝对外链；#/ 路由等放行
        var origin = location.origin && location.origin.replace(/\/+$/, "");
        if (origin && href.replace(/\/+$/, "").indexOf(origin) === 0) return; // 同源资源放行
        e.preventDefault();
        window.open(href, "_blank", "noopener");
      }, true);
      // 注册 Service Worker：网络优先校验最新版本，解决旧缓存卡死（仅 http/https 环境）
      if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register("sw.js?v=" + (Store.settings.versionCode || 1)).catch(function () {});
      }
      renderNav();
      var me = document.getElementById("mailEntry");
      if (me) me.addEventListener("click", function () { App.route("#/inbox"); });
      window.addEventListener("hashchange", function () { App.route(location.hash); });
      // 移动端顶栏：返回 + 收件箱；底部导航入口（数据已在 renderBottomNav 绑定）
      var mobBack = document.getElementById("mobBack");
      if (mobBack) mobBack.addEventListener("click", function () {
        var to = mobBack.dataset.to || "dashboard";
        App.route("#/" + to);
      });
      var mobMail = document.getElementById("mobMail");
      if (mobMail) mobMail.addEventListener("click", function () { App.route("#/inbox"); });
      // 视口跨断点切换时重算手机/桌面外壳（平板/手机互通或窗口缩放）
      var mq = window.matchMedia ? window.matchMedia("(max-width:760px)") : null;
      if (mq && mq.addEventListener) {
        mq.addEventListener("change", function () { App.refresh(); });
      } else if (mq && mq.addListener) { mq.addListener(function () { App.refresh(); }); }
      // 后台翻译任务栏（浮动小浮标 + 可取消面板）
      if (window.MIRROR && MIRROR.onTasks) TASK_UI.init();
      // 阅读宠物「小翼」：随后台任务驱动状态机（侧栏窝；点击展开任务面板）
      if (window.MIRROR && MIRROR.onTasks) PET.init();
      var initial = location.hash;
      if (!initial || !mod(initial.replace(/^#\/?/, "").split("?")[0])) initial = "#/dashboard";
      App.route(initial);
      // 清理历史重复公告（同 kind+正文 只留最新一条），避免老用户看两条一样的
      if (Store.inboxDedup() > 0) App.refreshMail();
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
      // 自动检查更新与公告（打开约 2 秒即查一次，之后每 10 分钟复查；弹窗/公告按版本与 id 去重）
      setTimeout(function () { App.checkUpdate(); }, 2000);
      setInterval(function () { App.checkUpdate(); }, 600000);
      // 切回本标签页时立查一次：长时间挂着不刷的老用户一回来就能收到新版本/公告
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) App.checkUpdate();
      });
      // 周末简报：周六/周日首次打开自动投递（纯本地汇总，幂等）
      setTimeout(function () { if (window.BRIEF) BRIEF.tryAuto(); }, 6500);
      // 自动微调排序权重（P5）：可关 / 每日最多一次 / 尊重新近手动调权；打开页面稍后执行一次
      setTimeout(function () {
        if (!window.H || !H.autoTune) return;
        H.autoTune().then(function (r) {
          if (r && r.done) App.toast(r.msg, "ok");
        }).catch(function () {});
      }, 10000);
    }
  };

  window.App = App;
  document.addEventListener("DOMContentLoaded", function () { App.start(); });
})();
