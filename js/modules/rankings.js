/* modules/rankings.js —— 排行榜（价值排序 P2）：今日榜 / 我的相关榜 / 回测与抽查 */
(function () {
  "use strict";
  var state = { tab: "today" };
  var STOP = new Set(("the a an and or of to in for on with at by from as is are was were be been this that these those it its their our your we you i they he she not no but so what when where who how about into over under between through during after before against more most some any all each both few such than then them").split(" "));
  var TOK_CACHE = {};

  function ageDays(a) {
    var t = new Date(a.pubDate || a.fetchedAt || 0).getTime();
    return t ? Math.max(0, (Date.now() - t) / 864e5) : 999;
  }
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
  function jgBtns(a) {
    return '<button class="btn sm" data-jg="pos" data-url="' + H.esc(a.url) + '" title="值得上榜">值得</button>' +
      '<button class="btn sm" data-jg="neg" data-url="' + H.esc(a.url) + '" title="不该上榜">不该上</button>';
  }
  function itemHtml(a, num, reasons) {
    return '<div class="art"><div class="art-title" data-url="' + H.esc(a.url) + '">' + H.esc(a.titleZh || a.title) + "</div>" +
      (a.titleZh ? '<div class="art-title-en">' + H.esc(a.title) + "</div>" : "") +
      metaHtml(a, num) + reasonHtml(reasons) +
      '<div class="art-actions" style="margin-top:8px">' + jgBtns(a) + "</div></div>";
  }

  function freshScore(a) {
    var d = ageDays(a);
    return d >= 60 ? 0 : Math.max(0, 1 - d / 60);
  }
  function heatFav(a, favSets) {
    var t = toks(a), c = 0;
    favSets.forEach(function (fs) {
      var hit = false;
      for (var k in fs) { if (t[k]) { hit = true; break; } }
      if (hit) c++;
    });
    return Math.min(1, c / 10);
  }
  function myReasons(a, kwr, heatN, fresh) {
    var rs = [];
    if (kwr && kwr.hits.length) rs.push("命中关键词：" + kwr.hits.slice(0, 2).join("/"));
    if (heatN > 0) rs.push("同主题收藏 " + heatN + " 篇");
    if (fresh >= 0.8) rs.push("近期热点");
    return rs;
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
        '<p class="view-sub">今日榜关注时效；我的相关榜融合关键词/偏好/收藏热度。探索率=防信息茧房：给非关键词内容留的比例。</p></div>' +
        '<div class="head-actions"><label class="muted">探索率</label><select id="exRate">' +
        [[0, "0%"], [0.05, "5%"], [0.1, "10%"], [0.2, "20%"], [0.3, "30%"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (Math.abs((s.exploreRate || 0.1) - o[0]) < 1e-9 ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select></div></div>" +
        '<div class="filters">' +
        '<button class="btn sm ' + (state.tab === "today" ? "primary" : "") + '" data-tab="today">今日榜</button>' +
        '<button class="btn sm ' + (state.tab === "mine" ? "primary" : "") + '" data-tab="mine">我的相关榜</button>' +
        '<button class="btn sm ' + (state.tab === "test" ? "primary" : "") + '" data-tab="test">回测与抽查</button>' +
        "</div><div id=\"rkBody\">" + bodyHtml(all) + "</div>";

      var ex = el.querySelector("#exRate");
      if (ex) ex.addEventListener("change", function () {
        s.exploreRate = parseFloat(ex.value) || 0.1;
        Store.saveSettings();
        App.refresh();
      });
      bind(el, all);

      function bodyHtml(all) {
        if (state.tab === "today") return todayHtml(all);
        if (state.tab === "mine") return mineHtml(all);
        return testHtml();
      }
      function todayHtml(all) {
        var cands = all.filter(function (a) { return ageDays(a) <= 14; });
        if (!cands.length) return emptyNote("近 14 天暂无文章，请先拉取镜像。");
        cands.sort(function (a, b) { return ageDays(a) - ageDays(b); });
        return listWrap(cands.slice(0, 20), function (a, i) {
          return itemHtml(a, i + 1, ageDays(a) <= 3 ? ["近期热点"] : ["权威源新讯"]);
        });
      }
      function mineHtml(all) {
        var favs = all.filter(function (a) { return a.fav; });
        var favSets = favs.map(toks);
        var cands = all.filter(function (a) { return ageDays(a) <= 60; });
        if (!cands.length) return emptyNote("60 天内暂无文章。");
        var kws = H.splitKeywords(Store.settings.interestKeywords || "");
        var scored = cands.map(function (a) {
          var kwr = kws.length ? H.kwScore(kws, a) : null;
          var rel = kwr ? kwr.score / 20 : 0;
          var fr = freshScore(a);
          var hn = favs.length ? Math.round(heatFav(a, favSets) * 10) : 0;
          var heat01 = Math.min(1, hn / 10);
          var src = 0.6 + 0.4 * (fr >= 0.8 ? 1 : 0);
          var score = 0.40 * rel + 0.25 * fr + 0.15 * heat01 + 0.20 * src;
          return { a: a, s: score, kwr: kwr, hn: hn, fr: fr };
        });
        scored.sort(function (x, y) { return y.s - x.s; });
        var top = scored.slice(0, 20);
        var exRate = Store.settings.exploreRate || 0.1;
        var nTake = Math.round(20 * exRate);
        var shown = top.slice(0, 20 - nTake);
        if (nTake > 0) {
          var pool = scored.slice(20 - nTake).filter(function (x) { return shown.indexOf(x) < 0; });
          var step = Math.max(1, Math.floor(pool.length / nTake));
          for (var i = 0; i < nTake && i * step < pool.length; i++) shown.push(pool[i * step]);
        }
        return listWrap(shown, function (x, i) {
          return itemHtml(x.a, i + 1, myReasons(x.a, x.kwr, x.hn, x.fr));
        }, favs.length ? "" : '<div class="note">还没有收藏，相关榜将偏向关键词；收藏后效果更好。</div>');
      }
      function testHtml() {
        return '<div class="card"><h3>离线回测</h3>' +
          '<p class="muted">把您收藏过的文章当作标准答案：隐藏收藏记录→用“我的相关榜”规则给全库打分→统计收藏文章进入前 20% 的比例。越高说明规则越懂您；零模型成本。</p>' +
          '<div class="art-actions"><button class="btn primary" id="rkBacktest">运行回测</button></div><div id="rkBtRes" class="muted" style="margin-top:8px"></div></div>' +
          '<div class="card"><h3>人工抽查</h3>' +
          '<p class="muted">每周抽查两个榜单前 10 条：在榜单项上点「值得 / 不该上」即可记录。</p>' +
          '<div id="rkJudge" class="muted"></div></div>';
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
            var jg = e.target.closest("[data-jg]");
            if (jg) {
              Store.getArticle(jg.dataset.url).then(function (a) {
                Store.logPreference(jg.dataset.jg === "pos" ? "jdg+" : "jdg-", a.url, a.titleZh || a.title);
                App.toast("已记录抽查意见", "ok");
              });
            }
            var bt = e.target.closest("#rkBacktest");
            if (bt) runBacktest(root);
          });
        }
        var jd = root.querySelector("#rkJudge");
        if (jd) {
          var p = Store.loadPrefs();
          var pos = 0, neg = 0;
          (p.events || []).forEach(function (e) {
            if (e.k === "jdg+") pos++;
            if (e.k === "jdg-") neg++;
          });
          jd.innerHTML = "已抽查：值得 " + pos + " 次 · 不该上 " + neg + " 次（仅本机）。";
        }
        var btEl = root.querySelector("#rkBacktest");
        if (btEl) {
          // 为容器内按钮兜底：id 点击已在容器委托处理
        }
      }
      function runBacktest(root) {
        var box = root.querySelector("#rkBtRes");
        var all2 = [];
        Store.getAllArticles().then(function (allA) {
          all2 = allA.filter(function (a) { return Store.channelOn(a.channel); });
          var favs = all2.filter(function (a) { return a.fav; });
          if (favs.length < 3) { box.innerHTML = "收藏不足 3 篇（当前 " + favs.length + "），回测需至少 3 篇收藏才有意义。"; return; }
          var cands = all2.filter(function (a) { return ageDays(a) <= 60; });
          var kws = H.splitKeywords(Store.settings.interestKeywords || "");
          var favUrl = {}; favs.forEach(function (a) { favUrl[a.url] = 1; });
          var scored = cands.map(function (a) {
            var kwr = kws.length ? H.kwScore(kws, a) : null;
            var rel = kwr ? kwr.score / 20 : 0;
            var fr = freshScore(a);
            var src = 0.6 + 0.4 * (fr >= 0.8 ? 1 : 0);
            return { a: a, s: 0.40 * rel + 0.25 * fr + 0.35 * src };
          }).sort(function (x, y) { return y.s - x.s; });
          var nTop = Math.max(1, Math.ceil(scored.length * 0.2));
          var hit = 0;
          scored.slice(0, nTop).forEach(function (x) { if (favUrl[x.a.url]) hit++; });
          var pct = Math.round(hit / favs.length * 100);
          box.innerHTML = '<div class="' + (pct >= 40 ? "ok-line" : "note") + '">收藏 ' + favs.length + " 篇中，有 <b>" + hit +
            "</b> 篇进入排序前 20%（命中率 <b>" + pct + "%</b>，样本池 " + scored.length + " 篇）。" +
            (pct >= 40 ? "规则与你的口味较一致。" : "规则偏了：建议调整关键词或等待更多收藏后再回测。") + "</div>";
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.rankings = M;
})();
