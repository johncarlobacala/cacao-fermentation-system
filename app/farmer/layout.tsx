import { FarmerSidebar } from "@/components/farmer/FarmerSidebar";

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <FarmerSidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
