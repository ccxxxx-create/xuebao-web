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
      var lines = [];
      lines.push("英语情报 · 周末简报（覆盖本周 " + mmdd(r.mon) + " ～ " + mmdd(r.today) + "）");
      lines.push("本周入库 " + r.weekN + " 篇，按「兴趣相关/新鲜度/来源权威/热度」精选 " + r.show.length + " 条（权重可在 设置 → 排序与喜好学习 调节）\n");
      if (r.ai && r.ai.overview) {
        lines.push("【全期综述】" + r.ai.overview + "\n");
      }
      r.show.forEach(function (it, i) {
        var a = it.a;
        var tags = [];
        if (a.fav) tags.push("已收藏");
        if (a.journalMade) tags.push("已出刊");
        if (a.selected) tags.push("已选");
        if (it.rel && it.rel.hits && it.rel.hits.length) tags.push("相关：" + it.rel.hits.slice(0, 4).join("、"));
        var src = a.channelName || a.channel || "未知来源";
        var dCn = dayCn(a);
        lines.push("【" + (i + 1) + "】" + (a.titleZh ? a.titleZh + " ｜ " + a.title : a.title) + (tags.length ? "（" + tags.join(" · ") + "）" : ""));
        var sum = shortSum(a);
        if (sum) lines.push("　　" + sum);
        lines.push("　　" + src + (dCn ? " · " + dCn : ""));
        if (r.ai && r.ai.comments && r.ai.comments[i + 1]) lines.push("　　✔ " + r.ai.comments[i + 1]);
        lines.push("◇" + a.url);
        lines.push("");
      });
      lines.push("—— 英语情报自动投递。点上方「打开这篇原文」可进阅读页；设置-自动化与行为可关闭本简报或 AI 点评。");
      Store.inboxAdd("brief", mmdd(r.mon) + "～" + mmdd(r.today), lines.join("\n").replace(/\n{3,}/g, "\n\n"));
      return { made: true, n: r.show.length, ai: !!r.ai };
    });
  }
  };

  window.BRIEF = BRIEF;
})();
