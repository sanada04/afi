'use strict';

// 新しく増えた・更新されたページを IndexNow（Bing・Yandex など）に通知するスクリプト
// 実行:
//   node scripts/indexnow.js <比較元の git ref>   sitemap.xml の差分（新規・lastmod 更新）だけを通知
//   node scripts/indexnow.js --all                 sitemap.xml の全 URL を通知（初回用）
// 毎日のページは更新日に関係なく通知する（トップ・ランキング・新着）
// 鍵ファイル /{KEY}.txt がサイトに公開されている必要がある

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT     = path.resolve(__dirname, '..');
const HOST     = 'nukidoki.net';
const BASE_URL = `https://${HOST}`;
const KEY      = '17bfa831ccf45d74584ed61790ecb276';
const ALWAYS   = ['/', '/ranking/', '/new/'];
const BATCH    = 10000; // IndexNow の 1 リクエストあたりの上限

function parseSitemap(xml) {
  const map = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
    map.set(m[1].replace(/&amp;/g, '&'), m[2] || '');
  }
  return map;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('使い方: node scripts/indexnow.js <git ref> | --all');
    process.exit(1);
  }

  const current = parseSitemap(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'));
  let urls;
  if (arg === '--all') {
    urls = [...current.keys()];
  } else {
    let before = new Map();
    try {
      before = parseSitemap(execFileSync('git', ['show', `${arg}:sitemap.xml`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    } catch {
      console.warn(`[indexnow] ${arg} の sitemap.xml を読めないため全 URL を通知します`);
    }
    urls = [...current].filter(([loc, lastmod]) => before.get(loc) !== lastmod).map(([loc]) => loc);
    urls.push(...ALWAYS.map(p => BASE_URL + p).filter(u => current.has(u)));
  }
  urls = [...new Set(urls)];

  if (urls.length === 0) {
    console.log('[indexnow] 通知する URL はありません');
    return;
  }

  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE_URL}/${KEY}.txt`, urlList }),
    });
    // 200 / 202 が成功。失敗しても更新処理全体は止めない
    console.log(`[indexnow] ${urlList.length} 件を通知: HTTP ${res.status}`);
    if (!res.ok) console.warn(await res.text().catch(() => ''));
  }
}

main().catch(err => console.warn('[indexnow] 通知に失敗しました:', err.message));
