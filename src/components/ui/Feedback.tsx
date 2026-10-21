export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Empty({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
      <p>{message}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
