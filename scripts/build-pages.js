'use strict';

// SEO 用の静的ページを生成するスクリプト
//   /video/{id}/       作品ごとのページ
//   /actress/{名前}/   女優ごとの作品一覧
//   /genre/{名前}/     ジャンルごとの作品一覧
//   /sitemap.xml       上記すべて + トップ・検索ページ
// 実行: node scripts/build-pages.js（videos.json 更新後に毎回実行する）

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data/videos.json');
const BASE_URL  = 'https://nukidoki.net';
const SITE_NAME = 'ヌキドキ';
const ASSET_V   = '20261027b'; // index.html の ?v= と揃える

// 作品数がこれ未満の女優・ジャンルページは noindex（中身の薄いページを検索結果に出さない）
const MIN_INDEX_VIDEOS = 2;
const RELATED_LIMIT    = 12;
const FOOTER_LIMIT     = 20;

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON-LD 内で </script> を閉じさせない
const jsonLd = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

const splitActress = v => (v.actress || '').split(',').map(s => s.trim()).filter(Boolean);
const dateOnly     = v => (v.date || '').slice(0, 10);
const shorten      = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

const urlOf = {
  video:   id   => `/video/${encodeURIComponent(id)}/`,
  actress: name => `/actress/${encodeURIComponent(name)}/`,
  genre:   name => `/genre/${encodeURIComponent(name)}/`,
};

// ---- 共通パーツ ----

function layout({ title, description, canonical, noindex, ogImage, jsonLds, body }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
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
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
  <meta name="rating" content="adult">
  <link rel="canonical" href="${BASE_URL}${canonical}">
  <link rel="icon" href="/favicon.ico?v=${ASSET_V}" sizes="any">
  <link rel="icon" href="/images/favicon-96.png?v=${ASSET_V}" type="image/png">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png?v=${ASSET_V}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}${canonical}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage || `${BASE_URL}/images/ogp.webp?v=${ASSET_V}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@imanuki_jp">
  ${jsonLds.map(o => `<script type="application/ld+json">${jsonLd(o)}</script>`).join('\n  ')}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap">
  <link rel="stylesheet" href="/pages.css?v=${ASSET_V}">
</head>
<body>
  <header class="site-header">
    <a href="/" class="site-logo"><img src="/images/img_logo.webp?v=${ASSET_V}" alt="${SITE_NAME}" width="96" height="40"></a>
    <a href="/search.html" class="site-search">女優・ジャンルから探す</a>
  </header>
  <main class="page">
${body}
  </main>
  ${footer()}
  <div id="age-gate" class="age-gate" hidden>
    <div class="age-gate-box">
      <img src="/images/img_logo.webp?v=${ASSET_V}" class="age-gate-logo" alt="${SITE_NAME}">
      <p class="age-gate-label">年齢確認</p>
      <p class="age-gate-desc">このサイトは成人向けコンテンツを含みます。<br>あなたは18歳以上ですか？</p>
      <button class="btn-yes" id="btn-yes" type="button">18歳以上・入場する</button>
      <button class="btn-no" id="btn-no" type="button">18歳未満・退場する</button>
    </div>
  </div>
  <script src="/pages.js?v=${ASSET_V}"></script>
</body>
</html>
`;
}

let footerHtml = '';
function footer() { return footerHtml; }

function breadcrumb(items) {
  const html = items.map((it, i) =>
    i === items.length - 1
      ? `<span aria-current="page">${esc(it.name)}</span>`
      : `<a href="${it.url}">${esc(it.name)}</a>`
  ).join('<span class="sep">›</span>');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: BASE_URL + it.url,
    })),
  };
  return { html: `    <nav class="breadcrumb" aria-label="パンくずリスト">${html}</nav>`, ld };
}

function card(v) {
  const actress = splitActress(v).join('、');
  return `<a class="card" href="${urlOf.video(v.id)}">
          <span class="card-thumb"><img src="${esc(v.thumbnail)}" alt="${esc(shorten(v.title, 60))}" loading="lazy" width="300" height="450"></span>
          ${actress ? `<span class="card-actress">${esc(actress)}</span>` : ''}
          <span class="card-title">${esc(v.title)}</span>
        </a>`;
}

const grid = videos => `    <div class="grid">
        ${videos.map(card).join('\n        ')}
    </div>`;

const chips = (items, urlFn) => items.map(([name, count]) =>
  `<a class="chip" href="${urlFn(name)}">${esc(name)}${count != null ? `<span class="chip-count">${count}</span>` : ''}</a>`
).join('\n        ');

// ---- ページごとの生成 ----

