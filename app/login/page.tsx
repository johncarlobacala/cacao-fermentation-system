"use client";

import "./styles.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setLoading(true);

    const supabase = createClient();

    try {
      // =====================================================
      // 1. SIGN IN
      // =====================================================

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(
          signInError.message.includes("Invalid login credentials")
            ? "Incorrect email or password."
            : signInError.message
        );

        setLoading(false);
        return;
      }

      const user = signInData.user;

      if (!user) {
        setError("Unable to sign in. Please try again.");
        setLoading(false);
        return;
      }

      // =====================================================
      // 2. GET USER PROFILE
      // =====================================================

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, status, full_name")
        .eq("id", user.id)
        .maybeSingle();

      // =====================================================
      // 3. PROFILE DOES NOT EXIST
      // =====================================================

      if (profileError) {
        console.error("Profile lookup error:", profileError);

        await supabase.auth.signOut();

        setError(
          "Unable to load your account profile. Please contact the administrator."
        );

        setLoading(false);
        return;
      }

      if (!profile) {
        console.error(
          "No profile found for authenticated user:",
          user.id
        );

        await supabase.auth.signOut();

        setError(
          "Your account profile is not configured. Please contact the administrator."
        );

        setLoading(false);
        return;
      }

      // =====================================================
      // 4. CHECK ACCOUNT STATUS
      // =====================================================

      if (profile.status === "inactive") {
        await supabase.auth.signOut();

        setError(
          "This account has been deactivated. Contact your admin."
        );

        setLoading(false);
        return;
      }

      // =====================================================
      // 5. CHECK ROLE
      // =====================================================

      if (profile.role === "admin") {
        router.replace("/admin/dashboard");
      } else if (profile.role === "farmer") {
        router.replace("/farmer/dashboard");
      } else {
        // Unknown role
        console.error("Unknown user role:", profile.role);

        await supabase.auth.signOut();

        setError(
          "Your account role is not configured correctly. Please contact the administrator."
        );

        setLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Login error:", err);

      await supabase.auth.signOut();

      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">

      {/* =====================================================
          BACKGROUND BLOBS
      ====================================================== */}

      <div className="auth-bg-blobs" aria-hidden="true">
        <span className="bg-blob bg-blob-1" />
        <span className="bg-blob bg-blob-2" />
        <span className="bg-blob bg-blob-3" />
      </div>

      <div className="auth-card">

        {/* ===================================================
            LEFT IMAGE PANEL
        ==================================================== */}

        <div
          className="auth-image-panel"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1589825743815-1795c99ebd94?q=80&w=1200&auto=format&fit=crop')",
          }}
        >
          <div
            className="auth-image-overlay"
            aria-hidden="true"
          />

          <span
            className="panel-blob panel-blob-1"
            aria-hidden="true"
          />

          <span
            className="panel-blob panel-blob-2"
            aria-hidden="true"
          />

          <div className="auth-panel-content">

            <div className="auth-brand">
              <span className="auth-brand-icon">
                🌱
              </span>

              Cacao Fermentation Monitor
            </div>

            <div className="auth-hero-text">

              <h2 className="auth-hero-title">
                Smart Cacao Fermentation Monitoring System
              </h2>

              <p className="auth-hero-subtitle">
                Monitor your fermentation batches in real-time
                anywhere, anytime.
              </p>

              <div className="auth-chips">

                <span className="auth-chip">
                  <span className="auth-chip-dot" />
                  42°C Bean Temperature
                </span>

                <span className="auth-chip">
                  <span className="auth-chip-dot" />
                  78% Humidity
                </span>

                <span className="auth-chip">
                  <span className="auth-chip-dot" />
                  Real-time Monitoring
                </span>

              </div>
            </div>

            <p className="auth-panel-footer">
              IoT-powered monitoring for small-scale cacao farmers.
            </p>

          </div>
        </div>

        {/* ===================================================
            LOGIN FORM
        ==================================================== */}

        <div className="auth-form-panel">

          <div className="auth-form-inner">

            <h1>Welcome Back</h1>

            <p className="auth-form-subtitle">
              Sign in to access your fermentation dashboard.
            </p>

            {/* ERROR MESSAGE */}

            {error && (
              <div
                className="form-error"
                role="alert"
              >
                <svg
                  className="form-error-icon"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />

                  <path
                    d="M10 6v4.5M10 13.5h.01"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>

                <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
            >

              {/* =================================================
                  EMAIL
              ================================================== */}

              <div className="field-group">

                <label
                  className="field-label"
                  htmlFor="email"
                >
                  Email
                </label>

                <div className="input-with-icon">

                  <svg
                    className="input-icon-left"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />

                    <path
                      d="m4 5.5 6 5 6-5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <input
                    id="email"
                    type="email"
                    required
                    className="text-input has-left-icon"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                  />

                </div>
              </div>

              {/* =================================================
                  PASSWORD
              ================================================== */}

              <div className="field-group">

                <label
                  className="field-label"
                  htmlFor="password"
                >
                  Password
                </label>

                <div
                  className="input-with-icon"
                  style={{
                    position: "relative",
                    width: "100%",
                  }}
                >

                  <svg
                    className="input-icon-left"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="4.5"
                      y="9"
                      width="11"
                      height="7.5"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />

                    <path
                      d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    className="text-input has-left-icon"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    autoComplete="current-password"
                    style={{
                      paddingRight: "44px",
                      boxSizing: "border-box",
                    }}
                  />

                  <button
                    type="button"
                    className="input-icon-btn"
                    onClick={() =>
                      setShowPassword((v) => !v)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    style={{
                      position: "absolute",
                      right: "4px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      zIndex: 10,
                      padding: "8px",
                      minWidth: "40px",
                      minHeight: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--auth-muted)",
                    }}
                  >

                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 2.5l15 15M8.3 8.5a2 2 0 0 0 2.8 2.8M6.1 6.2C4 7.4 2.5 9 2 10c1.3 2.9 4.5 6 8 6 1.3 0 2.5-.3 3.6-.9M12 4.3c-.6-.2-1.3-.3-2-.3-3.5 0-6.7 3.1-8 6 .4.9 1 1.9 1.8 2.8M17.9 12.6c.6-.8 1-1.7 1.6-2.6-1.3-2.9-4.5-6-8-6"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 10c1.3-2.9 4.5-6 8-6s6.7 3.1 8 6c-1.3 2.9-4.5 6-8 6s-6.7-3.1-8-6Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />

                        <circle
                          cx="10"
                          cy="10"
                          r="2"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                    )}

                  </button>

                </div>
              </div>

              {/* =================================================
                  FORGOT PASSWORD
              ================================================== */}

              <div className="auth-links-row">
                <a href="/forgot-password">
                  Forgot password?
                </a>
              </div>

              {/* =================================================
                  LOGIN BUTTON
              ================================================== */}

              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: "100%",
                }}
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading-content">
                    <span
                      className="btn-spinner"
                      aria-hidden="true"
                    />

                    Signing in...
                  </span>
                ) : (
                  "Login"
                )}
              </button>

            </form>

          </div>
        </div>

      </div>
    </div>
  );
}