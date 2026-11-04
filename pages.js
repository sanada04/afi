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

// ページトップボタン: スクロールしたら出す
(() => {
  const btn = document.getElementById('page-top');
  const sync = () => btn.classList.toggle('visible', scrollY > 400);
  addEventListener('scroll', sync, { passive: true });
  sync();
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
})();

// FANZA への移動（本編を見る）を Google アナリティクスに記録する
document.addEventListener('click', e => {
  const link = e.target.closest('a[rel~="sponsored"]');
  if (!link || typeof gtag !== 'function') return;
  const [, type = 'top', id = ''] = location.pathname.split('/');
  // 広告バナーは data-placement / data-video-id を持つ
  gtag('event', 'fanza_click', {
    placement: link.dataset.placement || (type === 'video' ? 'video_page' : 'list_page'),
    video_id: link.dataset.videoId || (type === 'video' ? decodeURIComponent(id) : undefined),
  });
});

// ページは 1 日 1 回の生成なので、生成後に終わったセールの表示は消す
document.querySelectorAll('.promo-campaign[data-end]').forEach(el => {
  const end = Date.parse(el.dataset.end.replace(' ', 'T') + '+09:00');
  if (end && end < Date.now()) {
    const promo = el.closest('.promo');
    promo.querySelector('.promo-off')?.remove();
    promo.querySelector('.promo-price')?.remove();
    promo.querySelector('.promo-label').lastChild.textContent = 'おすすめ';
    el.remove();
  }
});
