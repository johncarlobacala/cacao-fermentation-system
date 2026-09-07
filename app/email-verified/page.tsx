export default function EmailVerifiedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: 20,
      }}
    >
      <div className="card" style={{ maxWidth: 420, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Email verified</h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
          Your account is confirmed. You can now log in.
        </p>
        <a href="/login" className="btn-primary" style={{ display: "inline-block" }}>
          Go to login
        </a>
      </div>
    </div>
  );
}
