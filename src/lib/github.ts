/**
 * GitHub API helpers (workflow_dispatch + run status)
 *
 * 認証: GitHub App の installation token を都度発行する
 *   - GITHUB_APP_ID
 *   - GITHUB_INSTALLATION_ID
 *   - GITHUB_APP_PRIVATE_KEY  (PEM文字列)
 *
 * installation は 1 つだけ持つ。つまり **1 デプロイ = 1 GitHub 組織**。
 * 別の組織のリポジトリを操作したい場合は、この管理コンソールをもう 1 つ立てる
 * (README「新しい管理コンソールを作る」を参照)。
 */

import { createAppAuth } from '@octokit/auth-app'
import { request } from '@octokit/request'

export type LastRun = {
  runId?: number
  status: 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown'
  htmlUrl?: string
  startedAt?: string
  updatedAt?: string
}

const API = 'https://api.github.com'
const UA = 'admin-console'

let cachedToken: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cachedToken.token
  }

  const appId = process.env.GITHUB_APP_ID
  const installationId = process.env.GITHUB_INSTALLATION_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !installationId || !privateKey) {
    throw new Error(
      'GITHUB_APP_ID / GITHUB_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY が未設定です'
    )
  }

  const auth = createAppAuth({
    appId,
    installationId,
    privateKey,
  })

  const result = (await auth({ type: 'installation' })) as {
    token: string
    expiresAt: string
  }

  cachedToken = {
    token: result.token,
    expiresAt: new Date(result.expiresAt).getTime(),
  }
  return result.token
}

async function authHeaders() {
  const token = await getToken()
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA,
  }
}

export async function dispatchWorkflow(
  repo: string,
  workflowFile: string,
  ref: string,
  inputs: Record<string, string | boolean>
): Promise<void> {
  const url = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`
  const stringInputs: Record<string, string> = {}
  for (const [k, v] of Object.entries(inputs)) {
    stringInputs[k] = typeof v === 'boolean' ? String(v) : v
  }
  const headers = await authHeaders()
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, inputs: stringInputs }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub workflow_dispatch failed (${res.status}): ${body}`)
  }
}

