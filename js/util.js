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
    }
  };
  window.H = H;
})();
