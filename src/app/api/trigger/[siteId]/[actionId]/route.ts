import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { dispatchWorkflow, fetchRunAfterDispatch } from '@/lib/github'
import { sanitizeInputs } from '@/lib/validate'

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

  let body: { inputs?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

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
      // config.yml で宣言した入力だけを通す。宣言外の名前や型違いは拒否する。
      const checked = sanitizeInputs(action, body?.inputs)
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: 400 })
      }
      const merged = { ...checked.inputs, ...(action.fixedInputs ?? {}) }
      await dispatchWorkflow(action.repo, action.workflow, action.ref, merged)
      const { htmlUrl, runId } = await fetchRunAfterDispatch(action.repo, action.workflow)
      return NextResponse.json({ ok: true, htmlUrl, runId })
    }

    return NextResponse.json({ error: 'unsupported action type' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
