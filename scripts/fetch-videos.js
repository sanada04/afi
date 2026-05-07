'use strict';

const fs   = require('fs');
const path = require('path');

const API_ID       = process.env.DMM_API_ID;
const AFFILIATE_ID = process.env.DMM_AFFILIATE_ID;

if (!API_ID || !AFFILIATE_ID) {
  console.error('Error: DMM_API_ID and DMM_AFFILIATE_ID env vars are required');
  process.exit(1);
}

const OUT_PATH = path.resolve(__dirname, '../data/videos.json');
const HITS     = 100;

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
  console.log(
    `[fetch] Params: api_id=${maskSecret(API_ID)} affiliate_id=${maskSecret(AFFILIATE_ID)} hits=${HITS} sort=${sort}`
  );

  const res = await fetch(url);
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const snippet = bodyText ? bodyText.slice(0, 1000) : '(empty body)';
    throw new Error(`HTTP ${res.status} ${res.statusText}\nResponse body:\n${snippet}`);
  }

  const data = await res.json();
  if (data.result.status !== 200) {
    throw new Error(`API status ${data.result.status}: ${JSON.stringify(data.result)}`);
  }

  const items = data.result.items?.item ?? [];
  console.log(`[fetch] sort=${sort}: ${items.length} items`);
  return items;
}

function toVideo(item) {
  const m = item.sampleMovieURL;
  if (!m) return null;

  const videoURL =
    m.size_720_480 ||
    m.size_644_414 ||
    m.size_560_360 ||
    m.size_476_306 ||
    null;

  if (!videoURL) return null;

  // FANZA API returns actress at top-level or under iteminfo depending on version
  const actressArr = item.actress ?? item.iteminfo?.actress ?? [];

  return {
    id:           item.content_id,
    title:        item.title,
    affiliateURL: item.affiliateURL,
    thumbnail:    item.imageURL?.large || item.imageURL?.small || '',
    videoURL,
    actress:      actressArr.map(a => a.name).join(', '),
    date:         item.date,
  };
}

async function main() {
  // date順とrank順を並列フェッチして合算・重複除去
  const [dateItems, rankItems] = await Promise.all([
    fetchItems('date'),
    fetchItems('rank'),
  ]);

  const seen = new Set();
  const videos = [...dateItems, ...rankItems]
    .map(toVideo)
    .filter(Boolean)
    .filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });

  console.log(`[fetch] ${videos.length} videos with sample movies`);

  if (videos.length === 0) {
    console.warn('[fetch] No videos found — keeping existing data unchanged');
    process.exit(0);
  }

  const output = { updated: new Date().toISOString(), videos };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[fetch] Saved ${videos.length} videos to ${OUT_PATH}`);
}

main().catch(err => {
  console.error('[fetch] Fatal:', err.message);
  process.exit(1);
});
