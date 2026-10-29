'use strict';

// SEO 用の静的ページを生成するスクリプト
//   /video/{id}/       作品ごとのページ
//   /actress/{名前}/   女優ごとの作品一覧
//   /genre/{名前}/     ジャンルごとの作品一覧
//   /ranking/          人気ランキング（FANZA の売上順）
//   /new/              新着作品（FANZA の配信日順）
//   /sitemap.xml       上記すべて + トップ・検索ページ
//   index.html         メニュー内の人気女優・ジャンルのリンクを書き換える
// 実行: node scripts/build-pages.js（videos.json 更新後に毎回実行する）

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data/videos.json');
const BASE_URL  = 'https://nukidoki.net';
const SITE_NAME = 'ヌキドキ';
const ASSET_V   = '20261029b'; // index.html の ?v= と揃える

// 作品数がこれ未満の女優・ジャンルページは noindex（中身の薄いページを検索結果に出さない）
const MIN_INDEX_VIDEOS = 2;
const RELATED_LIMIT    = 12;
const FOOTER_LIMIT     = 20;
const RANKING_LIMIT    = 50;
const NEW_LIMIT        = 60;
const MENU_LIMIT       = 12;

// ほぼ全作品に付いていて作品の特徴を表さないジャンル（紹介文や類似作品の判定には使わない）
const GENERIC_GENRES = new Set(['ハイビジョン', '4K', '独占配信', '単体作品', '4時間以上作品', 'セット商品', 'デジモ', '配信限定']);
const isTopical = g => !GENERIC_GENRES.has(g);

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
  <meta name="twitter:site" content="@nukidoki_jp">
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

function card(v, rank) {
  const actress = splitActress(v).join('、');
  return `<a class="card" href="${urlOf.video(v.id)}">
          <span class="card-thumb">${rank ? `<span class="card-rank">${rank}</span>` : ''}<img src="${esc(v.thumbnail)}" alt="${esc(shorten(v.title, 60))}" loading="lazy" width="300" height="450"></span>
          ${actress ? `<span class="card-actress">${esc(actress)}</span>` : ''}
          <span class="card-title">${esc(v.title)}</span>
        </a>`;
}

const grid = (videos, ranked = false) => `    <div class="grid">
        ${videos.map((v, i) => card(v, ranked ? i + 1 : 0)).join('\n        ')}
    </div>`;

// 「見出し＋値」の一覧（女優・ジャンルページの概要欄）
const facts = rows => `    <dl class="meta">
        ${rows.filter(([, value]) => value).map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('\n        ')}
    </dl>`;

const linkList = (names, urlFn) => names.map(n => `<a href="${urlFn(n)}">${esc(n)}</a>`).join('、');

const chips = (items, urlFn) => items.map(([name, count]) =>
  `<a class="chip" href="${urlFn(name)}">${esc(name)}${count != null ? `<span class="chip-count">${count}</span>` : ''}</a>`
).join('\n        ');

// ---- ページごとの生成 ----

function videoPage(v, { sameActress, similar, rank }) {
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
        ${rank ? `<dt>人気順位</dt><dd><a href="/ranking/">人気ランキング ${rank}位</a></dd>` : ''}
        <dt>品番</dt><dd>${esc(v.id)}</dd>
        ${genres.length ? `<dt>ジャンル</dt><dd class="meta-chips">${genres.map(g => `<a class="chip" href="${urlOf.genre(g)}">${esc(g)}</a>`).join('')}</dd>` : ''}
      </dl>
      <p class="lead">${esc(description)}${rank ? `FANZAの人気ランキングでは現在${rank}位。` : ''}気に入ったら「FANZAで本編を見る」から本編をチェックできます。</p>
    </article>
    ${sameActress.length ? `<section>
      <h2>${esc(shorten(actresses[0], 20))}の他の作品</h2>
  ${grid(sameActress)}
    </section>` : ''}
    ${similar.length ? `<section>
      <h2>この作品に似ている動画</h2>
  ${grid(similar)}
    </section>` : ''}`;

  return layout({
    title, description, canonical: urlOf.video(v.id), noindex: false,
    ogImage: v.thumbnail, jsonLds: [videoLd, crumbs.ld], body,
  });
}

function listPage({ kind, name, videos, intro, summary, otherLinks }) {
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
${summary}
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

// 人気ランキング・新着のように、毎日並びが変わる一覧ページ
function feedPage({ urlPath, name, title, description, h1, intro, videos, ranked, updatedLabel, sibling }) {
  const crumbs = breadcrumb([
    { name: SITE_NAME, url: '/' },
    { name, url: urlPath },
  ]);
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: videos.length,
    itemListElement: videos.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: BASE_URL + urlOf.video(v.id), name: v.title })),
  };

  const body = `${crumbs.html}
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(intro)}<br><time>${esc(updatedLabel)}</time> 更新</p>
    <div class="actions">
      <a class="btn-cta" href="/">スワイプで次々に見る</a>
      <a class="btn-sub" href="${sibling.url}">${esc(sibling.label)}</a>
    </div>
