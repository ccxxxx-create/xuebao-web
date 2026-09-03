/* modules/dashboard.js —— 总览：核心统计 + 最近入库（镜像/模型/占用已移入设置页） */
(function () {
  "use strict";
  var M = {
    key: "dashboard",
    label: "总览",
    async render(el) {
      var arts = await Store.getAllArticles();
      var journals = await Store.getAllJournals();
      var today = H.ymd();
      var todayAdd = arts.filter(function (a) { return H.ymd(new Date(a.fetchedAt)) === today; }).length;
      // 待译标题口径：凡缺中文标题均计入（含翻译失败的），与资料库“标题待译”筛选一致
      var pending = arts.filter(function (a) { return !a.titleZh && !a.titleZhLocked; }).length;
      var favN = arts.filter(function (a) { return a.fav; }).length;
      var selected = arts.filter(function (a) { return a.selected; }).length;
      var s = Store.settings;
      var rt = (s.refreshTimes && s.refreshTimes.length) ? s.refreshTimes : ["09:00", "12:00", "18:00"];

      el.innerHTML =
        '<div class="view-head"><div>' +
        '<h1 class="view-title">总览</h1>' +
        '<p class="view-sub">外军防务资讯智能情报台 · 每日自动更新 · 支持中英对照阅读与一键出刊</p>' +
        "</div>" +
        '<div class="head-actions" style="flex-direction:column;align-items:flex-end">' +
        '<button class="btn sm primary" id="dfPull">↻ 立即更新</button>' +
        '<div class="muted" style="text-align:right">定时刷新：每日 ' + H.esc(rt.join("、")) + '<br>' +
        '上次拉取：' + (s.lastPullAt ? H.fmtDateTime(s.lastPullAt) : "从未") +
        (App.manualPullLeftMin && App.manualPullLeftMin() > 0 ? '<br>手动更新冷却中：' + App.manualPullLeftMin() + " 分钟" : "") +
        "</div></div></div>" +

        '<div class="grid g2" style="margin-bottom:14px">' +
        stat("资料库总数", arts.length, "", "#/library") +
        stat("今日新增", todayAdd, "", "#/library") +
        stat("待译标题", pending, pending ? "bad" : "", "#/library") +
        stat("收藏", favN, "", "#/favorites") +
        "</div>" +

        '<div class="card"><div class="art-head" style="margin-bottom:4px"><h3 style="margin:0">最近入库</h3>' +
        '<span class="muted">共 ' + journals.length + " 份学报 · 点击标题进入阅读页</span></div>" +
        recentHtml(arts) + "</div>";

      if (!el.__ds) {
        el.__ds = true;
        el.addEventListener("click", function (e) {
          var title = e.target.closest(".art-title[data-url]");
          if (title) { UI.openArticle(title.dataset.url, "dashboard"); return; }
          var pull = e.target.closest("#dfPull");
          if (pull) { App.manualPull(); return; }
        });
      }

      function stat(lab, n, cls, href) {
        return '<a class="stat" href="' + href + '" title="点击前往' + lab + '页面"><div class="num" style="color:' + (cls === "bad" ? "var(--bad)" : "") + '">' + n + '</div><div class="lab">' + lab + "</div></a>";
      }
      function recentHtml(list) {
        if (!list.length) return '<div class="empty"><b>资料库为空</b>待每日定时刷新（' + H.esc(rt.join("、")) + "）自动抓取官方信源镜像。</div>";
        var top = list.slice().sort(function (a, b) { return String(b.pubDate).localeCompare(String(a.pubDate)); }).slice(0, 6);
        return '<div>' + top.map(function (a) {
          return '<div class="art" style="margin-bottom:8px"><div class="art-head">' +
            '<div style="flex:1;min-width:0"><div class="art-title" data-url="' + H.esc(a.url) + '" title="点击进入阅读页" style="font-size:15.5px;user-select:none">' + (a.titleZh ? H.esc(a.titleZh) : H.esc(a.title)) +
            (a.titleZh ? ' <span class="badge ghost" style="font-weight:400">' + H.esc(a.title) + "</span>" : "") + "</div>" +
            '<div class="art-meta"><span class="badge A">A 官网直采</span><span>' + H.esc(a.channelName || a.channel) + "</span><span>" +
            H.fmtDay(a.pubDate) + "</span>" +
            (a.fav ? '<span class="badge" style="background:#fdeee0;color:#b06a1b">收藏</span>' : "") +
            "</div></div>" +
            "</div></div>";
        }).join("") + "</div>";
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.dashboard = M;
})();
