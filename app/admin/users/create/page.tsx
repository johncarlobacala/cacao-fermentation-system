"use client";

import { useState } from "react";

export default function CreateFarmerAccountPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/create-farmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        contact_number: contactNumber,
        temporary_password: password,
      }),
    });

    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }

    setSuccess(true);
    setFullName("");
    setEmail("");
    setContactNumber("");
    setPassword("");
    setShowPassword(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Create account</h1>
          <div className="page-subtitle">Create a login for a new farmer — role is locked to "Farmer"</div>
        </div>
      </div>

      <div className="create-account-grid">
        <div className="card create-account-form-card">
          {error && <div className="form-error">{error}</div>}
          {success && (
            <div className="form-success">
              Account created. A verification email was sent to the farmer.
            </div>
          )}

          {/* autoComplete="off" on the form itself helps discourage Chrome's
              form-level autofill heuristics on top of the per-field settings below */}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="field-group">
              <label className="field-label" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                className="text-input"
                required
                autoComplete="off"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="farmer-email-no-autofill"
                type="email"
                className="text-input"
                required
                autoComplete="new-email"
                placeholder="farmer@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="contactNumber">
                Contact number
              </label>
              <input
                id="contactNumber"
                name="contactNumber"
                className="text-input"
                autoComplete="off"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="role">
                Role
              </label>
              <input id="role" className="text-input" value="Farmer" disabled />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="password-field-wrapper">
                <input
                  id="password"
                  name="farmer-password-no-autofill"
                  type={showPassword ? "text" : "password"}
                  className="text-input"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Temporary password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // eye-off icon
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // eye icon
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        </div>

        <div className="create-account-sidebar">
          <div className="card">
            <h3 style={{ marginBottom: 10, fontSize: 15 }}>Before you create an account</h3>
            <ul style={{ fontSize: 14, color: "var(--color-text-muted)", paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
              <li>Role is always set to "Farmer" for accounts created here.</li>
              <li>The email must be unique — the farmer will use it to log in.</li>
              <li>Share the password with the farmer through a secure channel (not chat or email in plain text).</li>
              <li>The farmer can change their password later from their account settings.</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .create-account-grid {
          display: grid;
          grid-template-columns: minmax(0, 480px) minmax(260px, 320px);
          gap: 16px;
          align-items: start;
        }

        .create-account-form-card {
          margin: 0;
        }

        .create-account-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .password-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-field-wrapper .text-input {
          width: 100%;
          padding-right: 40px;
        }

        .password-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .password-toggle-btn:hover {
          color: var(--color-text);
        }

        @media (max-width: 860px) {
          .create-account-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}