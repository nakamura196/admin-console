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
  // braces は 2026-10 時点で GitHub Advisory Database に修正版が無い (最新の 3.0.3 でも直らない)。
  // eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces の経路で、
  // lint 時の glob 展開にのみ使われ、実行時に外部入力を処理しない。上流の修正版が出るまで保留する。
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    package: 'braces',
    until: '2026-11-15',
    reason: 'lint 時 (eslint-config-next → fast-glob 経由) の glob 展開のみに使用。上流に修正版なし',
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
const serious = new Map()

for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  if (entry.severity !== 'high' && entry.severity !== 'critical') continue
  for (const via of entry.via) {
    if (typeof via !== 'object') continue
    if (via.severity !== 'high' && via.severity !== 'critical') continue
    const id = (via.url || '').split('/').pop()
    const allowed = ALLOW.find((a) => a.id === id || a.id === via.source)
    if (allowed && allowed.until >= today) continue
    const key = `${via.name || name}|${id}`
    if (serious.has(key)) continue
    serious.set(key, {
      name: via.name || name,
      severity: via.severity,
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

if (serious.size === 0) {
  const skipped = ALLOW.filter((a) => a.until >= today)
  console.log(`high 以上の脆弱性なし (期限内の除外 ${skipped.length} 件)`)
  for (const a of skipped) console.log(`  除外中: ${a.package} ${a.id} (期限 ${a.until})`)
  process.exit(0)
}

console.error(`high 以上の脆弱性が ${serious.size} 件あります:`)
for (const s of serious.values()) {
  const note = s.expired ? ` [除外の期限 ${s.expired} 切れ]` : ''
  console.error(`  ${s.severity.padEnd(8)} ${s.name}: ${s.title}${note}`)
  console.error(`           ${s.url}`)
}
process.exit(1)
