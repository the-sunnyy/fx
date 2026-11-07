// 환율계산기 오프라인 캐시. 파일을 바꾸면 VERSION을 올려주세요.
const VERSION = 'fx-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  // cache: 'reload' → 브라우저 캐시 말고 서버에서 새로 받아서 저장
  event.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 앱 파일: 캐시에서 바로 열고(오프라인 OK), 인터넷 되면 뒤에서 새 버전으로 갱신.
// 환율 API(다른 도메인)는 건드리지 않음.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  const network = fetch(req).then(async res => {
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(VERSION);
      await cache.put(req, res.clone());
    }
    return res;
  }).catch(() => null);
  event.waitUntil(network);

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    let cached = await cache.match(req, { ignoreSearch: true });
    if (!cached && req.mode === 'navigate') cached = (await cache.match('./index.html')) || (await cache.match('./'));
    if (cached) return cached;
    const res = await network;
    return res || new Response('오프라인', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
