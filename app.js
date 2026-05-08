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

  const videos = (data.videos ?? []).filter(v => v.videoURL);

  if (videos.length === 0) {
    showMessage('🎬', '動画がまだありません');
    return;
  }

  const { reset, onOverscrollBottom, pauseCurrent, resumeCurrent } = initSwipe();
  reset(shuffle([...videos]));
  onOverscrollBottom(() => reset(shuffle([...videos])));
  initSearch(videos, reset, pauseCurrent, resumeCurrent);
  setupSwipeHint();
}

// ---- Slot factory (DOM structure only, no data) ----
function createSlot() {
  const card = document.createElement('div');
  card.className = 'card';

  const video = document.createElement('video');
  video.muted     = false;
  video.loop      = false;
  video.playsInline = true;
  video.preload   = 'none';
  video.setAttribute('playsinline', '');

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  video.addEventListener('waiting', () => { spinner.style.display = 'block'; });
  video.addEventListener('playing', () => { spinner.style.display = 'none'; });
  video.addEventListener('canplay', () => { spinner.style.display = 'none'; });
  video.addEventListener('error',   () => { spinner.style.display = 'none'; });

  const flash = document.createElement('div');
  flash.className = 'tap-flash';
  let flashTimer;
  video.addEventListener('click', e => {
    e.preventDefault();
    if (video.paused) {
      video.play().catch(err => console.warn('[play rejected]', err.name, err.message));
      flash.dataset.icon = 'play';
    } else {
      video.pause();
      flash.dataset.icon = 'pause';
    }
    flash.classList.add('visible');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('visible'), 700);
  });

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  const info = document.createElement('div');
  info.className = 'card-info';
  const actressEl = document.createElement('div');
  actressEl.className = 'card-actress';
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  info.append(actressEl, titleEl);

  const sidebar = document.createElement('div');
  sidebar.className = 'card-sidebar';

  const buyBtn = document.createElement('a');
  buyBtn.className = 'side-btn btn-buy';
  buyBtn.href = 'https://www.dmm.co.jp/';
  buyBtn.target = '_blank';
  buyBtn.rel = 'noopener noreferrer sponsored';
  buyBtn.innerHTML = '<div class="icon"><img class="icon-svg" src="images/icon-shopping.svg" alt="購入"></div><span class="label">購入</span>';

  const shareBtn = document.createElement('div');
  shareBtn.className = 'side-btn btn-share';
  shareBtn.innerHTML = '<div class="icon"><img class="icon-svg" src="images/icon-share.svg" alt="シェア"></div><span class="label">シェア</span>';
  shareBtn.addEventListener('click', () => {
    if (shareBtn._v) doShare(shareBtn._v.affiliateURL, shareBtn._v.title);
  });

  sidebar.append(buyBtn, shareBtn);

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

  // tap hint（初回のみ表示）
  const tapHint = document.createElement('div');
  tapHint.className = 'tap-hint';
  tapHint.innerHTML =
    '<div class="tap-hint-icon">' +
      '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>' +
    '</div>' +
    '<span class="tap-hint-text">タップして再生</span>';

  card.append(video, spinner, overlay, flash, tapHint, info, sidebar, progressBar);
  return card;
}

