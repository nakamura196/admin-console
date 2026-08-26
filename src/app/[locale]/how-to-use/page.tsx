import { setRequestLocale, getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import Image from 'next/image'
import { APP } from '@/lib/app.generated'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function HowToUsePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('HowToUse')

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  // 画面はコンソールごとに違うので、載せる画像は config.yml の app.howToUseImages で指定する。
  // 指定が無ければ画像なしで手順だけを表示する (テンプレートには画像を同梱しない)。
  const shots: readonly string[] = APP.howToUseImages
  const img = (i: number) => (shots[i] ? `${basePath}/images/how-to-use/${shots[i]}` : undefined)
  const steps = [
    { title: t('step1Title'), body: t('step1Body'), image: img(0), caption: t('step1Caption') },
    { title: t('step2Title'), body: t('step2Body'), image: img(1), caption: t('step2Caption') },
    { title: t('step3Title'), body: t('step3Body'), image: img(2), caption: t('step3Caption') },
    { title: t('step4Title'), body: t('step4Body'), image: img(3), caption: t('step4Caption') },
    { title: t('step5Title'), body: t('step5Body') },
  ]

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {t('title')}
      </h1>
      <p className="text-gray-700 dark:text-gray-300 mb-10">{t('lead')}</p>

      <div className="space-y-12">
        {steps.map((step, i) => (
          <section key={i}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {step.title}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{step.body}</p>
            {step.image && (
              <figure className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
                <Image
                  src={step.image}
                  alt={step.caption || step.title}
                  width={1280}
                  height={800}
                  className="w-full h-auto"
                  unoptimized
                />
                {step.caption && (
                  <figcaption className="text-xs text-center text-gray-500 dark:text-gray-400 py-2">
                    {step.caption}
                  </figcaption>
                )}
              </figure>
            )}
          </section>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-16 mb-4">
        {t('troubleHeading')}
      </h2>
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {t(`trouble${n}Title` as 'trouble1Title')}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {t(`trouble${n}Body` as 'trouble1Body')}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
