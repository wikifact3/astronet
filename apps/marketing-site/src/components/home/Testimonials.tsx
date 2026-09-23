import { Star } from 'lucide-react';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { FadeIn } from '@/components/shared/FadeIn';

const TESTIMONIALS = [
  {
    name: 'Anisha Shrestha',
    role: 'Software engineer, Lalitpur',
    quote:
      'Switched from my old ISP six months ago. Speeds are consistent, support answers on the first ring, and renewals take seconds through the portal.',
  },
  {
    name: 'Bikash Tamang',
    role: 'Small business owner, Kathmandu',
    quote:
      'Two shops, one billing account, transparent VAT on every invoice. My accountant is happy, which says a lot.',
  },
  {
    name: 'Dr. Sunita Rai',
    role: 'Clinic manager, Bhaktapur',
    quote:
      'We run patient records and video calls on PowerLink. In three years, the connection has never been the reason we stopped working.',
  },
];

export function Testimonials() {
  return (
    <section className="bg-gradient-to-b from-white to-brand-50/40 py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Customer stories"
          title="Trusted across Nepal"
          subtitle="From homes to clinics to small businesses, thousands of customers choose PowerLink every day."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={i * 80}>
              <figure className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-gray-700">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
