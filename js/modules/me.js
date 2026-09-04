/* modules/me.js —— 「我的」（移动端聚合页）：仅手机端底部导航最右入口。
   聚合 术语库/喜好/设置/排行榜/学报/信源 等中低频功能；本页本身不承载数据看板。 */
(function () {
  "use strict";
  var ENTRIES = [
    { key: "terms", label: "术语库", icon: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', desc: "军语/术语命中与候选" },
    { key: "prefs", label: "兴趣与喜好", icon: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', desc: "关键词、喜好学习、偏好档案" },
    { key: "settings", label: "设置", icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', desc: "模型、字体、主题、数据与更新" }
  ];

  var M = {
    key: "me",
    label: "我的",
    async render(el) {
      var s = Store.settings;
      var unreadC = Store.loadInbox().filter(function (x) { return !x.read; }).length;
      var s2 = Store.getAllArticles ? await Store.getAllArticles() : [];
      var favN = (s2 || []).filter(function (a) { return a.fav; }).length;
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">我的</h1>' +
        '<p class="view-sub">个人与工具入口 · 数据仅存本机</p></div></div>' +

        '<div class="card" style="background:linear-gradient(135deg,#0b4f8f,#2f7fd1);color:#fff;border:0">' +
        '<div class="art-head"><div class="brand-mark" style="background:rgba(255,255,255,.22)">势</div>' +
        '<div style="flex:1;min-width:0"><b style="font-size:16px">SENTRA 述势</b>' +
        '<div style="font-size:12.5px;opacity:.9;margin-top:2px">v' + H.esc(s.appVersion || "1.0.0") + " · 防务资讯工作台</div></div></div></div>" +

        '<div class="card"><h3>阅读与管理</h3>' +
        '<div class="me-list">' +
        meRow("favorites", "", "收藏夹", favN + " 篇收藏", '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>') +
        "</div></div>" +

        '<div class="card"><h3>工具与设置</h3>' +
        '<div class="me-list">' +
        ENTRIES.concat([
          { key: "rankings", label: "排行榜", desc: "按价值与喜好综合排序", icon: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
          { key: "sources", label: "信源与镜像", desc: "9 个官方信源状态与启停", icon: '<svg viewBox="0 0 24 24"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>' }
        ]).map(function (e) { return meRow(e.key, e.label, e.label, e.desc, e.icon); }).join("") +
        "</div></div>" +

        (unreadC ? '<div class="ok-line">收件箱有 <b>' + unreadC + '</b> 条未读，点击底部「收件箱」查看。</div>' : "");

      if (!el.__me) {
        el.__me = true;
        el.addEventListener("click", function (e) {
          var r = e.target.closest("[data-me]");
          if (r) { App.route("#/" + r.dataset.me); }
        });
      }

      function meRow(key, label, t, desc, icon) {
        return '<div class="me-item" data-me="' + key + '" role="button" tabindex="0">' +
          '<span class="me-ico">' + icon + "</span>" +
          '<span class="me-txt"><b>' + H.esc(t) + "</b><small>" + H.esc(desc || "") + "</small></span>" +
          '<span class="me-arrow">›</span></div>';
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.me = M;
})();
