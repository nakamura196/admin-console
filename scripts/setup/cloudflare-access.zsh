#!/usr/bin/env zsh
set -euo pipefail

# =====================================================
# Cloudflare Access で管理コンソールを保護する
# =====================================================
#
# 前提:
#   - Cloudflare の API トークンを 1Password に保存済みであること。
#     権限は Account / Access: Apps and Policies / Edit（Pages: Edit も同じトークンで可）
#   - Pages プロジェクトが作成済みであること (wrangler pages project create)
#   - op CLI と Cloudflare アカウント ID
#
# 何をするか:
#   1. Access アプリケーションを作成 (対象ドメイン = 管理コンソールの URL)
#   2. 許可ポリシーを作成 (下記のメールアドレスのみ入室可)
#   3. 保護が効いているか実際に HTTP で確認
#
# 実行は 1 回きり。値は画面に出さない。
#
#   zsh scripts/setup/cloudflare-access.zsh

OP_ITEM="${OP_ITEM:?1Password の項目名を指定してください (例: OP_ITEM='Cloudflare API Token my-console')}"
OP_VAULT="${OP_VAULT:-Personal}"
ACCOUNT_ID="${CF_ACCOUNT_ID:?Cloudflare のアカウント ID を指定してください}"
APP_DOMAIN="${APP_DOMAIN:?保護するドメインを指定してください (例: APP_DOMAIN=my-console.pages.dev)}"
APP_NAME="${APP_NAME:-管理コンソール}"

# 入室を許可するメールアドレス
ALLOWED_EMAILS=(
  "you@example.org"
)

API="https://api.cloudflare.com/client/v4"

echo "▶ トークンを 1Password から読み込みます: op://${OP_VAULT}/${OP_ITEM}/credential"
TOKEN="$(op read "op://${OP_VAULT}/${OP_ITEM}/credential" | tr -d '\n')"
if [[ -z "$TOKEN" ]]; then
  echo "✗ トークンを読み込めませんでした。項目名を確認してください（パレンを含む名前は op が解釈できません）"
  exit 1
fi

# 検証の窓口は 2 つある。My Profile で作った「ユーザー所有」トークンは
# /user/tokens/verify、アカウント所有は /accounts/<id>/tokens/verify。
# 片方だけ見ると、有効なトークンを「無効」と誤判定する。
echo "▶ トークンを検証します"
if curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/user/tokens/verify" > /dev/null; then
  echo "  有効です (ユーザー所有トークン)"
elif curl -sf -H "Authorization: Bearer ${TOKEN}" "${API}/accounts/${ACCOUNT_ID}/tokens/verify" > /dev/null; then
  echo "  有効です (アカウント所有トークン)"
else
  echo "✗ トークンが無効です"
  exit 1
fi

echo "▶ Access アプリケーションを作成します: ${APP_DOMAIN}"
APP_JSON=$(curl -s -X POST "${API}/accounts/${ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --arg name "$APP_NAME" --arg domain "$APP_DOMAIN" \
    '{name:$name, domain:$domain, type:"self_hosted", session_duration:"24h",
      auto_redirect_to_identity:false, app_launcher_visible:false}')")

APP_ID=$(echo "$APP_JSON" | jq -r '.result.id // empty')
if [[ -z "$APP_ID" ]]; then
  echo "✗ 作成に失敗しました:"
  echo "$APP_JSON" | jq -r '.errors[]?.message'
  exit 1
fi
echo "  app_id=${APP_ID}"

echo "▶ 許可ポリシーを作成します (${#ALLOWED_EMAILS[@]} 名)"
INCLUDE=$(printf '%s\n' "${ALLOWED_EMAILS[@]}" | jq -R '{email:{email:.}}' | jq -s '.')
POLICY_JSON=$(curl -s -X POST "${API}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "$(jq -n --argjson include "$INCLUDE" \
    '{name:"許可された担当者のみ", decision:"allow", include:$include}')")

POLICY_ID=$(echo "$POLICY_JSON" | jq -r '.result.id // empty')
if [[ -z "$POLICY_ID" ]]; then
  echo "✗ ポリシー作成に失敗しました:"
  echo "$POLICY_JSON" | jq -r '.errors[]?.message'
  exit 1
fi
echo "  policy_id=${POLICY_ID}"

unset TOKEN

echo "▶ 保護が効いているか確認します"
FINAL=$(curl -s -o /dev/null -w '%{url_effective}' -L --max-time 25 "https://${APP_DOMAIN}/")
if [[ "$FINAL" == *"cloudflareaccess.com"* ]]; then
  echo "✓ ログイン画面にリダイレクトされました。保護されています"
else
  echo "✗ リダイレクトされませんでした。到達先: ${FINAL}"
  echo "  （デプロイ前だとこの確認は失敗します。デプロイ後に再確認してください）"
fi

echo
echo "許可したアドレス:"
printf '  - %s\n' "${ALLOWED_EMAILS[@]}"
echo "ログイン方法は、この Access 組織に設定済みのもの（Google など）が使えます。"
echo "アドレスを増やす場合は ALLOWED_EMAILS に足したうえで、既存ポリシーを更新してください:"
echo "  PUT ${API}/accounts/<account>/access/apps/<app_id>/policies/<policy_id>"
