import { NotificationsList } from "@/components/shared/NotificationsList";

export default function FarmerNotificationsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <div className="page-subtitle">
            Turning reminders, alerts, and account activity
          </div>
        </div>
      </div>
      <NotificationsList />
    </div>
  );
}