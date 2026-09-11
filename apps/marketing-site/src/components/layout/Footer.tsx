import Link from 'next/link';
import { t, type Dict, type Locale } from '@/lib/i18n';

export function Footer({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="container-page grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">
              PL
            </span>
            <span className="text-lg font-semibold text-gray-900">PowerLink</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-gray-600">
            {t(dict, 'footer.tagline')}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {t(dict, 'footer.company')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href={`/${locale}/plans`} className="hover:text-brand-700">
                {t(dict, 'nav.plans')}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/coverage`} className="hover:text-brand-700">
                {t(dict, 'nav.coverage')}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/connect`} className="hover:text-brand-700">
                {t(dict, 'nav.connect')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {t(dict, 'footer.legal')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href={`/${locale}/terms`} className="hover:text-brand-700">
                {t(dict, 'footer.terms')}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/privacy`} className="hover:text-brand-700">
                {t(dict, 'footer.privacy')}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="container-page flex items-center justify-between py-4 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} PowerLink. {t(dict, 'footer.rights')}</span>
          <span>Kathmandu, Nepal</span>
        </div>
      </div>
    </footer>
  );
}
