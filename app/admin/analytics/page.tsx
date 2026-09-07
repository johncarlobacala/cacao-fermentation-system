import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";

export const dynamic = "force-dynamic";

type BatchRow = {
  id: string;
  variety: string | null;
  method: string | null;
  status: string | null;
  start_date: string;
  completed_at: string | null;
  farmer_id: string | null;
  profiles:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
};

type BarItem = {
  label: string;
  value: number;
};

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: batches, error } = await supabase
    .from("fermentation_batches")
    .select(`
      id,
      variety,
      method,
      status,
      start_date,
      completed_at,
      farmer_id,
      profiles!fermentation_batches_farmer_id_fkey(full_name)
    `)
    .order("start_date", { ascending: false });

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Analytics</h1>
            <div className="page-subtitle">
              Fermentation performance, batch trends, and farmer activity.
            </div>
          </div>
        </div>

        <div className="form-error">
          Failed to load analytics: {error.message}
        </div>
      </div>
    );
  }

  const all: BatchRow[] = (batches ?? []) as BatchRow[];

  // =========================================================
  // TOTAL BATCHES
  // =========================================================

  const totalCount = all.length;

  // =========================================================
  // COMPLETED BATCHES
  // =========================================================

  const completed = all.filter(
    (b) => b.status?.toLowerCase() === "completed" && b.completed_at
  );

  // =========================================================
  // SUCCESS RATE
  // =========================================================

  const successRate = totalCount
    ? Math.round((completed.length / totalCount) * 100)
    : 0;

  // =========================================================
  // AVERAGE FERMENTATION DURATION
  // =========================================================

  const avgDurationDays = completed.length
    ? completed.reduce((sum, b) => {
        const start = new Date(b.start_date).getTime();
        const end = new Date(b.completed_at!).getTime();

        const days = (end - start) / (1000 * 60 * 60 * 24);

        return sum + Math.max(days, 0);
      }, 0) / completed.length
    : 0;

  // =========================================================
  // GROUP BY VARIETY / METHOD
  // =========================================================

  function groupCount(key: "variety" | "method"): BarItem[] {
    const map = new Map<string, number>();

    all.forEach((batch) => {
      const value = batch[key]?.trim() || "Unknown";

      map.set(value, (map.get(value) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }

  const varietyBars = groupCount("variety");
  const methodBars = groupCount("method");

  // =========================================================
  // FARMER ACTIVITY
  // =========================================================

  const farmerMap = new Map<string, number>();

  all.forEach((batch) => {
    let farmerName = "Unknown farmer";

    if (Array.isArray(batch.profiles)) {
      farmerName = batch.profiles[0]?.full_name ?? "Unknown farmer";
    } else {
      farmerName = batch.profiles?.full_name ?? "Unknown farmer";
    }

    farmerMap.set(
      farmerName,
      (farmerMap.get(farmerName) ?? 0) + 1
    );
  });

  const farmerBars = Array.from(farmerMap.entries())
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="page-header">
        <div>
          <h1>Analytics</h1>

          <div className="page-subtitle">
            Fermentation performance, batch trends, and farmer activity.
          </div>
        </div>
      </div>

      {/* =====================================================
          SUMMARY STAT CARDS
      ===================================================== */}

      <div
        className="stat-grid"
        style={{
          marginBottom: 20,
        }}
      >
        <StatCard
          label="Total batches"
          value={totalCount}
          color="blue"
        />

        <StatCard
          label="Batch success rate"
          value={`${successRate}%`}
          color="green"
        />

        <StatCard
          label="Avg. fermentation duration"
          value={
            avgDurationDays > 0
              ? `${avgDurationDays.toFixed(1)} days`
              : "—"
          }
          color="amber"
        />
      </div>

      {/* =====================================================
          ANALYTICS GRID
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 18,
        }}
      >
        {/* ===================================================
            VARIETY
        =================================================== */}

        <div
          className="card"
          style={{
            padding: 22,
          }}
        >
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Batches by variety
            </h3>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "#9996aa",
              }}
            >
              Distribution of cacao varieties
            </div>
          </div>

          {varietyBars.length > 0 ? (
            <SimpleBarChart
  bars={varietyBars}
  color="#6c4ff6"
  total={totalCount}
/>
          ) : (
            <div
              style={{
                padding: "30px 0",
                textAlign: "center",
                color: "#9996aa",
                fontSize: 14,
              }}
            >
              No variety data available.
            </div>
          )}
        </div>

        {/* ===================================================
            METHOD
        =================================================== */}

        <div
          className="card"
          style={{
            padding: 22,
          }}
        >
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Batches by method
            </h3>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "#9996aa",
              }}
            >
              Fermentation methods currently used
            </div>
          </div>

          {methodBars.length > 0 ? (
            <SimpleBarChart
              bars={methodBars}
              color="#465bdc"
            />
          ) : (
            <div
              style={{
                padding: "30px 0",
                textAlign: "center",
                color: "#9996aa",
                fontSize: 14,
              }}
            >
              No method data available.
            </div>
          )}
        </div>

        {/* ===================================================
            FARMER ACTIVITY
        =================================================== */}

        <div
          className="card"
          style={{
            padding: 22,
          }}
        >
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Farmer activity
            </h3>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "#9996aa",
              }}
            >
              Top farmers by number of batches
            </div>
          </div>

          {farmerBars.length > 0 ? (
            <SimpleBarChart
              bars={farmerBars}
              color="#159447"
            />
          ) : (
            <div
              style={{
                padding: "30px 0",
                textAlign: "center",
                color: "#9996aa",
                fontSize: 14,
              }}
            >
              No farmer activity available.
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          ANALYTICS SUMMARY
      ===================================================== */}

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Fermentation overview
            </h3>

            <div
              style={{
                marginTop: 5,
                color: "#9996aa",
                fontSize: 13,
              }}
            >
              Current summary based on recorded fermentation batches.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 28,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9996aa",
                  marginBottom: 4,
                }}
              >
                Completed
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#159447",
                }}
              >
                {completed.length}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9996aa",
                  marginBottom: 4,
                }}
              >
                Ongoing
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#4f5fe8",
                }}
              >
                {
                  all.filter(
                    (b) =>
                      b.status?.toLowerCase() === "ongoing"
                  ).length
                }
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9996aa",
                  marginBottom: 4,
                }}
              >
                Varieties
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#6c4ff6",
                }}
              >
                {varietyBars.length}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9996aa",
                  marginBottom: 4,
                }}
              >
                Farmers
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#159447",
                }}
              >
                {farmerBars.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div
        style={{
          marginTop: 14,
          textAlign: "right",
          fontSize: 12,
          color: "#aaa7b8",
        }}
      >
        Analytics are automatically updated from fermentation batch records.
      </div>
    </div>
  );
}