function videoPage(v, related) {
  const actresses = splitActress(v);
  const genres    = v.genres ?? [];
  const date      = dateOnly(v);
  const who       = actresses.length ? actresses.join('、') : '';
  const title     = `${shorten(v.title, 48)}${who ? `｜${shorten(who, 20)}` : ''} サンプル動画｜${SITE_NAME}`;
  const description = shorten(
    `${who ? `${who}出演、` : ''}「${v.title}」のサンプル動画を無料で視聴。` +
    `${date ? `${date}配信。` : ''}${genres.length ? `ジャンル: ${genres.slice(0, 5).join('・')}。` : ''}`, 160);
  const crumbs = breadcrumb([
    { name: SITE_NAME, url: '/' },
    ...(actresses[0] ? [{ name: actresses[0], url: urlOf.actress(actresses[0]) }] : []),
    { name: shorten(v.title, 30), url: urlOf.video(v.id) },
  ]);

  const videoLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description,
    thumbnailUrl: [v.thumbnail],
    uploadDate: date ? `${date}T00:00:00+09:00` : undefined,
    contentUrl: v.videoURL,
    embedUrl: `${BASE_URL}/?video=${encodeURIComponent(v.id)}`,
    isFamilyFriendly: false,
    ...(actresses.length ? { actor: actresses.map(name => ({ '@type': 'Person', name, url: BASE_URL + urlOf.actress(name) })) } : {}),
    ...(genres.length ? { genre: genres } : {}),
  };

  const body = `${crumbs.html}
    <article class="video">
      <h1>${esc(v.title)}</h1>
      <div class="player">
        <video controls playsinline preload="none" poster="${esc(v.thumbnail)}" src="${esc(v.videoURL)}"></video>
      </div>
      <div class="actions">
        <a class="btn-cta" href="${esc(v.affiliateURL)}" target="_blank" rel="noopener noreferrer sponsored">FANZAで本編を見る</a>
        <a class="btn-sub" href="/?video=${encodeURIComponent(v.id)}">スワイプで続きを見る</a>
      </div>
      <dl class="meta">
        ${actresses.length ? `<dt>出演</dt><dd>${actresses.map(n => `<a href="${urlOf.actress(n)}">${esc(n)}</a>`).join('、')}</dd>` : ''}
        ${date ? `<dt>配信日</dt><dd><time datetime="${date}">${date.replace(/-/g, '/')}</time></dd>` : ''}
        <dt>品番</dt><dd>${esc(v.id)}</dd>
        ${genres.length ? `<dt>ジャンル</dt><dd class="meta-chips">${genres.map(g => `<a class="chip" href="${urlOf.genre(g)}">${esc(g)}</a>`).join('')}</dd>` : ''}
      </dl>
      <p class="lead">${esc(description)}気に入ったら「FANZAで本編を見る」から本編をチェックできます。</p>
    </article>
    ${related.length ? `<section>
      <h2>${who ? `${esc(shorten(actresses[0], 20))}の他の作品・関連動画` : '関連動画'}</h2>
  ${grid(related)}
    </section>` : ''}`;

  return layout({
    title, description, canonical: urlOf.video(v.id), noindex: false,
    ogImage: v.thumbnail, jsonLds: [videoLd, crumbs.ld], body,
  });
}

function listPage({ kind, name, videos, intro, otherLinks }) {
  const n = videos.length;
  const label = kind === 'actress' ? '女優' : 'ジャンル';
  const title = kind === 'actress'
    ? `${name}のサンプル動画一覧（${n}本）｜${SITE_NAME}`
    : `${name}のAVサンプル動画一覧（${n}本）｜${SITE_NAME}`;
  const latest = videos[0];
  const description = shorten(
    `${kind === 'actress' ? `${name}出演` : `「${name}」ジャンル`}のFANZA作品サンプル動画を${n}本掲載。` +
    `最新は「${latest.title}」。TikTokのようにスワイプで次々に無料視聴できます。`, 160);
  const canonical = urlOf[kind](name);
  const crumbs = breadcrumb([
    { name: SITE_NAME, url: '/' },
    { name: `${label}から探す`, url: '/search.html' },
    { name, url: canonical },
  ]);
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: n,
    itemListElement: videos.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: BASE_URL + urlOf.video(v.id), name: v.title })),
  };

  const body = `${crumbs.html}
    <h1>${esc(name)}の${kind === 'genre' ? 'AV' : ''}サンプル動画一覧<span class="h1-count">${n}本</span></h1>
    <p class="lead">${esc(intro)}</p>
    <div class="actions">
      <a class="btn-cta" href="/?q=${encodeURIComponent(name)}">${esc(shorten(name, 16))}の動画をスワイプで見る</a>
    </div>
${grid(videos)}
    ${otherLinks}`;

  return layout({
    title, description, canonical, noindex: n < MIN_INDEX_VIDEOS,
    ogImage: latest.thumbnail, jsonLds: [itemList, crumbs.ld], body,
  });
}

