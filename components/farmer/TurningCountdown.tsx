"use client";

import { useEffect, useState } from "react";

export function TurningCountdown({
  scheduledAt,
  turningNumber,
}: {
  scheduledAt: string;
  turningNumber: number;
}) {
  // Start as null so the server and the first client render both
  // produce the SAME output (a placeholder), avoiding the mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Runs ONLY on the client, after hydration is already done.
    setNow(Date.now());

    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // While `now` is still null (server render + first client render),
  // show a stable placeholder instead of computing the countdown.
  if (now === null) {
    return (
      <>
        <div className="stat-card-value stat-amber">–h –m</div>
        <span className="badge badge-warning">
          Turning #{turningNumber}
        </span>
      </>
    );
  }

  const target = new Date(scheduledAt).getTime();
  const diffMs = target - now;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <>
      <div className={`stat-card-value ${overdue ? "stat-red" : "stat-amber"}`}>
        {hours}h {minutes}m
      </div>
      <span className={`badge ${overdue ? "badge-danger" : "badge-warning"}`}>
        Turning #{turningNumber} {overdue ? "overdue" : "remaining"}
      </span>
    </>
  );
}