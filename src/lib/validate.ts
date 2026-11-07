/**
 * API ルートが受け取る値の検査。
 *
 * 管理コンソールの約束は「作業者は config.yml に書いた操作だけを、書いた入力だけで
 * 実行・閲覧できる」こと。URL やリクエスト本文の値をそのまま GitHub API に
 * 渡すと、この約束の外 (同じリポジトリの別ワークフローのログ、画面に出していない
 * 入力) に手が届いてしまうため、ここで絞る。
 */

import type { SiteAction } from './sites.generated'

/** URL の数値 ID (runId / jobId)。10 進の数字だけを受け付ける。 */
export function parseNumericId(value: string): number | null {
  if (!/^[0-9]{1,20}$/.test(value)) return null
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export type InputsResult =
  | { ok: true; inputs: Record<string, string | boolean> }
  | { ok: false; error: string }

/**
 * 作業者が送ってきた inputs を、config.yml で宣言した入力だけに絞る。
 * - 宣言していない名前が来たら拒否する
 * - boolean と宣言した入力は true/false (または "true"/"false") だけを受け付ける
 * - string と宣言した入力は文字列だけを受け付ける
 * fixedInputs は呼び出し側で最後に上書きする (作業者は変えられない)。
 */
export function sanitizeInputs(
  action: Extract<SiteAction, { type: 'github-workflow' }>,
  raw: unknown
): InputsResult {
  if (raw === undefined || raw === null) return { ok: true, inputs: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'inputs must be an object' }
  }
  const declared = new Map((action.inputs ?? []).map((i) => [i.name, i]))
  const out: Record<string, string | boolean> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = declared.get(name)
    if (!def) return { ok: false, error: `unknown input: ${name}` }
    if (def.type === 'boolean') {
      if (value === true || value === 'true') out[name] = true
      else if (value === false || value === 'false') out[name] = false
      else return { ok: false, error: `input ${name} must be boolean` }
    } else {
      if (typeof value !== 'string') return { ok: false, error: `input ${name} must be string` }
      out[name] = value
    }
  }
  return { ok: true, inputs: out }
}

/**
 * GitHub の run が、config.yml のワークフロー指定と一致するか。
 * workflow は通常ファイル名 (例: deploy.yml)。数字だけならワークフロー ID とみなす。
 * run.path は ".github/workflows/deploy.yml" の形 (末尾に "@ref" が付くことがある)。
 */
export function runMatchesWorkflow(
  run: { path?: string | null; workflow_id?: number | null },
  workflow: string
): boolean {
  if (/^[0-9]+$/.test(workflow)) return run.workflow_id === Number(workflow)
  if (!run.path) return false
  const path = run.path.split('@')[0]
  return path === `.github/workflows/${workflow}`
}
