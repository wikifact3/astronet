import { notFound } from 'next/navigation';
import { isLocale, locales, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return (
    <AuthProvider>
      <Header locale={locale} dict={dict} />
      <main>{children}</main>
    </AuthProvider>
  );
}
