'use strict';

// iOS Safari / Android Chrome のプルリフレッシュ・オーバースクロールを防止
// #grid 内のスクロールだけは許可する
document.addEventListener('touchmove', e => {
  if (!e.target.closest('#grid')) {
    e.preventDefault();
  }
}, { passive: false });

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

  const { reset, onOverscrollBottom, pauseCurrent, resumeCurrent } = initSwipe();
  reset(shuffle([...data.videos]));
  onOverscrollBottom(() => reset(shuffle([...data.videos])));
  initSearch(data.videos, reset, pauseCurrent, resumeCurrent);
  setupSwipeHint();
}

// ---- Card builder ----
function buildCard(v) {
  const card = document.createElement('div');
  card.className = 'card';

  // video element
  const video = document.createElement('video');
  video.src          = v.videoURL;
  video.dataset.src  = v.videoURL; // エラー後の再設定用
  video.loop      = false;
  video.muted     = false;
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

  // tap flash (play / pause)
  const flash = document.createElement('div');
  flash.className = 'tap-flash';

  let flashTimer;
  video.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[tap] video clicked, paused=', video.paused, 'src=', video.src.slice(0, 60));
    if (video.paused) {
      video.play().catch((err) => { console.warn('[play rejected]', err.name, err.message); });
      flash.dataset.icon = 'play';
    } else {
      video.pause();
      flash.dataset.icon = 'pause';
    }
    flash.classList.add('visible');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('visible'), 700);
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
  let currentIdx = 0;
  let startY = 0;
  let startTime = 0;
  let reel = null;
  let cards = [];
  let overscrollBottom = null;
  let overscrollTop    = null;

  const snapTo = (idx) => {
    reel.style.transition = 'transform 0.25s ease-out';
    reel.style.transform  = `translateY(-${idx * feed.clientHeight}px)`;
  };

  const goTo = (idx, dy = 999) => {
    if (!reel || cards.length === 0) return;
    if (idx >= cards.length) {
      snapTo(cards.length - 1);
      if (Math.abs(dy) > 40) overscrollBottom?.();
      return;
    }
    if (idx < 0) {
      snapTo(0);
      if (Math.abs(dy) > 40) overscrollTop?.();
      return;
    }
    const next = idx;
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
    const nextVideo = cards[currentIdx]?.querySelector('video');
    if (nextVideo) {
      // src がリセット済み（エラー後）なら再設定してから再生
      if (!nextVideo.src && nextVideo.dataset.src) {
        nextVideo.src = nextVideo.dataset.src;
      }
      nextVideo.play().catch(() => {});
    }
  };

  const reset = (videoData) => {
    cards.forEach(card => {
      const v = card.querySelector('video');
      if (v) { v.pause(); v.currentTime = 0; }
    });
    feed.innerHTML = '';
    reel = null;
    currentIdx = 0;
    cards = [];

    if (!videoData || videoData.length === 0) {
      showMessage('🔍', '該当する動画がありません');
      return;
    }

    cards = videoData.map(v => buildCard(v));
    reel = document.createElement('div');
    cards.forEach(card => reel.appendChild(card));
    feed.appendChild(reel);
    cards.forEach((card, i) => {
      const v = card.querySelector('video');
      if (!v) return;
      v.addEventListener('ended', () => goTo(i + 1));
      v.addEventListener('error', () => {
        const err = v.error;
        console.warn(`[video error] card=${i} code=${err?.code} msg=${err?.message} src=${v.src.slice(0, 80)}`);
        v.removeAttribute('src');
        v.load();
        if (i === currentIdx) setTimeout(() => goTo(i + 1), 400);
      });
    });
    // iOS: ユーザーアクションなしの play() はデファードオートプレイを引き起こしエラーになるので呼ばない
    // → 最初の動画はタップで再生、スワイプ後の動画は goTo() で再生
  };

  // マウスホイール（PC）
  let wheelLocked = false;
  feed.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelLocked || !reel) return;
    wheelLocked = true;
    feed.dispatchEvent(new Event('swiped'));
    goTo(currentIdx + (e.deltaY > 0 ? 1 : -1));
    setTimeout(() => { wheelLocked = false; }, 600);
  }, { passive: false });

  // タッチスワイプ
  feed.addEventListener('touchstart', e => {
    if (!reel) return;
    startY    = e.touches[0].clientY;
    startTime = Date.now();
    reel.style.transition = 'none';
  }, { passive: true });

  feed.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!reel) return;
    const dy = e.touches[0].clientY - startY;
    reel.style.transform = `translateY(${-currentIdx * feed.clientHeight + dy}px)`;
  }, { passive: false });

  feed.addEventListener('touchend', e => {
    if (!reel) return;
    const dy       = startY - e.changedTouches[0].clientY;
    const elapsed  = Date.now() - startTime;
    const velocity = Math.abs(dy) / elapsed;
    // タップ誤検知防止: velocity 判定は最低 40px の移動を要求
    const isSwipe  = Math.abs(dy) > 80 || (Math.abs(dy) > 40 && velocity > 0.4);
    if (isSwipe) {
      e.preventDefault(); // スワイプ中に指が <a> の上で終わってもリンク遷移しない
      feed.dispatchEvent(new Event('swiped'));
      goTo(currentIdx + (dy > 0 ? 1 : -1), dy);
    } else {
      reel.style.transition = 'transform 0.2s ease-out';
      reel.style.transform  = `translateY(-${currentIdx * feed.clientHeight}px)`;
    }
  });

  const pauseCurrent = () => {
    cards[currentIdx]?.querySelector('video')?.pause();
  };
  const resumeCurrent = () => {
    cards[currentIdx]?.querySelector('video')?.play().catch(() => {});
  };

  return {
    reset,
    onOverscrollBottom: (fn) => { overscrollBottom = fn; },
    pauseCurrent,
    resumeCurrent,
  };
}

