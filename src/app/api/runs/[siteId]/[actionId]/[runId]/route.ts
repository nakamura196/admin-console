import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { listJobs, runBelongsToWorkflow } from '@/lib/github'
import { parseNumericId } from '@/lib/validate'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ siteId: string; actionId: string; runId: string }> }
) {
  const { siteId, actionId, runId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action || action.type !== 'github-workflow') {
    return NextResponse.json({ error: 'unsupported' }, { status: 404 })
  }
  const run = parseNumericId(runId)
  if (run === null) {
    return NextResponse.json({ error: 'invalid runId' }, { status: 400 })
  }
  try {
    // この操作 (ワークフロー) の run だけを見せる
    if (!(await runBelongsToWorkflow(action.repo, run, action.workflow))) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    const jobs = await listJobs(action.repo, run)
    return NextResponse.json({ jobs })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
