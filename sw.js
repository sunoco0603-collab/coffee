/*
 * コーヒー学習アプリ オフライン用サービスワーカー
 *
 * 方針
 * - アプリ本体（HTML）は「まずネットから取り、だめならキャッシュ」。
 *   こうしておくと、更新したファイルをアップロードすれば次に開いたとき反映される。
 * - アイコンなどは「まずキャッシュ」。
 * - このアプリは外部CDNを一切使わないので、すべて自分のドメイン内で完結する。
 *
 * アプリを更新したら CACHE の数字を1つ増やすこと。
 */
var CACHE = "coffee-app-v1";
var SHELL = "./index.html";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .catch(function () { /* 1つでも取れなければ諦める（オンラインなら通常どおり動く） */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // ページそのもの：ネット優先（更新をすぐ反映するため）
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(SHELL, copy); });
        return res;
      }).catch(function () {
        return caches.match(SHELL).then(function (hit) {
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  // それ以外：キャッシュ優先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
