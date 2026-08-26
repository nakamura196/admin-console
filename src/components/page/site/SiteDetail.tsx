'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  FiArrowLeft,
  FiCheck,
  FiX,
  FiClock,
  FiPlay,
  FiLoader,
  FiRefreshCw,
  FiExternalLink,
} from 'react-icons/fi'
import { Link } from '@/i18n/routing'
import type { SiteAction } from '@/lib/sites.generated'

type RunSummary = {
  id: number
  runNumber: number
  status: 'success' | 'failure' | 'in_progress' | 'queued' | 'unknown'
  conclusion: string | null
  createdAt: string
  updatedAt: string
  htmlUrl: string
  event: string
  actor?: string
  durationSec?: number
}

type JobSummary = {
  id: number
  name: string
  status: RunSummary['status']
  startedAt: string | null
  completedAt: string | null
  durationSec?: number
  steps: Array<{ name: string; status: string; conclusion: string | null }>
}

type Props = {
  siteId: string
  siteUrl: string
  actions: SiteAction[]
  initialRunsByAction: Record<string, RunSummary[]>
}

export default function SiteDetail({ siteId, siteUrl, actions, initialRunsByAction }: Props) {
  const t = useTranslations()
  const [activeActionId, setActiveActionId] = useState(actions[0]?.id ?? '')

  useEffect(() => {
    const ids = new Set(actions.map((a) => a.id))
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, '')
      if (h && ids.has(h)) setActiveActionId(h)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [actions])

  const selectAction = (id: string) => {
    setActiveActionId(id)
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`)
    }
  }

  if (!activeActionId) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <BackLink />
        <div className="mt-6 text-gray-600 dark:text-gray-300">No actions defined for this site.</div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 py-6 max-w-7xl">
      <BackLink />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t(`Sites.${siteId}.name`)}
          </h1>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <FiExternalLink /> {t('HomePage.viewSite')}
          </a>
        </div>
      </div>

      {/* Action tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => selectAction(a.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeActionId === a.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {t(`Sites.${siteId}.actions.${a.id}.label`)}
          </button>
        ))}
      </div>

      {actions
        .filter((a) => a.id === activeActionId)
        .map((a) => (
          <ActionPanel
            key={a.id}
            siteId={siteId}
            action={a}
            initialRuns={initialRunsByAction[a.id] ?? []}
          />
        ))}
    </main>
  )
}

function BackLink() {
  const t = useTranslations('Common')
  return (
    <Link
      href="/"
      className="text-sm text-gray-600 dark:text-gray-300 hover:underline inline-flex items-center gap-1"
    >
      <FiArrowLeft /> {t('home')}
    </Link>
  )
}

type ActionPanelProps = {
  siteId: string
  action: SiteAction
  initialRuns: RunSummary[]
}

function ActionPanel({ siteId, action, initialRuns }: ActionPanelProps) {
  const t = useTranslations()
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns)
  const [selectedRunId, setSelectedRunId] = useState<number | null>(initialRuns[0]?.id ?? null)
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [logs, setLogs] = useState<Record<number, string>>({})
  const [loadingLogs, setLoadingLogs] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inputs = action.type === 'github-workflow' ? action.inputs : undefined
  const [inputValues, setInputValues] = useState<Record<string, boolean | string>>(
    () => Object.fromEntries((inputs ?? []).map((i) => [i.name, i.default ?? (i.type === 'boolean' ? false : '')]))
  )

  const baseUrl = `/api/runs/${siteId}/${action.id}`

  const loadRuns = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(baseUrl, { cache: 'no-store' })
      const data = (await res.json()) as { runs: RunSummary[] }
      setRuns(data.runs)
      if (!selectedRunId && data.runs[0]) setSelectedRunId(data.runs[0].id)
    } finally {
      setRefreshing(false)
    }
  }, [baseUrl, selectedRunId])

  const loadJobs = useCallback(
    async (runId: number) => {
      const res = await fetch(`${baseUrl}/${runId}`, { cache: 'no-store' })
      const data = (await res.json()) as { jobs: JobSummary[] }
      setJobs(data.jobs)
    },
    [baseUrl]
  )

  const loadLog = useCallback(
    async (runId: number, jobId: number) => {
      setLoadingLogs((s) => ({ ...s, [jobId]: true }))
      try {
        const res = await fetch(`${baseUrl}/${runId}/jobs/${jobId}/log`)
        const text = await res.text()
        setLogs((s) => ({ ...s, [jobId]: text }))
      } finally {
        setLoadingLogs((s) => ({ ...s, [jobId]: false }))
      }
    },
    [baseUrl]
  )

  useEffect(() => {
    if (selectedRunId == null) return
    setJobs([])
    setLogs({})
    loadJobs(selectedRunId)
  }, [selectedRunId, loadJobs])

  useEffect(() => {
    if (selectedRunId == null) return
    for (const j of jobs) {
      if (logs[j.id] === undefined && !loadingLogs[j.id]) {
        loadLog(selectedRunId, j.id)
      }
    }
  }, [jobs, selectedRunId, loadLog, logs, loadingLogs])

  const selectedRun = runs.find((r) => r.id === selectedRunId)
  const isLive =
    selectedRun?.status === 'in_progress' || selectedRun?.status === 'queued'
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => {
      loadRuns()
      if (selectedRunId != null) loadJobs(selectedRunId)
    }, 5000)
    return () => clearInterval(id)
  }, [isLive, loadRuns, loadJobs, selectedRunId])

  async function handleRun() {
    if (!confirm(t('Trigger.confirmTitle'))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/trigger/${siteId}/${action.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: inputValues }),
      })
      if (!res.ok) throw new Error(await res.text())
      await new Promise((r) => setTimeout(r, 2000))
      await loadRuns()
      const fresh = await fetch(baseUrl, { cache: 'no-store' })
      const data = (await fresh.json()) as { runs: RunSummary[] }
      if (data.runs[0]) setSelectedRunId(data.runs[0].id)
    } catch (e) {
      alert(`${t('Trigger.error')}: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Action description + inputs + Run button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {t(`Sites.${siteId}.actions.${action.id}.description`)}
        </p>

        {inputs?.some((i) => i.type === 'string') && (
          <div className="mt-4 flex flex-col gap-3">
            {inputs
              .filter((i) => i.type === 'string')
              .map((input) => (
                <label key={input.name} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {t(`Inputs.${input.name}`)}
                  </span>
                  <textarea
                    value={String(inputValues[input.name] ?? '')}
                    onChange={(e) =>
                      setInputValues((v) => ({ ...v, [input.name]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 font-mono"
                  />
                </label>
              ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-4">
          {inputs
            ?.filter((i) => i.type === 'boolean')
            .map((input) => (
              <label key={input.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(inputValues[input.name])}
                  onChange={(e) =>
                    setInputValues((v) => ({ ...v, [input.name]: e.target.checked }))
                  }
                  className="rounded"
                />
                {t(`Inputs.${input.name}`)}
              </label>
            ))}
          <button
            type="button"
            onClick={handleRun}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md px-4 py-2 text-sm transition"
          >
            {busy ? <FiLoader className="animate-spin" /> : <FiPlay />}
            {busy ? t('HomePage.running') : t(`Sites.${siteId}.actions.${action.id}.label`)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Left pane: runs list */}
        <aside className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('Detail.runsHeading')}
            </h2>
            <button
              type="button"
              onClick={loadRuns}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1"
            >
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
              {t('Detail.refresh')}
            </button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
            {runs.length === 0 && (
              <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                {t('Detail.noRunsYet')}
              </li>
            )}
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRunId(r.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                    selectedRunId === r.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={r.status} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{r.runNumber}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{r.event}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{formatTime(r.createdAt)}</span>
                    {r.durationSec != null && <span>{formatDuration(r.durationSec)}</span>}
                    {r.actor && <span>@{r.actor}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right pane */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {selectedRun ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={selectedRun.status} large />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      Run #{selectedRun.runNumber}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(selectedRun.createdAt)}
                      {selectedRun.durationSec != null && (
                        <> · {formatDuration(selectedRun.durationSec)}</>
                      )}
                    </div>
                  </div>
                </div>
                <a
                  href={selectedRun.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline inline-flex items-center gap-1"
                >
                  <FiExternalLink /> GitHub
                </a>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {jobs.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    {t('Detail.loadingJobs')}
                  </div>
                )}
                {jobs.map((j) => (
                  <div key={j.id} className="border-b border-gray-100 dark:border-gray-700">
                    <div className="px-4 py-3 flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40">
                      <StatusIcon status={j.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {j.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {j.steps.filter((s) => s.status === 'completed').length} /{' '}
                          {j.steps.length} steps
                          {j.durationSec != null && <> · {formatDuration(j.durationSec)}</>}
                        </div>
                      </div>
                    </div>
                    <pre className="px-4 py-3 text-xs text-gray-100 bg-gray-900 dark:bg-black overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-[60vh]">
                      {loadingLogs[j.id] && (logs[j.id] === undefined)
                        ? t('Detail.loadingLogs')
                        : logs[j.id] ?? ''}
                    </pre>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
              {t('Detail.selectRun')}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatusIcon({ status, large }: { status: RunSummary['status']; large?: boolean }) {
  const cls = large ? 'w-6 h-6' : 'w-4 h-4'
  if (status === 'success')
    return <FiCheck className={`${cls} text-green-600 dark:text-green-400 shrink-0`} />
  if (status === 'failure')
    return <FiX className={`${cls} text-red-600 dark:text-red-400 shrink-0`} />
  if (status === 'in_progress')
    return (
      <FiLoader className={`${cls} text-blue-600 dark:text-blue-400 animate-spin shrink-0`} />
    )
  if (status === 'queued')
    return <FiClock className={`${cls} text-yellow-600 dark:text-yellow-400 shrink-0`} />
  return <FiClock className={`${cls} text-gray-400 shrink-0`} />
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}秒前`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`
  return d.toLocaleString()
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m${s}s`
}
