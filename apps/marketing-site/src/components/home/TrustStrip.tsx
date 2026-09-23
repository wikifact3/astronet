interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '7', label: 'Provinces covered' },
  { value: '10,000+', label: 'Households connected' },
  { value: '24×7', label: 'Local support' },
];

export function TrustStrip() {
  return (
    <div className="border-y border-gray-100 bg-white">
      <div className="container-page grid grid-cols-2 gap-x-4 gap-y-8 py-10 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {s.value}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
