import { getTranslations } from 'next-intl/server'

export default async function Footer() {
  const t = await getTranslations('Footer')
  return (
    <footer className="bg-gray-100 dark:bg-gray-800 py-6 mt-16">
      <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-300">
        {t('copyright')}
      </div>
    </footer>
  )
}
