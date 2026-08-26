import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { ToggleLanguage } from '@/components/layout/ToggleLanguage';
import { ToggleTheme } from '@/components/layout/ToggleTheme';

const Header = () => {
  const tCommon = useTranslations('Common');
  const tHeader = useTranslations('Header');
  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-6 justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <Link href="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
            {tCommon('title')}
          </h1>
        </Link>
      </div>
      <div className="flex items-center space-x-3 sm:space-x-5">
        <Link
          href="/how-to-use"
          className="text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
        >
          {tHeader('howToUse')}
        </Link>
        <ToggleTheme />
        <ToggleLanguage />
      </div>
    </header>
  );
};

export default Header;
