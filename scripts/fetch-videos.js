'use strict';

const fs   = require('fs');
const path = require('path');

// .env.local が存在する場合はローカル環境変数として読み込む（GitHub Actions では不要）
const envLocal = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocal)) {
  fs.readFileSync(envLocal, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  });
}

const API_ID       = process.env.DMM_API_ID;
const AFFILIATE_ID = process.env.DMM_AFFILIATE_ID;

if (!API_ID || !AFFILIATE_ID) {
  console.error('Error: DMM_API_ID and DMM_AFFILIATE_ID が設定されていません');
  console.error('  → GitHub Actions: Secrets に設定してください');
  console.error('  → ローカル実行: .env.local ファイルを作成してください (.env.example 参照)');
  process.exit(1);
}

const OUT_PATH    = path.resolve(__dirname, '../data/videos.json');
const HITS        = 100;
const MAX_VIDEOS  = 150;
const CONCURRENCY = 2;

function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 6) return '*'.repeat(s.length);
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

async function fetchItems(sort) {
  const params = new URLSearchParams({
    api_id:       API_ID,
    affiliate_id: AFFILIATE_ID,
    site:         'FANZA',
    service:      'digital',
    floor:        'videoa',
    hits:         String(HITS),
    sort,
    output:       'json',
  });

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params}`;
  console.log(`[fetch] Calling FANZA API (sort=${sort})...`);
  console.log(`[fetch] api_id=${maskSecret(API_ID)} affiliate_id=${maskSecret(AFFILIATE_ID)}`);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${body.slice(0, 500)}`);
  }

  const data = await res.json();
  if (data.result?.status !== 200) {
    throw new Error(`API status ${data.result?.status}: ${JSON.stringify(data.result)}`);
  }

  const rawItems = data.result.items;
  const items = Array.isArray(rawItems) ? rawItems : (rawItems?.item ?? []);
  console.log(`[fetch] sort=${sort}: ${items.length} items`);

  if (items.length > 0) {
    const s = items[0];
    console.log(`[fetch] First item sampleMovieURL: ${JSON.stringify(s.sampleMovieURL)}`);
  }

  return items;
}

// --- Puppeteer ブラウザ管理 ---

let browser = null;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'Chrome が見つかりません。Google Chrome をインストールするか CHROME_PATH 環境変数を設定してください。'
  );
}

async function getBrowser() {
  if (browser) return browser;

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    throw new Error(
      'puppeteer-core が見つかりません。次を実行してください: npm install puppeteer-core'
    );
  }

  const executablePath = findChrome();
  console.log(`[fetch] Chrome: ${executablePath}`);

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

// litevideo ページを Puppeteer で開き、MP4 URL をネットワークリクエストから取得する
async function resolveMP4(litevideoURL) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    let capturedURL = null;

    // すべてのフレームのネットワークリクエストを監視
    page.on('requestfinished', req => {
      if (capturedURL) return;
      const url = req.url();
      if (url.includes('.mp4') || /cc\d+\.dmm\.co\.jp/.test(url)) {
        capturedURL = url.split('?')[0]; // クエリパラメータを除去
        console.log(`[fetch] MP4 found: ${capturedURL}`);
      }
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'Referer':         'https://www.dmm.co.jp/',
    });

    await page.goto(litevideoURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 最大 20 秒待機しながら MP4 URL を探す（500ms ごと）
    for (let i = 0; i < 40 && !capturedURL; i++) {
      await new Promise(r => setTimeout(r, 500));

      // 全フレームの <video> 要素から currentSrc を確認
      for (const frame of page.frames()) {
        try {
          const src = await frame.evaluate(() => {
            const v = document.querySelector('video');
            return v ? (v.currentSrc || v.src || null) : null;
          });
          if (src && (src.includes('.mp4') || /cc\d+\.dmm/.test(src))) {
            capturedURL = src.split('?')[0];
            console.log(`[fetch] MP4 from video element: ${capturedURL}`);
            break;
          }
        } catch { /* ignore cross-origin frame errors */ }
      }
    }

    if (!capturedURL) {
      console.warn(`[fetch] MP4 not found for ${litevideoURL}`);
    }
    return capturedURL;
  } catch (e) {
    console.warn(`[fetch] resolveMP4 error for ${litevideoURL}: ${e.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

function extractRawVideoURL(item) {
  const m = item.sampleMovieURL;
  if (!m) return null;
  if (typeof m === 'string') return m;
  return (
    m.size_720_480 ||
    m.size_644_414 ||
    m.size_560_360 ||
    m.size_476_306 ||
    Object.values(m).find(v => typeof v === 'string' && v.startsWith('http')) ||
    null
  );
}

// Promise.all を並列数制限付きで実行
async function pLimit(tasks, limit) {
  const results = [];
  let i = 0;
  async function run() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

async function main() {
  const [dateItems, rankItems] = await Promise.all([
    fetchItems('date'),
    fetchItems('rank'),
  ]);

  // 重複除去して候補リストを作成
  const seen = new Set();
  const candidates = [...dateItems, ...rankItems].filter(item => {
    if (seen.has(item.content_id)) return false;
    seen.add(item.content_id);
    return !!extractRawVideoURL(item);
  });

  console.log(`[fetch] ${candidates.length} candidates with sampleMovieURL`);

  const actressArr = item => item.actress ?? item.iteminfo?.actress ?? [];

  // litevideo URL → 直接 MP4 URL に解決（並列 CONCURRENCY 件ずつ）
  const tasks = candidates.slice(0, MAX_VIDEOS * 3).map(item => async () => {
    const rawURL = extractRawVideoURL(item);
    const isLitevideo = rawURL.includes('/litevideo/') || rawURL.includes('dmm.co.jp/litevideo');

    let videoURL = rawURL;
    if (isLitevideo) {
      videoURL = await resolveMP4(rawURL);
      if (!videoURL) return null;
    }

    return {
      id:           item.content_id,
      title:        item.title,
      affiliateURL: item.affiliateURL,
      thumbnail:    item.imageURL?.large || item.imageURL?.small || '',
      videoURL,
      actress:      actressArr(item).map(a => a.name).join(', '),
      date:         item.date,
    };
  });

  try {
    const resolved = await pLimit(tasks, CONCURRENCY);
    const videos = resolved.filter(Boolean).slice(0, MAX_VIDEOS);

    console.log(`[fetch] ${videos.length} videos resolved`);

    if (videos.length === 0) {
      console.warn('[fetch] No videos resolved — keeping existing data unchanged');
      process.exit(0);
    }

    const output = { updated: new Date().toISOString(), videos };
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[fetch] Saved ${videos.length} videos to ${OUT_PATH}`);
  } finally {
    await closeBrowser();
  }
}

main().catch(err => {
  console.error('[fetch] Fatal:', err.message);
  closeBrowser().finally(() => process.exit(1));
});
