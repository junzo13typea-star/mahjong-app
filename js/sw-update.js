// Service Worker 更新通知: 新バージョンが入ったらトーストで知らせ、
// 制御が切り替わったタイミングで1回だけ自動で再読み込みする。
// 初回インストール時は何もしない (controller が無い状態では通知も再読み込みもしない)。
(function (global) {
  'use strict';

  function showUpdateToast() {
    // app.js の showToast は非公開のため、同じ見た目の簡易トーストを自前で出す
    try {
      const toast = document.createElement('div');
      toast.className = 'mahjong-toast';
      toast.textContent = '🚀 新バージョンが利用可能です。更新中...';
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(4,30,23,0.95);color:#fef3c7;border:1px solid #f59e0b;border-radius:20px;padding:8px 18px;font-size:0.85rem;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.6);z-index:9999;max-width:min(92vw,560px);text-align:center;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    } catch (e) { /* トーストが出なくても更新自体は進める */ }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      if (reg.update) reg.update().catch(() => {});
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    }).catch((err) => console.log('SW reg error:', err));
  }

  global.registerMahjongServiceWorker = registerServiceWorker;
})(typeof window !== 'undefined' ? window : globalThis);
