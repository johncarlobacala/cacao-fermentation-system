import { SettingsForm } from "@/components/admin/SettingsForm";

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="page-subtitle">Temperature thresholds, turning intervals, notification preferences</div>
        </div>
      </div>
      <SettingsForm />
    </div>
  );
}