// ---- メイン ----

function writePage(urlPath, html) {
  const dir = path.join(ROOT, decodeURIComponent(urlPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function main() {
  const { videos: allVideos = [], updated } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // 再生できる動画のみ、新しい順
  const videos = allVideos.filter(v => v.videoURL).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const byActress = new Map();
  const byGenre   = new Map();
  for (const v of videos) {
    for (const a of splitActress(v)) (byActress.get(a) ?? byActress.set(a, []).get(a)).push(v);
    for (const g of v.genres ?? []) (byGenre.get(g) ?? byGenre.set(g, []).get(g)).push(v);
  }
  const sortByCount = m => [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => [k, list.length]);
  const actressRank = sortByCount(byActress);
  const genreRank   = sortByCount(byGenre);

  // 全ページ共通のフッター（人気女優・ジャンルへの内部リンク）
  footerHtml = `<footer class="site-footer">
    <h2>人気の女優</h2>
    <div class="chips">
        ${chips(actressRank.slice(0, FOOTER_LIMIT), urlOf.actress)}
    </div>
    <h2>人気のジャンル</h2>
    <div class="chips">
        ${chips(genreRank.slice(0, FOOTER_LIMIT), urlOf.genre)}
    </div>
    <p class="footer-note">当サイトは18歳未満の方の閲覧を固く禁じます。掲載動画はFANZA（DMM）の公式サンプル動画です。<br>© ${SITE_NAME}</p>
  </footer>`;

  // 前回生成分を削除（掲載が終わった作品・女優のページを残さない）
  for (const dir of ['video', 'actress', 'genre']) {
    fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  }

  const sitemap = [
    { loc: '/', lastmod: updated, priority: '1.0' },
    { loc: '/search.html', lastmod: updated, priority: '0.8' },
  ];

  // 作品ページ: 同じ女優 → 同じジャンルの多い順で関連動画を選ぶ
  for (const v of videos) {
    const sameActress = splitActress(v).flatMap(a => byActress.get(a));
    const genreSet    = new Set(v.genres ?? []);
    const byOverlap   = videos
      .map(o => [o, (o.genres ?? []).filter(g => genreSet.has(g)).length])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([o]) => o);
    const related = [...new Set([...sameActress, ...byOverlap])].filter(o => o.id !== v.id).slice(0, RELATED_LIMIT);
    writePage(urlOf.video(v.id), videoPage(v, related));
    sitemap.push({ loc: urlOf.video(v.id), lastmod: dateOnly(v), priority: '0.6' });
  }

  for (const [kind, map] of [['actress', byActress], ['genre', byGenre]]) {
    for (const [name, list] of map) {
      const genresOf = kind === 'actress'
        ? sortByCount(list.reduce((m, v) => { (v.genres ?? []).forEach(g => m.set(g, [...(m.get(g) ?? []), v])); return m; }, new Map())).slice(0, 5).map(([g]) => g)
        : [];
      const coActors = kind === 'genre'
        ? sortByCount(list.reduce((m, v) => { splitActress(v).forEach(a => m.set(a, [...(m.get(a) ?? []), v])); return m; }, new Map())).slice(0, 5).map(([a]) => a)
        : [];
      const intro = kind === 'actress'
        ? `${name}が出演するFANZA作品のサンプル動画を${list.length}本まとめました。` +
          `${genresOf.length ? `出演作に多いジャンルは${genresOf.join('・')}。` : ''}新しい作品から順に並んでいます。`
        : `「${name}」ジャンルのFANZA作品サンプル動画を${list.length}本まとめました。` +
          `${coActors.length ? `${coActors.join('・')}などが出演しています。` : ''}新しい作品から順に並んでいます。`;

      const others = kind === 'actress' ? genresOf.map(g => [g, null]) : coActors.map(a => [a, null]);
      const otherLinks = others.length ? `<section>
      <h2>${kind === 'actress' ? `${esc(name)}の出演作に多いジャンル` : `「${esc(name)}」によく出演する女優`}</h2>
      <div class="chips">
        ${chips(others, kind === 'actress' ? urlOf.genre : urlOf.actress)}
      </div>
    </section>` : '';

      writePage(urlOf[kind](name), listPage({ kind, name, videos: list, intro, otherLinks }));
      if (list.length >= MIN_INDEX_VIDEOS) {
        sitemap.push({ loc: urlOf[kind](name), lastmod: dateOnly(list[0]), priority: kind === 'actress' ? '0.7' : '0.6' });
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map(u => `  <url>
    <loc>${BASE_URL}${esc(u.loc)}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');

  console.log(`[pages] 作品 ${videos.length} / 女優 ${byActress.size} / ジャンル ${byGenre.size} ページを生成（サイトマップ ${sitemap.length} URL）`);
}

main();
