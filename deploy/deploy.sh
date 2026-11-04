#!/bin/bash
# GitHub の最新をサーバーの公開フォルダへ反映する（cron で 5 分おきに実行）
# 使い方: deploy.sh [force]   force を付けると更新が無くても反映する
set -eu

REPO="$HOME/afi"
WEB="$HOME/public_html"
GIT=/usr/local/cpanel/3rdparty/lib/path-bin/git

# 前回の反映が終わっていなければ何もしない
exec 9>"$HOME/.deploy.lock"
flock -n 9 || exit 0

cd "$REPO"
"$GIT" fetch -q --depth 1 origin master
if [ "$("$GIT" rev-parse HEAD)" = "$("$GIT" rev-parse FETCH_HEAD)" ] && [ "${1:-}" != force ]; then
  exit 0
fi
"$GIT" reset -q --hard FETCH_HEAD

rsync -rlt --delete --chmod=D755,F644 --exclude-from=deploy/rsync-exclude ./ "$WEB/"

mkdir -p "$WEB/api"
cp deploy/likes.php "$WEB/api/likes.php"
cp deploy/ad.htaccess "$WEB/ad/.htaccess"
chmod 644 "$WEB/api/likes.php" "$WEB/ad/.htaccess"

# cPanel が書いた部分を残したまま、サイトの設定だけ差し替える
sed -i '/^# BEGIN nukidoki$/,/^# END nukidoki$/d' "$WEB/.htaccess"
cat deploy/htaccess "$WEB/.htaccess" > "$WEB/.htaccess.new"
mv "$WEB/.htaccess.new" "$WEB/.htaccess"

echo "$(date '+%F %T') deployed $("$GIT" rev-parse --short HEAD)"
