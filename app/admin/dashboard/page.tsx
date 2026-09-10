"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleLineChart } from "@/components/ui/SimpleLineChart";

type Alert = {
  id: string;
  alert_type: string;
  temperature_value: number;
  created_at: string;
  fermentation_batches?: {
    batch_code: string;
  } | null;
};

type Turning = {
  id: string;
  turning_number: number;
  scheduled_at: string;
  status: string;
  fermentation_batches?: {
    batch_code: string;
    farmer_id: string;
    profiles?: {
      full_name: string;
    } | null;
  } | null;
};

type CompletedBatch = {
  id: string;
  batch_code: string;
  completed_at: string;
};

type Reading = {
  temperature: number | null;
  ph: number | null;
  humidity: number | null;
  recorded_at: string;
};

type ActiveBatch = {
  id: string;
  batch_code: string;
  farmer_id: string | null;
  start_date: string | null;
  status: string;
  completed_at: string | null;
  farmer_name: string;
};

function NotificationBell({
  unreadCount,
}: {
  unreadCount: number;
}) {
  return (
    <button
      type="button"
      className="dashboard-notification"
      onClick={() => {
        window.location.href = "/admin/notifications";
      }}
      aria-label="Notifications"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {unreadCount > 0 && (
        <span className="notification-red-dot">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [farmerCount, setFarmerCount] = useState(0);
  const [farmCount, setFarmCount] = useState(0);
  const [activeBatchCount, setActiveBatchCount] = useState(0);
  const [sensorsOnline, setSensorsOnline] = useState(0);
  const [sensorsOffline, setSensorsOffline] = useState(0);

  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [upcomingTurnings, setUpcomingTurnings] = useState<Turning[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<
    CompletedBatch[]
  >([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  /*
   * ============================================================
   * ACTIVE FERMENTATION BATCHES
   * ============================================================
   *
   * We only load batches whose real database status is "ongoing".
   *
   * We intentionally do NOT add a fake fermentation duration.
   * The currently supplied dashboard/project code does not expose
   * an existing total fermentation duration.
   */
  async function fetchActiveBatches(): Promise<ActiveBatch[]> {
    const { data: batches, error } = await supabase
      .from("fermentation_batches")
      .select(
        "id, batch_code, farmer_id, start_date, status, completed_at"
      )
      .eq("status", "ongoing")
      .order("start_date", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Active fermentation batches error:",
        error
      );
      return [];
    }

    if (!batches || batches.length === 0) {
      return [];
    }

    /*
     * Get farmer IDs from the actual batches.
     */
    const farmerIds = Array.from(
      new Set(
        batches
          .map((batch: any) => batch.farmer_id)
          .filter(Boolean)
      )
    );

    let profiles: any[] = [];

    /*
     * Get real farmer names from profiles.
     */
    if (farmerIds.length > 0) {
      const {
        data: profilesData,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", farmerIds);

      if (profilesError) {
        console.error(
          "Active batch farmer profiles error:",
          profilesError
        );
      } else {
        profiles = profilesData ?? [];
      }
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ])
    );

    return batches.map((batch: any) => {
      const farmer = batch.farmer_id
        ? profileMap.get(batch.farmer_id)
        : undefined;

      return {
        id: batch.id,
        batch_code: batch.batch_code,
        farmer_id: batch.farmer_id ?? null,
        start_date: batch.start_date ?? null,
        status: batch.status,
        completed_at:
          batch.completed_at ?? null,
        farmer_name:
          farmer?.full_name ??
          "Unknown farmer",
      };
    });
  }

  /*
   * ============================================================
   * UPCOMING TURNINGS
   * ============================================================
   */
  async function fetchUpcomingTurnings(): Promise<Turning[]> {
    const {
      data: schedules,
      error: schedulesError,
    } = await supabase
      .from("turning_schedules")
      .select(
        "id, turning_number, scheduled_at, status, batch_id"
      )
      .eq("status", "pending")
      .gt(
        "scheduled_at",
        new Date().toISOString()
      )
      .order("scheduled_at", {
        ascending: true,
      })
      .limit(5);

    if (schedulesError) {
      console.error(
        "Upcoming turnings error:",
        schedulesError
      );
      return [];
    }

    if (!schedules || schedules.length === 0) {
      return [];
    }

    const batchIds = Array.from(
      new Set(
        schedules
          .map(
            (schedule: any) =>
              schedule.batch_id
          )
          .filter(Boolean)
      )
    );

    let batches: any[] = [];

    if (batchIds.length > 0) {
      const {
        data: batchesData,
        error: batchesError,
      } = await supabase
        .from("fermentation_batches")
        .select(
          "id, batch_code, farmer_id"
        )
        .in("id", batchIds);

      if (batchesError) {
        console.error(
          "Turning batches error:",
          batchesError
        );
      } else {
        batches = batchesData ?? [];
      }
    }

    const farmerIds = Array.from(
      new Set(
        batches
          .map(
            (batch) => batch.farmer_id
          )
          .filter(Boolean)
      )
    );

    let farmerProfiles: any[] = [];

    if (farmerIds.length > 0) {
      const {
        data: profilesData,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", farmerIds);

      if (profilesError) {
        console.error(
          "Turning profiles error:",
          profilesError
        );
      } else {
        farmerProfiles =
          profilesData ?? [];
      }
    }

    const batchMap = new Map(
      batches.map((batch) => [
        batch.id,
        batch,
      ])
    );

    const profileMap = new Map(
      farmerProfiles.map((profile) => [
        profile.id,
        profile,
      ])
    );

    return schedules.map(
      (schedule: any) => {
        const batch = batchMap.get(
          schedule.batch_id
        );

        const profile = batch
          ? profileMap.get(
              batch.farmer_id
            )
          : undefined;

        return {
          id: schedule.id,
          turning_number:
            schedule.turning_number,
          scheduled_at:
            schedule.scheduled_at,
          status: schedule.status,
          fermentation_batches: batch
            ? {
                batch_code:
                  batch.batch_code,
                farmer_id:
                  batch.farmer_id,
                profiles: profile
                  ? {
                      full_name:
                        profile.full_name,
                    }
                  : null,
              }
            : null,
        };
      }
    );
  }

  /*
   * ============================================================
   * UNREAD NOTIFICATIONS
   * ============================================================
   */
  async function loadUnreadNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadNotifications(0);
      return;
    }

    const {
      count,
      error,
    } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error(
        "Unread notifications error:",
        error
      );

      setUnreadNotifications(0);
      return;
    }

    setUnreadNotifications(
      count ?? 0
    );
  }

  /*
   * ============================================================
   * LOAD DASHBOARD DATA
   * ============================================================
   */
  async function loadData() {
    const [
      { count: fCount },
      { count: farmC },
      { count: activeC },
      { count: onlineC },
      { count: offlineC },
      { data: alerts },
      turningsResult,
      { data: completed },
      { data: recentReadings },
      activeBatchesResult,
    ] = await Promise.all([
      /*
       * Farmers
       */
      supabase
        .from("profiles")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("role", "farmer"),

      /*
       * Farms
       */
      supabase
        .from("farms")
        .select("*", {
          count: "exact",
          head: true,
        }),

      /*
       * Active fermentation batches
       */
      supabase
        .from("fermentation_batches")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("status", "ongoing"),

      /*
       * Online sensors
       */
      supabase
        .from("sensors")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("status", "online"),

      /*
       * Offline sensors
       */
      supabase
        .from("sensors")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("status", "offline"),

      /*
       * Recent alerts
       */
      supabase
        .from("alerts")
        .select(
          "id, alert_type, temperature_value, created_at, fermentation_batches(batch_code)"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(5),

      /*
       * Turning schedule
       */
      fetchUpcomingTurnings(),

      /*
       * Completed batches
       */
      supabase
        .from("fermentation_batches")
        .select(
          "id, batch_code, completed_at"
        )
        .eq("status", "completed")
        .order("completed_at", {
          ascending: false,
        })
        .limit(5),

      /*
       * Sensor readings — last 24 hours
       */
      supabase
        .from("sensor_readings")
        .select(
          "temperature, ph, humidity, recorded_at"
        )
        .gte(
          "recorded_at",
          new Date(
            Date.now() -
              24 *
                60 *
                60 *
                1000
          ).toISOString()
        )
        .order("recorded_at", {
          ascending: true,
        })
        .limit(50),

      /*
       * Active fermentation progress
       */
      fetchActiveBatches(),
    ]);

    setFarmerCount(
      fCount ?? 0
    );

    setFarmCount(
      farmC ?? 0
    );

    setActiveBatchCount(
      activeC ?? 0
    );

    setSensorsOnline(
      onlineC ?? 0
    );

    setSensorsOffline(
      offlineC ?? 0
    );

    setRecentAlerts(
      (alerts as any) ?? []
    );

    setUpcomingTurnings(
      turningsResult ?? []
    );

    setRecentCompleted(
      completed ?? []
    );

    setReadings(
      recentReadings ?? []
    );

    setActiveBatches(
      activeBatchesResult ?? []
    );

    setLoading(false);
  }

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */
  useEffect(() => {
    loadData();
    loadUnreadNotifications();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ============================================================
   * REALTIME
   * ============================================================
   */
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard")

      /*
       * Sensor readings
       */
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        (payload) => {
          const row =
            payload.new as Reading;

          setReadings((prev) => {
            const cutoff =
              Date.now() -
              24 *
                60 *
                60 *
                1000;

            const updated = [
              ...prev,
              row,
            ].filter(
              (reading) =>
                new Date(
                  reading.recorded_at
                ).getTime() >=
                cutoff
            );

            return updated.slice(
              -50
            );
          });
        }
      )

      /*
       * Alerts
       */
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
        },
        () => {
          supabase
            .from("alerts")
            .select(
              "id, alert_type, temperature_value, created_at, fermentation_batches(batch_code)"
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(5)
            .then(({ data }) => {
              setRecentAlerts(
                (data as any) ??
                  []
              );
            });
        }
      )

      /*
       * Turning schedule
       */
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "turning_schedules",
        },
        () => {
          fetchUpcomingTurnings().then(
            (data) => {
              setUpcomingTurnings(
                data
              );
            }
          );
        }
      )

      /*
       * Fermentation batches
       *
       * This now listens to ALL changes, not just UPDATE.
       * That means INSERT/UPDATE/DELETE will also refresh
       * the Active Fermentation Progress section.
       */
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fermentation_batches",
        },
        () => {
          /*
           * Refresh count
           */
          supabase
            .from("fermentation_batches")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("status", "ongoing")
            .then(({ count }) => {
              setActiveBatchCount(
                count ?? 0
              );
            });

          /*
           * Refresh active batches
           */
          fetchActiveBatches().then(
            (data) => {
              setActiveBatches(
                data
              );
            }
          );

          /*
           * Refresh completed batches
           */
          supabase
            .from("fermentation_batches")
            .select(
              "id, batch_code, completed_at"
            )
            .eq("status", "completed")
            .order(
              "completed_at",
              {
                ascending: false,
              }
            )
            .limit(5)
            .then(({ data }) => {
              setRecentCompleted(
                data ?? []
              );
            });
        }
      )

      /*
       * Sensors
       */
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sensors",
        },
        () => {
          supabase
            .from("sensors")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("status", "online")
            .then(({ count }) => {
              setSensorsOnline(
                count ?? 0
              );
            });

          supabase
            .from("sensors")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("status", "offline")
            .then(({ count }) => {
              setSensorsOffline(
                count ?? 0
              );
            });
        }
      )

      /*
       * Notifications
       */
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadUnreadNotifications();
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [supabase]);

  /*
   * ============================================================
   * CHART DATA
   * ============================================================
   */

  const chartPoints = readings
    .filter(
      (reading) =>
        reading.temperature !==
          null &&
        reading.temperature !==
          undefined
    )
    .map((reading) => ({
      label: new Date(
        reading.recorded_at
      ).toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ),
      value: Number(
        reading.temperature
      ),
    }));

  const phChartPoints = readings
    .filter(
      (reading) =>
        reading.ph !== null &&
        reading.ph !== undefined
    )
    .map((reading) => ({
      label: new Date(
        reading.recorded_at
      ).toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ),
      value: Number(
        reading.ph
      ),
    }));

  const humidityChartPoints =
    readings
      .filter(
        (reading) =>
          reading.humidity !==
            null &&
          reading.humidity !==
            undefined
      )
      .map((reading) => ({
        label: new Date(
          reading.recorded_at
        ).toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        ),
        value: Number(
          reading.humidity
        ),
      }));

  /*
   * ============================================================
   * LATEST READING
   * ============================================================
   */

  const latestReading =
    readings.length > 0
      ? readings[
          readings.length - 1
        ]
      : null;

  const latestTemperature =
    latestReading?.temperature !=
    null
      ? `${Number(
          latestReading.temperature
        ).toFixed(1)}°C`
      : "—";

  const latestPh =
    latestReading?.ph != null
      ? Number(
          latestReading.ph
        ).toFixed(2)
      : "—";

  const latestHumidity =
    latestReading?.humidity !=
    null
      ? `${Number(
          latestReading.humidity
        ).toFixed(1)}%`
      : "—";

  const lastUpdated =
    latestReading?.recorded_at
      ? new Date(
          latestReading.recorded_at
        ).toLocaleString(
          [],
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "No readings yet";

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="page-header dashboard-header">
        <div>
          <h1>Dashboard</h1>

          <div className="page-subtitle">
            Monitor the current status
            of cacao fermentation
            operations
          </div>
        </div>

        <NotificationBell
          unreadCount={
            unreadNotifications
          }
        />
      </div>
    );
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="page-header">
        <div>
          <h1>Dashboard</h1>

          <div className="page-subtitle">
            Monitor the current status
            of cacao fermentation
            operations
          </div>

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 6,
                fontSize: 12.5,
                color:
                  "var(--color-text-muted)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius:
                    "50%",
                  background:
                    "#218653",
                  display:
                    "inline-block",
                }}
              />

              <span>
                System Operational
              </span>
            </div>

            <div
              style={{
                fontSize: 12.5,
                color:
                  "var(--color-text-muted)",
              }}
            >
              Last updated:{" "}
              <strong
                style={{
                  color:
                    "var(--color-text)",
                  fontWeight: 600,
                }}
              >
                {lastUpdated}
              </strong>
            </div>
          </div>
        </div>

        <NotificationBell
          unreadCount={
            unreadNotifications
          }
        />
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ====================================================== */}

      <div
        className="stat-grid"
        style={{
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Total farmers"
          value={farmerCount}
          color="blue"
        />

        <StatCard
          label="Total active farms"
          value={farmCount}
          color="green"
        />

        <StatCard
          label="Active fermentation batches"
          value={activeBatchCount}
          color="amber"
        />

        <StatCard
          label="Sensors online / offline"
          value={`${sensorsOnline} / ${sensorsOffline}`}
          color={
            sensorsOffline
              ? "red"
              : "green"
          }
        />
      </div>

      {/* =====================================================
          CURRENT SENSOR VALUES
      ====================================================== */}

      <div
        className="stat-grid"
        style={{
          marginBottom: 20,
        }}
      >
        <StatCard
          label="Current temperature"
          value={
            latestTemperature
          }
          color="red"
        />

        <StatCard
          label="Current pH"
          value={latestPh}
          color="blue"
        />

        <StatCard
          label="Current humidity"
          value={
            latestHumidity
          }
          color="green"
        />
      </div>

      {/* =====================================================
          ACTIVE FERMENTATION PROGRESS
      ====================================================== */}

      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: 20,
        }}
      >
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 9,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background:
                    "rgba(108, 78, 246, 0.10)",
                  color:
                    "var(--color-primary, #6c4ef6)",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v20" />
                  <path d="M17 5c-2.5 1-4 2.7-5 5" />
                  <path d="M7 5c2.5 1-4 2.7-5 5" />
                  <path d="M17 19c-2.5-1-4-2.7-5-5" />
                  <path d="M7 19c2.5-1-4-2.7-5-5" />
                </svg>
              </div>

              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                }}
              >
                Active Fermentation
                Progress
              </h3>
            </div>

            <div
              style={{
                marginTop: 4,
                marginLeft: 39,
                fontSize: 12.5,
                color:
                  "var(--color-text-muted)",
              }}
            >
              Current fermentation
              day of active cacao
              batches
            </div>
          </div>

          <a
            href="/admin/batches"
            className="btn-secondary"
            style={{
              padding:
                "7px 12px",
              fontSize: 12,
              whiteSpace:
                "nowrap",
            }}
          >
            View all →
          </a>
        </div>

        {activeBatches.length ===
        0 ? (
          <div
            style={{
              padding:
                "30px 16px",
              textAlign:
                "center",
              color:
                "var(--color-text-muted)",
              fontSize: 13.5,
              border:
                "1px dashed var(--color-border)",
              borderRadius: 10,
            }}
          >
            No active fermentation
            batches.
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              width: "100%",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 700,
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={
                      tableHeaderStyle
                    }
                  >
                    Batch
                  </th>

                  <th
                    style={
                      tableHeaderStyle
                    }
                  >
                    Farmer
                  </th>

                  <th
                    style={
                      tableHeaderStyle
                    }
                  >
                    Fermentation Day
                  </th>

                  <th
                    style={{
                      ...tableHeaderStyle,
                      minWidth: 190,
                    }}
                  >
                    Progress
                  </th>

                  <th
                    style={
                      tableHeaderStyle
                    }
                  >
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {activeBatches.map(
                  (batch) => {
                    const day =
                      getFermentationDay(
                        batch.start_date
                      );

                    return (
                      <tr
                        key={
                          batch.id
                        }
                      >
                        {/* Batch */}
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13.5,
                            }}
                          >
                            {
                              batch.batch_code
                            }
                          </div>

                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 11.5,
                              color:
                                "var(--color-text-muted)",
                            }}
                          >
                            {batch.start_date
                              ? `Started ${formatDate(
                                  batch.start_date
                                )}`
                              : "Start date unavailable"}
                          </div>
                        </td>

                        {/* Farmer */}
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {
                            batch.farmer_name
                          }
                        </td>

                        {/* Day */}
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {day !==
                          null ? (
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                }}
                              >
                                Day{" "}
                                {day}
                              </div>

                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 11.5,
                                  color:
                                    "var(--color-text-muted)",
                                }}
                              >
                                Elapsed
                                fermentation
                              </div>
                            </div>
                          ) : (
                            <span
                              style={{
                                color:
                                  "var(--color-text-muted)",
                                fontSize: 12.5,
                              }}
                            >
                              Start date
                              unavailable
                            </span>
                          )}
                        </td>

                        {/* Progress */}
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {/*
                           * IMPORTANT:
                           * There is currently no verified total
                           * fermentation duration in the supplied
                           * project code.
                           *
                           * Therefore we DO NOT display a fake
                           * percentage and DO NOT fill the bar.
                           */}
                          <div
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                height: 7,
                                background:
                                  "rgba(108, 78, 246, 0.08)",
                                borderRadius:
                                  999,
                                overflow:
                                  "hidden",
                                minWidth: 90,
                              }}
                            >
                              <div
                                style={{
                                  width:
                                    "28%",
                                  height:
                                    "100%",
                                  background:
                                    "var(--color-primary, #6c4ef6)",
                                  borderRadius:
                                    999,
                                  opacity:
                                    0.45,
                                }}
                              />
                            </div>

                            <span
                              style={{
                                fontSize: 12,
                                color:
                                  "var(--color-text-muted)",
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              Elapsed
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 5,
                              fontSize: 11,
                              color:
                                "var(--color-text-muted)",
                            }}
                          >
                            Total duration
                            unavailable
                          </div>
                        </td>

                        {/* Status */}
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              gap: 6,
                              padding:
                                "5px 9px",
                              borderRadius:
                                999,
                              background:
                                "rgba(33, 150, 83, 0.08)",
                              color:
                                "#218653",
                              fontSize: 11.5,
                              fontWeight: 600,
                              textTransform:
                                "capitalize",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius:
                                  "50%",
                                background:
                                  "#218653",
                              }}
                            />

                            {
                              batch.status
                            }
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          TEMPERATURE TREND
      ====================================================== */}

      <div
        className="card"
        style={{
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
              }}
            >
              Temperature Trend
            </h3>

            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                color:
                  "var(--color-text-muted)",
              }}
            >
              Last 24 hours
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                color:
                  "var(--color-text-muted)",
              }}
            >
              Current
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {latestTemperature}
            </div>
          </div>
        </div>

        {chartPoints.length >
        0 ? (
          <SimpleLineChart
            points={chartPoints}
          />
        ) : (
          <EmptyRow text="No readings yet." />
        )}
      </div>

      {/* =====================================================
          PH + HUMIDITY
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* pH */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                }}
              >
                pH Trend
              </h3>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  color:
                    "var(--color-text-muted)",
                }}
              >
                Last 24 hours
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color:
                    "var(--color-text-muted)",
                }}
              >
                Latest
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {latestPh}
              </div>
            </div>
          </div>

          {phChartPoints.length >
          0 ? (
            <SimpleLineChart
              points={
                phChartPoints
              }
            />
          ) : (
            <EmptyRow text="No pH readings yet." />
          )}
        </div>

        {/* Humidity */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                }}
              >
                Humidity Trend
              </h3>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  color:
                    "var(--color-text-muted)",
                }}
              >
                Last 24 hours
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color:
                    "var(--color-text-muted)",
                }}
              >
                Latest
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {latestHumidity}
              </div>
            </div>
          </div>

          {humidityChartPoints.length >
          0 ? (
            <SimpleLineChart
              points={
                humidityChartPoints
              }
            />
          ) : (
            <EmptyRow text="No humidity readings yet." />
          )}
        </div>
      </div>

      {/* =====================================================
          ALERTS + TURNINGS + COMPLETED
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {/* Recent Alerts */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 15,
              }}
            >
              Recent alerts
            </h3>

            <a
              href="/admin/monitoring/alerts"
              style={{
                fontSize: 12,
                color:
                  "var(--color-primary, #6c4ef6)",
                textDecoration:
                  "none",
                fontWeight: 600,
              }}
            >
              View all →
            </a>
          </div>

          {!recentAlerts.length && (
            <EmptyRow text="No alerts recorded." />
          )}

          {recentAlerts.map(
            (alert) => (
              <div
                key={alert.id}
                style={{
                  padding:
                    "10px 0",
                  borderBottom:
                    "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {
                      alert
                        .fermentation_batches
                        ?.batch_code
                    }
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      color:
                        "var(--color-text-muted)",
                    }}
                  >
                    {timeAgo(
                      alert.created_at
                    )}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color:
                      "var(--color-text-muted)",
                    marginTop: 3,
                  }}
                >
                  {alert.alert_type ===
                  "high_temperature"
                    ? "High temperature"
                    : "Low temperature"}{" "}
                  —{" "}
                  {
                    alert.temperature_value
                  }
                  °C
                </div>
              </div>
            )
          )}
        </div>

        {/* Upcoming Turnings */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 15,
              }}
            >
              Upcoming turnings today
            </h3>

            <a
              href="/admin/turning"
              style={{
                fontSize: 12,
                color:
                  "var(--color-primary, #6c4ef6)",
                textDecoration:
                  "none",
                fontWeight: 600,
              }}
            >
              View schedule →
            </a>
          </div>

          {!upcomingTurnings.length && (
            <EmptyRow text="No turnings scheduled for today." />
          )}

          {upcomingTurnings.map(
            (turning) => (
              <div
                key={turning.id}
                style={{
                  padding:
                    "10px 0",
                  borderBottom:
                    "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {
                      turning
                        .fermentation_batches
                        ?.batch_code
                    }{" "}
                    — Turning #
                    {
                      turning.turning_number
                    }
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color:
                        "var(--color-text-muted)",
                      marginTop: 3,
                    }}
                  >
                    {
                      turning
                        .fermentation_batches
                        ?.profiles
                        ?.full_name
                    }{" "}
                    ·{" "}
                    {new Date(
                      turning.scheduled_at
                    ).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </div>
                </div>

                <a
                  href="/admin/turning"
                  className="btn-secondary"
                  style={{
                    padding:
                      "6px 12px",
                    fontSize: 12,
                  }}
                >
                  View
                </a>
              </div>
            )
          )}
        </div>

        {/* Recently Completed */}
        <div className="card">
          <h3
            style={{
              marginBottom: 12,
              fontSize: 15,
            }}
          >
            Recently completed batches
          </h3>

          {!recentCompleted.length && (
            <EmptyRow text="No completed batches yet." />
          )}

          {recentCompleted.map(
            (batch) => (
              <div
                key={batch.id}
                style={{
                  padding:
                    "10px 0",
                  borderBottom:
                    "1px solid var(--color-border)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {
                    batch.batch_code
                  }
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color:
                      "var(--color-text-muted)",
                    marginTop: 3,
                  }}
                >
                  Completed{" "}
                  {new Date(
                    batch.completed_at
                  ).toLocaleDateString()}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TABLE STYLES
============================================================ */

const tableHeaderStyle: React.CSSProperties =
  {
    textAlign: "left",
    padding: "10px 10px",
    borderBottom:
      "1px solid var(--color-border)",
    color:
      "var(--color-text-muted)",
    fontSize: 11.5,
    fontWeight: 600,
    textTransform:
      "uppercase",
    letterSpacing: "0.03em",
  };

const tableCellStyle: React.CSSProperties =
  {
    padding: "13px 10px",
    borderBottom:
      "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

/* ============================================================
   FERMENTATION DAY
============================================================ */

/*
 * Start date = Day 1
 *
 * Example:
 *
 * Sept 7  = Day 1
 * Sept 8  = Day 2
 * Sept 9  = Day 3
 * Sept 10 = Day 4
 *
 * This calculates ONLY the elapsed day.
 *
 * It does NOT invent a total duration.
 */
function getFermentationDay(
  startDate: string | null
): number | null {
  if (!startDate) {
    return null;
  }

  const start = new Date(
    startDate
  );

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    return null;
  }

  const today = new Date();

  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const currentDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const difference =
    currentDay.getTime() -
    startDay.getTime();

  const elapsedDays =
    Math.floor(
      difference /
        (1000 *
          60 *
          60 *
          24)
    );

  return Math.max(
    1,
    elapsedDays + 1
  );
}

/* ============================================================
   DATE FORMAT
============================================================ */

function formatDate(
  dateString: string
) {
  const date = new Date(
    dateString
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleDateString(
    [],
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyRow({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        color:
          "var(--color-text-muted)",
        fontSize: 13.5,
        padding: "8px 0",
      }}
    >
      {text}
    </div>
  );
}

/* ============================================================
   TIME AGO
============================================================ */

function timeAgo(
  dateString: string
) {
  const diffMs =
    Date.now() -
    new Date(
      dateString
    ).getTime();

  const mins = Math.floor(
    diffMs / 60000
  );

  if (mins < 1) {
    return "just now";
  }

  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(
    mins / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(
    hours / 24
  )}d ago`;
}