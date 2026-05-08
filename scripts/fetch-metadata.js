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

const API_ID       = process.env.DMM_API_ID;
const AFFILIATE_ID = process.env.DMM_AFFILIATE_ID;

if (!API_ID || !AFFILIATE_ID) {
  console.error('Error: DMM_API_ID and DMM_AFFILIATE_ID が設定されていません');
  process.exit(1);
}

const OUT_PATH   = path.resolve(__dirname, '../data/videos.json');
const HITS       = 100;
const MAX_VIDEOS = 150;

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
  console.log(`[metadata] Calling FANZA API (sort=${sort})...`);
  console.log(`[metadata] api_id=${maskSecret(API_ID)} affiliate_id=${maskSecret(AFFILIATE_ID)}`);

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
  console.log(`[metadata] sort=${sort}: ${items.length} items`);
  return items;
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

async function main() {
  const [dateItems, rankItems] = await Promise.all([
    fetchItems('date'),
    fetchItems('rank'),
  ]);

  // 既存データを読み込み、解決済み videoURL を保持する
  let existingMap = new Map();
  if (fs.existsSync(OUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
      (existing.videos ?? []).forEach(v => existingMap.set(v.id, v));
    } catch {}
  }

  const seen = new Set();
  const videos = [];

  for (const item of [...dateItems, ...rankItems]) {
    if (seen.has(item.content_id)) continue;
    seen.add(item.content_id);

    const rawVideoURL = extractRawVideoURL(item);
    if (!rawVideoURL) continue;

    const isLitevideo = rawVideoURL.includes('/litevideo/') || rawVideoURL.includes('dmm.co.jp/litevideo');
    const actress = (item.actress ?? item.iteminfo?.actress ?? []).map(a => a.name).join(', ');
    const genres  = (item.iteminfo?.genre ?? []).map(g => g.name).filter(Boolean);

    // litevideo でない場合はそのまま videoURL として使える
    // litevideo の場合は既存の解決済み URL を引き継ぐ（なければ null → resolve-mp4.js で解決）
    const existing  = existingMap.get(item.content_id);
    const videoURL  = isLitevideo ? (existing?.videoURL ?? null) : rawVideoURL;

    videos.push({
      id:           item.content_id,
      title:        item.title,
      affiliateURL: item.affiliateURL,
      thumbnail:    item.imageURL?.large || item.imageURL?.small || '',
      rawVideoURL,
      videoURL,
      actress,
      genres,
      date:         item.date,
    });

    if (videos.length >= MAX_VIDEOS) break;
  }

  console.log(`[metadata] ${videos.length} items`);
  const unresolvedCount = videos.filter(v => !v.videoURL).length;
  console.log(`[metadata] videoURL 未解決: ${unresolvedCount} 件 → ローカルで resolve-mp4.js を実行してください`);

  const output = { updated: new Date().toISOString(), videos };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[metadata] Saved to ${OUT_PATH}`);
}

main().catch(err => {
  console.error('[metadata] Fatal:', err.message);
  process.exit(1);
});
