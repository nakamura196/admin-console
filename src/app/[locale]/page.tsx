import { setRequestLocale, getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { SITES } from '@/lib/sites.generated'
import SiteCard from '@/components/page/home/SiteCard'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('HomePage')

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t('heading')}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">{t('lead')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SITES.map((site) => (
          <SiteCard
            key={site.id}
            siteId={site.id}
            url={site.url}
            actionIds={site.actions.map((a) => a.id)}
          />
        ))}
      </div>
    </main>
  )
}
