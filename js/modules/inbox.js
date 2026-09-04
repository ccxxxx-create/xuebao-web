/* modules/inbox.js —— 收件箱（本机通知中心）：更新公告 / 简报 / 系统消息 */
(function () {
  "use strict";
  var KIND = { update: "更新公告", brief: "周末简报", system: "系统消息" };

  /* 正文渲染：以 “◇https://…” 开头的行渲染成“打开这篇原文”链接；
     列表预览(full=false)时正文最多 4 行 + 截断提示，链接行仅在展开(modal)时显示 */
  function makeBody(body, full) {
    var lines = String(body || "").split("\n");
    var out = [];
    if (!full) {
      // 列表预览：首个“打开原文”按钮置顶（始终可见可点），其后最多 3 行正文
      var firstLink = null;
      for (var i = 0; i < lines.length; i++) {
        var lm = /^◇\s*(https?:\/\/\S+)/.exec(String(lines[i]).trim());
        if (lm) { firstLink = lm[1]; break; }
      }
      if (firstLink) out.push('<a class="art-open" data-art-url="' + H.esc(firstLink) + '">打开这篇原文 ↗</a>');
      var shown = 0;
      for (i = 0; i < lines.length; i++) {
        if (/^◇/.test(String(lines[i]).trim())) continue;
        if (shown >= 3) { out.push("……（完整内容请点上方标题查看）"); break; }
        out.push(H.esc(lines[i]));
        if (String(lines[i]).trim()) shown++;
      }
      if (!out.length) out.push(H.esc(body || ""));
      return out.join("\n");
    }
    // 详情展开：全部行保留，◇ 行渲染成可点击按钮
    for (i = 0; i < lines.length; i++) {
      var m = /^◇\s*(https?:\/\/\S+)/.exec(String(lines[i]).trim());
      if (m) { out.push('<a class="art-open" data-art-url="' + H.esc(m[1]) + '">打开这篇原文 ↗</a>'); continue; }
      out.push(H.esc(lines[i]));
    }
    return out.join("\n");
  }

  var M = {
    key: "inbox",
    label: "收件箱",
    async render(el) {
      var items = Store.loadInbox();
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">收件箱</h1>' +
        '<p class="view-sub">更新公告、周末简报与系统消息都会投递到这里（仅存本机）。</p></div>' +
        '<div class="head-actions"><button class="btn sm" id="ibCheck">检查更新</button>' +
        '<button class="btn sm" id="ibReadAll">全部已读</button>' +
        '<button class="btn sm danger" id="ibClear">清空</button></div></div>' +
        (items.length
          ? items.map(function (x) {
              return '<div class="art inbox-card' + (x.read ? "" : " unread") + '" data-id="' + H.esc(x.id) + '" title="点击查看详情">' +
                '<div class="art-head"><div style="flex:1;min-width:0">' +
                '<div class="art-title" style="font-weight:600">' +
                (x.read ? "" : '<span class="badge accent">新</span> ') +
                H.esc(KIND[x.kind] || x.kind) + " · " + H.esc(x.title) + "</div>" +
                '<div class="art-meta"><span>' + H.fmtDateTime(new Date(x.at)) + "</span></div>" +
                "</div></div>" +
                '<div class="inbox-body">' + makeBody(x.body || "", false) + "</div>" +
                "</div>";
            }).join("")
          : '<div class="empty"><b>收件箱是空的</b>以后的新版本公告、周末简报等会出现在这里。</div>');
      bind(el);
      function bind(root) {
        if (!root.__ib) {
          root.__ib = true;
          root.addEventListener("click", function (e) {
            // 任何与本卡片相关的交互（点原文链接 / 点卡片看详情）都视为“阅读过”，自动标记已读
            var card = e.target.closest(".inbox-card");
            if (card) {
              var id = card.dataset.id;
              var item = Store.loadInbox().filter(function (x) { return x.id === id; })[0];
              if (item && !item.read) {
                Store.inboxMarkRead(id);
                App.refreshMail();
              }
            }
            var op = e.target.closest("[data-art-url]");
            if (op && op.dataset.artUrl) {
              if (window.UI && UI.openArticle) { UI.openArticle(op.dataset.artUrl, "inbox"); return; }
              window.open(op.dataset.artUrl, "_blank", "noopener");
              return;
            }
            // 点击整张卡片（含标题与预览正文）都能展开详情
            if (card) {
              if (item) {
                App.openModal(
                  '<div class="modal-head"><h3>' + H.esc(KIND[item.kind] || item.kind) + "</h3><button class=\"btn sm\" data-close>×</button></div>" +
                  '<div class="modal-body"><p class="muted">' + H.esc(item.title) + " · " + H.fmtDateTime(new Date(item.at)) + "</p>" +
                  '<div class="prose" style="max-height:60vh;white-space:pre-wrap;word-break:break-word">' + makeBody(item.body || "", true) + "</div></div>"
                );
              }
              return;
            }
            var btn = e.target.closest("[id]");
            if (!btn) return;
            if (btn.id === "ibCheck") {
              App.toast("正在检查更新…");
              App.checkUpdate(true);
            } else if (btn.id === "ibReadAll") {
              Store.inboxMarkAllRead();
              App.refreshMail();
              App.refresh();
            } else if (btn.id === "ibClear") {
              App.confirm("清空收件箱全部消息？（不可恢复）").then(function (ok) {
                if (ok) { Store.inboxClear(); App.refreshMail(); App.refresh(); }
              });
            }
          });
        }
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.inbox = M;
})();
