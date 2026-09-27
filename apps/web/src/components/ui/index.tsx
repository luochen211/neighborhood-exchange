import {
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
export function Button({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`button ${className}`} {...props} />;
}
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />;
}
export function Field({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generated = useId(),
    inputId = id ?? generated;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : props["aria-describedby"]
        }
      />
      {error && (
        <p className="error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function StatusMessage({
  title,
  children,
  action,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  error?: boolean;
}) {
  return (
    <section className="empty" role={error ? "alert" : "status"}>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </section>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  return loading ? (
    <div className="loading" role="status">
      正在加载…
      <div />
      <div />
    </div>
  ) : error ? (
    <StatusMessage
      error
      title="暂时无法加载"
      action={<Button onClick={retry}>重试</Button>}
    >
      {error}
    </StatusMessage>
  ) : null;
}
export function ErrorText({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : null;
}
