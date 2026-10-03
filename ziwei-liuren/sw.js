/* 离线缓存：首次打开后即可断网使用 */
var CACHE = 'ziwei-liuren-v1';
var FILES = [
  './', './index.html', './manifest.json',
  './js/calendar_data.js', './js/calendar.js',
  './js/ziwei.js', './js/liuren.js',
  './js/ziwei_read.js', './js/liuren_read.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.add(f).catch(function () { /* 单个文件失败不影响安装 */ });
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
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
