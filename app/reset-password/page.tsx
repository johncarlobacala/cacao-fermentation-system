"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./styles.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/login");
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg-blobs">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="auth-card">
        <div
          className="auth-image-panel"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1589825743815-1795c99ebd94?q=80&w=1200&auto=format&fit=crop')",
          }}
        >
          <div className="auth-image-overlay" />
          <div className="panel-blob panel-blob-1" />
          <div className="panel-blob panel-blob-2" />

          <div className="auth-panel-content">
            <div className="auth-brand">
              <span className="auth-brand-icon">🌱</span>
              Cacao Fermentation Monitor
            </div>

            <div className="auth-hero-text">
              <h2 className="auth-hero-title">Almost there</h2>
              <p className="auth-hero-subtitle">
                Choose a new password for your account to finish the reset process.
              </p>
            </div>

            <div className="auth-panel-footer">
              Secure password recovery powered by Supabase
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <h1>Reset password</h1>
            <p className="auth-form-subtitle">Enter and confirm your new password.</p>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="password">
                  New password
                </label>
                <div className="input-with-icon">
                  <input
                    id="password"
                    type="password"
                    required
                    className="text-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <div className="input-with-icon">
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    className="text-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" />
                    Saving...
                  </span>
                ) : (
                  "Reset password"
                )}
              </button>
            </form>

            <div className="auth-bottom-link">
              <a href="/login">Back to login</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}