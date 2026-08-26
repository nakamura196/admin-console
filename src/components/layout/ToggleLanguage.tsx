'use client';
import { Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { routing, useRouter, usePathname } from '@/i18n/routing';

const ToggleLanguageInner = () => {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('Header');

  const switchLanguage = (newLocale: string) => {
    // クエリパラメータを維持
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

    router.replace(fullPath, { locale: newLocale });
  };

  return (
    <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
      {routing.locales.map((loc) => {
        if (loc !== locale) {
          return (
            <button
              key={loc}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer"
              onClick={() => switchLanguage(loc)}
            >
              {t(loc)}
            </button>
          );
        }
      })}
    </div>
  );
};

export const ToggleLanguage = () => {
  return (
    <Suspense fallback={<div className="w-16 h-6" />}>
      <ToggleLanguageInner />
    </Suspense>
  );
};
