import Link from 'next/link';
import { t, type Dict, type Locale } from '@/lib/i18n';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header({ locale, dict }: { locale: Locale; dict: Dict }) {
  const nav = [
    { href: '', label: t(dict, 'nav.home') },
    { href: '/plans', label: t(dict, 'nav.plans') },
    { href: '/coverage', label: t(dict, 'nav.coverage') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">
            PL
          </span>
          <span className="text-lg font-semibold text-gray-900">PowerLink</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href || 'home'}
              href={`/${locale}${item.href}`}
              className="text-sm font-medium text-gray-700 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href={`/${locale}/connect`}
            className="btn btn-primary hidden sm:inline-flex"
          >
            {t(dict, 'nav.connect')}
          </Link>
        </div>
      </div>
    </header>
  );
}
