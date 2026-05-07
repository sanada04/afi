'use strict';

const fs   = require('fs');
const path = require('path');

// .env.local を読み込む
const envLocal = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocal)) {
  fs.readFileSync(envLocal, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq < 0) return;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  });
}

const AFFILIATE_ID = process.env.DMM_AFFILIATE_ID || 'imanuki-990';

// videos.json から最初の litevideo URL を取得（または引数で指定）
let testURL = process.argv[2];
if (!testURL) {
  const videos = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/videos.json'), 'utf8')).videos;
  const found = videos.find(v => v.videoURL.includes('litevideo'));
  if (found) {
    testURL = found.videoURL;
  } else {
    testURL = `https://www.dmm.co.jp/litevideo/-/part/=/cid=ofje00507/size=720_480/affi_id=${AFFILIATE_ID}/`;
  }
}

const HEADERS = {
  'Referer':         'https://www.dmm.co.jp/',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function main() {
  // --- Step 1: litevideo ページ ---
  console.log(`\n[Step1] Fetching litevideo: ${testURL}\n`);
  const res1 = await fetch(testURL, { headers: HEADERS });
  console.log(`Status: ${res1.status}  Content-Type: ${res1.headers.get('content-type')}`);
  const html1 = await res1.text();

  // iframe src を抽出
  const iframeMatch = html1.match(/src="(https:\/\/www\.dmm\.co\.jp\/service\/digitalapi\/-\/html5_player\/[^"]+)"/);
  if (!iframeMatch) {
    console.log('[Step1] iframe (html5_player) が見つかりませんでした。HTML を確認:');
    console.log(html1.slice(0, 3000));
    return;
  }
  const playerURL = iframeMatch[1];
  console.log(`[Step1] html5_player URL: ${playerURL}`);

  // --- Step 2: html5_player ページ ---
  console.log(`\n[Step2] Fetching html5_player...\n`);
  const res2 = await fetch(playerURL, { headers: { ...HEADERS, 'Referer': testURL } });
  console.log(`Status: ${res2.status}  Content-Type: ${res2.headers.get('content-type')}`);
  const html2 = await res2.text();

  console.log(`\n--- html5_player HTML (先頭 4000 文字) ---`);
  console.log(html2.slice(0, 4000));

  // html5_player の後半部分（body/script 初期化）を見る
  console.log(`\n--- html5_player HTML (末尾 3000 文字) ---`);
  console.log(html2.slice(-3000));

  // --- Step 3: litevideo-player.js を解析 ---
  const jsMatch = html2.match(/src=["'](https?:\/\/[^"']+litevideo-player\.js[^"']*)['"]/);
  if (jsMatch) {
    const jsURL = jsMatch[1];
    console.log(`\n[Step3] Fetching: ${jsURL}`);
    const res3 = await fetch(jsURL, { headers: HEADERS });
    const js = await res3.text();
    console.log(`JS size: ${js.length} bytes`);

    // API エンドポイントっぽいパターンを探す
    const apiHits = [...js.matchAll(/["'`](\/[^\s"'`]*(?:movie|stream|media|token|api)[^\s"'`]*)[`"']/gi)];
    console.log(`\n--- JS 内の API 系パス: ${apiHits.length} 件 ---`);
    apiHits.slice(0, 30).forEach(m => console.log(m[1]));

    const ccHits = [...js.matchAll(/["'`](https?:\/\/cc\d+[^\s"'`]*)[`"']/gi)];
    console.log(`\n--- JS 内の cc*.dmm URL: ${ccHits.length} 件 ---`);
    ccHits.slice(0, 10).forEach(m => console.log(m[1]));
  }

  // --- Step 4: cid と mtype を使って API エンドポイントを直接試す ---
  const cidMatch    = playerURL.match(/cid=([^/]+)/);
  const mtypeMatch  = playerURL.match(/mtype=([^/]+)/);
  const affiMatch   = playerURL.match(/affi_id=([^/]+)/);
  const cid   = cidMatch?.[1];
  const mtype = mtypeMatch?.[1];
  const affi  = affiMatch?.[1];

  const trialEndpoints = [
    `https://www.dmm.co.jp/service/digitalapi/-/media/=/cid=${cid}/mtype=${mtype}/service=litevideo/mode=part/`,
    `https://www.dmm.co.jp/service/digitalapi/-/movie_url/=/cid=${cid}/mtype=${mtype}/`,
    `https://www.dmm.co.jp/service/digitalapi/-/movies/=/cid=${cid}/mtype=${mtype}/`,
    `https://www.dmm.co.jp/litevideo/api/movie?cid=${cid}&mtype=${mtype}`,
  ];

  console.log('\n--- API エンドポイントを試す ---');
  for (const ep of trialEndpoints) {
    try {
      const r = await fetch(ep, { headers: { ...HEADERS, Referer: playerURL } });
      const body = await r.text();
      console.log(`\n${ep}`);
      console.log(`  Status: ${r.status}  Content-Type: ${r.headers.get('content-type')}`);
      console.log(`  Body (先頭300文字): ${body.slice(0, 300)}`);
    } catch (e) {
      console.log(`${ep} → ERROR: ${e.message}`);
    }
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
