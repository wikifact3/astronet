import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { t, type Dict, type Locale } from '@/lib/i18n';

export function Footer({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
              PL
            </span>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              PowerLink
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">
            {t(dict, 'footer.tagline')}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {t(dict, 'footer.company')}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
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
          <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
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

        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {t(dict, 'footer.contact')}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <span>+977 1 4000 000</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={14} className="text-gray-400" />
              <span>hello@powerlink.com.np</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span>Jhamsikhel, Lalitpur, Nepal</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} PowerLink. {t(dict, 'footer.rights')}</span>
          <span>VAT 601234567 · Registered in Nepal</span>
        </div>
      </div>
    </footer>
  );
}