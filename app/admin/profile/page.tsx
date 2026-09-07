import { ProfileForm } from "@/components/admin/ProfileForm";

export default function AdminProfilePage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <div className="page-subtitle">Your account details and password</div>
        </div>
      </div>
      <ProfileForm />
    </div>
  );
}
