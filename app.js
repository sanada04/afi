'use strict';

const AGE_KEY = 'afi_age_ok';
const gate    = document.getElementById('age-gate');
const feed    = document.getElementById('feed');

// ---- Age gate ----
if (sessionStorage.getItem(AGE_KEY)) {
  gate.classList.add('hidden');
  boot();
} else {
  document.getElementById('btn-yes').addEventListener('click', () => {
    sessionStorage.setItem(AGE_KEY, '1');
    gate.classList.add('hidden');
    boot();
  });
  document.getElementById('btn-no').addEventListener('click', () => {
    location.href = 'https://www.google.co.jp/';
  });
}

// ---- Boot ----
async function boot() {
  let data;
  try {
    const res = await fetch('./data/videos.json?t=' + Date.now());
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    showMessage('📡', 'データを読み込めませんでした');
    return;
  }

  if (!data.videos || data.videos.length === 0) {
    showMessage('🎬', '動画がまだありません');
    return;
  }

  data.videos.forEach(v => feed.appendChild(buildCard(v)));
  initSwipe();
  setupSwipeHint();
}

// ---- Card builder ----
function buildCard(v) {
  const card = document.createElement('div');
  card.className = 'card';

  // video element
  const video = document.createElement('video');
  video.src       = v.videoURL;
  video.loop      = false;
  video.muted     = true;
  video.playsInline = true;
  video.preload   = 'none';
  video.poster    = v.thumbnail || '';
  video.setAttribute('playsinline', '');

  // spinner
  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  video.addEventListener('waiting', () => { spinner.style.display = 'block'; });
  video.addEventListener('playing', () => { spinner.style.display = 'none'; });
  video.addEventListener('canplay', () => { spinner.style.display = 'none'; });
  video.addEventListener('error',   () => { spinner.style.display = 'none'; });

  // mute flash
  const flash = document.createElement('div');
  flash.className = 'mute-flash';

  let flashTimer;
  video.addEventListener('click', () => {
    video.muted = !video.muted;
    flash.textContent = video.muted ? '🔇' : '🔊';
    flash.classList.add('visible');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('visible'), 900);
  });

  // overlay gradient
  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  // info
  const info = document.createElement('div');
  info.className = 'card-info';
  if (v.actress) {
    const a = document.createElement('div');
    a.className = 'card-actress';
    a.textContent = '@' + v.actress;
    info.appendChild(a);
  }
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = v.title;
  info.appendChild(t);

  // sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'card-sidebar';

  const buyBtn = document.createElement('a');
  buyBtn.className = 'side-btn btn-buy';
  buyBtn.href = v.affiliateURL;
  buyBtn.target = '_blank';
  buyBtn.rel = 'noopener noreferrer';
  buyBtn.innerHTML = '<div class="icon">🛒</div><span class="label">購入</span>';

  const shareBtn = document.createElement('div');
  shareBtn.className = 'side-btn btn-share';
  shareBtn.innerHTML = '<div class="icon">↗</div><span class="label">シェア</span>';
  shareBtn.addEventListener('click', () => doShare(v.affiliateURL, v.title));

  sidebar.append(buyBtn, shareBtn);

  // progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressTrack = document.createElement('div');
  progressTrack.className = 'progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressTrack.appendChild(progressFill);
  progressBar.appendChild(progressTrack);

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    progressFill.style.width = (video.currentTime / video.duration * 100) + '%';
  });

  const doSeek = e => {
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (video.duration) {
      video.currentTime = ratio * video.duration;
      progressFill.style.width = (ratio * 100) + '%';
    }
  };

  progressBar.addEventListener('pointerdown', e => {
    e.stopPropagation();
    progressBar.setPointerCapture(e.pointerId);
    progressBar.classList.add('seeking');
    doSeek(e);
    const onMove = ev => doSeek(ev);
    const onUp = () => {
      progressBar.classList.remove('seeking');
      progressBar.removeEventListener('pointermove', onMove);
    };
    progressBar.addEventListener('pointermove', onMove);
    progressBar.addEventListener('pointerup', onUp, { once: true });
  });

  card.append(video, spinner, overlay, flash, info, sidebar, progressBar);
  return card;
}

// ---- Swipe Navigation ----
function initSwipe() {
  const cards = Array.from(feed.querySelectorAll('.card'));
  let currentIdx = 0;
  let startY = 0;
  let startTime = 0;

  // feed の中に reel ラッパーを作りカードを移す
  const reel = document.createElement('div');
  cards.forEach(card => reel.appendChild(card));
  feed.appendChild(reel);

  const goTo = (idx) => {
    const next = Math.max(0, Math.min(idx, cards.length - 1));
    if (next === currentIdx) {
      const v = cards[currentIdx]?.querySelector('video');
      if (v) { v.currentTime = 0; v.play().catch(() => {}); }
      return;
    }
    const prevVideo = cards[currentIdx]?.querySelector('video');
    if (prevVideo) { prevVideo.pause(); prevVideo.currentTime = 0; }
    currentIdx = next;
    reel.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    reel.style.transform  = `translateY(-${currentIdx * feed.clientHeight}px)`;
    cards[currentIdx]?.querySelector('video')?.play().catch(() => {});
  };

  // 動画終了で次へ
  cards.forEach((card, i) => {
    const v = card.querySelector('video');
    if (v) v.addEventListener('ended', () => goTo(i + 1));
  });

  // マウスホイール（PC）
  let wheelLocked = false;
  feed.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelLocked) return;
    wheelLocked = true;
    feed.dispatchEvent(new Event('swiped'));
    goTo(currentIdx + (e.deltaY > 0 ? 1 : -1));
    setTimeout(() => { wheelLocked = false; }, 600);
  }, { passive: false });

  // タッチスワイプ
  feed.addEventListener('touchstart', e => {
    startY    = e.touches[0].clientY;
    startTime = Date.now();
    reel.style.transition = 'none';
  }, { passive: true });

  feed.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    reel.style.transform = `translateY(${-currentIdx * feed.clientHeight + dy}px)`;
  }, { passive: true });

  feed.addEventListener('touchend', e => {
    const dy       = startY - e.changedTouches[0].clientY;
    const velocity = Math.abs(dy) / (Date.now() - startTime);
    if (Math.abs(dy) > 60 || velocity > 0.3) {
      feed.dispatchEvent(new Event('swiped'));
      goTo(currentIdx + (dy > 0 ? 1 : -1));
    } else {
      reel.style.transition = 'transform 0.2s ease-out';
      reel.style.transform  = `translateY(-${currentIdx * feed.clientHeight}px)`;
    }
  });

  cards[0]?.querySelector('video')?.play().catch(() => {});
}

// ---- Share ----
function doShare(url, title) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('リンクをコピーしました'));
  }
}

// ---- Swipe Hint ----
function setupSwipeHint() {
  const app = document.getElementById('app');
  const hint = document.createElement('div');
  hint.className = 'swipe-hint';
  hint.innerHTML =
    '<div class="swipe-hint-icon"><div class="swipe-hint-arrow"></div></div>' +
    '<span class="swipe-hint-text">スワイプ</span>';
  app.appendChild(hint);

  const timer = setTimeout(() => hint.classList.add('visible'), 3000);

  feed.addEventListener('swiped', () => {
    clearTimeout(timer);
    hint.classList.remove('visible');
    hint.addEventListener('transitionend', () => hint.remove(), { once: true });
  }, { once: true });
}

// ---- Fallback message ----
function showMessage(icon, text) {
  feed.innerHTML =
    `<div class="feed-message"><span class="icon">${icon}</span><span>${text}</span></div>`;
}
