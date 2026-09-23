const FAQ = [
  {
    q: 'How often is the coverage data updated?',
    a: 'Our field team updates coverage weekly. If a new ward has just been connected, you may see it here before it appears on partner sites.',
  },
  {
    q: 'My ward is "Coming soon" — how long is the wait?',
    a: 'Typical expansion happens in quarters. Where an estimated quarter is shown, treat it as a target — we update it monthly based on contractor scheduling.',
  },
  {
    q: 'My ward is "Not yet planned". Can I speed it up?',
    a: 'Yes. Register interest — the more requests in a ward, the higher it moves in our expansion planning. We contact every registered address the week coverage goes live.',
  },
  {
    q: 'I have an existing PowerLink connection — do I need to check coverage again?',
    a: 'No. Coverage lookup is for new connections. To upgrade, add a service, or move your existing connection, sign in to the customer portal.',
  },
];

export function CoverageFaq() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        Questions about coverage
      </h3>
      <dl className="mt-4 divide-y divide-gray-100">
        {FAQ.map((item) => (
          <div key={item.q} className="py-4 first:pt-0 last:pb-0">
            <dt className="text-sm font-medium text-gray-900">{item.q}</dt>
            <dd className="mt-1.5 text-xs leading-relaxed text-gray-600">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
