import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const other: Locale = locale === 'en' ? 'np' : 'en';
  const label = locale === 'en' ? 'नेपाली' : 'English';

  return (
    <Link
      href={`/${other}`}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      aria-label={`Switch to ${label}`}
    >
      {label}
    </Link>
  );
}
