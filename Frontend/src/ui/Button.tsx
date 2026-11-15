import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover font-semibold',
  secondary: 'bg-raised text-text hover:bg-hover border border-line',
  ghost: 'text-muted hover:text-text hover:bg-raised',
  danger: 'bg-bad text-white hover:brightness-110 font-semibold',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant], sizes[size], className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'off' | 'danger' | 'accent';
  badge?: number;
}

/** Round control-bar button. `tone="off"` = a device that is switched off. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active, tone = 'default', badge, className, children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
        'disabled:opacity-40',
        tone === 'default' && (active ? 'bg-text text-ink' : 'bg-raised text-text hover:bg-hover'),
        tone === 'off' && 'bg-bad/15 text-bad hover:bg-bad/25',
        tone === 'danger' && 'bg-bad text-white hover:brightness-110',
        tone === 'accent' && 'bg-accent text-accent-ink hover:bg-accent-hover',
        className,
      )}
      {...rest}
    >
      {children}
      {!!badge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-accent text-accent-ink text-[11px] font-bold leading-5 tabular">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
