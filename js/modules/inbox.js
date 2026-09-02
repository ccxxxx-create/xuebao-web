/* modules/inbox.js —— 收件箱（本机通知中心）：更新公告 / 简报 / 系统消息 */
(function () {
  "use strict";
  var KIND = { update: "更新公告", brief: "周末简报", system: "系统消息" };

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
              return '<div class="art' + (x.read ? "" : ' style="border-left:3px solid #2f7fd1"') + '">' +
                '<div class="art-head"><div style="flex:1;min-width:0">' +
                '<div class="art-title" data-id="' + H.esc(x.id) + '" style="font-weight:600">' +
                (x.read ? "" : '<span class="badge state-error">新</span> ') +
                H.esc(KIND[x.kind] || x.kind) + " · " + H.esc(x.title) + "</div>" +
                '<div class="art-meta"><span>' + H.fmtDateTime(new Date(x.at)) + "</span></div>" +
                "</div></div>" +
                '<p class="muted" style="white-space:pre-wrap;word-break:break-word;margin:6px 0 0">' + H.esc(x.body || "") + "</p>" +
                "</div>";
            }).join("")
          : '<div class="empty"><b>收件箱是空的</b>以后的新版本公告、周末简报等会出现在这里。</div>');
      bind(el);
      function bind(root) {
        if (!root.__ib) {
          root.__ib = true;
          root.addEventListener("click", function (e) {
            var t = e.target.closest(".art-title[data-id]");
            if (t) {
              var id = t.dataset.id;
              var item = Store.loadInbox().filter(function (x) { return x.id === id; })[0];
              if (item && !item.read) {
                Store.inboxMarkRead(id);
                App.refreshMail();
              }
              if (item) {
                App.openModal(
                  '<div class="modal-head"><h3>' + H.esc(KIND[item.kind] || item.kind) + "</h3><button class=\"btn sm\" data-close>×</button></div>" +
                  '<div class="modal-body"><p class="muted">' + H.esc(item.title) + " · " + H.fmtDateTime(new Date(item.at)) + "</p>" +
                  '<div class="prose" style="max-height:60vh;white-space:pre-wrap;word-break:break-word">' + H.esc(item.body || "") + "</div></div>"
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
