// Service Worker - 集会管理アプリ
// バージョンを変更するとキャッシュが更新される
const CACHE_VERSION = 'v4';
const CACHE_NAME = `meeting-app-${CACHE_VERSION}`;

// 起動時に必ずキャッシュするコアファイル
const CORE_ASSETS = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './worship.js',
  './tjc.png',
  './manifest.json',
  './popwindow/display.html',
  './Data.csv',
  './hymn.csv'
];

// install: コアファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] コアアセットをキャッシュ中...');
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      // 新しいSWを即座にアクティブ化
      return self.skipWaiting();
    })
  );
});

// activate: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] 古いキャッシュを削除:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      // 全クライアントを新しいSWで制御
      return self.clients.claim();
    })
  );
});

// fetch: ネットワーク優先、失敗時はキャッシュから返す
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 外部リクエスト（GAS API、Google Fontsなど）はネットワーク優先
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // コアファイル: ネットワーク優先、失敗時キャッシュ（常に最新を取得）
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

// メッセージ受信：更新チェック
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
