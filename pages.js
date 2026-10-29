'use strict';

// 静的ページ（作品・女優・ジャンル）の年齢確認。トップページと同じキーを使う
(() => {
  const AGE_KEY = 'afi_age_ok';
  const gate = document.getElementById('age-gate');
  let ok = false;
  try { ok = !!sessionStorage.getItem(AGE_KEY); } catch {}
  if (ok) return;

  gate.hidden = false;
  document.body.classList.add('gated');
  document.getElementById('btn-yes').addEventListener('click', () => {
    try { sessionStorage.setItem(AGE_KEY, '1'); } catch {}
    gate.hidden = true;
    document.body.classList.remove('gated');
  });
  document.getElementById('btn-no').addEventListener('click', () => {
    location.href = 'https://www.google.co.jp/';
  });
})();

// FANZA への移動（本編を見る）を Google アナリティクスに記録する
document.addEventListener('click', e => {
  const link = e.target.closest('a[rel~="sponsored"]');
  if (!link || typeof gtag !== 'function') return;
  const [, type = 'top', id = ''] = location.pathname.split('/');
  gtag('event', 'fanza_click', {
    placement: type === 'video' ? 'video_page' : 'list_page',
    video_id: type === 'video' ? decodeURIComponent(id) : undefined,
  });
});
