import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getSite, SITES } from '@/lib/sites.generated'
import { listRuns, type RunSummary } from '@/lib/github'
import SiteDetail from '@/components/page/site/SiteDetail'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    SITES.map((s) => ({ locale, siteId: s.id }))
  )
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ locale: string; siteId: string }>
}) {
  const { locale, siteId } = await params
  setRequestLocale(locale)

  const site = getSite(siteId)
  if (!site) notFound()

  // Fetch initial runs for each github-workflow action in parallel
  const initialRunsByAction: Record<string, RunSummary[]> = {}
  await Promise.all(
    site.actions.map(async (a) => {
      if (a.type !== 'github-workflow') return
      try {
        initialRunsByAction[a.id] = await listRuns(a.repo, a.workflow, 20)
      } catch {
        initialRunsByAction[a.id] = []
      }
    })
  )

  return (
    <SiteDetail
      siteId={siteId}
      siteUrl={site.url}
      actions={site.actions}
      initialRunsByAction={initialRunsByAction}
    />
  )
}
