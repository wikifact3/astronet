import Link from 'next/link';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict, t } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default function ConnectSuccessPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ref?: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return (
    <section className="container-page py-20">
      <div className="mx-auto max-w-lg rounded-lg border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-600 text-2xl text-white">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-bold text-green-900">
          {t(dict, 'wizard.successTitle')}
        </h1>
        {searchParams.ref && (
          <p className="mt-4 text-sm text-green-800">
            {t(dict, 'wizard.successRef')}
            <span className="mt-1 block text-lg font-semibold tracking-wider">
              {searchParams.ref}
            </span>
          </p>
        )}
        <p className="mt-4 text-sm text-green-800">{t(dict, 'wizard.successDesc')}</p>
        <Link href={`/${locale}`} className="btn btn-primary mt-8">
          {t(dict, 'nav.home')}
        </Link>
      </div>
    </section>
  );
}
