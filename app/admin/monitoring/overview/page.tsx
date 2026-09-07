"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SimpleLineChart } from "@/components/ui/SimpleLineChart";
import Link from "next/link";

type BatchOption = {
  id: string;
  batch_code: string;
  status: string;
};

type Reading = {
  id: string;
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

const PANEL_COUNT = 8;

export default function Page() {
  const supabase = useMemo(() => createClient(), []);

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [selections, setSelections] = useState<string[]>(
    Array(PANEL_COUNT).fill("")
  );

  useEffect(() => {
    let mounted = true;

    async function loadBatches() {
      setLoading(true);

      const { data, error } = await supabase
        .from("fermentation_batches")
        .select("id, batch_code, status")
        .eq("status", "ongoing")
        .order("batch_code", { ascending: true });

      if (!mounted) return;

      if (error) {
        console.error("Error loading fermentation batches:", error);
        setBatches([]);
        setSelections(Array(PANEL_COUNT).fill(""));
        setLoading(false);
        return;
      }

      const list = data ?? [];

      setBatches(list);

      // Automatically assign unique batches to the first available panels.
      setSelections(
        Array.from(
          { length: PANEL_COUNT },
          (_, index) => list[index]?.id ?? ""
        )
      );

      setLoading(false);
    }

    loadBatches();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  function updateSelection(index: number, batchId: string) {
    setSelections((prev) => {
      const next = [...prev];
      next[index] = batchId;
      return next;
    });
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div
        style={{
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          Overview
        </h1>

        <p
          style={{
            marginTop: 8,
            color: "var(--color-text-muted)",
            fontSize: 15,
          }}
        >
          Compare up to {PANEL_COUNT} batches side by side.
        </p>
      </div>

      {/* LOADING */}
      {loading ? (
        <div
          className="card"
          style={{
            color: "var(--color-text-muted)",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading batches...
        </div>
      ) : batches.length === 0 ? (
        /* NO BATCHES */
        <div
          className="card"
          style={{
            color: "var(--color-text-muted)",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          No ongoing batches to monitor.
        </div>
      ) : (
        /* 8 PANELS */
        <div
          className="overview-batch-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {selections.map((selectedId, index) => {
            // Batches already selected by other panels
            const takenByOthers = selections.filter(
              (_, panelIndex) => panelIndex !== index
            );

            // Only show batches that are not already selected
            // by another panel.
            const availableOptions = batches.filter(
              (batch) =>
                !takenByOthers.includes(batch.id) ||
                batch.id === selectedId
            );

            return (
              <BatchPanel
                key={index}
                allBatches={batches}
                availableOptions={availableOptions}
                selectedBatch={selectedId}
                onChange={(id) => updateSelection(index, id)}
                supabase={supabase}
              />
            );
          })}
        </div>
      )}

      {/* RESPONSIVE GRID */}
      <style jsx>{`
        @media (max-width: 1200px) {
          .overview-batch-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .overview-batch-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 600px) {
          .overview-batch-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function BatchPanel({
  allBatches,
  availableOptions,
  selectedBatch,
  onChange,
  supabase,
}: {
  allBatches: BatchOption[];
  availableOptions: BatchOption[];
  selectedBatch: string;
  onChange: (id: string) => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadReadings() {
      if (!selectedBatch) {
        setReadings([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("sensor_readings")
        .select(
          "id, temperature, ph, humidity, recorded_at"
        )
        .eq("batch_id", selectedBatch)
        .gte(
          "recorded_at",
          new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString()
        )
        .order("recorded_at", {
          ascending: true,
        })
        .limit(200);

      if (!mounted) return;

      if (error) {
        console.error(
          "Error loading sensor readings:",
          error
        );

        setReadings([]);
        setLoading(false);
        return;
      }

      setReadings(data ?? []);
      setLoading(false);
    }

    loadReadings();

    return () => {
      mounted = false;
    };
  }, [selectedBatch, supabase]);

  /* =========================
     TEMPERATURE CHART DATA
     ========================= */

  const tempPoints = readings
    .filter((reading) => reading.temperature !== null)
    .map((reading) => ({
      label: new Date(
        reading.recorded_at
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),

      value: Number(reading.temperature),
    }));

  /* =========================
     LATEST READING
     ========================= */

  const latest =
    readings.length > 0
      ? readings[readings.length - 1]
      : null;

  const latestTemp =
    latest?.temperature != null
      ? `${Number(latest.temperature).toFixed(1)}°C`
      : "—";

  const latestPh =
    latest?.ph != null
      ? Number(latest.ph).toFixed(2)
      : "—";

  const latestHumidity =
    latest?.humidity != null
      ? `${Number(latest.humidity).toFixed(1)}%`
      : "—";

  /* =========================
     BATCH NAME
     ========================= */

  const selectedBatchInfo = allBatches.find(
    (batch) => batch.id === selectedBatch
  );

  return (
    <div
      className="card"
      style={{
        minHeight: 248,
        height: 248,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
     <select
  className="text-input"
  value={selectedBatch}
  onChange={(event) => onChange(event.target.value)}
  style={{
    marginBottom: 12,
    width: "100%",
    textAlign: "center",
    textAlignLast: "center",
    flexShrink: 0,
    cursor: "pointer",
  }}
>
  <option value="">None</option>

  {availableOptions.map((batch) => (
    <option key={batch.id} value={batch.id}>
      {batch.batch_code}
    </option>
  ))}
</select>

      {/* EMPTY PANEL */}

      {!selectedBatch ? (
        <div
          style={{
            color: "var(--color-text-muted)",
            fontSize: 13.5,
            flex: 1,
          }}
        >
          No batch selected.
        </div>
      ) : loading ? (
        /* LOADING PANEL */

        <div
          style={{
            color: "var(--color-text-muted)",
            fontSize: 13.5,
            flex: 1,
          }}
        >
          Loading...
        </div>
      ) : (
        /* BATCH DATA */

        <>
          {/* SENSOR VALUES */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr 1fr",
              gap: 8,
              marginBottom: 10,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {/* TEMPERATURE */}

            <div>
              <div
                style={{
                  color:
                    "var(--color-text-muted)",
                  marginBottom: 3,
                }}
              >
                Temp
              </div>

              <div
                style={{
                  fontWeight: 600,
                }}
              >
                {latestTemp}
              </div>
            </div>

            {/* PH */}

            <div>
              <div
                style={{
                  color:
                    "var(--color-text-muted)",
                  marginBottom: 3,
                }}
              >
                pH
              </div>

              <div
                style={{
                  fontWeight: 600,
                }}
              >
                {latestPh}
              </div>
            </div>

            {/* HUMIDITY */}

            <div>
              <div
                style={{
                  color:
                    "var(--color-text-muted)",
                  marginBottom: 3,
                }}
              >
                Humidity
              </div>

              <div
                style={{
                  fontWeight: 600,
                }}
              >
                {latestHumidity}
              </div>
            </div>
          </div>

          {/* TEMPERATURE CHART */}

          <div
            style={{
              flexShrink: 0,
              height: 70,
            }}
          >
            <SimpleLineChart
              points={tempPoints}
              height={70}
              color="#e0973b"
            />
          </div>

          {/* VIEW FULL DETAIL */}

          <div
  style={{
    display: "flex",
    justifyContent: "center",
    marginTop: 12,
    flexShrink: 0,
  }}
>
  <Link
    href={`/admin/monitoring/temperature?batch=${selectedBatch}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: "8px 16px",
      borderRadius: 8,
      background: "rgba(109, 40, 217, 0.08)",
      color: "var(--color-primary, #6d28d9)",
      fontSize: 13,
      fontWeight: 500,
      textDecoration: "none",
      transition: "all 0.2s ease",
    }}
  >
    View full detail
    <span style={{ fontSize: 14 }}>→</span>
  </Link>
</div>
        </>
      )}
    </div>
  );
}