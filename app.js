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
  initObserver();
}

// ---- Card builder ----
function buildCard(v) {
  const card = document.createElement('div');
  card.className = 'card';

  // video element
  const video = document.createElement('video');
  video.src       = v.videoURL;
  video.loop      = true;
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

  card.append(video, spinner, overlay, flash, info, sidebar);
  return card;
}

// ---- Intersection Observer (auto-play) ----
function initObserver() {
  let active = null;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      if (!video) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
        if (active && active !== video) {
          active.pause();
          active.currentTime = 0;
        }
        video.play().catch(() => {});
        active = video;
      } else if (!entry.isIntersecting) {
        video.pause();
      }
    });
  }, { threshold: 0.75 });

  document.querySelectorAll('.card').forEach(c => observer.observe(c));
}

// ---- Share ----
function doShare(url, title) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('リンクをコピーしました'));
  }
}

// ---- Fallback message ----
function showMessage(icon, text) {
  feed.innerHTML =
    `<div class="feed-message"><span class="icon">${icon}</span><span>${text}</span></div>`;
}
