/* modules/rankings.js —— 排行榜：今日榜（时效）/ 兴趣榜（权重+探索率）。
   排序权重（兴趣相关/新鲜度/来源权威/热度）与探索率在 设置 → 排序与喜好学习 调节。 */
(function () {
  "use strict";
  var state = { tab: "today" };
  var STOP = new Set(("the a an and or of to in for on with at by from as is are was were be been this that these those it its their our your we you i they he she not no but so what when where who how about into over under between through during after before against more most some any all each both few such than then them").split(" "));
  var TOK_CACHE = {};

  function toks(a) {
    if (TOK_CACHE[a.url]) return TOK_CACHE[a.url];
    var set = {};
    var en = (((a.title || "") + " " + (a.summary || "") + " " + (a.summaryEn || "")).toLowerCase().match(/[a-z][a-z0-9\-]{3,}/g) || []);
    en.forEach(function (t) { if (t.length >= 4 && !STOP.has(t)) set[t] = 1; });
    var zh = String((a.titleZh || "") + (a.summaryZh || "")).replace(/[^\u4e00-\u9fff]/g, "");
    for (var i = 0; i + 2 <= zh.length; i++) set[zh.slice(i, i + 2)] = 1;
    TOK_CACHE[a.url] = set;
    return set;
  }
  /* 与“我的收藏”的主题重合篇数（候选文章与某篇收藏有 token 交集即计 1），用于热度维度 */
  function favHitOf(a, favToks) {
    var t = toks(a), c = 0;
    favToks.forEach(function (fs) {
      var hit = false;
      for (var k in t) { if (fs[k]) { hit = true; break; } }
      if (hit) c++;
    });
    return c;
  }
  function metaHtml(a, num, extraBadges) {
    var medal = num <= 3 ? '<span class="badge" style="background:#ffe9c2;color:#8a5a00">TOP' + num + "</span>" : '<span class="badge ghost">' + num + "</span>";
    return '<div class="art-meta" style="margin-top:6px"><span class="badge A">A</span>' +
      "<span>" + H.esc(a.channelName || a.channel) + "</span><span>" + H.fmtDay(a.pubDate) + "</span>" +
      (extraBadges || "") + "</div>";
  }
  function reasonHtml(reasons) {
    if (!reasons || !reasons.length) return "";
    return '<div class="art-meta" style="margin-top:4px">' + reasons.map(function (r) {
      return '<span class="badge" style="background:#e4f1fd;color:#0b4f8f">' + H.esc(r) + "</span>";
    }).join("") + "</div>";
  }
  function itemHtml(a, num, reasons) {
    return '<div class="art"><div class="art-title" data-url="' + H.esc(a.url) + '">' + H.esc(a.titleZh || a.title) + "</div>" +
      (a.titleZh ? '<div class="art-title-en">' + H.esc(a.title) + "</div>" : "") +
      metaHtml(a, num) + reasonHtml(reasons) +
      "</div>";
  }

  var M = {
    key: "rankings",
    label: "排行榜",
    async render(el) {
      var s = Store.settings;
      if (s.exploreRate == null) s.exploreRate = 0.1;
      var all = (await Store.getAllArticles()).filter(function (a) { return Store.channelOn(a.channel); });
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">排行榜</h1>' +
        '<p class="view-sub">今日榜关注时效；兴趣榜按「兴趣相关/新鲜度/来源权威/热度」加权排序。权重与探索率在 设置 → 排序与喜好学习 调节。</p></div>' +
        '<div class="head-actions"><a class="btn sm" href="#/settings">调权重与探索率 ⚙</a></div></div>' +
        '<div class="filters seg">' +
        '<button class="' + (state.tab === "today" ? "active" : "") + '" data-tab="today">今日榜</button>' +
        '<button class="' + (state.tab === "mine" ? "active" : "") + '" data-tab="mine">兴趣榜</button>' +
        "</div><div id=\"rkBody\">" + bodyHtml(all) + "</div>";

      bind(el, all);

      function bodyHtml(all) {
        if (state.tab === "mine") return mineHtml(all);
        return todayHtml(all);
      }
      function todayHtml(all) {
        var cands = all.filter(function (a) { return H.ageDays(a) <= 14; });
        if (!cands.length) return emptyNote("近 14 天暂无文章，请先等待定时刷新拉取镜像。");
        cands.sort(function (a, b) { return H.ageDays(a) - H.ageDays(b); });
        return listWrap(cands.slice(0, 20), function (a, i) {
          return itemHtml(a, i + 1, H.ageDays(a) <= 3 ? ["近期热点"] : ["权威源新讯"]);
        });
      }
      function mineHtml(all) {
        var favs = all.filter(function (a) { return a.fav; });
        var favToks = favs.map(toks);
        var cands = all.filter(function (a) { return H.ageDays(a) <= 60; });
        if (!cands.length) return emptyNote("60 天内暂无文章。");
        var kws = H.splitKeywords(s.interestKeywords || "");
        var scored = cands.map(function (a) {
          var favHit = favs.length ? favHitOf(a, favToks) : 0;
          var r = H.rankScore(a, { kws: kws, favHit: favHit, self: { fav: !!a.fav, journal: !!a.journalMade, selected: !!a.selected } });
          return { a: a, s: r.score, p: r.parts, favHit: favHit };
        });
        scored.sort(function (x, y) { return y.s - x.s; });
        var top = scored.slice(0, 20);
        var exRate = s.exploreRate || 0.1;
        var nTake = Math.round(20 * exRate);
        var shown = top.slice(0, 20 - nTake);
        if (nTake > 0) {
          var pool = scored.slice(20 - nTake).filter(function (x) { return shown.indexOf(x) < 0; });
          var step = Math.max(1, Math.floor(pool.length / nTake));
          for (var i = 0; i < nTake && i * step < pool.length; i++) shown.push(pool[i * step]);
        }
        return listWrap(shown, function (x, i) {
          return itemHtml(x.a, i + 1, myReasons(x));
        }, favs.length ? "" : '<div class="note">还没有收藏：当前主要按关键词与新鲜度排序；收藏后“热度”维度开始生效，效果更好。</div>');
      }
      function myReasons(x) {
        var rs = [];
        if (x.p.hits && x.p.hits.length) rs.push("命中关键词：" + x.p.hits.slice(0, 2).join("/"));
        if (x.favHit > 0) rs.push("同主题收藏 " + x.favHit + " 篇");
        if (x.p.age <= 3) rs.push("近期热点");
        return rs;
      }
      function listWrap(list, fn, note) {
        return (note || "") + '<div>' + list.map(function (x, i) { return fn(x, i); }).join("") + "</div>";
      }
      function emptyNote(t) {
        return '<div class="empty"><b>' + H.esc(t) + "</b></div>";
      }
      function bind(root, all) {
        if (!root.__rk) {
          root.__rk = true;
          root.addEventListener("click", function (e) {
            var tb = e.target.closest("[data-tab]");
            if (tb) { state.tab = tb.dataset.tab; App.refresh(); return; }
            var title = e.target.closest(".art-title[data-url]");
            if (title) { UI.openArticle(title.dataset.url, "rankings"); return; }
          });
        }
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.rankings = M;
})();
