import type { ReactNode } from 'react';

import { formatAmount, formatAmountExact, formatPpmPercent, type AmountFormat } from '@/lib/units';

/**
 * A matte panel. Square corners, one hairline edge, no shadow and no blur —
 * the surface is flat and the hierarchy comes from the edge and the ground,
 * not from depth.
 */
export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={`border border-edge bg-raised ${className}`}>{children}</Tag>;
}

export function PanelHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-[0.06em] text-paper uppercase">{title}</h2>
        {hint === undefined ? null : <p className="mt-1 max-w-prose text-sm text-muted">{hint}</p>}
      </div>
      {right === undefined ? null : <div className="shrink-0">{right}</div>}
    </div>
  );
}

/**
 * A USDC amount.
 *
 * Fixed fraction digits so columns line up and a value that updates does not
 * change width, truncated rather than rounded up, with the exact chain value
 * on the title for anyone who needs the last four digits.
 */
export function Amount({
  value,
  className = '',
  ...format
}: { value: bigint; className?: string } & AmountFormat) {
  return (
    <span className={`num ${className}`} title={`${formatAmountExact(value)} USDC`}>
      {formatAmount(value, format)}
    </span>
  );
}

/** A percentage from parts per million, at a fixed width. */
export function Percent({ ppm, digits = 1, className = '' }: { ppm: bigint; digits?: number; className?: string }) {
  return (
    <span className={`num ${className}`}>
      {formatPpmPercent(ppm, digits)}
      <span className="text-muted">%</span>
    </span>
  );
}

export type Tone = 'up' | 'down' | 'neutral' | 'quiet';

const TONE_TEXT: Record<Tone, string> = {
  up: 'text-lime',
  down: 'text-coral',
  neutral: 'text-paper',
  quiet: 'text-muted',
};

/** A small label. Square, hairline, never filled unless it is the one thing that matters. */
export function Badge({
  children,
  tone = 'quiet',
  solid = false,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  solid?: boolean;
  className?: string;
}) {
  const solidClass =
    tone === 'up' ? 'bg-lime text-ink' : tone === 'down' ? 'bg-coral text-ink' : 'bg-paper text-ink';
  return (
    <span
      className={`num inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.1em] ${
        solid ? solidClass : `border border-edge ${TONE_TEXT[tone]}`
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** A label above a number, which is most of this surface. */
export function Stat({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="mt-1.5 text-lg leading-none">{children}</dd>
      {hint === undefined ? null : <p className="mt-1.5 text-xs leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/**
 * What a list says when it has nothing in it. Every list on this surface has
 * one: an empty market board and a broken market board should not look alike.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border border-edge bg-raised px-5 py-10 text-center">
      <p className="font-display text-base">{title}</p>
      {children === undefined ? null : (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** A calm placeholder. It does not shimmer, and it does not outlive the data. */
export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="border border-edge bg-raised px-5 py-6" role="status" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-4 space-y-2" aria-hidden>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-3 bg-paper/5" style={{ width: `${86 - index * 14}%` }} />
        ))}
      </div>
    </div>
  );
}
