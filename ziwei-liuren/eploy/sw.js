/* 离线缓存：首次打开后即可断网使用。
   策略：本地有缓存就直接用（离线优先）；同时后台静默拉一次网络版，
   这样以后页面更新了，你下次联网打开就能自动拿到新版，不必手动清缓存。 */
var CACHE = 'ziwei-liuren-v3';
var FILES = [
  './', './index.html', './manifest.json',
  './js/calendar_data.js', './js/calendar.js',
  './js/ziwei.js', './js/liuren.js',
  './js/ziwei_read.js', './js/liuren_read.js',
  './js/xiaoliuren.js', './js/meihua.js', './js/qimen.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.add(new Request(f, { cache: 'reload' })).catch(function () { /* 单个文件失败不影响安装 */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        }
        return res;
      });
      if (hit) { net.catch(function () {}); return hit; }          // 先用缓存（离线可用），后台更新
      return net.catch(function () { return caches.match('./index.html'); });
    })
  );
});
