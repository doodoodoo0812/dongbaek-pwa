// 동백전 납부 매칭 - Service Worker
// 버전 바꾸면 자동으로 새 캐시 적용됨
const CACHE_NAME = 'dongbaek-v' + Date.now();

// 네트워크 우선 전략 — 항상 최신 파일 사용
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 이전 버전 캐시 모두 삭제
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // API 요청은 캐시 안 함
  if (e.request.url.includes('googleapis.com') ||
      e.request.url.includes('firebasejs') ||
      e.request.url.includes('gstatic.com')) return;

  // 네트워크 우선, 실패하면 캐시
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 성공하면 캐시에 저장
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