// ---- Search ----
function initSearch(allVideos, resetFeed, pauseCurrent, resumeCurrent) {
  const btn           = document.getElementById('search-btn');
  const overlay       = document.getElementById('search-overlay');
  const input         = document.getElementById('search-input');
  const closeBtn      = document.getElementById('search-close');
  const actressLabel  = document.getElementById('actress-label');
  const actressEl     = document.getElementById('actress-chips');
  const actressSec    = document.getElementById('actress-section');
  const genreEl       = document.getElementById('genre-chips');
  const genreSec      = document.getElementById('genre-section');
  const gridEl        = document.getElementById('grid');

  const selectedGenres = new Set();
  let query = '';
  let debounce;

  // 女優出演頻度を集計（多い順）
  const actressCount = {};
  allVideos.forEach(v => {
    (v.actress || '').split(',').map(s => s.trim()).filter(Boolean).forEach(a => {
      actressCount[a] = (actressCount[a] || 0) + 1;
    });
  });
  const allActresses = Object.keys(actressCount).sort((a, b) => actressCount[b] - actressCount[a]);

  // 女優チップを描画
  const renderActressChips = (names, label) => {
    actressLabel.textContent = label;
    actressEl.innerHTML = '';
    const list = names.slice(0, 16);
    actressSec.classList.toggle('hidden', list.length === 0);
    list.forEach(name => {
      const chip = document.createElement('button');
      chip.className = 'suggest-chip';
      chip.textContent = name;
      chip.addEventListener('click', () => {
        input.value = name;
        query = name;
        overlay.classList.remove('open');
        applyFilter();
      });
      actressEl.appendChild(chip);
    });
  };
  renderActressChips(allActresses, '人気女優');

  // ジャンルチップ生成
  const genres = [...new Set(allVideos.flatMap(v => v.genres ?? []))].sort();
  if (genres.length > 0) {
    genres.forEach(genre => {
      const chip = document.createElement('button');
      chip.className = 'suggest-chip';
      chip.textContent = genre;
      chip.addEventListener('click', () => {
        const on = chip.classList.toggle('active');
        on ? selectedGenres.add(genre) : selectedGenres.delete(genre);
        applyFilter();
      });
      genreEl.appendChild(chip);
    });
  } else {
    genreSec.classList.add('hidden');
  }

  // グリッド表示
  const showGrid = (videos) => {
    gridEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'grid-container';

    if (videos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = '該当する動画がありません';
      container.appendChild(empty);
    } else {
      videos.forEach((v, i) => {
        const item = document.createElement('div');
        item.className = 'grid-item';

        if (v.thumbnail) {
          const img = document.createElement('img');
          img.src = v.thumbnail;
          img.alt = v.title;
          img.loading = 'lazy';
          item.appendChild(img);
        }

        const playIcon = document.createElement('div');
        playIcon.className = 'grid-item-play';
        item.appendChild(playIcon);

        const info = document.createElement('div');
        info.className = 'grid-item-info';
        if (v.actress) {
          const a = document.createElement('div');
          a.className = 'grid-item-actress';
          a.textContent = v.actress;
          info.appendChild(a);
        }
        const t = document.createElement('div');
        t.className = 'grid-item-title';
        t.textContent = v.title;
        info.appendChild(t);
        item.appendChild(info);

        item.addEventListener('click', () => {
          // タップした動画を先頭にして検索結果のみをループ
          const ordered = [...videos.slice(i), ...videos.slice(0, i)];
          overlay.classList.remove('open');
          gridEl.classList.remove('visible');
          resetFeed(ordered);
        });

        container.appendChild(item);
      });
    }

    gridEl.appendChild(container);
    gridEl.classList.add('visible');
  };

  const applyFilter = () => {
    const q = query.trim().toLowerCase();
    const hasFilter = q || selectedGenres.size > 0;
    const filtered = allVideos.filter(v => {
      const matchText = !q ||
        v.title.toLowerCase().includes(q) ||
        (v.actress || '').toLowerCase().includes(q);
      const matchGenre = selectedGenres.size === 0 ||
        (v.genres ?? []).some(g => selectedGenres.has(g));
      return matchText && matchGenre;
    });

    if (hasFilter) {
      showGrid(filtered);
    } else {
      gridEl.classList.remove('visible');
      resetFeed(shuffle([...allVideos]));
    }
  };

  const resetAll = () => {
    input.value = '';
    query = '';
    selectedGenres.clear();
    genreEl.querySelectorAll('.suggest-chip').forEach(c => c.classList.remove('active'));
    renderActressChips(allActresses, '人気女優');
    overlay.classList.remove('open');
    gridEl.classList.remove('visible');
    resetFeed(shuffle([...allVideos]));
  };

  document.querySelector('.header-logo').addEventListener('click', resetAll);

  btn.addEventListener('click', () => {
    const opening = !overlay.classList.contains('open');
    overlay.classList.toggle('open');
    if (opening) {
      pauseCurrent();
    } else if (!gridEl.classList.contains('visible')) {
      resumeCurrent();
    }
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('open');
    if (!gridEl.classList.contains('visible')) {
      resumeCurrent();
    }
  });

  input.addEventListener('input', e => {
    query = e.target.value;
    const q = query.trim().toLowerCase();
    if (q) {
      const matched = allActresses.filter(a => a.toLowerCase().includes(q));
      renderActressChips(matched, '候補');
    } else {
      renderActressChips(allActresses, '人気女優');
    }
    clearTimeout(debounce);
    debounce = setTimeout(applyFilter, 350);
  });
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

  let idleTimer;

  const resetTimer = () => {
    clearTimeout(idleTimer);
    hint.classList.remove('visible');
    idleTimer = setTimeout(() => hint.classList.add('visible'), 30000);
  };

  resetTimer();
  feed.addEventListener('swiped', resetTimer);
}

// ---- Shuffle ----
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Fallback message ----
function showMessage(icon, text) {
  feed.innerHTML =
    `<div class="feed-message"><span class="icon">${icon}</span><span>${text}</span></div>`;
}
