/* modules/sources.js —— 信源与镜像状态 */
(function () {
  "use strict";
  var CH = [
    { id: "defensenews", name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", note: "feed 含全文；试点" },
    { id: "airandspaceforces", name: "Air & Space Forces", url: "https://www.airandspaceforces.com/feed/", note: "feed 含全文；试点" },
    { id: "govuk_mod", name: "英国国防部（gov.uk）", url: "https://www.gov.uk/government/organisations/ministry-of-defence.atom", note: "摘要型，镜像抓正文页" },
    { id: "afresearchlab", name: "美国空军研究实验室 AFRL", url: "https://afresearchlab.com/feed/", note: "feed 含全文；更新较慢" },
    { id: "westpoint", name: "美国西点军校", url: "https://www.westpoint.edu/rss.xml", note: "云端（GitHub 机房）被该校 403 拦截，界面如实标注" },
    { id: "rand", name: "美国兰德公司 RAND", url: "https://www.rand.org/pubs/new.xml 等 4 feed", note: "报告落地页正文" },
    { id: "us_dod", name: "美国国防部 defense.gov", url: "https://www.defense.gov（官方 ArticleCS 系统）", note: "官方每日新闻，摘要型，镜像抓正文页" },
    { id: "us_marines", name: "美国海军陆战队 marines.mil", url: "https://www.marines.mil（官方 ArticleCS 系统）", note: "陆战队官方新闻/发布" },
    { id: "us_airforce", name: "美国空军 af.mil", url: "https://www.af.mil（官方 ArticleCS 系统）", note: "空军官方新闻/发布" }
  ];

  var M = {
    key: "sources",
    label: "信源",
    async render(el) {
      var s = Store.settings;
      var meta = s.lastMirrorMeta || {};
      var repo = (s.mirrorRepo || "").trim();
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">信源与镜像</h1>' +
        '<p class="view-sub">9 个官方直连源由 GitHub Actions 每天 09:00 自动抓取成镜像 JSON，本页展示最近一次镜像结果；西点军校在云端机房受限（见备注）</p></div>' +
        '<div class="head-actions"><button class="btn primary" id="sPull">' + (MIRROR.isBusy() ? "更新中…" : "立即拉取镜像") + "</button></div></div>" +

        '<div class="card"><h3>镜像仓库</h3>' +
        '<div class="muted">仓库：' + H.esc(repo || "未配置") + (s.lastMirrorUpdatedAt ? " · 镜像数据时间 " + H.fmtDateTime(s.lastMirrorUpdatedAt) : "") + "</div>" +
        '<div class="art-actions" style="margin-top:8px">' +
        '<a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + H.esc(repo) + '">GitHub 仓库</a>' +
        '<a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + H.esc(repo) + '/actions">定时任务（Actions）</a>' +
        "</div></div>" +

        '<div class="card"><h3>各源最近镜像状态</h3>' +
        '<div class="tbl-wrap"><table class="data"><thead><tr><th>信源</th><th>级别</th><th>Feed / 方式</th><th>状态</th><th>本次条数</th><th>错误</th></tr></thead><tbody>' +
        CH.map(function (c) {
          var m = meta[c.id];
          var st = m ? (m.status === "ok" ? '<span class="badge state-ok">正常</span>' : '<span class="badge state-error">异常</span>') : '<span class="badge ghost">尚未运行</span>';
          return "<tr><td><b>" + H.esc(c.name) + "</b><div class='muted'>" + c.note + "</div></td>" +
            '<td><span class="badge A">A</span></td>' +
            '<td class="mono" style="max-width:280px">' + H.esc(c.url) + "</td>" +
            "<td>" + st + "</td><td>" + (m && m.count != null ? m.count : "—") + "</td>" +
            "<td class='muted' style='max-width:220px'>" + (m && m.error ? H.esc(m.error) : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="muted">说明：网页（浏览器）无法直接跨域读取这些官网 RSS，因此采集放在 GitHub Actions 定时任务里完成，与您个人工作台 arXiv 镜像同模式。每源每轮 ≤20 条、间隔 ≥2s，遵循 robots 许可的低频礼貌策略。含全文内容仅供个人阅读归档。</p>' +
        "</div>";

      var b = el.querySelector("#sPull");
      if (b) b.addEventListener("click", function () { App.pullNow({ silent: false }); });
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.sources = M;
})();
