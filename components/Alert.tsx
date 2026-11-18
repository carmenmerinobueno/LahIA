export function Alert({ ok, error, info }: { ok?: string; error?: string; info?: string }) {
  if (error) return <p className="alert err" role="alert">{error}</p>;
  if (ok) return <p className="alert ok" role="status">{ok}</p>;
  if (info) return <p className="alert info" role="status">{info}</p>;
  return null;
}
