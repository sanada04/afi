'use strict';

// iOS Safari / Android Chrome のプルリフレッシュ・オーバースクロールを防止
// #grid 内のスクロールだけは許可する
document.addEventListener('touchmove', e => {
  if (!e.target.closest('#grid')) {
    e.preventDefault();
  }
}, { passive: false });

const AGE_KEY = 'afi_age_ok';
const FAV_KEY = 'nukidoki_favs';
const gate    = document.getElementById('age-gate');
const feed    = document.getElementById('feed');

// ---- Favorites（「ドキッ」した動画の ID。ブラウザ内にだけ保存） ----
const favs = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); }
  catch { return new Set(); }
})();

function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch {}
  return favs.has(id);
}

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

  const params      = new URLSearchParams(location.search);
  const initQuery   = params.get('q')     || '';
  const initGenre   = params.get('genre') || '';
  const initVideoId = params.get('video') || '';

  // おすすめ / 新着 / 人気 フィード（API の順位どおり、再生可能なものだけ）
  // 該当動画が少ないときは残りをシャッフルして後ろに続ける
  const byId = new Map(videos.map(v => [v.id, v]));
  const feedList = name => {
    const list = (data.feeds?.[name] ?? []).map(id => byId.get(id)).filter(Boolean);
    const inList = new Set(list.map(v => v.id));
    return [...list, ...shuffle(videos.filter(v => !inList.has(v.id)))];
  };
  let currentFeed = 'recommend';

  // ?video=ID で指定した動画を先頭に並べる
  let ordered = feedList(currentFeed);
  if (initVideoId && byId.has(initVideoId)) {
    ordered = [byId.get(initVideoId), ...ordered.filter(v => v.id !== initVideoId)];
  }

  const { reset, onOverscrollBottom, pauseCurrent, resumeCurrent } = initSwipe();
  reset(ordered);
  onOverscrollBottom(() => reset(shuffle([...videos])));
  const selectTab = initFeedTabs(currentFeed, name => {
    if (name === 'favorites') {
      const list = [...favs].reverse().map(id => byId.get(id)).filter(Boolean); // 新しく保存した順
      search.showList(list, 'ハートの「ドキッ」をタップした動画がここに保存されます');
      return;
    }
    currentFeed = name;
    search.clear();
  });
  const search = initSearch(videos, reset, pauseCurrent, resumeCurrent, initQuery, initGenre, () => feedList(currentFeed));

  // ロゴ: 絞り込み・お気に入りを閉じて、選んでいたタブに戻る
  document.querySelector('.header-logo').addEventListener('click', () => {
    selectTab(currentFeed);
    search.clear();
  });
  watchHeaderHeight();
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

  // 動画の上下にできる余白を、ぼかしたサムネイルで埋める
  const bg = document.createElement('div');
  bg.className = 'card-bg';

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';

  const info = document.createElement('div');
  info.className = 'card-info';
  const actressEl = document.createElement('a');
  actressEl.className = 'card-actress';
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';

  const buyBtn = document.createElement('a');
  buyBtn.className = 'cta-buy';
  buyBtn.href = 'https://www.dmm.co.jp/';
  buyBtn.target = '_blank';
  buyBtn.rel = 'noopener noreferrer sponsored';
  buyBtn.innerHTML = '<img class="cta-icon" src="images/icon-shopping.svg" alt="">FANZAで本編を見る';
  info.append(actressEl, titleEl, buyBtn);

  const sidebar = document.createElement('div');
  sidebar.className = 'card-sidebar';

  const likeBtn = document.createElement('div');
  likeBtn.className = 'side-btn btn-like';
  likeBtn.innerHTML =
    '<div class="icon"><svg class="icon-heart" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>' +
    '<span class="label">ドキッ</span>';
  likeBtn.addEventListener('click', () => {
    if (!likeBtn._v) return;
    const on = toggleFav(likeBtn._v.id);
    likeBtn.classList.toggle('liked', on);
    // 鼓動アニメーションを毎回最初から再生
    likeBtn.classList.remove('beat');
    void likeBtn.offsetWidth;
    if (on) likeBtn.classList.add('beat');
  });

  const shareBtn = document.createElement('div');
  shareBtn.className = 'side-btn btn-share';
  shareBtn.innerHTML = '<div class="icon"><img class="icon-svg" src="images/icon-share.svg" alt="シェア"></div><span class="label">シェア</span>';
  shareBtn.addEventListener('click', () => {
    if (shareBtn._v) doShare(shareBtn._v.affiliateURL, shareBtn._v.title);
  });

  sidebar.append(likeBtn, shareBtn);

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

  card.append(bg, video, spinner, overlay, flash, tapHint, info, sidebar, progressBar);
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
    const bg = slot.querySelector('.card-bg');
    if (!data) { v.poster = ''; bg.style.backgroundImage = ''; return; }
    v.src    = data.videoURL;
    v.poster = data.thumbnail || '';
    v.currentTime = 0;
    bg.style.backgroundImage = data.thumbnail ? `url("${data.thumbnail}")` : '';
    // 女優名タップでその女優の動画一覧へ（複数出演時は先頭の女優）
    const actressEl   = slot.querySelector('.card-actress');
    const mainActress = (data.actress || '').split(',')[0].trim();
    actressEl.textContent = data.actress ? '@' + data.actress : '';
    actressEl.href        = mainActress ? '/?q=' + encodeURIComponent(mainActress) : '#';
    slot.querySelector('.card-title').textContent   = data.title;
    slot.querySelector('.cta-buy').href             = data.affiliateURL;
    slot.querySelector('.btn-share')._v             = data;
    const likeBtn = slot.querySelector('.btn-like');
    likeBtn._v = data;
    likeBtn.classList.toggle('liked', favs.has(data.id));
    likeBtn.classList.remove('beat');
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

  // キーボード（PC）: ↑↓ で前後の動画、スペースで再生/一時停止
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea') || document.getElementById('grid').classList.contains('visible')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(-1); }
    else if (e.key === ' ') {
      e.preventDefault();
      dismissTapHint();
      const v = currVideo();
      v.paused ? v.play().catch(() => {}) : v.pause();
    }
  });

  return {
    reset,
    onOverscrollBottom: fn => { overscrollBottom = fn; },
    pauseCurrent:  () => currVideo()?.pause(),
    resumeCurrent: () => currVideo()?.play().catch(() => {}),
  };
}

