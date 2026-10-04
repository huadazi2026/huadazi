/* 离线缓存：首次打开后即可断网使用。
   策略：
     · HTML（./ 与 index.html）→ 网络优先：联网时永远拿最新，断网才回退缓存
     · 其余静态资源（js/图标）→ 缓存优先 + 后台静默更新
   另外每 6 小时自动查一次新版本，装好立刻接管，避免"代码更新了但页面还是旧的"。 */
var CACHE = 'ziwei-liuren-v12';
var FILES = [
  './', './index.html', './manifest.json',
  './js/calendar_data.js', './js/calendar.js',
  './js/ziwei.js', './js/liuren.js',
  './js/ziwei_read.js', './js/liuren_read.js',
  './js/xiaoliuren.js', './js/meihua.js',
  './js/yijing_data.js', './js/liuyao.js', './js/qimen.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];
var NET_TIMEOUT = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.add(new Request(f, { cache: 'reload' })).catch(function () { /* 单个失败不影响安装 */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeoutFetch(req){
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, NET_TIMEOUT);
    fetch(req).then(function (r) { clearTimeout(t); resolve(r); },
                    function (e) { clearTimeout(t); reject(e); });
  });
}
function isHTML(req){
  if (req.mode === 'navigate') return true;
  var u = new URL(req.url);
  return u.pathname === '/' || /\/$/.test(u.pathname) || /index\.html$/.test(u.pathname);
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  /* —— HTML：网络优先 —— */
  if (isHTML(e.request)) {
    e.respondWith(
      timeoutFetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* —— 其余资源：缓存优先 + 后台更新 —— */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        }
        return res;
      });
      if (hit) { net.catch(function () {}); return hit; }
      return net.catch(function () { return caches.match('./index.html'); });
    })
  );
});
