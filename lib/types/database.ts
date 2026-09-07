// Hand-written types matching database_schema.sql.
// (Optional upgrade later: run `supabase gen types typescript` to auto-generate
// these from your live database instead of maintaining them by hand.)

export type UserRole = "admin" | "farmer";
export type AccountStatus = "active" | "inactive";
export type BatchSizeKg = "10" | "20" | "50" | "100" | "150";
export type BeanVariety = "Forastero" | "Trinitario" | "Criollo";
export type FermentationMethod = "Wooden Box" | "Heap" | "Basket";
export type BatchStatus = "ongoing" | "completed";
export type SensorStatus = "online" | "offline";
export type TurningStatus = "pending" | "completed" | "overdue";
export type AlertType = "low_temperature" | "high_temperature";
export type AlertStatus = "active" | "resolved";
export type NotificationType =
  | "turning_reminder"
  | "turning_due"
  | "turning_overdue"
  | "temperature_alert"
  | "batch_completed"
  | "system";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  contact_number: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Farm {
  id: string;
  farmer_id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  size_hectares: number | null;
  created_at: string;
  updated_at: string;
}

export interface FermentationBatch {
  id: string;
  batch_code: string;
  farm_id: string;
  farmer_id: string;
  size_kg: BatchSizeKg;
  variety: BeanVariety;
  method: FermentationMethod;
  start_date: string;
  status: BatchStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sensor {
  id: string;
  sensor_code: string;
  farm_id: string | null;
  batch_id: string | null;
  status: SensorStatus;
  last_reading_at: string | null;
  created_at: string;
}

export interface TemperatureReading {
  id: string;
  sensor_id: string;
  batch_id: string;
  temperature: number;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
}

export interface TurningSchedule {
  id: string;
  batch_id: string;
  turning_number: number;
  scheduled_at: string;
  completed_at: string | null;
  status: TurningStatus;
  reminder_sent: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  batch_id: string;
  sensor_id: string | null;
  alert_type: AlertType;
  temperature_value: number | null;
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}