export async function fetchLatestRun(
  repo: string,
  workflowFile: string
): Promise<LastRun | null> {
  const url = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`
  const headers = await authHeaders()
  const res = await fetch(url, {
    headers,
    next: { revalidate: 10 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    workflow_runs?: Array<{
      id: number
      status: string
      conclusion: string | null
      html_url: string
      created_at: string
      updated_at: string
    }>
  }
  const run = data.workflow_runs?.[0]
  if (!run) return null
  return {
    runId: run.id,
    status: mapStatus(run.status, run.conclusion),
    htmlUrl: run.html_url,
    startedAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

function mapStatus(s: string, c: string | null): LastRun['status'] {
  if (s === 'in_progress') return 'in_progress'
  if (s === 'queued' || s === 'waiting' || s === 'pending' || s === 'requested') return 'queued'
  if (c === 'success') return 'success'
  if (c === 'failure' || c === 'cancelled' || c === 'timed_out') return 'failure'
  return 'unknown'
}

export type RunDetail = {
  runId: number
  status: LastRun['status']
  htmlUrl: string
  startedAt: string
  updatedAt: string
  jobs: Array<{
    name: string
    status: LastRun['status']
    currentStep?: string
    completedSteps: number
    totalSteps: number
    durationSec?: number
  }>
}

export async function fetchRunDetail(
  repo: string,
  workflowFile: string
): Promise<RunDetail | null> {
  const latest = await fetchLatestRun(repo, workflowFile)
  if (!latest || !latest.runId) return null

  const url = `${API}/repos/${repo}/actions/runs/${latest.runId}/jobs`
  const headers = await authHeaders()
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) {
    return {
      runId: latest.runId,
      status: latest.status,
      htmlUrl: latest.htmlUrl ?? '',
      startedAt: latest.startedAt ?? '',
      updatedAt: latest.updatedAt ?? '',
      jobs: [],
    }
  }
  const data = (await res.json()) as {
    jobs: Array<{
      name: string
      status: string
      conclusion: string | null
      started_at: string | null
      completed_at: string | null
      steps: Array<{
        name: string
        status: string
        conclusion: string | null
      }>
    }>
  }

  const jobs = data.jobs.map((j) => {
    const totalSteps = j.steps.length
    const completedSteps = j.steps.filter((s) => s.status === 'completed').length
    const currentStep = j.steps.find((s) => s.status === 'in_progress')?.name
    let durationSec: number | undefined
    if (j.started_at) {
      const end = j.completed_at ? new Date(j.completed_at) : new Date()
      durationSec = Math.floor((end.getTime() - new Date(j.started_at).getTime()) / 1000)
    }
    return {
      name: j.name,
      status: mapStatus(j.status, j.conclusion),
      currentStep,
      completedSteps,
      totalSteps,
      durationSec,
    }
  })

  return {
    runId: latest.runId,
    status: latest.status,
    htmlUrl: latest.htmlUrl ?? '',
    startedAt: latest.startedAt ?? '',
    updatedAt: latest.updatedAt ?? '',
    jobs,
  }
}

export async function fetchRunAfterDispatch(
  repo: string,
  workflowFile: string
): Promise<{ htmlUrl?: string; runId?: number }> {
  await new Promise((r) => setTimeout(r, 2000))
  const run = await fetchLatestRun(repo, workflowFile)
  return { htmlUrl: run?.htmlUrl, runId: run?.runId }
}

export type RunSummary = {
  id: number
  runNumber: number
  status: LastRun['status']
  conclusion: string | null
  createdAt: string
  updatedAt: string
  htmlUrl: string
  event: string
  actor?: string
  durationSec?: number
}

export async function listRuns(
  repo: string,
  workflowFile: string,
  perPage = 20
): Promise<RunSummary[]> {
  const url = `${API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${perPage}`
  const headers = await authHeaders()
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as {
    workflow_runs?: Array<{
      id: number
      run_number: number
      status: string
      conclusion: string | null
      created_at: string
      updated_at: string
      html_url: string
      event: string
      actor?: { login?: string } | null
    }>
  }
  return (data.workflow_runs || []).map((r) => {
    const start = new Date(r.created_at).getTime()
    const end = new Date(r.updated_at).getTime()
    return {
      id: r.id,
      runNumber: r.run_number,
      status: mapStatus(r.status, r.conclusion),
      conclusion: r.conclusion,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url,
      event: r.event,
      actor: r.actor?.login || undefined,
      durationSec: end > start ? Math.floor((end - start) / 1000) : undefined,
    }
  })
}

export type JobSummary = {
  id: number
  name: string
  status: LastRun['status']
  startedAt: string | null
  completedAt: string | null
  durationSec?: number
  steps: Array<{ name: string; status: string; conclusion: string | null }>
}

export async function listJobs(repo: string, runId: number): Promise<JobSummary[]> {
  const url = `${API}/repos/${repo}/actions/runs/${runId}/jobs`
  const headers = await authHeaders()
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as {
    jobs: Array<{
      id: number
      name: string
      status: string
      conclusion: string | null
      started_at: string | null
      completed_at: string | null
      steps: Array<{ name: string; status: string; conclusion: string | null }>
    }>
  }
  return data.jobs.map((j) => {
    let durationSec: number | undefined
    if (j.started_at) {
      const end = j.completed_at ? new Date(j.completed_at) : new Date()
      durationSec = Math.floor((end.getTime() - new Date(j.started_at).getTime()) / 1000)
    }
    return {
      id: j.id,
      name: j.name,
      status: mapStatus(j.status, j.conclusion),
      startedAt: j.started_at,
      completedAt: j.completed_at,
      durationSec,
      steps: j.steps,
    }
  })
}

/**
 * ジョブのプレーンテキストログを取得。
 * GitHub APIは302でAzure Blob Storageの一時URLにリダイレクトする。
 * fetchで `redirect: 'manual'` を使い、302のLocationを取り出して
 * Authorization無しで一時URLを取りにいく。
 */
export async function fetchJobLog(repo: string, jobId: number): Promise<string> {
  const url = `${API}/repos/${repo}/actions/jobs/${jobId}/logs`
  const headers = await authHeaders()
  const res = await fetch(url, { headers, redirect: 'manual' })
  // 302の場合: Locationヘッダから一時URLを取得
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location')
    if (!loc) return '(リダイレクトURLが取得できませんでした)'
    const r2 = await fetch(loc)
    if (!r2.ok) return `(一時URL取得失敗: ${r2.status})`
    return await r2.text()
  }
  if (res.ok) return await res.text()
  if (res.status === 404) {
    return '(ログが取得できません。実行が完了済みの場合は数秒後に再表示してください)'
  }
  return `(取得失敗: ${res.status})`
}
