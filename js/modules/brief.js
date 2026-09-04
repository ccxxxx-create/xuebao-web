/* modules/brief.js —— 周末简报：周六/周日首次打开页面时，把“本周一至今”入库文章按
   「兴趣相关 + 收藏 + 新鲜度」汇总成一期，投递到收件箱（纯本地拼装，不消耗模型额度）。
   侧栏可点“立即生成”任意天手动生成当期快照（手动不占用每周自动名额）。 */
(function () {
  "use strict";

  var MAX = 12;               // 每期最多精选条数

  /* 本周一 00:00（本地时区） */
  function mondayOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function mmdd(d) {
    return (d.getMonth() + 1) + "/" + d.getDate();
  }
  function atMs(a) {
    return new Date(a.pubDate || a.fetchedAt || 0).getTime();
  }
  function dayCn(a) {
    var d = new Date(a.pubDate || a.fetchedAt || 0);
    if (isNaN(d.getTime())) return "";
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function shortSum(a) {
    var s = String(a.summaryZh || a.summary || "").replace(/\s+/g, " ").trim();
    return s.length > 130 ? s.slice(0, 127) + "…" : s;
  }
  /* 收件箱里的“摘要/概述”：只给一段小结，长文放进独立「周末简报」阅读页，避免弹窗塞不下 */
  function briefSummary(overview, items, weekN) {
    var lines = [];
    if (overview) {
      lines.push(overview.length > 92 ? overview.slice(0, 89) + "…" : overview);
    }
    lines.push("本期精选 " + items.length + " 条（本周入库 " + weekN + " 篇）。");
    items.slice(0, 4).forEach(function (it) {
      var t = it.zh || it.en || "";
      if (t) lines.push("· " + (t.length > 44 ? t.slice(0, 41) + "…" : t));
    });
    if (items.length > 4) lines.push("· 等共 " + items.length + " 条，点下方「阅读完整简报」查看全文。");
    return lines.join("\n");
  }
  /* 独立「周末简报」页：单条小文章块（序号 + 标题 + 标签 + 摘要 + 来源 + AI 点评 + 打开原文） */
  function briefItemHtml(it) {
    var esc = H.esc;
    var title = it.zh ? (it.zh + (it.en && it.en !== it.zh ? " ｜ " + it.en : "")) : (it.en || "");
    var h = ['<div class="brief-item">'];
    h.push('<div class="brief-item-head"><span class="brief-no">' + (it.no || "") + "</span>");
    h.push('<span class="brief-title">' + esc(title) + "</span>");
    (it.tags || []).forEach(function (t) { h.push('<span class="badge">' + esc(t) + "</span>"); });
    h.push("</div>");
    if (it.sum) h.push('<div class="brief-item-sum">' + esc(it.sum) + "</div>");
    h.push('<div class="brief-item-meta">' + esc(it.src) + (it.day ? " · " + esc(it.day) : "") + "</div>");
    if (it.comment) h.push('<div class="brief-item-cm">✔ ' + esc(it.comment) + "</div>");
    h.push('<div class="brief-item-open"><a class="art-open" href="' + esc(it.url) + '" target="_blank" rel="noopener">打开这篇原文 ↗</a></div>');
    h.push("</div>");
    return h.join("");
  }

  function collect(arts, mon) {
    var start = mon.getTime();
    var end = start + 7 * 86400000;
    return arts.filter(function (a) {
      var t = atMs(a);
      return t >= start && t < end;
    });
  }

  /* 排序：与「兴趣榜」同一套可调权重（兴趣相关/新鲜度/来源权威/热度，设置→排序与喜好学习），
     出刊/选文作为强信号额外加成（不消耗模型额度） */
  function rank(list, kws) {
    return list.map(function (a) {
      var r = H.rankScore(a, { kws: kws, favHit: 0, self: { fav: !!a.fav, journal: !!a.journalMade, selected: !!a.selected } });
      var extra = (a.journalMade ? 8 : 0) + (a.selected ? 6 : 0);
      return { a: a, rel: { hits: r.parts.hits }, score: r.score + extra };
    }).sort(function (x, y) { return y.score - x.score; });
  }

  /* 解析 AI 结果：首段为综述，【N】开头为逐条点评 */
  function parseCommentary(raw) {
    var overview = [];
    var comments = {};
    var inComments = false;
    String(raw || "").split(/\r?\n/).forEach(function (ln) {
      var m = /^【\s*(\d+)\s*】\s*(.+)/.exec((ln || "").trim());
      if (m) {
        inComments = true;
        comments[parseInt(m[1], 10)] = m[2].trim();
        return;
      }
      if (inComments) return;              // 点评段后的非编号行忽略
      var t = (ln || "").trim();
      if (t) overview.push(t);
    });
    return { overview: overview.join("\n"), comments: comments };
  }

  var BRIEF = {
    /* 自动投递：周六/周日首次打开时调用（幂等，同一周只投一期；数据不足则静默跳过，下周六再试） */
    tryAuto: function () {
      var s = Store.settings;
      if (!s.weeklyBrief) return Promise.resolve(false);
      var d = new Date(), day = d.getDay();          // 0=周日 6=周六
      if (day !== 6 && day !== 0) return Promise.resolve(false);
      var wk = H.ymd(mondayOf(d));
      if (s.lastBriefWeek === wk) return Promise.resolve(false);
      return this.make().then(function (r) {
        if (!r.made) return false;                    // 本周暂无文章：不记周标，下周末再试
        s.lastBriefWeek = wk;
        Store.saveSettings();
        App.refreshMail();
        App.toast("本周简报已投递到收件箱 ✉", "ok");
        return true;
      }).catch(function () { return false; });
    },

    /* 手动“立即生成”（任意日期可，不写入每周自动名额） */
    generateNow: function () {
      return this.make().then(function (r) {
        if (r.made) {
          App.refreshMail();
          App.toast("已生成周末简报并投递到收件箱 ✉", "ok");
        }
        return r;
      });
    },

    /* 独立阅读页：收件箱简报卡片点「阅读完整简报」/「打开这篇原文」跳到这里，长文在这看 */
    async render(el) {
      var b = Store.getBrief(this.curId || "");
      if (!b) {
        el.innerHTML = '<div class="empty"><b>简报不存在或已清理</b><br><a class="btn sm" href="#/inbox">返回收件箱</a></div>';
        return;
      }
      var esc = H.esc;
      var parts = ['<div class="view-head"><div><h1 class="view-title">周末简报</h1>' +
        '<p class="view-sub">' + esc(b.sub || "") + '</p></div>' +
        '<div class="head-actions"><button class="btn sm" id="brBack">← 返回收件箱</button></div></div>'];
      parts.push('<div class="card"><div class="art">');
      parts.push('<div class="art-head"><div style="flex:1;min-width:0">');
      parts.push('<div class="art-title" style="font-weight:600">' + esc(b.title || "周末简报") + '</div>');
      parts.push('<div class="art-meta"><span>生成于 ' + H.fmtDateTime(new Date(b.createdAt)) + '</span><span class="badge ghost" style="margin-left:8px">' + (b.count || 0) + " 条精选</span></div>");
      parts.push('</div></div>');
      if (b.overview) parts.push('<div class="brief-ov"><b>全期综述</b><div class="prose" style="max-height:none;margin-top:6px">' + esc(b.overview) + "</div></div>");
      parts.push('</div></div>');
      parts.push('<div class="brief-list">');
      (b.items || []).forEach(function (it) { parts.push(briefItemHtml(it)); });
      parts.push('</div>');
      if (b.foot) parts.push('<div class="note">' + esc(b.foot) + "</div>");
      el.innerHTML = parts.join("");
      var back = el.querySelector("#brBack");
      if (back) back.addEventListener("click", function () { location.hash = "#/inbox"; });
    },

    /* 核心：拉取本周入库 → 排序精选 → 可选 AI(综述+点评) → 拼纯文本 → 投递收件箱 */
  make: function () {
    var mon = mondayOf(new Date());
    var today = new Date();
    var kws = H.splitKeywords(Store.settings.interestKeywords);
    var s = Store.settings;
    var wantAi = !!(s.briefAi && window.LLM && LLM.configured());
    return Store.getAllArticles().then(function (arts) {
      var week = collect(arts, mon);
      if (!week.length) {
        return { made: false, reason: "本周（" + mmdd(mon) + " 起）还没有入库文章，先待每日定时刷新拉取一次吧" };
      }
      var top = rank(week, kws);
      var show = top.slice(0, MAX);
      if (!wantAi) return { made: true, show: show, weekN: week.length, mon: mon, today: today, ai: null };
      // AI 增强：把精选条目等信息发给模型
      var items = show.map(function (it, i) {
        var a = it.a;
        return "【" + (i + 1) + "】" + (a.titleZh || a.title) + " ｜ " + (a.title || "") +
          " ｜ " + (a.channelName || a.channel || "") + " ｜ " + dayCn(a) + " ｜ " + shortSum(a);
      });
      return Store.getAllTerms().then(function (terms) {
        return LLM.briefCommentary(items, LLM.glossaryLines(terms))
          .then(function (out) { return { made: true, show: show, weekN: week.length, mon: mon, today: today, ai: parseCommentary(out) }; })
          .catch(function () { return { made: true, show: show, weekN: week.length, mon: mon, today: today, ai: null }; });
      });
    }).then(function (r) {
      if (!r.made) return { made: false, reason: r.reason };
      var rangeTxt = mmdd(r.mon) + " ～ " + mmdd(r.today);
      var items = r.show.map(function (it, i) {
        var a = it.a;
        var tags = [];
        if (a.fav) tags.push("已收藏");
        if (a.journalMade) tags.push("已出刊");
        if (a.selected) tags.push("已选");
        if (it.rel && it.rel.hits && it.rel.hits.length) tags.push("相关：" + it.rel.hits.slice(0, 4).join("、"));
        return {
          no: i + 1,
          url: a.url,
          zh: a.titleZh || "",
          en: a.title || (a.titleZh || ""),
          tags: tags,
          src: a.channelName || a.channel || "未知来源",
          day: dayCn(a),
          sum: shortSum(a),
          comment: (r.ai && r.ai.comments && r.ai.comments[i + 1]) || ""
        };
      });
      var overview = (r.ai && r.ai.overview) || "";
      var briefId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var title = "英语情报 · 周末简报（覆盖本周 " + rangeTxt + "）";
      var sub = "覆盖本周 " + rangeTxt + " · 本周入库 " + r.weekN + " 篇，按「兴趣相关/新鲜度/来源权威/热度」精选 " + r.show.length + " 条（权重可在 设置 → 排序与喜好学习 调节）";
      var foot = "本期精选均为「本周一至今」入库文章，点各条「打开这篇原文」可在新标签打开原文网页阅读。设置 → 自动化与行为 可关闭本简报或 AI 点评。";
      // 保存结构化全文，供独立「周末简报」阅读页使用（长文不再塞进收件箱小弹窗）
      Store.addBrief({
        id: briefId, title: title, sub: sub, foot: foot,
        week: H.ymd(r.mon), createdAt: Date.now(),
        overview: overview, count: r.show.length, weekN: r.weekN,
        items: items
      });
      // 收件箱只放“摘要/概述”，长文留在独立页
      var body = briefSummary(overview, items, r.weekN);
      Store.inboxAdd("brief", mmdd(r.mon) + "～" + mmdd(r.today), body, { briefId: briefId });
      return { made: true, n: r.show.length, ai: !!r.ai, briefId: briefId };
    });
  }
  };

  window.BRIEF = BRIEF;
  /* 同时注册为可路由模块：入口 → #/brief/<id> 打开独立阅读页（不进侧栏，不占导航位） */
  BRIEF.key = "brief";
  BRIEF.label = "周末简报";
  BRIEF.curId = "";
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.brief = BRIEF;
})();
