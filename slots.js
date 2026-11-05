'use strict';

// 忍者AdMax の枠を読み込み、ページを開いたときにランダムでモーダル広告を出す（スワイプ画面以外）
(() => {
  const CHANCE    = 0.3;            // ページを開いたときにモーダルを出す確率
  const GAP_MS    = 5 * 60 * 1000;  // 一度出したら、しばらく出さない
  const LOCK_SEC  = 0;              // 閉じるボタンを押せるようになるまでの秒数（AdMax の確認が取れるまで 0）
  const AGE_KEY   = 'afi_age_ok';
  const SHOWN_KEY = 'afi_ad_modal_at';

  // AdMax の規約で広告の上に別の要素を重ねられないので、ページ内の枠はモーダルを閉じてから読み込む
  const loadSlots = () => document.querySelectorAll('iframe[data-ad-src]').forEach(f => {
    f.src = f.dataset.adSrc;
  });

  // 年齢確認の前には出さない。確認が済んだページで後から出すのも規約の NG 例なので、次のページから
  const shouldOpen = () => {
    try {
      if (!sessionStorage.getItem(AGE_KEY)) return false;
      if (Date.now() - Number(sessionStorage.getItem(SHOWN_KEY)) < GAP_MS) return false;
      if (Math.random() >= CHANCE) return false;
      sessionStorage.setItem(SHOWN_KEY, String(Date.now()));
      return true;
    } catch {
      return false;
    }
  };

  const STYLE = `
    .ad-modal { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.88); }
    .ad-modal-box { display: flex; flex-direction: column; gap: 12px; width: 300px; }
    .ad-modal-bar { display: flex; align-items: center; justify-content: space-between; }
    .ad-modal-label { font-size: 12px; color: rgba(255,255,255,0.7); }
    .ad-modal-close { width: 44px; height: 44px; padding: 0; border: 1px solid rgba(255,255,255,0.4); border-radius: 50%; background: #1c1622; color: #fff; font: 700 18px/1 sans-serif; cursor: pointer; }
    .ad-modal-close:disabled { color: rgba(255,255,255,0.6); cursor: default; }
    .ad-modal iframe { display: block; width: 300px; height: 250px; border: 0; background: #1c1622; }
  `;

  const openModal = () => {
    const style = document.createElement('style');
    style.textContent = STYLE;
    const modal = document.createElement('div');
    modal.className = 'ad-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '広告');
    modal.innerHTML = `<div class="ad-modal-box">
      <div class="ad-modal-bar">
        <span class="ad-modal-label">広告</span>
        <button class="ad-modal-close" type="button" aria-label="広告を閉じる" disabled>${LOCK_SEC}</button>
      </div>
      <iframe src="/ad/admax.html" width="300" height="250" scrolling="no" title="広告" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
    </div>`;
    document.head.append(style);
    document.body.append(modal);
    document.documentElement.style.overflow = 'hidden';

    const close = modal.querySelector('.ad-modal-close');
    const unlock = () => {
      close.textContent = '×';
      close.disabled = false;
      close.focus();
    };
    if (LOCK_SEC === 0) {
      unlock();
    } else {
      let left = LOCK_SEC;
      const timer = setInterval(() => {
        left -= 1;
        if (left) { close.textContent = left; return; }
        clearInterval(timer);
        unlock();
      }, 1000);
    }

    // AdMax の規約に沿って、押したらすぐに消す（フェードアウトさせない）
    close.addEventListener('click', () => {
      modal.remove();
      style.remove();
      document.documentElement.style.overflow = '';
      loadSlots();
    });

    if (typeof gtag === 'function') gtag('event', 'ad_view', { placement: 'modal' });
  };

  if (shouldOpen()) openModal();
  else loadSlots();
})();
