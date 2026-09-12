import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { LoginFlow } from '@/components/auth/LoginFlow';

export default function LoginPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-md">
        <LoginFlow locale={locale} dict={dict} />
      </div>
    </section>
  );
}
