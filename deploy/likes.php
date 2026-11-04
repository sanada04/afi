<?php
// 「ドキッ」の回数を数える API
//   GET  /api/likes                     → { "counts": { 作品ID: 回数 } }
//   POST /api/likes { "id", "on": bool } → 押した / 取り消した
// データは公開フォルダの外（~/nukidoki-data）の SQLite に保存する

const ORIGIN     = 'https://nukidoki.net';
const ID_PATTERN = '/^[a-z0-9_]{1,40}$/';
const RATE_LIMIT = 30; // 1 分あたりの回数（同じ接続元）

function respond(int $status, ?array $body = null): void {
    http_response_code($status);
    if ($body !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_FORCE_OBJECT);
    }
    exit;
}

function dataDir(): string {
    $dir = dirname(__DIR__, 2) . '/nukidoki-data';
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    return $dir;
}

function openDb(): PDO {
    $db = new PDO('sqlite:' . dataDir() . '/likes.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_TIMEOUT, 5);
    $db->exec('CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS likers (id TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (id, visitor))');
    $db->exec('CREATE TABLE IF NOT EXISTS rate (visitor TEXT NOT NULL, minute INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (visitor, minute))');
    return $db;
}

// IP はそのまま保存せず、ハッシュにして「同じ人の二重カウント」の判定にだけ使う
function visitor(): string {
    $saltFile = dataDir() . '/salt';
    if (!is_file($saltFile)) {
        file_put_contents($saltFile, bin2hex(random_bytes(32)));
        chmod($saltFile, 0600);
    }
    return substr(hash('sha256', file_get_contents($saltFile) . ':' . $_SERVER['REMOTE_ADDR']), 0, 24);
}

function withinRateLimit(PDO $db, string $visitor): bool {
    $minute = intdiv(time(), 60);
    $db->prepare('DELETE FROM rate WHERE minute < ?')->execute([$minute - 1]);
    $db->prepare('INSERT INTO rate (visitor, minute, used) VALUES (?, ?, 1)
                  ON CONFLICT (visitor, minute) DO UPDATE SET used = used + 1')->execute([$visitor, $minute]);
    $used = $db->prepare('SELECT used FROM rate WHERE visitor = ? AND minute = ?');
    $used->execute([$visitor, $minute]);
    return (int) $used->fetchColumn() <= RATE_LIMIT;
}

// 同じ人が同じ作品を押しても 1 回だけ数える
function recordLike(PDO $db, string $id, bool $on, string $visitor): void {
    if ($on) {
        $change = $db->prepare('INSERT OR IGNORE INTO likers (id, visitor) VALUES (?, ?)');
    } else {
        $change = $db->prepare('DELETE FROM likers WHERE id = ? AND visitor = ?');
    }
    $change->execute([$id, $visitor]);
    if ($change->rowCount() === 0) return;

    $delta = $on ? 1 : -1;
    $db->prepare('INSERT INTO likes (id, count) VALUES (?, ?)
                  ON CONFLICT (id) DO UPDATE SET count = count + ?')->execute([$id, $delta, $delta]);
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        header('Cache-Control: public, max-age=60');
        $counts = [];
        foreach (openDb()->query('SELECT id, count FROM likes WHERE count > 0') as $row) {
            $counts[$row['id']] = (int) $row['count'];
        }
        respond(200, ['counts' => $counts]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        respond(405, ['error' => 'method not allowed']);
    }

    header('Cache-Control: no-store');
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== ORIGIN) respond(403, ['error' => 'forbidden']);

    $body = json_decode((string) file_get_contents('php://input'), true);
    $id   = $body['id'] ?? null;
    $on   = $body['on'] ?? null;
    if (!is_string($id) || !preg_match(ID_PATTERN, $id) || !is_bool($on)) {
        respond(400, ['error' => 'invalid request']);
    }

    $db = openDb();
    $who = visitor();
    $db->beginTransaction();
    $allowed = withinRateLimit($db, $who);
    if ($allowed) recordLike($db, $id, $on, $who);
    $db->commit();
    $allowed ? respond(204) : respond(429, ['error' => 'too many requests']);
} catch (Throwable $e) {
    error_log('[likes] ' . $e->getMessage());
    respond(500, ['error' => 'internal error']);
}
