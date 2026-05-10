'use strict';

const fs   = require('fs');
const path = require('path');

// ---------- env loader ----------
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

// ---------- comment templates ----------
const GENRE_TEMPLATES = [
  {
    keywords: ['中出し'],
    comments: [
      '生で中まで...これはヤバすぎる🔥',
      '中出しシーン最高すぎて無限ループしてる💦',
      '膣内射精の瞬間がたまらん😤',
    ],
  },
  {
    keywords: ['潮吹き'],
    comments: [
      '潮吹きの量がえぐすぎる🌊',
      'びしゃびしゃになるまで絞り出された🔥',
      'こんなに吹くの初めて見た😳',
    ],
  },
  {
    keywords: ['野外', '露出'],
    comments: [
      '外でこんなことしてるの大丈夫？😳🔥',
      '公衆の面前でここまでやるの神すぎる',
      '羞恥心ゼロの露出プレイが最高すぎた🌞',
    ],
  },
  {
    keywords: ['放尿', 'お漏らし'],
    comments: [
      'お漏らしシーンがリアルすぎてヤバい💦',
      '恥ずかしがりながらも止まらない🔥',
      '漏らしてしまう瞬間が最高すぎる😤',
    ],
  },
  {
    keywords: ['人妻', '主婦'],
    comments: [
      '人妻がこんなに乱れるの反則すぎる🔥',
      '旦那には見せられない顔してる😈',
      '既婚者とは思えない淫乱ぶり💦',
    ],
  },
  {
    keywords: ['素人'],
    comments: [
      '素人なのにこのクオリティは天才😳',
      '素人感が逆にリアルでヤバい🔥',
      '本当に素人？信じられないエロさ💦',
    ],
  },
  {
    keywords: ['巨乳', 'Fカップ', 'Gカップ', 'Hカップ', 'Iカップ'],
    comments: [
      'このおっぱいの大きさは反則🔥',
      '揺れる巨乳から目が離せない😤',
      'デカすぎておかしくなりそう💦',
    ],
  },
  {
    keywords: ['美少女', '10代'],
    comments: [
      'この若さでここまでできるのか😳🔥',
      '見た目とのギャップが最高すぎる',
      'かわいい顔してこんなことするの反則💦',
    ],
  },
  {
    keywords: ['レズ', 'レズビアン', '百合'],
    comments: [
      '女同士の絡みがエロすぎてヤバい🔥',
      '女の子がここまでするとは思わなかった😳',
      '男抜きでここまで達しちゃうの？💦',
    ],
  },
  {
    keywords: ['SM', '緊縛', '拘束'],
    comments: [
      '縛られて乱れる姿が最高すぎる😈🔥',
      'SMで覚醒した女の子の顔ヤバすぎ',
      '支配されながら感じまくってて最高💦',
    ],
  },
  {
    keywords: ['OL', 'オフィス', '制服'],
    comments: [
      'あのOLさんがこんな顔するとは😳🔥',
      '仕事中の顔と別人すぎてヤバい',
      'スーツ脱いだら別人級のエロさ💦',
    ],
  },
  {
    keywords: ['アナル'],
    comments: [
      'アナルまで使ってくれる神作品🔥',
      'バックドアで感じまくってて最高😤',
      'あそこだけじゃなくてここまで？💦',
    ],
  },
  {
    keywords: ['単体作品'],
    comments: [
      '単体ならではの密度で最高すぎる🔥',
      'この子だけに全力集中した結果がヤバい',
      '単体だから引きが全然違う😳',
    ],
  },
];

const FALLBACK_COMMENTS = [
  'これは今日一番の一本🔥',
  '見始めたら止まらなくなった😤💦',
  'クオリティ高すぎてヤバい作品🔥',
  '抜けすぎて動けなくなった😳',
  '今日のおすすめはこれ一択🔥',
  '久々に当たりを引いた感じ💦',
  '想像の10倍良かった作品🔥',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateComment(video) {
  const genres  = video.genres ?? [];
  const actress = video.actress ?? '';

  for (const { keywords, comments } of GENRE_TEMPLATES) {
    if (keywords.some(kw => genres.some(g => g.includes(kw)))) {
      return pickRandom(comments);
    }
  }

  if (actress && genres.includes('単体作品')) {
    const candidates = [
      `${actress}、本当にヤバすぎる🔥`,
      `${actress}のこんな姿初めて見た😳`,
      `${actress}が全力で魅せてくれる作品💦`,
    ].filter(c => c.length <= 30);
    if (candidates.length > 0) return pickRandom(candidates);
  }

  return pickRandom(FALLBACK_COMMENTS);
}

// ---------- helpers ----------
function truncateTitle(title, maxWeight = 60) {
  let w = 0, i = 0;
  for (const ch of title) {
    const delta = (ch.codePointAt(0) >= 0x1100) ? 2 : 1;
    if (w + delta > maxWeight) return title.slice(0, i) + '…';
    w += delta;
    i += ch.length;
  }
  return title;
}

function buildTweet(video, comment) {
  const title = truncateTitle(video.title);
  const url   = video.affiliateURL || '';
  return [
    '🔞今日の一本',
    '',
    `📽️「${title}」`,
    '',
    comment,
    '',
    url,
    '',
    '#FANZA #エロ動画 #AV #抜ける',
  ].join('\n');
}

const VIDEOS_PATH = path.resolve(__dirname, '../data/videos.json');
const OUT_PATH    = path.resolve(__dirname, '../tweets.md');

function loadVideos() {
  if (!fs.existsSync(VIDEOS_PATH)) {
    throw new Error('data/videos.json が見つかりません。先に npm run metadata を実行してください');
  }
  const data   = JSON.parse(fs.readFileSync(VIDEOS_PATH, 'utf8'));
  const videos = (data.videos ?? []).filter(v => v.videoURL || v.affiliateURL);
  if (videos.length === 0) throw new Error('有効な動画データがありません');
  return videos;
}

// ---------- main ----------
function main() {
  console.log('[tweet] 動画データを読み込み中...');
  const videos  = loadVideos();
  const video   = pickRandom(videos);
  console.log(`[tweet] 選択: ${video.title}`);
  console.log(`[tweet] ジャンル: ${(video.genres ?? []).join(', ') || 'なし'}`);

  const comment   = generateComment(video);
  const tweetText = buildTweet(video, comment);

  fs.writeFileSync(OUT_PATH, tweetText, 'utf8');
  console.log(`[tweet] 出力: ${OUT_PATH}`);
  console.log('\n' + tweetText);
}

main();
