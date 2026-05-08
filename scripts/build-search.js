'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '../data/videos.json');
const OUT_PATH  = path.resolve(__dirname, '../search.html');
const BASE_URL  = 'https://imanuki.vercel.app';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('[build] videos.json が見つかりません');
    process.exit(1);
  }

  const { videos = [] } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  // 女優: 出演本数でソート
  const actressCount = {};
  videos.forEach(v => {
    (v.actress || '').split(',').map(s => s.trim()).filter(Boolean).forEach(a => {
      actressCount[a] = (actressCount[a] || 0) + 1;
    });
  });
  const actresses = Object.entries(actressCount).sort((a, b) => b[1] - a[1]);

  // ジャンル: 本数でソート
  const genreCount = {};
  videos.forEach(v => {
    (v.genres ?? []).forEach(g => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  const genres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);

  const actressChips = actresses.map(([name, count]) =>
    `<a href="/?q=${encodeURIComponent(name)}" class="chip" data-type="actress" data-value="${esc(name)}">` +
    `<span class="chip-name">${esc(name)}</span>` +
    `<span class="chip-count">${count}</span>` +
    `</a>`
  ).join('\n        ');

  const genreChips = genres.map(([name, count]) =>
    `<a href="/?q=${encodeURIComponent(name)}" class="chip" data-type="genre" data-value="${esc(name)}">` +
    `<span class="chip-name">${esc(name)}</span>` +
    `<span class="chip-count">${count}</span>` +
    `</a>`
  ).join('\n        ');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0d0d0d">
  <title>女優・ジャンル検索 | いまぬきっ！</title>
  <meta name="description" content="FANZAの人気AV女優・ジャンル一覧。いまぬきっ！でTikTok感覚のスワイプ動画を楽しもう。">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${BASE_URL}/search.html">
  <link rel="icon" href="favicon.ico" type="image/x-icon">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}/search.html">
  <meta property="og:title" content="女優・ジャンル検索 | いまぬきっ！">
  <meta property="og:description" content="FANZAの人気AV女優・ジャンル一覧。">
  <meta property="og:image" content="${BASE_URL}/images/ogp.webp">
  <meta name="rating" content="adult">
  <meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: #ff4757; }
    body {
      background: #0d0d0d;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
      min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }

    /* Header */
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(13,13,13,0.96);
      backdrop-filter: blur(12px);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .logo img { height: 30px; width: auto; display: block; }
    .search-form {
      flex: 1;
      display: flex;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      overflow: hidden;
    }
    .search-form input {
      flex: 1;
      background: none;
      border: none;
      padding: 9px 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
      min-width: 0;
    }
    .search-form input::placeholder { color: rgba(255,255,255,0.28); }
    .search-form button {
      background: var(--accent);
      border: none;
      padding: 0 14px;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }

    /* Main */
    main { max-width: 600px; margin: 0 auto; padding: 20px 16px 0; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 28px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 7px 14px 7px 10px;
      transition: background 0.15s;
    }
    .back-link:hover { background: rgba(255,255,255,0.14); }

    /* Section */
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
      margin-bottom: 12px;
    }

    /* Chips */
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      cursor: pointer;
    }
    .chip:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.22); }
    .chip.active { background: var(--accent); border-color: var(--accent); }
    .chip.active .chip-count { border-left-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
    .chip.hidden-chip { display: none; }
    .chip-name { padding: 6px 7px 6px 12px; font-size: 12px; font-weight: 500; }
    .chip-count {
      padding: 6px 10px 6px 6px;
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.36);
      border-left: 1px solid rgba(255,255,255,0.1);
    }

    /* Results */
    #results { margin: 8px 0 24px; }
    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .results-label {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.75);
    }
    .results-count {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
    }
    .results-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .result-item {
      display: block;
      border-radius: 8px;
      overflow: hidden;
      background: #1a1a1a;
      position: relative;
      aspect-ratio: 2/3;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.15s;
    }
    .result-item:active { transform: scale(0.97); }
    .result-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .result-item::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,0.5);
      border: 0;
    }
    .play-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .play-icon::after {
      content: '';
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 7px 0 7px 13px;
      border-color: transparent transparent transparent #fff;
      margin-left: 2px;
    }
    .result-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 24px 8px 8px;
      background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%);
    }
    .result-actress {
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .result-title {
      font-size: 9px;
      color: rgba(255,255,255,0.7);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }
    .no-results {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px 0;
      color: rgba(255,255,255,0.35);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <img src="images/img_logo.webp" alt="いまぬきっ！">
    </a>
    <form class="search-form" id="search-form" action="/" method="get">
      <input type="search" id="search-input" name="q" placeholder="女優名・タイトルで検索" autocomplete="off" autocorrect="off" autocapitalize="off">
      <button type="submit">検索</button>
    </form>
  </header>

  <main>
    <a href="/" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      動画に戻る
    </a>

    <section class="section">
      <p class="section-title">人気女優 （${actresses.length}人）</p>
      <div class="chips" id="actress-chips">
        ${actressChips}
      </div>
    </section>

    ${genres.length > 0 ? `<section class="section">
      <p class="section-title">ジャンル （${genres.length}種）</p>
      <div class="chips" id="genre-chips">
        ${genreChips}
      </div>
    </section>` : ''}

    <section id="results" hidden>
      <div class="results-header">
        <span class="results-label" id="results-label"></span>
        <span class="results-count" id="results-count"></span>
      </div>
      <div class="results-grid" id="results-grid"></div>
    </section>
  </main>

  <script>
  (async () => {
    let allVideos = [];
    try {
      const res  = await fetch('/data/videos.json');
      const data = await res.json();
      allVideos  = (data.videos ?? []).filter(v => v.videoURL);
    } catch (e) {
      console.warn('[search] Failed to load videos.json', e);
    }

    const resultsSection = document.getElementById('results');
    const resultsGrid    = document.getElementById('results-grid');
    const resultsLabel   = document.getElementById('results-label');
    const resultsCount   = document.getElementById('results-count');
    const searchInput    = document.getElementById('search-input');
    let activeChip = null;

    function showResults(videos, label) {
      resultsLabel.textContent = label;
      resultsCount.textContent = videos.length + '件';
      resultsGrid.innerHTML    = '';

      if (videos.length === 0) {
        const p = document.createElement('p');
        p.className   = 'no-results';
        p.textContent = '該当する動画がありません';
        resultsGrid.appendChild(p);
      } else {
        videos.forEach(v => {
          const a = document.createElement('a');
          a.href      = '/?video=' + encodeURIComponent(v.id);
          a.className = 'result-item';

          if (v.thumbnail) {
            const img = document.createElement('img');
            img.src     = v.thumbnail;
            img.alt     = v.title;
            img.loading = 'lazy';
            a.appendChild(img);
          }

          const playEl = document.createElement('div');
          playEl.className = 'play-icon';
          a.appendChild(playEl);

          const info = document.createElement('div');
          info.className = 'result-info';
          if (v.actress) {
            const d = document.createElement('div');
            d.className   = 'result-actress';
            d.textContent = v.actress;
            info.appendChild(d);
          }
          const t = document.createElement('div');
          t.className   = 'result-title';
          t.textContent = v.title;
          info.appendChild(t);
          a.appendChild(info);

          resultsGrid.appendChild(a);
        });
      }

      resultsSection.hidden = false;
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // チップクリック → インライン結果表示
    document.querySelectorAll('.chip[data-type]').forEach(chip => {
      chip.addEventListener('click', e => {
        if (!allVideos.length) return;
        e.preventDefault();

        if (activeChip === chip) {
          chip.classList.remove('active');
          activeChip = null;
          resultsSection.hidden = true;
          return;
        }

        if (activeChip) activeChip.classList.remove('active');
        chip.classList.add('active');
        activeChip = chip;

        const type  = chip.dataset.type;
        const value = chip.dataset.value;

        const filtered = allVideos.filter(v =>
          type === 'actress'
            ? (v.actress || '').split(',').map(s => s.trim()).includes(value)
            : (v.genres ?? []).includes(value)
        );

        showResults(filtered, value);
      });
    });

    // 検索入力でチップを絞り込む（フォーム送信はそのまま /?q= へ）
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('.chip[data-type]').forEach(chip => {
        const match = chip.dataset.value.toLowerCase().includes(q);
        chip.classList.toggle('hidden-chip', q !== '' && !match);
      });
      // アクティブチップが隠れたらリセット
      if (activeChip && activeChip.classList.contains('hidden-chip')) {
        activeChip.classList.remove('active');
        activeChip = null;
        resultsSection.hidden = true;
      }
    });
  })();
  </script>
</body>
</html>`;

  fs.writeFileSync(OUT_PATH, html, 'utf8');
  console.log(`[build] search.html を生成しました（女優 ${actresses.length}人 / ジャンル ${genres.length}種）`);
}

main();
