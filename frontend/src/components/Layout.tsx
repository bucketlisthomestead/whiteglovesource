import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { RichOrPlain } from './RichOrPlain';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}

export function PageHeader({ eyebrow, title, subtitle, dark }: PageHeaderProps) {
  return (
    <div className={`py-12 md:py-20 px-4 ${dark ? 'bg-charcoal text-cream' : 'bg-cream-dark/50'}`}>
      <div className="max-w-3xl mx-auto text-center">
        {eyebrow && (
          <p className={`text-xs uppercase tracking-[0.3em] mb-4 ${dark ? 'text-gold' : 'text-gold'}`}>
            {eyebrow}
          </p>
        )}
        <h1 className={`text-3xl md:text-5xl font-serif mb-4 ${dark ? 'text-cream' : 'text-charcoal'}`}>
          {title}
        </h1>
        {subtitle && (
          <div className={`text-base md:text-lg leading-relaxed ${dark ? 'text-cream/70' : 'text-charcoal/60'}`}>
            <RichOrPlain text={subtitle} as="div" />
          </div>
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-charcoal text-cream hover:bg-charcoal-light',
    secondary: 'bg-gold text-charcoal hover:bg-gold-light',
    outline: 'border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Sending...' : children}
    </button>
  );
}

interface FormFieldProps {
  label: string;
  children: ReactNode;
  required?: boolean;
}

export function FormField({ label, children, required }: FormFieldProps) {
  const generatedId = useId();
  const childId =
    isValidElement(children) && (children as ReactElement<{ id?: string }>).props.id
      ? (children as ReactElement<{ id?: string }>).props.id
      : generatedId;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: childId })
    : children;

  return (
    <div>
      <label
        htmlFor={childId}
        className="block text-xs uppercase tracking-wider text-charcoal/75 font-medium mb-2"
      >
        {label}{required && <span className="text-gold ml-1">*</span>}
      </label>
      {control}
    </div>
  );
}

export const inputClass =
  'w-full px-4 py-3 bg-white border border-cream-dark text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-gold transition-colors';

export const textareaClass = `${inputClass} resize-y min-h-[120px]`;

export const selectClass = `${inputClass} appearance-none`;
