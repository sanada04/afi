'use strict';

// 「ドキッ」の回数を数える API（Vercel Functions + Upstash Redis）
//   GET  /api/likes                     → { counts: { 作品ID: 回数 } }
//   POST /api/likes { id, on: boolean } → 押した / 取り消した
// Redis の環境変数が無いあいだは空の結果を返すだけで、サイトには影響しない

const crypto = require('crypto');

const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ORIGIN     = 'https://nukidoki.net';
const ID_PATTERN = /^[a-z0-9_]{1,40}$/;
const RATE_LIMIT = 30; // 1 分あたりの回数（同じ接続元）

async function redis(...command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).result;
}

// IP はそのまま保存せず、ハッシュにして「同じ人の二重カウント」の判定にだけ使う
function visitorOf(req) {
  const ip = req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${REDIS_TOKEN}:${ip}`).digest('hex').slice(0, 24);
}

async function readCounts() {
  const flat = await redis('HGETALL', 'likes'); // [ID, 回数, ID, 回数, ...]
  const counts = {};
  for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) counts[flat[i]] = Number(flat[i + 1]);
  return counts;
}

async function recordLike(id, on, visitor) {
  const rateKey = `rate:${visitor}`;
  const used = await redis('INCR', rateKey);
  if (used === 1) await redis('EXPIRE', rateKey, 60);
  if (used > RATE_LIMIT) return false;

  // 同じ人が同じ作品を押しても 1 回だけ数える
  const changed = await redis(on ? 'SADD' : 'SREM', `likers:${id}`, visitor);
  if (changed) await redis('HINCRBY', 'likes', id, on ? 1 : -1);
  return true;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ counts: REDIS_URL ? await readCounts() : {} });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method not allowed' });
    }

    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin !== ORIGIN) return res.status(403).json({ error: 'forbidden' });

    const { id, on } = req.body ?? {};
    if (!ID_PATTERN.test(String(id)) || typeof on !== 'boolean') {
      return res.status(400).json({ error: 'invalid request' });
    }
    if (!REDIS_URL) return res.status(204).end();

    const ok = await recordLike(id, on, visitorOf(req));
    return ok ? res.status(204).end() : res.status(429).json({ error: 'too many requests' });
  } catch (err) {
    console.error('[likes]', err.message);
    return res.status(500).json({ error: 'internal error' });
  }
};