// ---- Swipe Navigation (3-slot virtual carousel) ----
function initSwipe() {
  let videoData  = [];
  let currentIdx = 0;
  let overscrollBottom = null;
  let tapHintDismissed = false;

  const dismissTapHint = () => {
    if (tapHintDismissed) return;
    tapHintDismissed = true;
    slots.forEach(s => s.querySelector('.tap-hint').classList.remove('visible'));
  };

  // 3 スロットを DOM に追加（以後この 3 枚だけを使い回す）
  const slots = [createSlot(), createSlot(), createSlot()];
  slots.forEach(s => {
    feed.appendChild(s);
    s.querySelector('video').addEventListener('click', dismissTapHint);
  });

  // roles[0]=上(prev), roles[1]=表示中(curr), roles[2]=下(next)
  // roles の値はスロット配列のインデックス
  const roles = [0, 1, 2];

  const currSlot  = () => slots[roles[1]];
  const currVideo = () => currSlot().querySelector('video');

  // スロットにデータを流し込む（src セット / 解放）
  const fillSlot = (slot, data) => {
    const v = slot.querySelector('video');
    v.pause();
    v.removeAttribute('src');
    v.load(); // メモリ解放
    if (!data) { v.poster = ''; return; }
    v.src    = data.videoURL;
    v.poster = data.thumbnail || '';
    v.currentTime = 0;
    slot.querySelector('.card-actress').textContent = data.actress ? '@' + data.actress : '';
    slot.querySelector('.card-title').textContent   = data.title;
    slot.querySelector('.btn-buy').href             = data.affiliateURL;
    slot.querySelector('.btn-share')._v             = data;
    slot.querySelector('.progress-fill').style.width = '0%';
  };

  // 全スロットを位置に配置（dragPx は指追従オフセット）
  const positionAll = (dragPx, animate) => {
    const h = feed.clientHeight;
    slots.forEach((slot, s) => {
      const role = roles.indexOf(s); // 0=上, 1=中, 2=下
      slot.style.transition = animate
        ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)'
        : 'none';
      slot.style.transform = `translateY(${(role - 1) * h + dragPx}px)`;
    });
  };

  // dir: 1=次へ, -1=前へ
  const goTo = (dir) => {
    dismissTapHint();
    const newIdx = currentIdx + dir;
    if (newIdx < 0) { positionAll(0, true); return; }
    if (newIdx >= videoData.length) {
      positionAll(0, true);
      overscrollBottom?.();
      return;
    }

    currVideo().pause();
    currVideo().currentTime = 0;
    currentIdx = newIdx;

    let recycled;
    if (dir === 1) {
      recycled = roles.shift();
      roles.push(recycled);
      fillSlot(slots[recycled], videoData[currentIdx + 1] ?? null);
    } else {
      recycled = roles.pop();
      roles.unshift(recycled);
      fillSlot(slots[recycled], videoData[currentIdx - 1] ?? null);
    }

    // リサイクルしたスロットを画面外の目的位置に瞬間移動させてから
    // 他のスロットだけアニメーションさせる（通過グリッチ防止）
    const h = feed.clientHeight;
    slots[recycled].style.transition = 'none';
    slots[recycled].style.transform  = `translateY(${dir * h}px)`;
    void slots[recycled].offsetHeight; // reflow を強制して transition:none を確定

    positionAll(0, true);
    currVideo().play().catch(() => {});
    feed.dispatchEvent(new Event('swiped'));
  };

  // ended / error はスロット生成時に一度だけセット
  slots.forEach(slot => {
    const v = slot.querySelector('video');
    v.addEventListener('ended', () => { if (slot === currSlot()) goTo(1); });
    v.addEventListener('error', () => {
      if (slot !== currSlot()) return;
      console.warn('[video error]', v.error?.message);
      setTimeout(() => goTo(1), 400);
    });
  });

  const reset = (data) => {
    slots.forEach(s => fillSlot(s, null));
    videoData  = data || [];
    currentIdx = 0;
    roles[0] = 0; roles[1] = 1; roles[2] = 2;

    if (videoData.length === 0) {
      showMessage('🔍', '該当する動画がありません');
      return;
    }
    fillSlot(slots[0], null);                          // 上: 空
    fillSlot(slots[1], videoData[0]);                  // 表示中
    fillSlot(slots[2], videoData[1] ?? null);          // 下
    positionAll(0, false);

    // 初回のみタップ案内を表示
    if (!tapHintDismissed) {
      slots[1].querySelector('.tap-hint').classList.add('visible');
    }
  };

  // タッチスワイプ
  let startY = 0, startTime = 0, isDragging = false;

  feed.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startTime = Date.now();
    isDragging = false;
    slots.forEach(s => { s.style.transition = 'none'; });
  }, { passive: true });

  feed.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > 10) isDragging = true;
    if (isDragging) {
      e.preventDefault();
      positionAll(dy, false);
    }
  }, { passive: false });

  feed.addEventListener('touchend', e => {
    const dy       = startY - e.changedTouches[0].clientY;
    const elapsed  = Date.now() - startTime;
    const velocity = Math.abs(dy) / elapsed;
    const isSwipe  = Math.abs(dy) > 80 || (Math.abs(dy) > 40 && velocity > 0.4);
    if (isSwipe && isDragging) {
      goTo(dy > 0 ? 1 : -1);
    } else {
      positionAll(0, true);
    }
  });

  // マウスホイール（PC）
  let wheelLocked = false;
  feed.addEventListener('wheel', e => {
    e.preventDefault();
    if (wheelLocked) return;
    wheelLocked = true;
    goTo(e.deltaY > 0 ? 1 : -1);
    setTimeout(() => { wheelLocked = false; }, 600);
  }, { passive: false });

  return {
    reset,
    onOverscrollBottom: fn => { overscrollBottom = fn; },
    pauseCurrent:  () => currVideo()?.pause(),
    resumeCurrent: () => currVideo()?.play().catch(() => {}),
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

  // 女優チップを描画（全件・件数バッジ付き）
  const renderActressChips = (names, label) => {
    actressLabel.textContent = label;
    actressEl.innerHTML = '';
    actressSec.classList.toggle('hidden', names.length === 0);
    names.forEach(name => {
      const chip = document.createElement('button');
      chip.className = 'suggest-chip';
      if (name === query.trim()) chip.classList.add('active');
      chip.innerHTML =
        `<span class="chip-name">${name}</span>` +
        `<span class="chip-count">${actressCount[name] ?? 1}</span>`;
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

  // ジャンル出現頻度を集計（多い順）
  const genreCount = {};
  allVideos.forEach(v => {
    (v.genres ?? []).forEach(g => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  const genres = Object.keys(genreCount).sort((a, b) => genreCount[b] - genreCount[a]);

  if (genres.length > 0) {
    genres.forEach(genre => {
      const chip = document.createElement('button');
      chip.className = 'suggest-chip';
      chip.innerHTML =
        `<span class="chip-name">${genre}</span>` +
        `<span class="chip-count">${genreCount[genre]}</span>`;
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
