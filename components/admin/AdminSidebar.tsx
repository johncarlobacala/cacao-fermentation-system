"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_GROUPS: { label: string; items: { href: string; icon: string; text: string }[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", icon: "", text: "Dashboard" }],
  },
  {
    label: "User management",
    items: [
      { href: "/admin/users/farmers", icon: "", text: "Farmers" },
      { href: "/admin/users/create", icon: "", text: "Create account" },
    ],
  },
  {
    label: "Farm operations",
    items: [
      { href: "/admin/farms", icon: "", text: "Farms" },
      { href: "/admin/batches", icon: "", text: "Fermentation batches" },
      { href: "/admin/turning", icon: "", text: "Turning schedule" },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/admin/monitoring/overview", icon: "", text: "Overview" },
      { href: "/admin/monitoring/temperature", icon: "", text: "Sensor Readings" },
      { href: "/admin/monitoring/sensors", icon: "", text: "Sensor MAC Address" },
      { href: "/admin/monitoring/alerts", icon: "", text: "Alerts" },
    ],
  },
  {
    label: "Reports & analytics",
    items: [
      { href: "/admin/reports", icon: "", text: "Reports" },
      { href: "/admin/analytics", icon: "", text: "Analytics" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/admin/notifications", icon: "", text: "Notifications" },
      { href: "/admin/settings", icon: "", text: "Settings" },
      { href: "/admin/profile", icon: "", text: "Profile" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function closeSidebar() {
    setIsOpen(false);
  }

  return (
    <>
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setIsOpen(true)} aria-label="Open menu">
          ☰
        </button>
        <span className="sidebar-brand-icon">🌱</span>
        <span className="mobile-topbar-title">Cacao Monitor</span>
        <button className="topbar-logout-btn" onClick={handleLogout} aria-label="Logout">
           Logout
        </button>
      </div>

      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🌱</span>
          Cacao Monitor
          <button className="sidebar-close-btn" onClick={closeSidebar} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-section-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
                >
                  <span className="icon">{item.icon}</span>
                  {item.text}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
          >
            <span className="icon"></span>
            Logout
          </button>
        </div>
      </aside>

      <style jsx>{`
        .mobile-topbar {
          display: none;
        }
        .sidebar-close-btn {
          display: none;
        }
        .sidebar-overlay {
          display: none;
        }
        .topbar-logout-btn {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-topbar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            background: #fff;
            border-bottom: 1px solid #eee;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 30;
          }

          .hamburger-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
          }

          .mobile-topbar-title {
            font-weight: 600;
            flex: 1;
          }

          .topbar-logout-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            background: none;
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #d92d20;
            cursor: pointer;
          }

          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 260px;
            transform: translateX(-100%);
            transition: transform 0.25s ease-in-out;
            z-index: 50;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .sidebar-nav {
            flex: 1;
            overflow-y: auto;
            min-height: 0;
          }

          .sidebar-footer {
            flex-shrink: 0;
            border-top: 1px solid #eee;
            background: #fff;
          }

          .sidebar-close-btn {
            display: inline-block;
            margin-left: auto;
            background: none;
            border: none;
            font-size: 1.25rem;
            cursor: pointer;
          }

          .sidebar-brand {
            display: flex;
            align-items: center;
            flex-shrink: 0;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 40;
          }
        }
      `}</style>
    </>
  );
}