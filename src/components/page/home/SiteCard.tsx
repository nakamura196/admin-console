'use client'

import { useTranslations } from 'next-intl'
import { FiExternalLink, FiArrowRight } from 'react-icons/fi'
import { Link } from '@/i18n/routing'

type SiteCardProps = {
  siteId: string
  url: string
  actionIds: string[]
}

export default function SiteCard({ siteId, url, actionIds }: SiteCardProps) {
  const t = useTranslations()

  return (
    <Link
      href={`/sites/${siteId}`}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t(`Sites.${siteId}.name`)}
          </h2>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{siteId}</div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <FiExternalLink /> {t('HomePage.viewSite')}
        </a>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300">{t(`Sites.${siteId}.description`)}</p>

      <div className="flex flex-wrap gap-2 mt-1">
        {actionIds.map((aid) => (
          <span
            key={aid}
            className="inline-block text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded px-2 py-1"
          >
            {t(`Sites.${siteId}.actions.${aid}.label`)}
          </span>
        ))}
      </div>

      <div className="text-sm text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 mt-auto pt-2">
        {t('HomePage.viewDetails')} <FiArrowRight />
      </div>
    </Link>
  )
}
