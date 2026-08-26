/**
 * config.yml を読んで、以下のファイルを生成する：
 *  - src/lib/sites.generated.ts    （server-side用、型付きsites配列）
 *  - src/lib/app.generated.ts      （アプリ名・説明。メタデータ用）
 *  - src/messages/ja.json          （UI内部テキスト + config.ymlのテキストをマージ）
 *  - src/messages/en.json
 *
 * 生成物はコミットしない（.gitignore 済み）。テンプレートとして複製したときに
 * 前の組織の文言が残らないようにするため。
 *
 * config.yml が変更されるたびに `npm run config:generate` を実行する想定。
 * `npm run dev` / `npm run build` の前に自動実行される。
 */

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')
const CONFIG_PATH = path.join(ROOT, 'config.yml')
const TEMPLATE_DIR = path.join(ROOT, 'src/messages/_template')

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`❌ config.yml not found at ${CONFIG_PATH}`)
  console.error(`   Copy config.example.yml to config.yml and edit.`)
  process.exit(1)
}

const config = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf-8'))

// -------------------------------------------------------------
// 1. src/lib/sites.generated.ts を生成
// -------------------------------------------------------------
const normalizedSites = (config.sites || []).map((s) => ({
  id: s.id,
  url: s.url,
  actions: (s.actions || []).map((a) => normalizeAction(a)),
}))

const sitesTs = `// AUTO-GENERATED from config.yml. Do not edit by hand.
// Run \`npm run config:generate\` to regenerate.

export type ActionInput = {
  name: string
  type: 'boolean' | 'string'
  default?: string | boolean
}

export type SiteAction =
  | {
      id: string
      type: 'github-workflow'
      repo: string
      workflow: string
      ref: string
      inputs?: ActionInput[]
      fixedInputs?: Record<string, string | boolean>
    }
  | {
      id: string
      type: 'vercel-deploy-hook'
      envHookKey: string
    }

export type SiteDef = {
  id: string
  url: string
  actions: SiteAction[]
}

export const SITES: SiteDef[] = ${JSON.stringify(normalizedSites, null, 2)}

export function getSite(id: string): SiteDef | undefined {
  return SITES.find((s) => s.id === id)
}

export function getAction(siteId: string, actionId: string): SiteAction | undefined {
  const site = getSite(siteId)
  return site?.actions.find((a) => a.id === actionId)
}
`
fs.writeFileSync(path.join(ROOT, 'src/lib/sites.generated.ts'), sitesTs)
console.log('✅ Generated src/lib/sites.generated.ts')

function normalizeAction(action) {
  if (!action) return null
  if (action.type === 'github-workflow') {
    return {
      id: action.id,
      type: 'github-workflow',
      repo: action.repo,
      workflow: action.workflow || 'admin.yml',
      ref: action.ref || 'main',
      ...(action.inputs?.length
        ? {
            inputs: action.inputs.map((i) => ({
              name: i.name,
              type: i.type,
              default: i.default,
            })),
          }
        : {}),
      ...(action.fixedInputs && Object.keys(action.fixedInputs).length
        ? { fixedInputs: action.fixedInputs }
        : {}),
    }
  }
  if (action.type === 'vercel-deploy-hook') {
    return {
      id: action.id,
      type: 'vercel-deploy-hook',
      envHookKey: action.envHookKey,
    }
  }
  return action
}

// -------------------------------------------------------------
// 2. src/messages/{ja,en}.json を生成
// -------------------------------------------------------------
for (const locale of ['ja', 'en']) {
  const templatePath = path.join(TEMPLATE_DIR, `${locale}.json`)
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${templatePath}`)
    process.exit(1)
  }
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))

  const sitesI18n = {}
  const inputsI18n = {}
  for (const s of config.sites || []) {
    sitesI18n[s.id] = {
      name: s.name?.[locale] ?? s.id,
      description: s.description?.[locale] ?? '',
      actions: Object.fromEntries(
        (s.actions || []).map((a) => [
          a.id,
          {
            label: a.label?.[locale] ?? a.id,
            description: a.description?.[locale] ?? '',
          },
        ])
      ),
    }
    for (const a of s.actions || []) {
      for (const input of a.inputs || []) {
        inputsI18n[input.name] = input.label?.[locale] ?? input.name
      }
    }
  }

  const merged = {
    ...template,
    Common: {
      ...(template.Common || {}),
      title: config.app?.title?.[locale] ?? template.Common?.title ?? '',
      description: config.app?.description?.[locale] ?? template.Common?.description ?? '',
    },
    HomePage: {
      ...(template.HomePage || {}),
      heading: config.app?.homePage?.heading?.[locale] ?? template.HomePage?.heading ?? '',
      lead: config.app?.homePage?.lead?.[locale] ?? template.HomePage?.lead ?? '',
    },
    Footer: {
      ...(template.Footer || {}),
      copyright: config.app?.footer?.[locale] ?? template.Footer?.copyright ?? '',
    },
    Sites: sitesI18n,
    Inputs: inputsI18n,
  }
  fs.writeFileSync(
    path.join(ROOT, `src/messages/${locale}.json`),
    JSON.stringify(merged, null, 2) + '\n'
  )
  console.log(`✅ Generated src/messages/${locale}.json`)
}

// -------------------------------------------------------------
// 3. src/lib/app.generated.ts を生成（アプリ名・説明）
// -------------------------------------------------------------
// メタデータ (<title> や OGP) もここから引く。config.yml が唯一の出どころ。
const appTs = `// AUTO-GENERATED from config.yml. Do not edit by hand.
// Run \`npm run config:generate\` to regenerate.

export const APP = ${JSON.stringify(
  {
    title: {
      ja: config.app?.title?.ja ?? 'Admin Console',
      en: config.app?.title?.en ?? 'Admin Console',
    },
    description: {
      ja: config.app?.description?.ja ?? '',
      en: config.app?.description?.en ?? '',
    },
    // 配信先 URL (OGP / metadataBase 用)。環境変数 NEXT_PUBLIC_SITE_URL が優先。
    url: config.app?.url ?? '',
    // 「使い方」ページに載せるスクリーンショット。public/images/how-to-use/ に置いた
    // ファイル名を並べる。空なら画像なしで手順だけを表示する。
    // 画面はコンソールごとに違うので、テンプレートには画像を同梱しない。
    howToUseImages: config.app?.howToUseImages ?? [],
  },
  null,
  2
)} as const
`
fs.writeFileSync(path.join(ROOT, 'src/lib/app.generated.ts'), appTs)
console.log('✅ Generated src/lib/app.generated.ts')
