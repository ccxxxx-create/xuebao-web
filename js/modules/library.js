/* modules/library.js —— 资料库 v3：点击标题进阅读页；摘要独立；标题自动翻译 */
(function () {
  "use strict";
  var state = { q: "", channel: "", trans: "", from: "", to: "", sort: "time", page: 1, mode: "zh", doneAuto: false };
  var running = {};

  function artBadges(a) {
    var out = [];
    if (a.fav) out.push('<span class="badge" style="background:#fdeee0;color:#b06a1b">收藏</span>');
    if (a.titleZh) out.push('<span class="badge state-ok">已译标题</span>');
    if (a.zhState === "ok") out.push('<span class="badge state-ok">全文已译</span>');
    return out.join(" ");
  }

  var M = {
    key: "library",
    label: "资料库",
    async render(el) {
      var all = await Store.getAllArticles();
      var kws = H.splitKeywords(Store.settings.interestKeywords || "");
      var arts = filter(all);
      var favN = all.filter(function (a) { return a.fav; }).length;
      var selN = all.filter(function (a) { return a.selected; }).length;
      if (!arts.length) state.page = 1;
      // 打开资料库时自动翻译待译标题（已配置模型且开启自动翻译）
      if (!state.doneAuto) {
        state.doneAuto = true;
        UI.ensureAutoTitles(all).then(function (n) { if (n > 0) App.refresh(); });
      }
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">资料库</h1>' +
        '<p class="view-sub">共 ' + all.length + " 篇 · 显示 " + arts.length + " 篇 · 收藏 " + favN + " 篇 · 学报选文 " + selN + " 篇 · 点击标题进入阅读页</p></div>" +
        '<div class="head-actions">' +
        '<div class="filters" style="margin-bottom:0">' +
        '<button class="btn sm ' + (state.mode === "zh" ? "primary" : "") + '" id="mZh">中文标题</button>' +
        '<button class="btn sm ' + (state.mode === "en" ? "primary" : "") + '" id="mEn">English</button>' +
        "</div></div></div>" +
        '<div class="filters">' +
        '<input class="search" id="fQ" placeholder="关键词（标题/正文/摘要/作者）" value="' + H.esc(state.q) + '">' +
        '<select id="fCh"><option value="">全部信源</option>' + chOptions(all) + "</select>" +
        '<select id="fTr"><option value="">翻译状态</option><option value="pending">标题待译</option><option value="ok">已译标题</option><option value="failed">失败</option></select>' +
        '<select id="fSort" title="排序方式"><option value="time"' + (state.sort === "time" ? " selected" : "") + ">按时间</option><option value=\"rel\"" + (state.sort === "rel" ? " selected" : "") + ">按相关度</option></select>" +
        '<input type="date" id="fFrom" title="发布日期 起" value="' + H.esc(state.from) + '"><span class="muted">至</span>' +
        '<input type="date" id="fTo" title="发布日期 止" value="' + H.esc(state.to) + '">' +
        "</div>" +
        '<div id="lbList">' + listHtml(arts, kws) + "</div>";

      bind(el, all);

      function chOptions(list) {
        var seen = {}, out = "";
        list.forEach(function (a) { if (a.channel && !seen[a.channel]) { seen[a.channel] = 1; out += '<option value="' + H.esc(a.channel) + '"' + (state.channel === a.channel ? " selected" : "") + ">" + H.esc(a.channelName || a.channel) + "</option>"; } });
        return out;
      }
      function filter(list) {
        var q = state.q.trim().toLowerCase();
        return list.filter(function (a) {
          if (state.channel && a.channel !== state.channel) return false;
          if (state.trans === "pending" && (a.titleZh || a.titleTrans !== "pending")) return false;
          if (state.trans === "ok" && !a.titleZh) return false;
          if (state.trans === "failed" && a.titleTrans !== "failed") return false;
          var d = (a.pubDate || "").slice(0, 10);
          if (state.from && d < state.from) return false;
          if (state.to && d > state.to) return false;
          if (q) {
            var blob = ((a.title || "") + " " + (a.titleZh || "") + " " + (a.author || "") + " " +
              (a.summary || "") + " " + (a.summaryZh || "") + " " + (a.summaryEn || "") + " " + (a.body || "")).toLowerCase();
            if (blob.indexOf(q) < 0) return false;
          }
          return true;
        }).sort(function (x, y) {
          if (state.sort === "rel" && kws.length) {
            var d2 = H.kwScore(kws, y).score - H.kwScore(kws, x).score;
            if (d2) return d2;
          }
          return String(y.pubDate).localeCompare(String(x.pubDate));
        });
      }
      function listHtml(list, kws) {
        if (!list.length) return '<div class="empty"><b>没有匹配的文章</b>试试放宽筛选，或等每日定时刷新后重看。</div>';
        var per = 20, pages = Math.max(1, Math.ceil(list.length / per));
        if (state.page > pages) state.page = pages;
        if (state.page < 1) state.page = 1;
        var slice = list.slice((state.page - 1) * per, state.page * per);
        var html = slice.map(function (a) { return cardHtml(a, kws); }).join("");
        if (pages > 1) html += pager(pages, list.length);
        return html;
      }
      function pager(pages, total) {
        return '<div class="pager">' +
          '<button class="btn sm" data-act="pg" data-pg="' + (state.page - 1) + '"' + (state.page <= 1 ? " disabled" : "") + ">上一页</button>" +
          '<span class="pg-info">第 ' + state.page + " / " + pages + " 页 · 共 " + total + " 篇</span>" +
          '<button class="btn sm" data-act="pg" data-pg="' + (state.page + 1) + '"' + (state.page >= pages ? " disabled" : "") + ">下一页</button></div>";
      }
      function cardHtml(a, kws) {
        var run = running[a.url];
        var kwr = kws.length ? H.kwScore(kws, a) : null;
        var zhMode = state.mode === "zh";
        var titleShow = zhMode ? (a.titleZh || a.title) : (a.title || a.titleZh || "");
        var sub = zhMode ? (a.titleZh ? a.title : "") : (a.titleZh ? a.titleZh : "");
        return '<div class="art">' +
          '<div class="art-title" data-url="' + H.esc(a.url) + '" title="点击进入阅读页">' + H.esc(titleShow) + "</div>" +
          (sub ? '<div class="art-title-en">' + H.esc(sub) + "</div>" : "") +
          '<div class="art-meta"><span class="badge A">A 官网直采</span>' +
          "<span>" + H.esc(a.channelName || a.channel) + "</span>" +
          "<span>" + H.fmtDay(a.pubDate) + "</span>" +
          artBadges(a) + (kwr && kwr.score ? H.kwBadge(kwr) : "") +
          "</div>" +
          '<div class="art-actions">' +
          '<button class="btn sm" data-act="fav" data-url="' + H.esc(a.url) + '">' + (a.fav ? "取消收藏" : "收藏") + "</button>" +
          '<button class="btn sm' + (a.selected ? " primary" : "") + '" data-act="sel" data-url="' + H.esc(a.url) + '" title="加入学报出刊队列">' + (a.selected ? "✓ 已选入学报" : "选入学报") + "</button>" +
          '<button class="btn sm" data-act="sum" data-url="' + H.esc(a.url) + '">摘要（中/英）</button>' +
          '<button class="btn sm" data-act="full" data-url="' + H.esc(a.url) + '"' + (run ? " disabled" : "") + ">" +
          (a.zhState === "ok" ? "重译全文" : (a.zhFull && a.zhState === "failed") ? "续译全文" : "全文翻译") + "</button>" +
          (a.titleZh ? '<button class="btn sm accent" data-act="journal" data-url="' + H.esc(a.url) + '" title="直接为这一篇生成学报 docx">直接出刊</button>' : "") +
          "</div>" +
          "</div>";
      }
      function bind(root, all) {
        var qI = root.querySelector("#fQ");
        qI.addEventListener("input", H.debounce(function () { state.q = qI.value; state.page = 1; App.refresh(); }, 350));
        root.querySelector("#fCh").addEventListener("change", function (e) { state.channel = e.target.value; state.page = 1; App.refresh(); });
        root.querySelector("#fTr").addEventListener("change", function (e) { state.trans = e.target.value; state.page = 1; App.refresh(); });
        root.querySelector("#fSort").addEventListener("change", function (e) { state.sort = e.target.value; App.refresh(); });
        root.querySelector("#fFrom").addEventListener("change", function (e) { state.from = e.target.value; state.page = 1; App.refresh(); });
        root.querySelector("#fTo").addEventListener("change", function (e) { state.to = e.target.value; state.page = 1; App.refresh(); });
        root.querySelector("#mZh").addEventListener("click", function () { state.mode = "zh"; App.refresh(); });
        root.querySelector("#mEn").addEventListener("click", function () { state.mode = "en"; App.refresh(); });
        if (!root.__lb) {
          root.__lb = true;
          root.addEventListener("click", function (e) {
            var title = e.target.closest(".art-title[data-url]");
            if (title) { UI.openArticle(title.dataset.url, "library"); return; }
            var btn = e.target.closest("[data-act]");
            if (!btn) return;
            var act = btn.dataset.act, url = btn.dataset.url;
            if (act === "pg") { var p = parseInt(btn.dataset.pg, 10); if (p >= 1) { state.page = p; App.refresh(); } }
            else if (act === "fav") doFav(url);
            else if (act === "sel") doSel(url);
            else if (act === "sum") window.UI.summaryModal(url);
            else if (act === "full") doFull(url);
            else if (act === "journal") {
              Store.getArticle(url).then(function (a) {
                if (!a.titleZh) { App.toast("标题尚未翻译，请稍候或先配置模型"); return; }
                window.WB.modules.journal.generateOne(a);
              });
            }
          });
        }
      }
      function doFav(url) {
        Store.getArticle(url).then(function (a) {
          a.fav = a.fav ? 0 : 1;
          var nowOn = !!a.fav;
          return Store.putArticle(a).then(function () {
            if (nowOn) { Store.logPreference("fav", a.url, a.titleZh || a.title); window.UI.afterFav(a); }
            else { App.toast("已取消收藏"); App.refresh(); }
          });
        });
      }
      /* 选入学报队列（出刊需要中文标题，未译先提示） */
      function doSel(url) {
        Store.getArticle(url).then(function (a) {
          if (!a) return;
          if (!a.titleZh) { App.toast("该文章标题尚未翻译，出刊需要中文标题，请先「全文翻译/摘要」生成", "err"); return; }
          a.selected = a.selected ? 0 : 1;
          return Store.putArticle(a).then(function () {
            App.toast(a.selected ? "已选入学报（到「学报」页逐个出刊）" : "已移出学报选文", a.selected ? "ok" : "");
            App.refresh();
          });
        });
      }
      function doFull(url) {
        if (!LLM.configured()) { App.toast("请先在 设置 → 模型 配置模型"); return; }
        running[url] = true; App.refresh();
        Store.getArticle(url).then(function (a) {
          if (a.zhState === "ok") { a.zhFull = ""; a.zhDone = 0; a.zhState = "none"; }
          return MIRROR.translateFull(a, {
            onChunk: function () {},
            onState: function (st) {
              delete running[url];
              App.toast(st === "ok" ? "全文翻译完成" : "翻译中断，可续译", st === "ok" ? "ok" : "err");
              App.refresh();
            }
          });
        }).catch(function (err) {
          delete running[url];
          App.toast(err && err.message ? err.message : "翻译失败", "err");
          App.refresh();
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.library = M;
})();
