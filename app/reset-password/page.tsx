"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./styles.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccess(false);

    // Password length validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    // Password match validation
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: password,
        });

      if (updateError) {
        console.error("Password update error:", updateError);
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Give the user a moment to see the success message
      setTimeout(() => {
        router.push("/login");
      }, 1800);
    } catch (err) {
      console.error("Unexpected reset password error:", err);

      setError(
        "Something went wrong while resetting your password. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* BACKGROUND */}
      <div className="auth-bg-blobs">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="auth-card">
        {/* =========================================
            LEFT PANEL
        ========================================= */}
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
                Almost there
              </h2>

              <p className="auth-hero-subtitle">
                Choose a new password for your account
                to finish the reset process.
              </p>
            </div>

            <div className="auth-panel-footer">
              Secure password recovery powered by Supabase
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT PANEL
        ========================================= */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">

            <h1>Reset your password</h1>

            <p className="auth-form-subtitle">
              Enter your new password below.
            </p>

            {/* ERROR */}
            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="form-success">
                Password successfully reset. Redirecting
                you to login...
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* =====================================
                  NEW PASSWORD
              ===================================== */}
              <div className="field-group">

                <label
                  className="field-label"
                  htmlFor="password"
                >
                  New password
                </label>

                <div className="input-with-icon">

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    minLength={8}
                    className="text-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>

                </div>
              </div>

              {/* =====================================
                  CONFIRM PASSWORD
              ===================================== */}
              <div className="field-group">

                <label
                  className="field-label"
                  htmlFor="confirmPassword"
                >
                  Confirm password
                </label>

                <div className="input-with-icon">

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    required
                    minLength={8}
                    className="text-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(
                        e.target.value
                      );
                      setError(null);
                    }}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? "🙈" : "👁"}
                  </button>

                </div>
              </div>

              {/* =====================================
                  RESET BUTTON
              ===================================== */}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || success}
              >
                {loading ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" />
                    Resetting...
                  </span>
                ) : success ? (
                  "Password reset"
                ) : (
                  "Reset password"
                )}
              </button>

            </form>

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