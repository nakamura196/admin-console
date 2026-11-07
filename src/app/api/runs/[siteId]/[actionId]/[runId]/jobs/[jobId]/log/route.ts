import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { fetchJobLog, jobBelongsToRun, runBelongsToWorkflow } from '@/lib/github'
import { parseNumericId } from '@/lib/validate'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: {
    params: Promise<{
      siteId: string
      actionId: string
      runId: string
      jobId: string
    }>
  }
) {
  const { siteId, actionId, runId, jobId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action || action.type !== 'github-workflow') {
    return new NextResponse('unsupported', { status: 404 })
  }
  const run = parseNumericId(runId)
  const job = parseNumericId(jobId)
  if (run === null || job === null) {
    return new NextResponse('invalid id', { status: 400 })
  }
  try {
    // URL の runId / jobId をそのまま信じず、この操作 (ワークフロー) の run の job か確かめる。
    // 確かめないと、同じリポジトリの別ワークフローのログまで読めてしまう。
    const allowed =
      (await jobBelongsToRun(action.repo, job, run)) &&
      (await runBelongsToWorkflow(action.repo, run, action.workflow))
    if (!allowed) {
      return new NextResponse('not found', { status: 404 })
    }
    const log = await fetchJobLog(action.repo, job)
    return new NextResponse(log, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 })
  }
}
