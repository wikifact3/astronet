import { CheckCircle2, Clock, XCircle } from 'lucide-react';

const ITEMS = [
  {
    Icon: CheckCircle2,
    tone: 'text-green-600',
    bg: 'bg-green-100',
    badgeClass: 'bg-green-100 text-green-800',
    label: 'Available now',
    desc: 'We can install at your ward. Submit a connection request and we schedule within 48 hours.',
  },
  {
    Icon: Clock,
    tone: 'text-amber-600',
    bg: 'bg-amber-100',
    badgeClass: 'bg-amber-100 text-amber-800',
    label: 'Coming soon',
    desc: 'Planned expansion. Leave your contact and we notify you the week we go live in your ward.',
  },
  {
    Icon: XCircle,
    tone: 'text-gray-600',
    bg: 'bg-gray-100',
    badgeClass: 'bg-gray-100 text-gray-700',
    label: 'Not yet planned',
    desc: 'Outside our current roadmap. Register interest — enough requests in an area move it up our priority list.',
  },
];

export function CoverageStatusLegend() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        What the statuses mean
      </h3>
      <ul className="mt-4 space-y-4">
        {ITEMS.map((item) => {
          const Icon = item.Icon;
          return (
            <li key={item.label} className="flex gap-3">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.bg}`}
              >
                <Icon size={16} className={item.tone} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <span className={`badge ${item.badgeClass}`}>{item.label}</span>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                  {item.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
