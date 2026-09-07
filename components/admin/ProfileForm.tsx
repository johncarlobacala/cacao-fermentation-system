"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, contact_number")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name ?? "");
        setContactNumber(profile.contact_number ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    setSavingProfile(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, contact_number: contactNumber })
      .eq("id", user!.id);

    setSavingProfile(false);
    if (error) {
      setProfileErr(error.message);
      return;
    }
    setProfileMsg("Profile updated.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordErr(null);
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordErr("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr("Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordErr(error.message);
      return;
    }
    setPasswordMsg("Password changed.");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (loading) {
    return <div className="card">Loading profile...</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Account details</h3>
        {profileErr && <div className="form-error">{profileErr}</div>}
        {profileMsg && <div className="form-success">{profileMsg}</div>}

        <form onSubmit={handleSaveProfile}>
          <div className="field-group">
            <label className="field-label">Email</label>
            <input className="text-input" value={email} disabled />
          </div>
          <div className="field-group">
            <label className="field-label">Full name</label>
            <input className="text-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Contact number</label>
            <input className="text-input" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Change password</h3>
        {passwordErr && <div className="form-error">{passwordErr}</div>}
        {passwordMsg && <div className="form-success">{passwordMsg}</div>}

        <form onSubmit={handleChangePassword}>
          <div className="field-group">
            <label className="field-label">New password</label>
            <input
              type="password"
              className="text-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Confirm new password</label>
            <input
              type="password"
              className="text-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={savingPassword}>
            {savingPassword ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
