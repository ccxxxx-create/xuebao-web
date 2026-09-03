/* util.js —— H 工具集 */
(function () {
  "use strict";
  var H = {
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    dateStr: function (d) {
      d = d || new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },
    ymd: function (d) {
      d = d || new Date();
      return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    },
    nowIso: function () { return new Date().toISOString(); },
    fmtDateCN: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return (d.getMonth() + 1) + "月" + d.getDate() + "日";
    },
    fmtDay: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },
    fmtDateTime: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return H.fmtDay(iso) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    },
    ago: function (ts) {
      if (!ts) return "—";
      var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
      if (s < 60) return "刚刚";
      if (s < 3600) return Math.floor(s / 60) + " 分钟前";
      if (s < 86400) return Math.floor(s / 3600) + " 小时前";
      return Math.floor(s / 86400) + " 天前";
    },
    sizeFmt: function (b) {
      if (b == null) return "—";
      if (b < 1024) return b + " B";
      if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
      if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
      return (b / 1073741824).toFixed(2) + " GB";
    },
    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    debounce: function (fn, ms) {
      var t = null;
      return function () {
        var a = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, a); }, ms || 300);
      };
    },
    download: function (name, blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
    },
    safeFile: function (s) {
      return String(s || "").replace(/[\\/:*?"<>|\r\n\t]+/g, "_").slice(0, 60);
    },
    parseISO: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toISOString();
    },
    /* 兴趣关键词：中英文逗号/顿号/分号/空格/换行分隔，去重 */
    splitKeywords: function (str) {
      var seen = {}, out = [];
      String(str || "").split(/[\s,，、;；\n]+/).forEach(function (k) {
        k = (k || "").trim().toLowerCase();
        if (k.length >= 1 && !seen[k]) { seen[k] = 1; out.push(k); }
      });
      return out;
    },
    /* 模糊相关度：任一关键词在 标题/摘要/正文（中英文）出现即计分（取字段最高权重），返回 {score, hits} */
    kwScore: function (kws, art) {
      if (!kws || !kws.length || !art) return { score: 0, hits: [] };
      var fields = [
        { t: art.titleZh || "", w: 6 },
        { t: art.title || "", w: 4 },
        { t: art.summaryZh || "", w: 5 },
        { t: art.summary || "", w: 3 },
        { t: art.zhFull || "", w: 2 },
        { t: art.body || "", w: 1 }
      ];
      var score = 0, hits = [];
      kws.forEach(function (kw) {
        var best = 0;
        fields.forEach(function (f) {
          if (f.t && f.t.toLowerCase().indexOf(kw) >= 0 && f.w > best) best = f.w;
        });
        if (best > 0) { score += best; hits.push(kw); }
      });
      return { score: Math.min(20, score), hits: hits };
    },
    kwBadge: function (r) {
      if (!r || !r.score) return "";
      var cls = r.score >= 10 ? "state-error" : r.score >= 4 ? "" : "ghost";
      return '<span class="badge ' + cls + '" style="background:#fdeee0;color:#b06a1b">相关 ' + r.score + "</span>";
    },

    /* —— 价值排序（榜单 / 周末简报 / 离线回测共用）—— */
    ageDays: function (a) {
      var t = new Date(a.pubDate || a.fetchedAt || 0).getTime();
      return t ? Math.max(0, (Date.now() - t) / 864e5) : 999;
    },
    /* 权重归一：settings.rankWeights 为百分整数 {rel,fresh,source,heat}，返回总和=1 的小数 */
    normW: function (w) {
      var o = { rel: 40, fresh: 25, source: 20, heat: 15 };
      if (w) {
        ["rel", "fresh", "source", "heat"].forEach(function (k) {
          var v = parseInt(w[k], 10);
          if (!isNaN(v) && v >= 0) o[k] = v;
        });
      }
      var sum = o.rel + o.fresh + o.source + o.heat;
      if (sum <= 0) { o = { rel: 40, fresh: 25, source: 20, heat: 15 }; sum = 100; }
      ["rel", "fresh", "source", "heat"].forEach(function (k) { o[k] = o[k] / sum; });
      return o;
    },
    /* 四维原始分（0..1）。ctx: {kws, favHit(同主题收藏篇数), self:{fav,journal,selected}} */
    rankParts: function (a, ctx) {
      ctx = ctx || {};
      var kws = ctx.kws || [];
      var rel = 0, hits = [];
      if (kws.length) { var kwr = H.kwScore(kws, a); rel = Math.min(1, (kwr.score || 0) / 20); hits = kwr.hits || []; }
      var age = H.ageDays(a);
      var fresh = age >= 60 ? 0 : Math.max(0, 1 - age / 60);
      var src = 0.6 + 0.4 * (age <= 7 ? 1 : 0);
      var heat = Math.min(1, (parseInt(ctx.favHit, 10) || 0) / 6);
      var sf = ctx.self || {};
      if (sf.fav) heat = Math.min(1, heat + 0.3);
      if (sf.journal) heat = Math.min(1, heat + 0.2);
      if (sf.selected) heat = Math.min(1, heat + 0.15);
      return { rel: rel, fresh: fresh, src: src, heat: heat, hits: hits, age: age };
    },
    /* 加权总分 0..100（兴趣相关 / 新鲜度 / 来源权威 / 热度） */
    rankScore: function (a, ctx) {
      var p = H.rankParts(a, ctx);
      var w = H.normW(Store.settings.rankWeights);
      return {
        score: (w.rel * p.rel + w.fresh * p.fresh + w.source * p.src + w.heat * p.heat) * 100,
        parts: p, w: w
      };
    },
    /* 离线回测：把收藏当标准答案，按当前权重给 60 天内文章打分，
       统计收藏进入前 20% 的比例。返回 {ok, text, html}（纯本地，零模型成本） */
    backtestResult: function () {
      var w = H.normW(Store.settings.rankWeights);
      var pctW = function (k) { return Math.round(w[k] * 100); };
      var head = "权重：兴趣" + pctW("rel") + "·新鲜" + pctW("fresh") + "·来源" + pctW("source") + "·热度" + pctW("heat");
      return Store.getAllArticles().then(function (allA) {
        var all = allA.filter(function (a) { return Store.channelOn(a.channel); });
        var favs = all.filter(function (a) { return a.fav; });
        if (favs.length < 3) {
          return { ok: false, text: "离线回测：收藏不足 3 篇（当前 " + favs.length + "），暂无可参考的标准答案。", html: "" };
        }
        var cands = all.filter(function (a) { return H.ageDays(a) <= 60; });
        var kws = H.splitKeywords(Store.settings.interestKeywords || "");
        var favUrl = {};
        favs.forEach(function (f) { favUrl[f.url] = 1; });
        var scored = cands.map(function (a) {
          // 回测考察「兴趣/新鲜/来源」配比是否把收藏顶上来；收藏文章自带热度信号
          var s = H.rankScore(a, { kws: kws, favHit: 0, self: { fav: !!favUrl[a.url] } });
          return { a: a, s: s };
        }).sort(function (x, y) { return y.s.score - x.s.score; });
        var nTop = Math.max(1, Math.ceil(scored.length * 0.2));
        var hit = 0;
        scored.slice(0, nTop).forEach(function (x) { if (favUrl[x.a.url]) hit++; });
        var pct = Math.round(hit / favs.length * 100);
        var verdict = pct >= 40 ? "配比与您的口味较一致。" : "配比有些偏：可调高“兴趣相关/热度”或等收藏更多后再看。";
        var text = "离线回测：" + head + "。" + favs.length + " 篇收藏中 " + hit + " 篇进入前 20%（命中率 " + pct + "%，样本池 " + scored.length + " 篇）。" + verdict;
        var html = '<div class="' + (pct >= 40 ? "ok-line" : "note") + '">收藏 ' + favs.length + " 篇中，有 <b>" + hit +
          "</b> 篇进入排序前 20%（命中率 <b>" + pct + "%</b>，样本池 " + scored.length + " 篇）<br>（" + head + "）<br>" +
          (pct >= 40 ? "配比与您的口味较一致。" : "配比有些偏：可调高“兴趣相关/热度”或等收藏更多后再看。") + "</div>";
        return { ok: true, text: text, html: html };
      });
    }
  };
  window.H = H;
})();
