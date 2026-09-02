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

  /* 排序：相关分(兴趣关键词)权重最高，其次收藏/出刊/选中，最后本周内新鲜度 */
  function rank(list, kws) {
    var mon = mondayOf(new Date()).getTime();
    var span = 7 * 86400000;
    return list.map(function (a) {
      var rel = H.kwScore(kws, a);
      var fresh = Math.min(1, Math.max(0, (Date.now() - Math.max(atMs(a), mon)) / span));
      var score = (rel.score || 0) * 2
        + (a.fav ? 10 : 0) + (a.journalMade ? 6 : 0) + (a.selected ? 5 : 0)
        + fresh * 4;
      return { a: a, rel: rel, score: score };
    }).sort(function (x, y) { return y.score - x.score; });
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

    /* 核心：拉取本周入库 → 排序精选 → 拼纯文本 → 投递收件箱 */
    make: function () {
      var mon = mondayOf(new Date());
      var today = new Date();
      var kws = H.splitKeywords(Store.settings.interestKeywords);
      return Store.getAllArticles().then(function (arts) {
        var week = collect(arts, mon);
        if (!week.length) {
          return { made: false, reason: "本周（" + mmdd(mon) + " 起）还没有入库文章，先点「立即更新资料」拉取一次吧" };
        }
        var top = rank(week, kws);
        var show = top.slice(0, MAX);
        var lines = [];
        lines.push("英语情报 · 周末简报（覆盖本周 " + mmdd(mon) + " ～ " + mmdd(today) + "）");
        lines.push("本周入库 " + week.length + " 篇，按「兴趣相关 + 收藏 + 新鲜度」精选 " + show.length + " 条\n");
        show.forEach(function (it, i) {
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
          lines.push("◇" + a.url);
          lines.push("");
        });
        lines.push("—— 英语情报自动投递。点上方「打开这篇原文」可进阅读页；设置-行为默认值可关闭本简报。");
        Store.inboxAdd("brief", mmdd(mon) + "～" + mmdd(today), lines.join("\n").replace(/\n{3,}/g, "\n\n"));
        return { made: true, n: show.length };
      });
    }
  };

  window.BRIEF = BRIEF;
})();
