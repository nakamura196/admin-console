# Admin Console

組織内の複数Webサイトについて、デプロイやデータ更新などの操作を **GitHubアカウントを持たない作業者** がブラウザから実行できるようにする管理コンソール。

各操作は **GitHub Actions の workflow_dispatch** を叩くだけのシンプルな構成で、認証は **Cloudflare Access (Zero Trust)** に任せています。配信は **Cloudflare Pages** (`@opennextjs/cloudflare` 経由のNext.js)。

## 機能

- サイトとアクションをYAML 1ファイルで定義（`config.yml`）
- 1サイトに複数アクション（例：「デプロイ」「ESインデックス更新」「バックアップ」）
- 詳細画面で実行履歴・ジョブごとのリアルタイムログを表示
- メール認証（Cloudflare Access）で作業者の入退室を制御
- 多言語対応（ja / en）

## 仕組み

```
[作業者]
  ↓ メール認証 (Cloudflare Access)
[admin console]   ← Next.js on Cloudflare Pages
  ↓ GitHub App (installation token)
[GitHub Actions: workflow_dispatch]
  ↓
[各リポジトリの workflow が npm run xxx などを実行]
```

## 新しい管理コンソールを作る（テンプレートとして使う）

**このリポジトリは GitHub の template repository です。** 別の組織・別の相手向けにもう 1 つ立てるときは、
コードには手を入れず、次の 4 つを用意するだけで動きます。

| 用意するもの | 内容 |
|---|---|
| `config.yml` | `config.example.yml` をコピーして編集。画面の文言・サイト・アクションはすべてここから生成される |
| GitHub App | 対象組織にインストール。権限は **Actions: Read and write** のみ |
| Cloudflare Pages プロジェクト | プロジェクト名はリポジトリ名と同じにする（別名にするならリポジトリ変数 `CF_PAGES_PROJECT` を設定） |
| Cloudflare Access のポリシー | 作業者のメールアドレスを登録する |

**1 デプロイ = 1 GitHub 組織**です。GitHub App の installation を 1 つしか持たないため、
別組織のリポジトリは扱えません。相手ごとに見せる範囲を分けたい場合も、インスタンスを分けるのが簡単です。

組織固有の値がコードに残らないよう、次のものは `config.yml` から生成し、**コミットしません**。

- `src/lib/sites.generated.ts`（サイト定義）
- `src/lib/app.generated.ts`（アプリ名・説明。`<title>` と OGP もここから）
- `src/messages/ja.json` / `en.json`（画面の文言）

`npm run dev` / `npm run build` / `npm run build:cloudflare` の前に自動生成されます。

## セットアップ手順

### 1. テンプレートから作成、またはクローン

GitHub の **Use this template** で新しいリポジトリを作るか、既存のものをクローンします。

```bash
git clone https://github.com/<your-org>/<your-console>.git
cd <your-console>
npm install
cp config.example.yml config.yml   # 新規に作る場合
```

### 2. GitHub App を作成

組織の **Settings → Developer settings → GitHub Apps → New GitHub App** で作成：

| 項目 | 値 |
|---|---|
| App name | `<your-org>-admin`（GitHub全体でユニーク） |
| Homepage URL | あなたの管理コンソールURL |
| Callback URL | 空 |
| Webhook | Active のチェックを外す |
| Repository permissions | **Actions: Read and write** のみ |
| Organization permissions | すべて No access |
| Installation target | Only on this account |

作成後：
1. **App ID** をメモ（数字）
2. **Generate a private key** で `.pem` ファイルをDL
3. **Install App** で対象組織にインストール → 必要なリポジトリを選択
4. インストール画面のURL末尾の数字が **Installation ID**

### 3. config.yml を編集

`config.yml.example` を `config.yml` にコピーして編集：

```yaml
app:
  title:
    ja: 管理コンソール
    en: Admin Console
  homePage:
    heading:
      ja: 管理コンソール
      en: Admin Console
    lead:
      ja: 各サイトのカードを開いて、操作を実行できます。
      en: Open a site card to run operations.
  footer:
    ja: © Your Org
    en: © Your Org

sites:
  - id: site-a
    name:
      ja: サイトA
      en: Site A
    description:
      ja: サイトAの説明
      en: Description of Site A
    url: https://site-a.example.com/
    actions:
      - id: deploy
        label:
          ja: デプロイを実行
          en: Deploy
        description:
          ja: ビルドして公開します。
          en: Build and publish.
        type: github-workflow
        repo: your-org/site-a
        workflow: deploy.yml
        ref: main
      - id: es-sync
        label:
          ja: ESインデックス更新
          en: Re-index
        description:
          ja: Elasticsearch を再同期します。
          en: Re-syncs Elasticsearch.
        type: github-workflow
        repo: your-org/site-a
        workflow: es-sync.yml
        ref: main
        inputs:
          - name: dry_run
            type: boolean
            default: false
            label:
              ja: Dry run
              en: Dry run
```

`config:generate` を走らせて、`src/lib/sites.generated.ts` と `src/messages/{ja,en}.json` を生成：

```bash
npm run config:generate
```

(`npm run dev` / `npm run build` 実行時に自動で走ります。)

### 4. 各リポジトリに workflow を追加

