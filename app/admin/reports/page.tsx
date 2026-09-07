import { ReportsBuilder } from "@/components/admin/ReportsBuilder";

export default function ReportsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="page-subtitle">Generate and export batch, farmer, or overall summary reports</div>
        </div>
      </div>
      <ReportsBuilder />
    </div>
  );
}
