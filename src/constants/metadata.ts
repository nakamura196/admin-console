import { APP } from '@/lib/app.generated'

// アプリ名・説明は config.yml が唯一の出どころ (app.title / app.description)。
// ここには組織固有の値を書かないこと。URL だけは配信先ごとに変わるので環境変数で渡す。
const FALLBACK_URL = 'http://localhost:3200'

// config.yml の app.url が未編集 (例: https://<your-console>.pages.dev) のままだと
// new URL() が例外を投げ、ビルドが「Invalid URL」で落ちる。原因が分かりにくいので、
// 妥当な URL でなければ既定値に落とす。
const resolveUrl = (): string => {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL || APP.url
  if (!candidate) return FALLBACK_URL
  try {
    return new URL(candidate).toString()
  } catch {
    console.warn(`[metadata] 配信先 URL が不正です: ${candidate} — ${FALLBACK_URL} を使います`)
    return FALLBACK_URL
  }
}

export const SITE_CONFIG = {
  name: APP.title,
  description: APP.description,
  url: resolveUrl(),
} as const

export const getMetadata = (locale: 'ja' | 'en') => {
  const title = SITE_CONFIG.name[locale]
  const description = SITE_CONFIG.description[locale]

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    metadataBase: new URL(SITE_CONFIG.url),
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: SITE_CONFIG.url,
      siteName: title,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website' as const,
    },
  }
}
