import { cx } from './cx';

export function ProgressSteps({
  steps,
  current,
  className,
}: {
  steps: readonly string[];
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label="İlerleme" className={className}>
      <p className="text-text-muted mb-2 text-xs">
        Adım {current + 1} / {steps.length}: <span className="text-text">{steps[current]}</span>
      </p>
      <ol className="flex gap-1.5">
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === current ? 'step' : undefined}
            className={cx(
              'h-1.5 flex-1 rounded-full transition-colors',
              index <= current ? 'bg-primary' : 'bg-text/10',
            )}
          >
            <span className="sr-only">{step}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
