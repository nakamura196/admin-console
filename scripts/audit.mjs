/**
 * `npm audit` の結果を判定する。high 以上があれば失敗する。
 *
 * `npm audit --audit-level=high` をそのまま使わないのは、直せない既知の 1 件で
 * CI が止まり続け、そのうち誰も見なくなるため。除外する場合は下の ALLOW に
 * 理由と期限を書いて残す。期限を過ぎたら、除外していても失敗させる。
 * 「なぜ放置しているのか」と「いつ見直すのか」が、常にこのファイルに残る。
 *
 * 使い方: node scripts/audit.mjs
 */
import { execFileSync } from 'node:child_process'

/** @type {{ id: string, package: string, until: string, reason: string }[]} */
const ALLOW = [
  {
    id: 'GHSA-6g55-p6wh-862q',
    package: 'postcss (next 同梱)',
    until: '2026-12-08',
    reason:
      'next が node_modules/next/node_modules/postcss に 8.4.31 を同梱している。' +
      'これを差し替える正規の経路は next 16 系へのメジャー更新だけで、この PR (脆弱性に気づく仕組みを入れる PR) の範囲を超える。' +
      '内容は「CSS のコメントに書かれた sourceMappingURL を信用して .map ファイルを読む」もので、踏むにはビルド対象の CSS に攻撃者が細工できる必要がある。' +
      '当リポジトリがビルドする CSS は自前のソースと npm 依存だけで、外部入力は一切通らないため実害が無い。',
  },
  {
    id: 'GHSA-r28c-9q8g-f849',
    package: 'postcss (next 同梱)',
    until: '2026-12-08',
    reason: 'GHSA-6g55-p6wh-862q と同じ sourceMappingURL 経由の .map 読み出し。同上の理由で保留。',
  },
  {
    id: 'GHSA-f88m-g3jw-g9cj',
    package: 'sharp',
    until: '2026-12-08',
    reason:
      '修正版は sharp 0.35.4 だが、wrangler が依存する miniflare が sharp を "0.35.2" と完全固定しているため上げられない (npm audit fix でも解決不能)。' +
      '内容は sharp が同梱する libvips の画像デコーダの脆弱性で、悪意ある画像ファイルを sharp に読ませたときにだけ問題になる。' +
      'sharp の到達経路は wrangler (ローカル開発とデプロイ用ツール) と next の任意依存のみで、Cloudflare Pages 上で動く Worker のバンドルには入らない。' +
      'miniflare が sharp 0.35.4 以降を取り込んだ時点で解消する。',
  },
  {
    id: 'GHSA-rgj7-g3m4-5g8c',
    package: 'sharp',
    until: '2026-12-08',
    reason: 'GHSA-f88m-g3jw-g9cj と同じく sharp 同梱の画像デコーダ (libheif) の脆弱性。miniflare の固定により上げられない。同上の理由で保留。',
  },
  {
    id: 'GHSA-qx2v-qp2m-jg93',
    package: 'postcss (next 同梱)',
    until: '2026-12-08',
    reason: '同じ next 同梱 postcss 8.4.31 の件 (CSS 文字列化時の </style> 未エスケープ)。advisory 自体は moderate。同上の理由で保留。',
  },
  {
    id: 'GHSA-fxqj-rqcc-2cmp',
    package: 'postcss (next 同梱)',
    until: '2026-12-08',
    reason: 'GHSA-6g55-p6wh-862q の修正漏れ。advisory 自体は moderate。同上の理由で保留。',
  },
]

function audit() {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    )
  } catch (error) {
    // 脆弱性があると npm audit は終了コード 1 を返す。出力は標準出力に出ている。
    if (error.stdout) return JSON.parse(error.stdout)
    throw error
  }
}

const today = new Date().toISOString().slice(0, 10)
const report = audit()
const serious = []

for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  if (entry.severity !== 'high' && entry.severity !== 'critical') continue
  for (const via of entry.via) {
    if (typeof via !== 'object') continue
    const allowed = ALLOW.find((a) => a.id === via.url?.split('/').pop() || a.id === via.source)
    if (allowed && allowed.until >= today) continue
    serious.push({
      name,
      severity: entry.severity,
      title: via.title,
      url: via.url,
      expired: allowed ? allowed.until : null,
    })
  }
}

for (const a of ALLOW) {
  if (a.until < today) {
    console.error(`除外の期限切れ: ${a.package} (${a.id}) の期限 ${a.until} を過ぎています。見直してください。`)
  }
}

if (serious.length === 0) {
  const skipped = ALLOW.filter((a) => a.until >= today)
  console.log(`high 以上の脆弱性なし (期限内の除外 ${skipped.length} 件)`)
  for (const a of skipped) console.log(`  除外中: ${a.package} ${a.id} (期限 ${a.until})`)
  process.exit(0)
}

console.error(`high 以上の脆弱性が ${serious.length} 件あります:`)
for (const s of serious) {
  const note = s.expired ? ` [除外の期限 ${s.expired} 切れ]` : ''
  console.error(`  ${s.severity.padEnd(8)} ${s.name}: ${s.title}${note}`)
  console.error(`           ${s.url}`)
}
process.exit(1)
