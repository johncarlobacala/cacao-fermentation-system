
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  text: string;
};

type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "farm-management",
    label: "Farm Management",
    items: [
      { href: "/admin/users/farmers", text: "Farmers" },
      { href: "/admin/farms", text: "Farms" },
      { href: "/admin/users/create", text: "Create Account" },
    ],
  },
  {
    key: "fermentation",
    label: "Fermentation",
    items: [
      { href: "/admin/batches", text: "Fermentation Batches" },
      { href: "/admin/turning", text: "Turning Schedule" },
    ],
  },
  {
    key: "monitoring",
    label: "Monitoring",
    items: [
      { href: "/admin/monitoring/overview", text: "Overview" },
      { href: "/admin/monitoring/temperature", text: "Sensor Readings" },
      { href: "/admin/monitoring/sensors", text: "Sensor MAC Address" },
      { href: "/admin/monitoring/alerts", text: "Alerts" },
    ],
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    items: [
      { href: "/admin/reports", text: "Reports" },
      { href: "/admin/analytics", text: "Analytics" },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { href: "/admin/notifications", text: "Notifications" },
      { href: "/admin/settings", text: "Settings" },
      { href: "/admin/profile", text: "Profile" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    NAV_GROUPS.filter((group) =>
      group.items.some((item) => item.href === pathname)
    ).map((group) => group.key)
  );

  // Automatically expand the group containing the active page.
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) =>
      group.items.some((item) => item.href === pathname)
    );

    if (activeGroup) {
      setExpandedGroups((previous) =>
        previous.includes(activeGroup.key)
          ? previous
          : [...previous, activeGroup.key]
      );
    }
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  function closeSidebar() {
    setIsOpen(false);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  }

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <>
      {/* MOBILE TOPBAR */}
      <div className="mobile-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>

        <span className="sidebar-brand-icon">🌱</span>
        <span className="mobile-topbar-title">Cacao Monitor</span>

        <button
          className="topbar-logout-btn"
          onClick={handleLogout}
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>

        {/* BRAND */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🌱</span>
          <span>Cacao Monitor</span>

          <button
            className="sidebar-close-btn"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="sidebar-nav">

          {/* OVERVIEW */}
          <div className="nav-section">
            <div className="sidebar-section-label">
              OVERVIEW
            </div>

            <Link
              href="/admin/dashboard"
              onClick={closeSidebar}
              className={`sidebar-link dashboard-link ${
                isActive("/admin/dashboard") ? "active" : ""
              }`}
            >
              Dashboard
            </Link>
          </div>

          {/* NAVIGATION GROUPS */}
          {NAV_GROUPS.map((group) => {
            const isExpanded = expandedGroups.includes(group.key);

            const hasActiveItem = group.items.some((item) =>
              isActive(item.href)
            );

            return (
              <div className="nav-section" key={group.key}>

                <button
                  type="button"
                  className={`sidebar-group-btn ${
                    hasActiveItem ? "group-active" : ""
                  }`}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isExpanded}
                >
                  <span className="group-title">
                    {group.label}
                  </span>

                  <span
                    className={`group-chevron ${
                      isExpanded ? "expanded" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isExpanded && (
                  <div className="sidebar-submenu">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeSidebar}
                        aria-current={
                          isActive(item.href) ? "page" : undefined
                        }
                        className={`sidebar-link submenu-link ${
                          isActive(item.href) ? "active" : ""
                        }`}
                      >
                        {item.text}
                      </Link>
                    ))}
                  </div>
                )}

              </div>
            );
          })}

        </nav>

        {/* LOGOUT */}
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="sidebar-link logout-link"
            style={{
              width: "100%",
              border: "none",
              background: "none",
              textAlign: "left",
            }}
          >
            Logout
          </button>
        </div>

      </aside>

      {/* STYLES */}
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

        /* NAVIGATION AREA */

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          padding: 8px 14px 20px;
        }

        .nav-section {
          margin-bottom: 7px;
        }

        /* SECTION LABEL */

        .sidebar-section-label {
          padding: 15px 12px 9px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.1px;
          color: #9893a8;
        }

        /* GROUP BUTTON */

        .sidebar-group-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-height: 43px;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #353348;
          font: inherit;
          font-size: 13.5px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sidebar-group-btn:hover {
          background: #f6f3ff;
          color: #6748ed;
        }

        .sidebar-group-btn.group-active {
          color: #6748ed;
        }

        .group-title {
          flex: 1;
        }

        /* CHEVRON */

        .group-chevron {
          width: 8px;
          height: 8px;
          margin-right: 3px;
          border-right: 1.5px solid currentColor;
          border-bottom: 1.5px solid currentColor;
          transform: rotate(45deg);
          transition: transform 0.2s ease;
          flex-shrink: 0;
          position: relative;
          top: -2px;
        }

        .group-chevron.expanded {
          transform: rotate(225deg);
          top: 2px;
        }

        /* SUBMENU */

        .sidebar-submenu {
          margin: 3px 0 7px 12px;
          padding-left: 11px;
          border-left: 1px solid #e8e3f5;
          animation: submenuIn 0.2s ease;
        }

        .submenu-link {
          display: flex;
          align-items: center;
          min-height: 37px;
          margin: 2px 0;
          padding: 8px 12px;
          border-radius: 7px;
          color: #777387;
          font-size: 12.5px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .submenu-link:hover {
          background: #f6f3ff;
          color: #6748ed;
        }

        .submenu-link.active {
          background: #f0ecff;
          color: #6748ed;
          font-weight: 600;
          border-radius: 7px;
        }

        /* DASHBOARD */

        .dashboard-link {
          display: flex;
          align-items: center;
          min-height: 42px;
          margin-bottom: 7px;
          padding: 10px 12px;
          border-radius: 8px;
          color: #353348;
          font-size: 13.5px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .dashboard-link:hover {
          background: #f6f3ff;
          color: #6748ed;
        }

        .dashboard-link.active {
          background: linear-gradient(
            120deg,
            #6254f5,
            #8055ff
          );
          color: #fff;
          box-shadow: 0 4px 12px rgba(103, 72, 237, 0.15);
        }

        /* LOGOUT */

        .sidebar-footer {
          flex-shrink: 0;
          padding: 12px 18px;
          border-top: 1px solid #eeeaf4;
          background: #fff;
        }

        .logout-link {
          display: flex;
          align-items: center;
          min-height: 40px;
          padding: 10px 12px;
          border-radius: 8px;
          color: #dc5555;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .logout-link:hover {
          background: #fff3f3 !important;
        }

        /* ANIMATION */

        @keyframes submenuIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* MOBILE */

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
