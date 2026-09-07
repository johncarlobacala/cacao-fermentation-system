"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function WeatherWidget({ lat, lng }: { lat?: number; lng?: number }) {
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lat || !lng) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    function fetchWeather() {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setWeather({ temp: data.current.temperature_2m, code: data.current.weather_code });
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }

    // Fetch immediately, then keep refreshing on an interval so the
    // widget reflects current conditions instead of only the value
    // captured when the page first loaded.
    fetchWeather();
    const intervalId = setInterval(fetchWeather, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [lat, lng]);

  function describeCode(code: number) {
    if (code === 0) return "☀️ Clear sky";
    if (code <= 3) return "⛅ Partly cloudy";
    if (code <= 48) return "🌫️ Foggy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "🌨️ Snow";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Storms";
  }

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="stat-card-label">Today's weather</div>
      {!lat || !lng ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          Set your farm's latitude/longitude (ask your admin) to see local weather here.
        </div>
      ) : loading ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading...</div>
      ) : weather ? (
        <>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(weather.temp)}°C</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{describeCode(weather.code)}</div>
        </>
      ) : (
        <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Couldn't load weather right now.</div>
      )}
    </div>
  );
}