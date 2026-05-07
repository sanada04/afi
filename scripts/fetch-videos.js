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
const HITS     = 30;

function maskSecret(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 6) return '*'.repeat(s.length);
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

async function main() {
  const params = new URLSearchParams({
    api_id:       API_ID,
    affiliate_id: AFFILIATE_ID,
    site:         'FANZA',
    service:      'digital',
    floor:        'videoa',
    hits:         String(HITS),
    sort:         'date',
    output:       'json',
  });

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params}`;
  console.log('[fetch] Calling FANZA API...');
  console.log(
    `[fetch] Params: api_id=${maskSecret(API_ID)} affiliate_id=${maskSecret(AFFILIATE_ID)} site=FANZA service=digital floor=videoa hits=${HITS} sort=date output=json`
  );

  const res = await fetch(url);
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const snippet = bodyText ? bodyText.slice(0, 1000) : '(empty body)';
    throw new Error(`HTTP ${res.status} ${res.statusText}\nResponse body (first 1000 chars):\n${snippet}`);
  }

  const data = await res.json();

  if (data.result.status !== 200) {
    throw new Error(`API returned status ${data.result.status}: ${JSON.stringify(data.result)}`);
  }

  const items = data.result.items?.item ?? [];
  console.log(`[fetch] Got ${items.length} items from API`);

  const videos = items
    .map(item => {
      const m = item.sampleMovieURL;
      if (!m) return null;

      // Prefer highest resolution
      const videoURL =
        m.size_720_480 ||
        m.size_644_414 ||
        m.size_560_360 ||
        m.size_476_306 ||
        null;

      if (!videoURL) return null;

      return {
        id:           item.content_id,
        title:        item.title,
        affiliateURL: item.affiliateURL,
        thumbnail:    item.imageURL?.large || item.imageURL?.small || '',
        videoURL,
        actress:      (item.actress ?? []).map(a => a.name).join(', '),
        genres:       (item.genre   ?? []).map(g => g.name),
        date:         item.date,
      };
    })
    .filter(Boolean);

  console.log(`[fetch] ${videos.length} videos have sample movies`);

  const output = {
    updated: new Date().toISOString(),
    videos,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[fetch] Saved to ${OUT_PATH}`);
}

main().catch(err => {
  console.error('[fetch] Fatal:', err.message);
  process.exit(1);
});
