'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '../data/videos.json');
const OUT_PATH  = path.resolve(__dirname, '../search.html');
const BASE_URL  = 'https://nukidoki.net';

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

  const { videos: allVideos = [] } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // 再生できる動画だけで数える（タップしても 0 件になるチップを出さない）
  const videos = allVideos.filter(v => v.videoURL);

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

  const CHIP_LIMIT = 30;
  const extra = i => (i >= CHIP_LIMIT ? ' extra-chip' : '');

  const actressChips = actresses.map(([name, count], i) =>
    `<a href="/actress/${encodeURIComponent(name)}/" class="chip${extra(i)}" data-type="actress" data-value="${esc(name)}">` +
    `<span class="chip-name">${esc(name)}</span>` +
    `<span class="chip-count">${count}</span>` +
    `</a>`
  ).join('\n        ');

  const genreChips = genres.map(([name, count], i) =>
    `<a href="/genre/${encodeURIComponent(name)}/" class="chip${extra(i)}" data-type="genre" data-value="${esc(name)}">` +
    `<span class="chip-name">${esc(name)}</span>` +
    `<span class="chip-count">${count}</span>` +
    `</a>`
  ).join('\n        ');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-RB9QNYGPW4"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-RB9QNYGPW4');
  </script>

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0e0a12">
  <title>女優・ジャンル検索 | ヌキドキ</title>
  <meta name="description" content="FANZAの人気AV女優・ジャンル一覧。ヌキドキでTikTok感覚のスワイプ動画を楽しもう。">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${BASE_URL}/search.html">
  <link rel="alternate" type="application/rss+xml" title="ヌキドキ 新着" href="/feed.xml">
  <link rel="icon" href="/favicon.ico?v=20261104d" sizes="any">
  <link rel="icon" href="/images/favicon-96.png?v=20261104d" type="image/png">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v=20261104d">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}/search.html">
  <meta property="og:title" content="女優・ジャンル検索 | ヌキドキ">
  <meta property="og:description" content="FANZAの人気AV女優・ジャンル一覧。">
  <meta property="og:image" content="${BASE_URL}/images/ogp.webp?v=20261104d">
  <meta name="rating" content="adult">
  <meta name="rating" content="RTA-5042-1996-1400-1577-RTA">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "${BASE_URL}/search.html",
        "url": "${BASE_URL}/search.html",
        "name": "女優・ジャンル検索 | ヌキドキ",
        "description": "FANZAの人気AV女優・ジャンル一覧。ヌキドキでTikTok感覚のスワイプ動画を楽しもう。",
        "inLanguage": "ja",
        "isPartOf": { "@id": "${BASE_URL}/#website" }
      },
      {
        "@type": "WebSite",
        "@id": "${BASE_URL}/#website",
        "url": "${BASE_URL}/",
        "name": "ヌキドキ",
        "inLanguage": "ja"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "ヌキドキ",
            "item": "${BASE_URL}/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "女優・ジャンル検索",
            "item": "${BASE_URL}/search.html"
          }
        ]
      },
      {
        "@type": "ItemList",
        "name": "人気AV女優一覧",
        "numberOfItems": ${actresses.length},
        "itemListElement": [
          ${actresses.slice(0, 50).map(([name], i) =>
            `{"@type":"ListItem","position":${i + 1},"name":"${name.replace(/"/g, '\\"')}","url":"${BASE_URL}/actress/${encodeURIComponent(name)}/"}`
          ).join(',\n          ')}
        ]
      }
    ]
  }
  </script>

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root { --accent: #ff2d78; --accent-grad: linear-gradient(135deg, #ff2d78 0%, #ff8a3d 100%); }
    button, input { font-family: inherit; }
    html { scroll-padding-top: calc(var(--header-h, 70px) + 16px); }
    body {
      background: #0e0a12;
      color: #fff;
      font-family: 'Zen Maru Gothic', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
      min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }

    /* Header */
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(14,10,18,0.94);
      backdrop-filter: blur(12px);
      padding: 16px max(16px, calc((100% - 600px) / 2 + 16px));
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
      padding: 10px 12px;
      color: #fff;
      font-size: 16px;
      outline: none;
      min-width: 0;
    }
    .search-form input::placeholder { color: rgba(255,255,255,0.28); }
    .search-form button {
      background: var(--accent-grad);
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

    /* Accordion */
    .accordion {
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      overflow: hidden;
      overflow: clip;
      scroll-margin-top: 44px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.02);
    }
    .accordion-header {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 15px 16px;
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
      user-select: none;
    }
    .accordion-header:hover { background: rgba(255,255,255,0.04); }
    .accordion-header:active { background: rgba(255,255,255,0.08); }
    .accordion-label {
      font-size: 14px;
      font-weight: 700;
      flex: 1;
      letter-spacing: 0.01em;
    }
    .accordion-badge {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255,255,255,0.45);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 2px 9px;
      flex-shrink: 0;
      transition: background 0.2s, color 0.2s;
    }
    .accordion.open .accordion-badge {
      background: rgba(255,45,120,0.18);
      border-color: rgba(255,45,120,0.35);
      color: #ff7aa8;
    }
    .accordion-chevron {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: rgba(255,255,255,0.35);
      transition: transform 0.3s ease, color 0.2s;
    }
    .accordion.open .accordion-chevron {
      transform: rotate(180deg);
      color: rgba(255,255,255,0.65);
    }
    .accordion-body {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.3s ease, border-color 0.3s;
      border-top: 1px solid transparent;
    }
    .accordion.open .accordion-body {
      grid-template-rows: 1fr;
      border-top-color: rgba(255,255,255,0.07);
    }
    .accordion-inner {
      min-height: 0;
      overflow: hidden;
      overflow: clip;
    }

    /* Chips */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px;
      transition: padding 0.3s ease;
    }
    .accordion.open .chips { padding: 14px 16px 16px; }
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
    .pr-notice { margin-bottom: 12px; font-size: 12px; color: rgba(255,255,255,0.5); }
    .ad-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 24px auto; }
    .ad-slot-label { font-size: 11px; color: rgba(255,255,255,0.6); }
    .ad-slot iframe { display: block; width: 300px; height: 250px; border: 0; }
    .quick-links { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .quick-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 10px;
      border: 1px solid rgba(255,45,120,0.5);
      border-radius: 12px;
      background: rgba(255,45,120,0.1);
      font-size: 14px;
      font-weight: 700;
      transition: background 0.15s;
    }
    .quick-link:hover { background: rgba(255,45,120,0.2); }
    .quick-link svg { color: var(--accent); }
    .chip:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.22); }
    .chip.active { background: var(--accent); border-color: var(--accent); }
    .chip.active .chip-count { border-left-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
    .chip.hidden-chip,
    .accordion:not(.expanded) .chip.extra-chip { display: none; }
    body.searching .chip.extra-chip:not(.hidden-chip) { display: inline-flex; }
    body.searching .more-btn { display: none; }
    .chip-name { padding: 8px 7px 8px 13px; font-size: 13px; font-weight: 500; }
    .more-btn {
      display: block;
      width: calc(100% - 32px);
      margin: 0 16px 16px;
      padding: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: rgba(255,255,255,0.8);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .more-btn:hover { background: rgba(255,255,255,0.12); }
    .accordion.expanded .more-btn,
    .accordion:not(.open) .more-btn,
    .more-btn[hidden] { display: none; }
    .close-btn {
      display: none;
      position: sticky;
      bottom: 12px;
      z-index: 2;
      width: calc(100% - 32px);
      margin: 0 16px 16px;
      padding: 12px;
      border: none;
      border-radius: 24px;
      background: var(--accent-grad);
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .accordion.open.expanded .close-btn,
    body.searching .accordion.open .close-btn { display: block; }
    .chip-count {
      padding: 8px 11px 8px 6px;
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.36);
      border-left: 1px solid rgba(255,255,255,0.1);
    }

    /* Results */
    #results { margin: 8px 0 24px; min-height: 100vh; scroll-margin-top: 44px; }
    .results-header {
      position: sticky;
      top: var(--header-h, 70px);
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      padding: 10px 0;
      background: #0e0a12;
    }
    .results-label {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.75);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .results-count {
      flex-shrink: 0;
      font-size: 12px;
      color: rgba(255,255,255,0.55);
    }
    .results-clear {
      flex-shrink: 0;
      padding: 4px 12px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 14px;
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .results-header[hidden], .results-clear[hidden], .ad-slot[hidden] { display: none; }
    .page-top {
      position: fixed;
      right: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom));
      z-index: 9;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      background: rgba(14,10,18,0.88);
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s, visibility 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .page-top.visible { opacity: 1; visibility: visible; transform: none; }
    /* 画面下の「閉じる」と重ならないよう上へずらす */
    body:has(.accordion.open.expanded) .page-top,
    body.searching:has(.accordion.open) .page-top { bottom: calc(76px + env(safe-area-inset-bottom)); }
    #results-more { height: 1px; }
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .result-item {
      display: block;
      border-radius: 8px;
      overflow: hidden;
      background: #1a1320;
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
      object-position: right center; /* サムネイル右半分がパッケージ表面 */
      display: block;
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
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .result-title {
      font-size: 11px;
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
      <img src="images/img_logo.webp?v=20261104d" alt="ヌキドキ">
    </a>
    <form class="search-form" id="search-form" action="/" method="get">
      <input type="search" id="search-input" name="q" placeholder="女優・作品名で検索" autocomplete="off" autocorrect="off" autocapitalize="off">
      <button type="submit">検索</button>
    </form>
  </header>

  <main>
    <p class="pr-notice">※本ページはプロモーション（アフィリエイト広告）を含みます ／ <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener">Powered by FANZA Webサービス</a></p>
    <a href="/" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      動画に戻る
    </a>

    <nav class="quick-links" aria-label="ランキング・新着">
      <a href="/ranking/" class="quick-link">人気ランキング<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></a>
      <a href="/new/" class="quick-link">新着作品<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></a>
    </nav>

    <div class="results-header" id="results-header" hidden>
      <span class="results-label" id="results-label"></span>
      <span class="results-count" id="results-count"></span>
      <button class="results-clear" id="results-clear" type="button" hidden>解除</button>
    </div>

    <section class="accordion" id="actress-accordion">
      <button class="accordion-header" aria-expanded="false" aria-controls="actress-body">
        <span class="accordion-label">人気女優</span>
        <span class="accordion-badge">${actresses.length}人</span>
        <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="accordion-body" id="actress-body" role="region">
        <div class="accordion-inner">
          <div class="chips" id="actress-chips">
            ${actressChips}
          </div>
          ${actresses.length > CHIP_LIMIT ? `<button class="more-btn" type="button">すべて表示（${actresses.length}人）</button>` : ''}
          <button class="close-btn" type="button">閉じる</button>
        </div>
      </div>
    </section>

    ${genres.length > 0 ? `<section class="accordion" id="genre-accordion">
      <button class="accordion-header" aria-expanded="false" aria-controls="genre-body">
        <span class="accordion-label">ジャンル</span>
        <span class="accordion-badge">${genres.length}種</span>
        <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="accordion-body" id="genre-body" role="region">
        <div class="accordion-inner">
          <div class="chips" id="genre-chips">
            ${genreChips}
          </div>
          ${genres.length > CHIP_LIMIT ? `<button class="more-btn" type="button">すべて表示（${genres.length}種）</button>` : ''}
          <button class="close-btn" type="button">閉じる</button>
        </div>
      </div>
    </section>` : ''}

    <section id="results" hidden>
      <div class="results-grid" id="results-grid"></div>
      <aside class="ad-slot" id="results-ad" aria-label="広告">
        <span class="ad-slot-label">広告</span>
        <iframe src="/ad/admax.html" width="300" height="250" loading="lazy" scrolling="no" title="広告" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
      </aside>
      <div class="results-grid" id="results-rest"></div>
      <div id="results-more"></div>
    </section>
  </main>

  <button class="page-top" id="page-top" type="button" aria-label="ページの先頭へ">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
  </button>

  <script>
  (async () => {
    const header = document.querySelector('header');
    const updateHeaderH = () =>
      document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    updateHeaderH();
    new ResizeObserver(updateHeaderH).observe(header);

    // ページトップボタン: スクロールしたら出す
    const pageTop = document.getElementById('page-top');
    const syncPageTop = () => pageTop.classList.toggle('visible', scrollY > 400);
    addEventListener('scroll', syncPageTop, { passive: true });
    syncPageTop();
    pageTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

    let allVideos = [];
    try {
      const res  = await fetch('/data/videos.json');
      const data = await res.json();
      allVideos  = (data.videos ?? []).filter(v => v.videoURL);
    } catch (e) {
      console.warn('[search] Failed to load videos.json', e);
    }

    if (!allVideos.length) return; // 読み込めないときはチップのリンクと /?q= の検索をそのまま使う

    const resultsSection = document.getElementById('results');
    const resultsHeader  = document.getElementById('results-header');
    const resultsGrid    = document.getElementById('results-grid');
    const resultsRest    = document.getElementById('results-rest');
    const resultsAd      = document.getElementById('results-ad');
    const resultsLabel   = document.getElementById('results-label');
    const resultsCount   = document.getElementById('results-count');
    const resultsClear   = document.getElementById('results-clear');
    const resultsMore    = document.getElementById('results-more');
    const searchForm     = document.getElementById('search-form');
    const searchInput    = document.getElementById('search-input');
    const chips          = [...document.querySelectorAll('.chip[data-type]')];
    const activeChips    = new Set();
    const PAGE = 60;     // 一度に描画する本数。残りはスクロールで読み足す
    const AD_AFTER = 12; // 広告を挟む位置（作品数）
    const CHIP_LIMIT = ${CHIP_LIMIT}; // 「すべて表示」を押す前に見せるチップの数

    // 全角・半角、大文字・小文字、カタカナ・ひらがなの違いを無視して比べる
    const norm = s => String(s || '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    const actressesOf = v => (v.actress || '').split(',').map(s => s.trim());
    const searchText = new Map(allVideos.map(v => [v, norm([v.title, v.actress, ...(v.genres ?? [])].join(' '))]));
    chips.forEach(chip => {
      chip._norm    = norm(chip.dataset.value);
      chip._countEl = chip.querySelector('.chip-count');
    });

    // 女優・ジャンルの欄ごとに、見出しの数と「すべて表示」を更新するための情報
    const chipGroups = [['actress', '人'], ['genre', '種']].map(([type, unit]) => {
      const accordion = document.getElementById(type + '-accordion');
      return {
        type, unit,
        chips: chips.filter(c => c.dataset.type === type),
        badge: accordion?.querySelector('.accordion-badge'),
        more:  accordion?.querySelector('.more-btn'),
      };
    });

    let current = [];
    let shown   = 0;

    function createItem(v) {
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
      return a;
    }

    function renderMore() {
      current.slice(shown, shown + PAGE).forEach((v, i) =>
        (shown + i < AD_AFTER ? resultsGrid : resultsRest).appendChild(createItem(v)));
      shown = Math.min(shown + PAGE, current.length);
    }

    // 監視し直すと、終端が見えたままでも次の判定が来る
    const moreObserver = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting) || shown >= current.length) return;
      renderMore();
      moreObserver.unobserve(resultsMore);
      moreObserver.observe(resultsMore);
    }, { rootMargin: '600px' });

    // チップの数字を今の絞り込み結果での本数にし、0 本のチップは隠す
    function updateChips(words) {
      const counts = new Map();
      const bump = key => counts.set(key, (counts.get(key) ?? 0) + 1);
      current.forEach(v => {
        actressesOf(v).forEach(a => bump('actress|' + a));
        (v.genres ?? []).forEach(g => bump('genre|' + g));
      });

      document.body.classList.toggle('searching', words.length > 0);
      chipGroups.forEach(group => {
        // 入力に合うチップがある欄だけ候補に絞る（女優名を入れたとき、ジャンル欄はその女優のジャンルを出す）
        const hits = chip => words.some(w => chip._norm.includes(w));
        const narrow = group.chips.some(hits);
        const onlyActive = group.type === 'actress' && group.chips.some(c => activeChips.has(c));
        let visible = 0;
        group.chips.forEach(chip => {
          const n = counts.get(group.type + '|' + chip.dataset.value) ?? 0;
          const show = activeChips.has(chip) || (!onlyActive && n > 0 && (!narrow || hits(chip)));
          chip._countEl.textContent = n;
          chip.classList.toggle('hidden-chip', !show);
          chip.classList.toggle('extra-chip', show && visible >= CHIP_LIMIT);
          if (show) visible++;
        });
        if (group.badge) group.badge.textContent = visible + group.unit;
        if (group.more) {
          group.more.hidden = visible <= CHIP_LIMIT;
          group.more.textContent = 'すべて表示（' + visible + group.unit + '）';
        }
      });
    }

    // 検索語とチップをすべて満たす作品に絞り、一覧を描き直す
    function update() {
      const words = norm(searchInput.value).split(/\s+/).filter(Boolean);
      const picked = [...activeChips];

      current = allVideos.filter(v =>
        words.every(w => searchText.get(v).includes(w)) &&
        picked.every(c => c.dataset.type === 'actress'
          ? actressesOf(v).includes(c.dataset.value)
          : (v.genres ?? []).includes(c.dataset.value)));

      const labels = [searchInput.value.trim(), ...picked.map(c => c.dataset.value)].filter(Boolean);
      resultsLabel.textContent = labels.length ? labels.join(' × ') : 'すべての作品';
      resultsCount.textContent = current.length + '件';
      resultsClear.hidden = labels.length === 0;

      updateChips(words);

      resultsGrid.innerHTML = '';
      resultsRest.innerHTML = '';
      resultsAd.hidden = current.length <= AD_AFTER;
      shown = 0;
      if (current.length === 0) {
        const p = document.createElement('p');
        p.className   = 'no-results';
        p.textContent = '該当する動画がありません';
        resultsGrid.appendChild(p);
      } else {
        renderMore();
      }
      moreObserver.unobserve(resultsMore);
      moreObserver.observe(resultsMore);

      // 作品を開いて戻ったときに同じ絞り込みへ戻れるよう、URL に残す
      const params = new URLSearchParams();
      if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
      picked.forEach(c => params.append(c.dataset.type, c.dataset.value));
      const qs = params.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    // アコーディオン開閉
    document.querySelectorAll('.accordion-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const accordion = btn.closest('.accordion');
        const isOpen    = accordion.classList.contains('open');
        accordion.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });

    // すべて表示
    document.querySelectorAll('.more-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.accordion').classList.add('expanded'));
    });

    // 閉じる: 長い一覧を畳んで、その欄の見出しまで戻る
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const accordion = btn.closest('.accordion');
        accordion.classList.remove('open', 'expanded');
        accordion.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
        accordion.scrollIntoView({ block: 'start' });
      });
    });

    // ジャンルは複数選べる。女優は 1 人だけで、別の人を選ぶと入れ替わる
    chips.forEach(chip => {
      chip.addEventListener('click', e => {
        e.preventDefault();
        const on = !activeChips.has(chip);
        if (on && chip.dataset.type === 'actress') {
          activeChips.forEach(c => {
            if (c.dataset.type !== 'actress') return;
            activeChips.delete(c);
            c.classList.remove('active');
          });
        }
        on ? activeChips.add(chip) : activeChips.delete(chip);
        chip.classList.toggle('active', on);
        update();
      });
    });

    // スマホはキーボードで画面が狭いので、入力を始めたら一覧を検索欄のすぐ下まで上げる
    searchInput.addEventListener('input', () => {
      update();
      if (searchInput.value.trim() && resultsSection.getBoundingClientRect().top > innerHeight * 0.3) {
        resultsSection.scrollIntoView({ block: 'start' });
      }
    });

    // 入力のたびに絞り込むので、検索ボタンはキーボードを閉じて一覧へ移動するだけ
    searchForm.addEventListener('submit', e => {
      e.preventDefault();
      searchInput.blur();
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    resultsClear.addEventListener('click', () => {
      searchInput.value = '';
      activeChips.forEach(c => c.classList.remove('active'));
      activeChips.clear();
      update();
    });

    // URL の絞り込みを復元する
    const initial = new URLSearchParams(location.search);
    searchInput.value = initial.get('q') ?? '';
    chips.forEach(chip => {
      const wanted = chip.dataset.type === 'actress' ? [initial.get('actress')] : initial.getAll('genre');
      if (!wanted.includes(chip.dataset.value)) return;
      activeChips.add(chip);
      chip.classList.add('active');
    });

    resultsHeader.hidden  = false;
    resultsSection.hidden = false;
    update();
  })();
  </script>
</body>
</html>`;

  fs.writeFileSync(OUT_PATH, html, 'utf8');
  console.log(`[build] search.html を生成しました（女優 ${actresses.length}人 / ジャンル ${genres.length}種）`);
}

main();