// ---- Feed Tabs (おすすめ / 新着 / 人気) ----
function initFeedTabs(initial, onChange) {
  const tabs = document.querySelectorAll('.feed-tab');
  const select = name => tabs.forEach(t => t.classList.toggle('active', t.dataset.feed === name));
  select(initial);
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      select(tab.dataset.feed);
      onChange(tab.dataset.feed);
    });
  });
  return select;
}

// ヘッダーの高さ（タブ・絞り込みバー込み）を CSS 変数 --header-h に反映
function watchHeaderHeight() {
  const header = document.querySelector('header');
  const update = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  update();
  new ResizeObserver(update).observe(header);
}

// ---- Search ----
function initSearch(allVideos, resetFeed, pauseCurrent, resumeCurrent, initQuery = '', initGenre = '', defaultFeed = () => shuffle([...allVideos])) {
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
  const headerEl      = document.querySelector('header');
  const filterBar     = document.getElementById('filter-bar');
  const filterLabel   = document.getElementById('filter-label');

  const selectedGenres = new Set();
  let query = '';
  let debounce;

  // 絞り込み中はヘッダーに「〇〇 の動画 N件 / 解除」を出し、タブの選択表示を消す
  const setFilterBar = (text) => {
    filterBar.hidden = text === null;
    headerEl.classList.toggle('filtering', text !== null);
    if (text !== null) filterLabel.textContent = text;
  };

  // 絞り込み結果を動画で見ているとき、ラベルのタップで一覧に戻る
  filterLabel.addEventListener('click', () => {
    if (gridEl.classList.contains('visible')) return;
    pauseCurrent();
    gridEl.classList.add('visible');
  });

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

  // グリッド表示（filterText があればヘッダーに絞り込みバーを出す）
  const showGrid = (videos, { filterText = null, emptyText = '該当する動画がありません' } = {}) => {
    gridEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'grid-container';

    if (videos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = emptyText;
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
    gridEl.scrollTop = 0;
    gridEl.classList.add('visible');
    pauseCurrent();
    setFilterBar(filterText);
  };

  const applyFilter = () => {
    const q = query.trim().toLowerCase();
    const hasFilter = q || selectedGenres.size > 0;
    const filtered = allVideos.filter(v => {
      const matchText = !q ||
        v.title.toLowerCase().includes(q) ||
        (v.actress || '').toLowerCase().includes(q) ||
        (v.genres ?? []).some(g => g.toLowerCase() === q);
      const matchGenre = selectedGenres.size === 0 ||
        (v.genres ?? []).some(g => selectedGenres.has(g));
      return matchText && matchGenre;
    });

    if (hasFilter) {
      const words = q ? [query.trim()] : [...selectedGenres];
      showGrid(filtered, { filterText: `「${words.join('・')}」の動画 ${filtered.length}件` });
    } else {
      gridEl.classList.remove('visible');
      setFilterBar(null);
      resetFeed(defaultFeed());
    }
  };

  // URL パラメータ (?q= / ?genre=) による初期フィルタ
  if (initQuery) {
    query = initQuery;
    input.value = initQuery;
    renderActressChips(allActresses.filter(a => a.toLowerCase().includes(initQuery.toLowerCase())), '候補');
    applyFilter();
  } else if (initGenre && genreCount[initGenre]) {
    selectedGenres.add(initGenre);
    genreEl.querySelectorAll('.suggest-chip').forEach(c => {
      if (c.querySelector('.chip-name')?.textContent === initGenre) c.classList.add('active');
    });
    applyFilter();
  }

  const resetAll = () => {
    input.value = '';
    query = '';
    selectedGenres.clear();
    genreEl.querySelectorAll('.suggest-chip').forEach(c => c.classList.remove('active'));
    renderActressChips(allActresses, '人気女優');
    overlay.classList.remove('open');
    gridEl.classList.remove('visible');
    setFilterBar(null);
    resetFeed(defaultFeed());
  };

  document.getElementById('filter-clear').addEventListener('click', () => {
    // ?q= / ?genre= で開いた場合も URL を元に戻す
    if (location.search) history.replaceState(null, '', location.pathname);
    resetAll();
  });

  btn.addEventListener('click', () => {
    window.location.href = '/search.html';
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

  return {
    clear: resetAll,
    showList: (videos, emptyText) => showGrid(videos, { emptyText }),
  };
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
