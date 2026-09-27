import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export function Button({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`button ${className}`} {...props} />;
}
export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />;
}
export function Field({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <div className="field"><label htmlFor={inputId}>{label}</label>
    <input {...props} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : props['aria-describedby']} />
    {error && <p id={`${inputId}-error`} role="alert">{error}</p>}</div>;
}
export function StatusMessage({ title, children, action, error = false }: { title: string; children?: ReactNode; action?: ReactNode; error?: boolean }) {
  return <Card role={error ? 'alert' : 'status'}><h2>{title}</h2>{children && <p>{children}</p>}{action}</Card>;
}
export function PendingFeature({ title }: { title: string }) {
  return <StatusMessage title={title}>功能建设中，暂未开放。</StatusMessage>;
}
