interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: Props) {
  const alignment =
    align === 'center' ? 'text-center mx-auto max-w-2xl' : 'text-left max-w-2xl';

  return (
    <div className={alignment}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
