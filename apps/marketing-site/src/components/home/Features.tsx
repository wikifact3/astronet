import {
  Wifi,
  ShieldCheck,
  Clock,
  Headphones,
  Zap,
  MapPin,
} from 'lucide-react';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { FadeIn } from '@/components/shared/FadeIn';

const FEATURES = [
  {
    icon: Wifi,
    title: 'Fiber to the home',
    body: 'Direct fiber connection to your premises. Symmetric speeds up to 500 Mbps with no data caps.',
  },
  {
    icon: ShieldCheck,
    title: 'No hidden charges',
    body: 'VAT and Telecom Service Charge shown separately. What you see is what you pay.',
  },
  {
    icon: Zap,
    title: 'Instant activation',
    body: 'Renew online and your bandwidth reactivates within 60 seconds of payment confirmation.',
  },
  {
    icon: Clock,
    title: 'Fast installations',
    body: 'Standard installations within 48 hours of KYC approval. Same-day in most Kathmandu wards.',
  },
  {
    icon: Headphones,
    title: 'Local support',
    body: 'Real people, real phone numbers. WhatsApp, Viber, SMS, and portal — pick what suits you.',
  },
  {
    icon: MapPin,
    title: 'Coverage across Nepal',
    body: 'Expanding to new wards every quarter. Check availability at your address before you apply.',
  },
];

export function Features() {
  return (
    <section className="container-page py-20">
      <SectionHeading
        eyebrow="Why PowerLink"
        title="Built for how Nepal connects"
        subtitle="Reliable infrastructure, transparent pricing, and support that actually answers."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <FadeIn key={f.title} delay={i * 60}>
              <div className="group h-full rounded-xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/50">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {f.body}
                </p>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </section>
  );
}
