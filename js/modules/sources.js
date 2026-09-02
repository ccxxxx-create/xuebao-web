/* modules/sources.js —— 信源与镜像：状态展示 + 本设备级启停开关 */
(function () {
  "use strict";
  var CH = [
    { id: "defensenews", name: "Defense News", note: "feed 含全文；试点" },
    { id: "airandspaceforces", name: "Air & Space Forces", note: "feed 含全文；试点" },
    { id: "govuk_mod", name: "英国国防部（gov.uk）", note: "摘要型，镜像抓正文页" },
    { id: "afresearchlab", name: "美国空军研究实验室 AFRL", note: "feed 含全文；更新较慢" },
    { id: "westpoint", name: "美国西点军校", note: "云端机房被 403（本机网络正常），处理见受阻源方案" },
    { id: "rand", name: "美国兰德公司 RAND", note: "报告落地页正文" },
    { id: "us_dod", name: "美国国防部 defense.gov", note: "官方每日新闻，DVIDS 兜底" },
    { id: "us_marines", name: "美国海军陆战队 marines.mil", note: "官方 + DVIDS 陆战队兜底" },
    { id: "us_airforce", name: "美国空军 af.mil", note: "官方每日新闻" }
  ];

  var M = {
    key: "sources",
    label: "信源",
    async render(el) {
      var s = Store.settings;
      var meta = s.lastMirrorMeta || {};
      var repo = (s.mirrorRepo || "").trim();
      var nowH = H.fmtDateTime ? H.fmtDateTime(Date.now()) : "";
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">信源与镜像</h1>' +
        '<p class="view-sub">9 个官方直连源 · 每天 09:00 自动抓取 · 本页可对本设备启用/停用单个信源（停用后不再收录该源新内容，历史数据保留）</p></div>' +
        '<div class="head-actions"><button class="btn primary" id="sPull">' + (MIRROR.isBusy() ? "更新中…" : "立即拉取镜像") + "</button></div></div>" +

        '<div class="card"><h3>镜像概览</h3>' +
        '<p class="muted">上次拉取：' + (s.lastPullAt ? H.fmtDateTime(s.lastPullAt) + "（" + H.ago(s.lastPullAt) + "）" : "从未") +
        " · 镜像数据时间：" + (s.lastMirrorUpdatedAt ? H.fmtDateTime(s.lastMirrorUpdatedAt) : "—") + "</p>" +
        '<div class="art-actions">' +
        '<a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + H.esc(repo) + '">GitHub 仓库（只读展示）</a>' +
        '<a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + H.esc(repo) + '/actions">定时任务 Actions</a>' +
        "</div>" +
        '<p class="muted" style="margin-top:6px">仓库与任务由部署方统一维护，页面不提供修改，避免误改损坏。</p></div>' +

        '<div class="card"><h3>各源状态（云端抓取结果 + 本设备开关）</h3>' +
        '<div class="tbl-wrap"><table class="data"><thead><tr><th>信源</th><th>云端状态</th><th>云端条数</th><th>本设备</th><th>备注</th></tr></thead><tbody>' +
        CH.map(function (c) {
          var m = meta[c.id];
          var st = m ? (m.status === "ok" ? '<span class="badge state-ok">正常</span>' : '<span class="badge state-error">异常</span>') : '<span class="badge ghost">尚无记录</span>';
          var on = Store.channelOn(c.id);
          return "<tr><td><b>" + H.esc(c.name) + "</b></td>" +
            "<td>" + st + "</td><td>" + (m && m.count != null ? m.count : "—") + "</td>" +
            "<td>" + (on ? '<span class="badge state-ok">收录中</span>' : '<span class="badge ghost">已停用</span>') +
            ' <button class="btn sm" data-ch="' + c.id + '">' + (on ? "停用" : "启用") + "</button></td>" +
            "<td class='muted' style='max-width:260px'>" + H.esc(c.note) + (m && m.error ? " · " + H.esc(m.error) : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<p class="muted">说明：停用仅作用于<b>本设备</b>（不再入库该源新条目），不改变云端公共镜像，也不删除已收录历史。</p>' +
        "</div>";

      var b = el.querySelector("#sPull");
      if (b) b.addEventListener("click", function () { App.pullNow({ silent: false }); });
      if (!el.__src) {
        el.__src = true;
        el.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-ch]");
          if (!btn) return;
          var id = btn.dataset.ch;
          var on = !Store.channelOn(id);
          Store.setChannelOn(id, on);
          App.toast(on ? "已启用该信源（下次拉取恢复收录）" : "已停用该信源（历史数据保留，不再收录）", "ok");
          App.refresh();
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.sources = M;
})();
