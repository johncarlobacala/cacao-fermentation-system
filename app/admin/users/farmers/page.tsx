import { FarmersTable } from "@/components/admin/FarmersTable";

export default function FarmersPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Farmers</h1>
          <div className="page-subtitle">Manage all farmer accounts</div>
        </div>
      </div>
      <FarmersTable />
    </div>
  );
}
