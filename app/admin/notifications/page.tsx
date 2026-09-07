import { NotificationsList } from "@/components/shared/NotificationsList";

export default function AdminNotificationsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <div className="page-subtitle">System events and alerts for your account</div>
        </div>
      </div>
      <NotificationsList role="admin" />
    </div>
  );
}