対象リポジトリの `.github/workflows/<workflow-file>.yml` を作成：

> **workflow ファイルはデフォルトブランチに置くこと。**
> `workflow_dispatch` は、対象の workflow がデフォルトブランチに存在しないと起動できません
> (`config.yml` の `ref` で別ブランチを指定して実行することはできますが、ファイル自体は
> デフォルトブランチにマージされている必要があります)。

```yaml
name: Admin trigger

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run'
        type: boolean
        default: false

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - env:
          ES_URL: ${{ secrets.ES_URL }}
          # 各リポジトリ側でSecretsに設定
        run: |
          if [ "${{ inputs.dry_run }}" = "true" ]; then
            npm run my-action:dry
          else
            npm run my-action
          fi
```

各リポジトリの **Secrets** に必要な値を投入。

### 5. ローカル開発

機密情報は 1Password に格納し、`op run` 経由で注入する。

1. 1Password に item を作成（例: vault `Personal` / item `<your-console>`、カテゴリは API Credential）。フィールド:
   - `app_id` (text) … 上で取得した App ID
   - `installation_id` (text) … Installation ID
   - `private_key` (concealed) … `.pem` ファイルの中身を改行込みでそのまま
2. `.env.local` には 1Password シークレット参照のみを書く:

   ```
   GITHUB_APP_ID=op://Personal/<item>/app_id
   GITHUB_INSTALLATION_ID=op://Personal/<item>/installation_id
   GITHUB_APP_PRIVATE_KEY=op://Personal/<item>/private_key
   ```
3. 起動:

   ```bash
   npm run dev:op   # = op run --env-file=.env.local -- npm run dev
   # http://localhost:3200
   ```

   `op` CLI のサインインが必要（`op signin` または Touch ID）。本番の Cloudflare Pages では `op` は不要で、Secret 変数に直接 PEM を入れる。

### 6. Cloudflare Pages にデプロイ

```bash
# 初回
npx wrangler login
npx wrangler pages project create <project-name> --production-branch=main

# デプロイ
npm run deploy
```

Cloudflare Dashboard → Workers & Pages → `<project-name>` → **Settings → Variables and Secrets** で本番Secretsを設定：

- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`（PEM全文、改行含む）

### 7. カスタムドメイン

Cloudflareが管理しているゾーンにサブドメイン（例：`admin.example.com`）を作る場合、Pages → **Custom domains** → Add で追加。CNAMEレコードは自動で作成されます。

外部DNS（Cloudflare以外）でゾーン管理している場合は、CNAMEを手動で `<project-name>.pages.dev` に向けてください。

### 8. Cloudflare Access (Zero Trust) でアクセス制限

Cloudflare Dashboard → **Zero Trust** → 初回はチームドメインを設定 → **Access → Applications → Add an application → Self-hosted**

| 項目 | 値 |
|---|---|
| Application domain | `admin.example.com`（とPages公開URLも `self_hosted_domains` に追加） |
| Identity provider | One-time PIN（メールワンタイム）等 |
| Policy: Action | Allow |
| Policy: Selector | Emails → 許可するメールアドレスを列挙 |

Pagesのプレビューデプロイ用URLも保護したい場合、`*.<project-name>.pages.dev` も追加すること。

## 環境変数一覧

| 変数 | 用途 | 必須 |
|---|---|---|
| `GITHUB_APP_ID` | GitHub App ID | ✅ |
| `GITHUB_INSTALLATION_ID` | GitHub App Installation ID | ✅ |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App秘密鍵（PEM全文） | ✅ |
| `NEXT_PUBLIC_SITE_URL` | OG/メタタグ用。未設定なら `config.yml` の `app.url` を使う | |
| `NEXT_PUBLIC_BASE_PATH` | サブパス配信時 | |

## 開発コマンド

```bash
npm run dev               # 開発サーバ (port 3200)
npm run build             # 静的ビルド検証
npm run build:cloudflare  # Cloudflare用ビルド
npm run deploy            # ビルド + Cloudflare Pages デプロイ
npm run config:generate   # config.yml から sites.generated.ts と messages を再生成
```

## ディレクトリ構成

```
config.yml                    # サイト・アクション・i18n の単一の真実
scripts/
  generate-config.js          # config.yml → sites.generated.ts + messages/*.json
src/
  app/[locale]/
    page.tsx                  # ホーム（サイト一覧）
    sites/[siteId]/page.tsx   # サイト詳細（タブ・履歴・ログ）
    how-to-use/page.tsx       # 作業者向け使い方ガイド
  app/api/
    trigger/[siteId]/[actionId]/route.ts
    runs/[siteId]/[actionId]/route.ts
    runs/[siteId]/[actionId]/[runId]/route.ts
    runs/[siteId]/[actionId]/[runId]/jobs/[jobId]/log/route.ts
  components/
    layout/Header.tsx
    page/home/SiteCard.tsx
    page/site/SiteDetail.tsx
  lib/
    github.ts                 # GitHub App認証 + workflow_dispatch + log fetch
    sites.generated.ts        # AUTO-GENERATED from config.yml
  messages/
    _template/{ja,en}.json    # UI内部テキスト（編集する側）
    {ja,en}.json              # AUTO-GENERATED
```

## ライセンス

MIT