${grid(videos, ranked)}`;

  return layout({
    title, description, canonical: urlPath, noindex: false,
    ogImage: videos[0].thumbnail, jsonLds: [itemList, crumbs.ld], body,
  });
}

// ---- メイン ----

function writePage(urlPath, html) {
  const dir = path.join(ROOT, decodeURIComponent(urlPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function main() {
  const { videos: allVideos = [], feeds = {}, updated } = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // 再生できる動画のみ、新しい順
  const videos = allVideos.filter(v => v.videoURL).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const byId   = new Map(videos.map(v => [v.id, v]));
  const fromFeed = name => (feeds[name] ?? []).map(id => byId.get(id)).filter(Boolean);

  // 人気ランキング（売上順）と新着（配信日順）。feeds が無いときは配信日順で代用する
  const ranking  = fromFeed('popular').slice(0, RANKING_LIMIT);
  const newList  = (fromFeed('new').length ? fromFeed('new') : videos).slice(0, NEW_LIMIT);
  const rankOf   = new Map(ranking.map((v, i) => [v.id, i + 1]));
  const updatedLabel = (() => {
    const d = new Date(updated || Date.now());
    const jst = new Date(d.getTime() + 9 * 3600 * 1000);
    return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
  })();

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
    <h2>ランキング・新着</h2>
    <div class="chips">
        ${ranking.length ? '<a class="chip" href="/ranking/">人気ランキング</a>' : ''}
        <a class="chip" href="/new/">新着作品</a>
    </div>
    <h2>人気の女優</h2>
    <div class="chips">
        ${chips(actressRank.slice(0, FOOTER_LIMIT), urlOf.actress)}
    </div>
    <h2>人気のジャンル</h2>
    <div class="chips">
        ${chips(genreRank.slice(0, FOOTER_LIMIT), urlOf.genre)}
    </div>
    <h2>新着情報</h2>
    <div class="chips">
        <a class="chip" href="https://x.com/nukidoki_jp" target="_blank" rel="noopener me">X（@nukidoki_jp）でフォロー</a>
    </div>
    <p class="footer-note">当サイトは18歳未満の方の閲覧を固く禁じます。掲載動画はFANZA（DMM）の公式サンプル動画です。<br>© ${SITE_NAME}</p>
  </footer>`;

  // トップページのメニューに人気女優・ジャンルへのリンクを書き込む（トップの評価を各ページへ流す）
  const menuLinks = (label, items, urlFn) => `<p class="site-menu-label">${label}</p>
        <div class="site-menu-chips">
          ${items.map(([name]) => `<a href="${urlFn(name)}">${esc(name)}</a>`).join('\n          ')}
        </div>`;
  const indexPath = path.join(ROOT, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const menuBlock = /(<!-- build:menu-links[^>]*-->)[\s\S]*?(<!-- \/build:menu-links -->)/;
  if (menuBlock.test(indexHtml)) {
    const links = [
      menuLinks('人気の女優', actressRank.slice(0, MENU_LIMIT), urlOf.actress),
      menuLinks('人気のジャンル', genreRank.filter(([g]) => isTopical(g)).slice(0, MENU_LIMIT), urlOf.genre),
    ].join('\n        ');
    const next = indexHtml.replace(menuBlock, (_, open, close) => `${open}\n        ${links}\n        ${close}`);
    if (next !== indexHtml) fs.writeFileSync(indexPath, next, 'utf8');
  } else {
    console.warn('[pages] index.html にメニューの書き込み位置が見つかりません');
  }

  // 前回生成分を削除（掲載が終わった作品・女優のページを残さない）
  for (const dir of ['video', 'actress', 'genre', 'ranking', 'new']) {
    fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  }

  const sitemap = [
    { loc: '/', lastmod: updated, priority: '1.0' },
    { loc: '/search.html', lastmod: updated, priority: '0.8' },
  ];

  // 人気ランキング・新着ページ
  const feedPages = [
    ranking.length && {
      urlPath: '/ranking/', name: '人気ランキング', videos: ranking, ranked: true,
      title: `AV人気ランキングTOP${ranking.length}【毎日更新】FANZAサンプル動画｜${SITE_NAME}`,
      h1: `AV人気ランキング TOP${ranking.length}`,
      description: `FANZAで今売れているAVのサンプル動画ランキングTOP${ranking.length}。1位は「${shorten(ranking[0].title, 40)}」。毎日更新、スワイプで無料視聴できます。`,
      intro: `FANZAの売上順に、いま人気のAV作品のサンプル動画を${ranking.length}本並べました。順位は毎日更新されます。`,
      sibling: { url: '/new/', label: '新着作品を見る' },
    },
    {
      urlPath: '/new/', name: '新着作品', videos: newList, ranked: false,
      title: `AV新作・新着サンプル動画【毎日更新】FANZA最新作${newList.length}本｜${SITE_NAME}`,
      h1: 'AV新作・新着サンプル動画',
      description: `FANZAで配信が始まったばかりのAV新作サンプル動画を${newList.length}本掲載。最新は「${shorten(newList[0].title, 40)}」。毎日更新、無料視聴できます。`,
      intro: `FANZAで新しく配信された作品のサンプル動画を、新しい順に${newList.length}本まとめました。毎日更新しています。`,
      sibling: ranking.length ? { url: '/ranking/', label: '人気ランキングを見る' } : { url: '/search.html', label: '女優・ジャンルから探す' },
    },
  ].filter(Boolean);
  for (const p of feedPages) {
    writePage(p.urlPath, feedPage({ ...p, updatedLabel }));
    sitemap.push({ loc: p.urlPath, lastmod: updated, priority: '0.9' });
  }

  // 作品ページ: 同じ女優の作品と、特徴的なジャンルが多く重なる作品を載せる
  for (const v of videos) {
    const sameActress = [...new Set(splitActress(v).flatMap(a => byActress.get(a)))]
      .filter(o => o.id !== v.id).slice(0, RELATED_LIMIT);
    const shown       = new Set([v.id, ...sameActress.map(o => o.id)]);
    const genreSet    = new Set((v.genres ?? []).filter(isTopical));
    const similar     = videos
      .filter(o => !shown.has(o.id))
      .map(o => [o, (o.genres ?? []).filter(g => genreSet.has(g)).length])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, RELATED_LIMIT)
      .map(([o]) => o);
    writePage(urlOf.video(v.id), videoPage(v, { sameActress, similar, rank: rankOf.get(v.id) }));
    sitemap.push({ loc: urlOf.video(v.id), lastmod: dateOnly(v), priority: '0.6' });
  }

  for (const [kind, map] of [['actress', byActress], ['genre', byGenre]]) {
    for (const [name, list] of map) {
      // 一覧内の作品で多い順に数える（自分自身は除く）
      const topBy = (keysOf, limit) => sortByCount(list.reduce((m, v) => {
        keysOf(v).filter(k => k !== name).forEach(k => m.set(k, [...(m.get(k) ?? []), v]));
        return m;
      }, new Map())).slice(0, limit).map(([k]) => k);
      const topGenres   = topBy(v => (v.genres ?? []).filter(isTopical), 6);
      const topActress  = topBy(splitActress, 6);
      const latest      = list[0];
      const oldest      = list[list.length - 1];
      const ranked      = list.filter(v => rankOf.has(v.id)).map(v => rankOf.get(v.id)).sort((a, b) => a - b);
      const rankText    = ranked.length ? `人気ランキングに${ranked.length}作品（最高${ranked[0]}位）` : '';
      const period      = dateOnly(oldest) && dateOnly(latest) && dateOnly(oldest) !== dateOnly(latest)
        ? `${dateOnly(oldest).replace(/-/g, '/')} 〜 ${dateOnly(latest).replace(/-/g, '/')}` : '';

      const intro = kind === 'actress'
        ? `${name}が出演するFANZA作品のサンプル動画を${list.length}本まとめました。` +
          `最新作は${dateOnly(latest) ? `${dateOnly(latest).replace(/-/g, '/')}配信の` : ''}「${shorten(latest.title, 50)}」。` +
          `${topGenres.length ? `出演作には${topGenres.slice(0, 3).join('・')}の作品が多く、` : ''}` +
          `${topActress.length ? `${topActress.slice(0, 2).join('・')}との共演作もあります。` : ''}` +
          `${ranked.length ? `現在、${ranked.length}作品がFANZAの人気ランキングに入っています。` : ''}新しい作品から順に並んでいます。`
        : `「${name}」ジャンルのFANZA作品サンプル動画を${list.length}本まとめました。` +
          `最新作は「${shorten(latest.title, 50)}」。` +
          `${topActress.length ? `${topActress.slice(0, 3).join('・')}などが出演し、` : ''}` +
          `${topGenres.length ? `${topGenres.slice(0, 3).join('・')}と組み合わさった作品が多いジャンルです。` : ''}` +
          `新しい作品から順に並んでいます。`;

      const summary = facts([
        ['掲載作品数', `${list.length}本`],
        ['最新作', `<a href="${urlOf.video(latest.id)}">${esc(shorten(latest.title, 40))}</a>`],
        ['配信時期', period],
        [kind === 'actress' ? '多いジャンル' : '関連ジャンル', linkList(topGenres, urlOf.genre)],
        [kind === 'actress' ? '共演した女優' : 'よく出演する女優', linkList(topActress, urlOf.actress)],
        ['人気度', rankText && `<a href="/ranking/">${esc(rankText)}</a>`],
      ]);

      const sections = kind === 'actress'
        ? [[`${esc(name)}の出演作に多いジャンル`, topGenres, urlOf.genre], [`${esc(name)}と共演した女優`, topActress, urlOf.actress]]
        : [[`「${esc(name)}」によく出演する女優`, topActress, urlOf.actress], [`「${esc(name)}」と一緒に見られるジャンル`, topGenres, urlOf.genre]];
      const otherLinks = sections.filter(([, names]) => names.length).map(([h, names, fn]) => `<section>
      <h2>${h}</h2>
      <div class="chips">
        ${chips(names.map(n => [n, null]), fn)}
      </div>
    </section>`).join('\n    ');

      writePage(urlOf[kind](name), listPage({ kind, name, videos: list, intro, summary, otherLinks }));
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
