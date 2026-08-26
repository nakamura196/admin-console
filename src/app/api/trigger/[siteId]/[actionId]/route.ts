import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { dispatchWorkflow, fetchRunAfterDispatch } from '@/lib/github'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ siteId: string; actionId: string }> }
) {
  const { siteId, actionId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action) {
    return NextResponse.json(
      { error: `unknown action: ${siteId}/${actionId}` },
      { status: 404 }
    )
  }

  let body: { inputs?: Record<string, string | boolean> } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const inputs = body.inputs ?? {}

  try {
    if (action.type === 'vercel-deploy-hook') {
      const hook = process.env[action.envHookKey]
      if (!hook) {
        return NextResponse.json(
          { error: `${action.envHookKey} is not set` },
          { status: 500 }
        )
      }
      const res = await fetch(hook, { method: 'POST' })
      if (!res.ok) {
        return NextResponse.json(
          { error: `Deploy hook failed (${res.status})` },
          { status: 502 }
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (action.type === 'github-workflow') {
      const merged = { ...inputs, ...(action.fixedInputs ?? {}) }
      await dispatchWorkflow(action.repo, action.workflow, action.ref, merged)
      const { htmlUrl, runId } = await fetchRunAfterDispatch(action.repo, action.workflow)
      return NextResponse.json({ ok: true, htmlUrl, runId })
    }

    return NextResponse.json({ error: 'unsupported action type' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
