"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./styles.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSent(false);
    setLoading(true);

    const supabase = createClient();

    // Clean the email before sending it to Supabase
    const cleanEmail = email.trim().toLowerCase();

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
       redirectTo: "https://cacaosense.vercel.app/reset-password",
      });

    setLoading(false);

    if (resetError) {
      console.error("Reset password error:", resetError);
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg-blobs">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="auth-card">
        {/* LEFT PANEL */}
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
              <h2 className="auth-hero-title">
                No worries, we've got you
              </h2>

              <p className="auth-hero-subtitle">
                We'll help you get back into your account in just a
                couple of steps.
              </p>
            </div>

            <div className="auth-panel-footer">
              Secure password recovery powered by Supabase
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <h1>Forgot password?</h1>

            <p className="auth-form-subtitle">
              Enter your email and we'll send you a reset link.
            </p>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            {/* SUCCESS MESSAGE */}
            {sent && (
              <div className="form-success">
                Check your email for a reset link.
              </div>
            )}

            {/* FORM */}
            {!sent && (
              <form onSubmit={handleSubmit}>
                <div className="field-group">
                  <label
                    className="field-label"
                    htmlFor="email"
                  >
                    Email
                  </label>

                  <div className="input-with-icon">
                    <input
                      id="email"
                      type="email"
                      required
                      className="text-input"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="btn-loading-content">
                      <span className="btn-spinner" />
                      Sending...
                    </span>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>
            )}

            {/* BACK TO LOGIN */}
            <div className="auth-bottom-link">
              <a href="/login">
                Back to login
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}