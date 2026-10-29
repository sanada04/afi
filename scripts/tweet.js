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
const BASE_URL = 'https://nukidoki.net';

// X の文字数カウント: 日本語などは 2、英数字は 1、URL は長さに関係なく 23
const URL_WEIGHT = 23;
const MAX_WEIGHT = 280;
function weightOf(text) {
  let w = 0;
  for (const part of text.split(/(https?:\/\/\S+)/)) {
    if (/^https?:\/\//.test(part)) { w += URL_WEIGHT; continue; }
    for (const ch of part) w += ch.codePointAt(0) >= 0x1100 ? 2 : 1;
  }
  return w;
}

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

// サイト内の URL。日本語は X でリンクが途切れるのでエンコードし、
// 投稿の種類を GA で見分けられるよう UTM を付ける
const videoPath   = id   => `/video/${encodeURIComponent(id)}/`;
const actressPath = name => `/actress/${encodeURIComponent(name)}/`;
const withUtm = (pathname, campaign) =>
  `${BASE_URL}${pathname}?utm_source=x&utm_medium=social&utm_campaign=${campaign}`;

const splitActress = v => (v.actress || '').split(',').map(s => s.trim()).filter(Boolean);
const mainActress  = v => splitActress(v)[0] || '';
const dayIndex     = d => Math.floor((d.getTime() + 9 * 3600 * 1000) / 86400000); // JST の日付ごとに 1 ずつ増える
const rotate       = (arr, d) => arr[dayIndex(d) % arr.length];
const NUMS         = ['1️⃣', '2️⃣', '3️⃣'];

// ---------- 投稿の組み立て ----------
// 本文にはリンクを入れず、リンクは自分のリプライに付ける（外部リンク付きの投稿は表示が伸びにくいため）

function rankingFirst(top) {
  const who = mainActress(top);
  return {
    name: '人気1位の紹介', time: '12:00',
    body: [
      '今FANZAで一番売れてるのがこれ👀',
      '',
      `「${truncateTitle(top.title, 70)}」`,
      ...(who ? [`出演: ${who}`] : []),
      '',
      generateComment(top),
    ],
    reply: `サンプルはここでスワイプで見られます▶ ${withUtm(videoPath(top.id), 'ranking1')}`,
  };
}

function top3(kind, list) {
  const isRanking = kind === 'ranking';
  return {
    name: isRanking ? '人気ランキングTOP3' : '新着TOP3', time: isRanking ? '21:00' : '19:00',
    body: [
      isRanking ? '【今日の人気ランキングTOP3】' : '【今日の新着TOP3】',
      '',
      ...list.slice(0, 3).map((v, i) => `${NUMS[i]} ${mainActress(v)}「${truncateTitle(v.title, 36)}」`),
      '',
      isRanking ? '4位以下はこちら👇' : '新着は毎日更新してます🆕',
    ],
    reply: withUtm(isRanking ? '/ranking/' : '/new/', isRanking ? 'ranking_top3' : 'new_top3'),
  };
}

function actressFeature(name, list) {
  return {
    name: '女優特集', time: '22:00',
    body: [
      `【今日の女優特集】${name}`,
      '',
      `サンプル動画${list.length}本をまとめました。`,
      `最新作は「${truncateTitle(list[0].title, 50)}」`,
      '',
      '全部スワイプで見比べられます👇',
      '',
      `#${name.replace(/[\s（(].*$/, '')}`, // 「名前（旧名）」のような表記は括弧の前だけをタグにする
    ],
    reply: withUtm(actressPath(name), 'actress'),
  };
}

function todaysPick(video) {
  return {
    name: '今日の一本', time: '23:30',
    body: [
      '🔞今日の一本',
      '',
      `📽️「${truncateTitle(video.title, 60)}」`,
      '',
      generateComment(video),
    ],
    reply: withUtm(videoPath(video.id), 'pick'),
  };
}

const POLLS = [
  { q: 'どっち派？', options: ['巨乳', 'スレンダー', '人妻', '美少女'] },
  { q: '一番グッとくるシチュエーションは？', options: ['職場・OL', '旅行・温泉', 'ナンパ', '寝取られ'] },
  { q: '見る時間帯はいつが多い？', options: ['朝', '昼休み', '夜', '深夜'] },
  { q: '作品選びで一番重視するのは？', options: ['女優', 'ジャンル', 'パッケージ', 'ランキング'] },
];

function poll(date) {
  const p = rotate(POLLS, date);
  return {
    name: '投票（リンクなし）', time: '週末の夜',
    body: ['正直に答えてほしい🔞', '', p.q],
    note: `選択肢: ${p.options.join(' / ')}`,
  };
}

// ---------- main ----------
const VIDEOS_PATH = path.resolve(__dirname, '../data/videos.json');
const OUT_PATH    = path.resolve(__dirname, '../tweets.md');

function loadData() {
  if (!fs.existsSync(VIDEOS_PATH)) {
    throw new Error('data/videos.json が見つかりません。先に npm run metadata を実行してください');
  }
  const data = JSON.parse(fs.readFileSync(VIDEOS_PATH, 'utf8'));
  // サイトで再生できる（作品ページがある）動画だけを使う
  const videos = (data.videos ?? []).filter(v => v.videoURL)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (videos.length === 0) throw new Error('有効な動画データがありません');
  const byId = new Map(videos.map(v => [v.id, v]));
  const feed = name => (data.feeds?.[name] ?? []).map(id => byId.get(id)).filter(Boolean);
  return {
    videos,
    ranking:   feed('popular'),
    newest:    feed('new').length ? feed('new') : videos,
    recommend: feed('recommend'),
  };
}

// リンク付きの投稿は FANZA 作品の宣伝なので、ステマ規制に沿って #PR を付ける
function withPr(lines) {
  const last = lines[lines.length - 1];
  return last.startsWith('#') ? [...lines.slice(0, -1), `${last} #PR`] : [...lines, '', '#PR'];
}

function render(post) {
  const body = (post.reply ? withPr(post.body) : post.body).join('\n').trim();
  const w = weightOf(body);
  return [
    `## ${post.name}（おすすめ ${post.time}）`,
    '',
    '本文:',
    '```',
    body,
    '```',
    post.reply ? `リプライ:\n\`\`\`\n${post.reply}\n\`\`\`` : '',
    post.note || '',
    w > MAX_WEIGHT ? `⚠️ 本文が長すぎます（${w} / ${MAX_WEIGHT}）` : `文字数: ${w} / ${MAX_WEIGHT}`,
  ].filter(Boolean).join('\n');
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const today  = new Date();
  const { videos, ranking, newest, recommend } = loadData();

  // 女優特集は作品数の多い上位 20 人（3 本以上）を日替わりで回す
  const byActress = new Map();
  for (const v of videos) {
    for (const a of splitActress(v)) (byActress.get(a) ?? byActress.set(a, []).get(a)).push(v);
  }
  const featured = [...byActress]
    .filter(([, list]) => list.length >= 3)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 20);

  const posts = [];
  if (ranking.length) posts.push(rankingFirst(ranking[0]));
  if (newest.length >= 3) posts.push(top3('new', newest));
  if (ranking.length >= 3) posts.push(top3('ranking', ranking));
  if (featured.length) posts.push(actressFeature(...rotate(featured, today)));
  // 今日の一本は、ほかの投稿で紹介した作品と被らないように選ぶ
  const used = new Set([...ranking.slice(0, 3), ...newest.slice(0, 3)].map(v => v.id));
  const pickFrom = (recommend.length ? recommend : videos).slice(0, 30).filter(v => !used.has(v.id));
  if (pickFrom.length) posts.push(todaysPick(pickRandom(pickFrom)));
  posts.push(poll(today));

  const jstDate = new Date(today.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const md = [
    `# X 投稿案（${jstDate}）`,
    '',
    '本文を投稿したあと、その投稿に「リプライ」の URL を返信として付けてください。',
    'URL の utm_campaign で、どの種類の投稿から来たかを Google アナリティクスで見分けられます。',
    '',
    posts.map(render).join('\n\n'),
    '',
  ].join('\n');

  if (dryRun) {
    console.log(md);
    return;
  }
  fs.writeFileSync(OUT_PATH, md, 'utf8');
  console.log(`[tweet] ${posts.length} 件の投稿案を出力: ${OUT_PATH}`);
}

main();
