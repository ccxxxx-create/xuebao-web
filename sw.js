/* 英语情报 · Service Worker v23 —— 导航与 update.json 均网络优先，避免更新公告被旧缓存延迟 */
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf("xuebao-shell-v") === 0 && k !== "xuebao-shell-v31"; }).map(function (k) { return caches.delete(k); })); })
  ]));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // update.json：网络优先（版本与公告必须及时送达，不能等下一次）
  if (url.pathname.endsWith("/update.json")) {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then(function (r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open("xuebao-shell-v31").then(function (c) { c.put(req, copy); });
        }
        return r;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
    );
    return;
  }
  if (req.mode === "navigate") {
    // 导航（打开页面）：网络优先，失败才用缓存 —— 保证每次都能拿到最新版
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open("xuebao-shell-v31").then(function (c) { c.put(req, copy); });
        }
        return r;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      })
    );
    return;
  }
  // 静态资源：先回缓存即时显示，同时后台拉最新并更新缓存
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open("xuebao-shell-v31").then(function (c) { c.put(req, copy); });
        }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});