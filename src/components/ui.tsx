'use client';

import Link from 'next/link';
import {
  ButtonHTMLAttributes,
  ComponentProps,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, Minus, Plus } from 'lucide-react';
import { humanize } from '@/lib/format';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-sun text-ink hover:bg-sun-strong active:bg-sun-strong',
  dark: 'bg-ink text-white hover:bg-ink-soft',
  secondary: 'border border-line bg-white text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-cloud',
  danger: 'border border-danger/30 bg-white text-danger hover:bg-danger-soft',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-xs',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-7 text-base',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, cx(block && 'w-full', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

const controlClasses =
  'w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-ink focus:ring-4 focus:ring-sun/40 disabled:bg-cloud disabled:text-muted aria-[invalid=true]:border-danger';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  optional?: boolean;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  optional,
  children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cx('grid gap-1.5', className)}>
      <label className="text-xs font-semibold text-ink-soft" htmlFor={id}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  ...props
}: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <input
        id={fieldId}
        className={cx(controlClasses, 'min-h-11')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  children,
  ...props
}: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <select id={fieldId} className={cx(controlClasses, 'min-h-11 cursor-pointer pr-8')} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  ...props
}: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <textarea id={fieldId} className={cx(controlClasses, 'min-h-24 py-3')} {...props} />
    </FieldShell>
  );
}

type Tone = 'info' | 'success' | 'danger' | 'warning';

const alertTones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-line bg-cloud text-ink', icon: <Info size={18} aria-hidden="true" /> },
  success: { box: 'border-success/20 bg-success-soft text-success', icon: <CheckCircle2 size={18} aria-hidden="true" /> },
  danger: { box: 'border-danger/20 bg-danger-soft text-danger', icon: <AlertCircle size={18} aria-hidden="true" /> },
  warning: { box: 'border-sun bg-sun-soft text-sun-ink', icon: <AlertCircle size={18} aria-hidden="true" /> },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon } = alertTones[tone];
  return (
    <div
      className={cx('flex gap-3 rounded-2xl border px-4 py-3 text-sm', box, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'leading-6 text-ink-soft')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

const badgeTones = {
  neutral: 'bg-cloud text-ink-soft',
  sun: 'bg-sun text-ink',
  soft: 'bg-sun-soft text-sun-ink',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  dark: 'bg-ink text-white',
} as const;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, keyof typeof badgeTones> = {
  pending_payment: 'soft',
  confirmed: 'success',
  preparing: 'sun',
  ready: 'dark',
  delivered: 'neutral',
  completed: 'neutral',
  cancelled: 'danger',
  expired: 'danger',
  failed: 'danger',
  payment_failed: 'danger',
  succeeded: 'success',
  pending: 'soft',
};

const statusLabels: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  cancelled_by_customer: 'Cancelled',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTones[status] ?? (status.startsWith('cancel') ? 'danger' : 'neutral');
  return (
    <Badge tone={tone} className={className}>
      {statusLabels[status] ?? humanize(status)}
    </Badge>
  );
}

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm text-muted', className)} role="status">
      <Loader2 className="animate-spin" size={18} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-cloud', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-12 text-center', className)}>
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-full bg-sun-soft text-sun-ink">{icon}</span>}
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm leading-6 text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cx('rounded-3xl border border-line bg-white shadow-card', className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  as: Heading = 'h2',
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sun-ink">{eyebrow}</p>}
        <Heading className="font-display text-3xl leading-tight sm:text-4xl" id={id}>
          {title}
        </Heading>
        {description && <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label: string;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'size-8' : 'size-10';
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white p-0.5" role="group" aria-label={label}>
      <button
        aria-label={`Decrease ${label}`}
        className={cx(box, 'grid place-items-center rounded-full text-ink transition hover:bg-cloud disabled:opacity-40')}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        aria-label={`Increase ${label}`}
        className={cx(box, 'grid place-items-center rounded-full bg-sun text-ink transition hover:bg-sun-strong disabled:opacity-40')}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cx('flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-cloud p-1', className)}
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            aria-selected={selected}
            className={cx(
              'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
              selected ? 'bg-white text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cx(
                  'grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-5 tabular-nums',
                  selected ? 'bg-sun text-ink' : 'bg-white text-ink-soft',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
