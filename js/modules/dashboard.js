/* modules/dashboard.js —— 总览：核心统计 + 最近入库（镜像/模型/占用已移入设置页）
   桌面/平板保持原样；手机端(≤760px)增强：今日榜前置 + 统计区精炼 + 刷新状态小字 + 最近入库。 */
(function () {
  "use strict";
  function isMobile() { return window.matchMedia && window.matchMedia("(max-width:760px)").matches; }

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
      var rtStr = rt.join("、");

      if (isMobile()) {
        el.innerHTML = mobileHtml(arts, journals);
      } else {
        el.innerHTML =
          '<div class="view-head"><div>' +
          '<h1 class="view-title">总览</h1>' +
          '<p class="view-sub">外军防务资讯智能工作台 · 每日自动更新 · 支持中英对照阅读与一键出刊</p>' +
          "</div>" +
          '<div class="head-actions" style="flex-direction:column;align-items:flex-end">' +
          '<button class="btn sm primary" id="dfPull">↻ 立即更新</button>' +
          '<div class="muted" style="text-align:right">定时刷新：每日 ' + H.esc(rtStr) + '<br>' +
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
          recentHtml(arts, rtStr) + "</div>";
      }

      if (!el.__ds) {
        el.__ds = true;
        el.addEventListener("click", function (e) {
          var title = e.target.closest(".art-title[data-url]") || e.target.closest(".m-today-item[data-url]") || e.target.closest(".m-recent-item[data-url]");
          if (title) { UI.openArticle(title.dataset.url, "dashboard"); return; }
          var rk = e.target.closest("[data-goto]");
          if (rk) { App.route("#/" + rk.dataset.goto); return; }
          var pull = e.target.closest("#dfPull");
          if (pull) { App.manualPull(); return; }
          var pull2 = e.target.closest("[data-pull]");
          if (pull2) { App.manualPull(); return; }
        });
      }

      function stat(lab, n, cls, href) {
        return '<a class="stat" href="' + href + '" title="点击前往' + lab + '页面"><div class="num" style="color:' + (cls === "bad" ? "var(--bad)" : "") + '">' + n + '</div><div class="lab">' + lab + "</div></a>";
      }

      /* —— 桌面端：最近入库列表（保持原样） —— */
      function recentHtml(list, rtStr) {
        if (!list.length) return '<div class="empty"><b>资料库为空</b>待每日定时刷新（' + H.esc(rtStr) + "）自动抓取官方信源镜像。</div>";
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

      /* —— 手机端：今日榜 TOP5（按时效排序的近期文章，方便看到高价值信息） —— */
      function todayTop(arts, n) {
        var cands = arts.filter(function (a) { return H.ageDays(a) <= 14; });
        if (!cands.length) return [];
        cands.sort(function (a, b) { return H.ageDays(a) - H.ageDays(b); });
        return cands.slice(0, n);
      }

      /* —— 手机端：总览增强版 —— */
      function mobileHtml(arts, journals) {
        var top = todayTop(arts, 5);
        var pullLeft = (App.manualPullLeftMin && App.manualPullLeftMin() > 0) ? (" · 冷却 " + App.manualPullLeftMin() + " 分钟") : "";
        return (
          // 今日榜 TOP 区块
          '<div class="card m-card-today">' +
          '<div class="m-sec-head"><h3><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>今日榜</h3>' +
          '<button class="m-sec-more" data-goto="rankings">查看全部 ›</button></div>' +
          (top.length ? top.map(function (a, i) { return todayItem(a, i + 1); }).join("") :
            '<div class="empty" style="padding:22px 10px"><b>暂无近期文章</b>待每日定时刷新（' + H.esc(rtStr) + "）自动抓取官方信源镜像。</div>") +
          "</div>" +

          // 统计区精炼
          '<div class="m-stats">' +
          mStat(arts.length, "资料库", "#/library") +
          mStat(todayAdd, "今日新增", "#/library") +
          mStat(pending, "待译标题", "#/library", pending ? "bad" : "") +
          mStat(favN, "收藏", "#/favorites") +
          "</div>" +

          // 刷新状态一行小字 + 立即更新按钮
          '<div class="m-refresh">' +
          '<div class="m-refresh-info"><span>定时刷新：每日 ' + H.esc(rtStr) + "</span>" +
          "<span>上次拉取：" + (s.lastPullAt ? H.fmtDateTime(s.lastPullAt) : "从未") + H.esc(pullLeft) + "</span></div>" +
          '<button class="btn sm primary" data-pull="1">↻ 立即更新</button>' +
          "</div>" +

          // 最近入库
          '<div class="card" style="padding-bottom:8px"><div class="art-head" style="margin-bottom:4px"><h3 style="margin:0">最近入库</h3>' +
          '<span class="muted">最新 ' + arts.length + " 篇</span></div>" +
          recentMobile(arts) + "</div>"
        );
      }

      function todayItem(a, num) {
        var medal = num <= 3 ? '<span class="m-rank" style="background:linear-gradient(135deg,#f6b73c,#e8930c);color:#fff">' + num + "</span>" : '<span class="m-rank ghost">' + num + "</span>";
        return '<div class="m-today-item" data-url="' + H.esc(a.url) + '">' + medal +
          '<div class="m-today-body"><div class="m-today-title">' + H.esc(a.titleZh || a.title) + "</div>" +
          '<div class="m-today-meta">' + H.esc(a.channelName || a.channel) + " · " + H.fmtDay(a.pubDate) + "</div></div>" +
          '<span class="m-today-arrow">›</span></div>';
      }
      function mStat(n, lab, href, cls) {
        return '<a class="m-stat" href="' + href + '" title="点击前往' + lab + '">' +
          '<span class="m-stat-num" style="color:' + (cls === "bad" ? "var(--bad)" : "") + '">' + n + "</span>" +
          '<span class="m-stat-lab">' + lab + "</span>" +
          '<span class="m-stat-arrow">›</span></a>';
      }
      function recentMobile(list) {
        if (!list.length) return '<div class="empty" style="padding:22px 10px"><b>资料库为空</b>待每日定时刷新。</div>';
        var top = list.slice().sort(function (a, b) { return String(b.pubDate).localeCompare(String(a.pubDate)); }).slice(0, 6);
        return '<div>' + top.map(function (a) {
          return '<div class="m-recent-item" data-url="' + H.esc(a.url) + '">' +
            '<div class="m-recent-title">' + H.esc(a.titleZh || a.title) + "</div>" +
            '<div class="m-recent-meta"><span class="badge A">A</span><span>' + H.esc(a.channelName || a.channel) + "</span><span>" + H.fmtDay(a.pubDate) + "</span></div>" +
            "</div>";
        }).join("") + "</div>";
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.dashboard = M;
})();
