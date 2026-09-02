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
      var pending = MIRROR.pendingTitles(arts).length;
      var favN = arts.filter(function (a) { return a.fav; }).length;
      var selected = arts.filter(function (a) { return a.selected; }).length;

      el.innerHTML =
        '<div class="view-head"><div>' +
        '<h1 class="view-title">总览</h1>' +
        '<p class="view-sub">英语情报 · 信息搜集为主、学报输出为辅（纯本地网页版，各设备数据独立）</p>' +
        "</div>" +
        '<div class="head-actions">' +
        '<button class="btn primary" id="dPull">' + (MIRROR.isBusy() ? '<span class="spin"></span> 更新中' : "立即更新资料") + "</button>" +
        "</div></div>" +

        '<div class="grid g2" style="margin-bottom:14px">' +
        stat("资料库总数", arts.length, "", "#/library") +
        stat("今日新增", todayAdd, "", "#/library") +
        stat("待译标题", pending, pending ? "bad" : "", "#/library") +
        stat("收藏", favN, "", "#/favorites") +
        "</div>" +

        '<div class="card"><div class="art-head" style="margin-bottom:4px"><h3 style="margin:0">最近入库</h3>' +
        '<span class="muted">共 ' + journals.length + " 份学报 · 全文/译文见资料库</span></div>" +
        recentHtml(arts) + "</div>";

      var b = el.querySelector("#dPull");
      if (b) b.addEventListener("click", function () {
        if (MIRROR.isBusy()) return;
        App.pullNow({ silent: false });
      });

      function stat(lab, n, cls, href) {
        return '<a class="stat" href="' + href + '" title="点击前往' + lab + '页面"><div class="num" style="color:' + (cls === "bad" ? "var(--bad)" : "") + '">' + n + '</div><div class="lab">' + lab + "</div></a>";
      }
      function recentHtml(list) {
        if (!list.length) return '<div class="empty"><b>资料库为空</b>点击「立即更新资料」从官方信源镜像拉取。</div>';
        var top = list.slice().sort(function (a, b) { return String(b.pubDate).localeCompare(String(a.pubDate)); }).slice(0, 6);
        return '<div>' + top.map(function (a) {
          return '<div class="art" style="margin-bottom:8px"><div class="art-head">' +
            '<div style="flex:1;min-width:0"><div class="art-title" style="font-size:15.5px">' + (a.titleZh ? H.esc(a.titleZh) : H.esc(a.title)) +
            (a.titleZh ? ' <span class="badge ghost" style="font-weight:400">' + H.esc(a.title) + "</span>" : "") + "</div>" +
            '<div class="art-meta"><span class="badge A">A 官网直采</span><span>' + H.esc(a.channelName || a.channel) + "</span><span>" +
            H.fmtDay(a.pubDate) + "</span>" +
            (a.fav ? '<span class="badge" style="background:#fdeee0;color:#b06a1b">收藏</span>' : "") +
            "</div></div>" +
            '<a class="btn sm" href="#/library?q=' + encodeURIComponent(a.title.slice(0, 40)) + '">查看</a>' +
            "</div></div>";
        }).join("") + "</div>";
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.dashboard = M;
})();
