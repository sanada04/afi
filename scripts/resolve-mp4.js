'use strict';

const fs   = require('fs');
const path = require('path');

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

const OUT_PATH    = path.resolve(__dirname, '../data/videos.json');
const CONCURRENCY = 2;

// ---- Chrome / Puppeteer ----

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
    throw new Error('puppeteer-core が見つかりません。npm install puppeteer-core を実行してください。');
  }

  const executablePath = findChrome();
  console.log(`[resolve] Chrome: ${executablePath}`);

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

async function resolveMP4(litevideoURL) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    let capturedURL = null;

    page.on('requestfinished', req => {
      if (capturedURL) return;
      const url = req.url();
      if (url.includes('.mp4') || /cc\d+\.dmm\.co\.jp/.test(url)) {
        capturedURL = url.split('?')[0];
        console.log(`[resolve] MP4 found: ${capturedURL}`);
      }
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'Referer':         'https://www.dmm.co.jp/',
    });

    await page.goto(litevideoURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (let i = 0; i < 40 && !capturedURL; i++) {
      await new Promise(r => setTimeout(r, 500));

      for (const frame of page.frames()) {
        try {
          const src = await frame.evaluate(() => {
            const v = document.querySelector('video');
            return v ? (v.currentSrc || v.src || null) : null;
          });
          if (src && (src.includes('.mp4') || /cc\d+\.dmm/.test(src))) {
            capturedURL = src.split('?')[0];
            console.log(`[resolve] MP4 from video element: ${capturedURL}`);
            break;
          }
        } catch { /* ignore cross-origin frame errors */ }
      }
    }

    if (!capturedURL) {
      console.warn(`[resolve] MP4 not found: ${litevideoURL}`);
    }
    return capturedURL;
  } catch (e) {
    console.warn(`[resolve] Error for ${litevideoURL}: ${e.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

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

// ---- Main ----

async function main() {
  if (!fs.existsSync(OUT_PATH)) {
    console.error('[resolve] videos.json が見つかりません。先に fetch-metadata.js を実行してください。');
    process.exit(1);
  }

  const data   = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  const videos = data.videos ?? [];

  const unresolved = videos.filter(v => !v.videoURL && v.rawVideoURL);
  console.log(`[resolve] ${unresolved.length} / ${videos.length} 件を解決します`);

  if (unresolved.length === 0) {
    console.log('[resolve] 解決が必要な動画はありません');
    return;
  }

  const tasks = unresolved.map(v => async () => {
    const isLitevideo = v.rawVideoURL.includes('/litevideo/') || v.rawVideoURL.includes('dmm.co.jp/litevideo');
    if (!isLitevideo) {
      v.videoURL = v.rawVideoURL;
      return;
    }
    const mp4 = await resolveMP4(v.rawVideoURL);
    if (mp4) v.videoURL = mp4;
  });

  try {
    await pLimit(tasks, CONCURRENCY);

    const resolved = videos.filter(v => v.videoURL).length;
    console.log(`[resolve] 解決済み: ${resolved} / ${videos.length} 件`);

    fs.writeFileSync(OUT_PATH, JSON.stringify({ ...data, videos }, null, 2), 'utf8');
    console.log(`[resolve] 保存完了: ${OUT_PATH}`);
  } finally {
    await closeBrowser();
  }
}

main().catch(err => {
  console.error('[resolve] Fatal:', err.message);
  closeBrowser().finally(() => process.exit(1));
});
