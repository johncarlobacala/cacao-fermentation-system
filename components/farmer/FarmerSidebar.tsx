
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
    key: "farm",
    label: "Farm",
    items: [
      { href: "/farmer/my-farm", text: "My Farm" },
      {
        href: "/farmer/temperature",
        text: "Temperature Monitoring",
      },
      {
        href: "/farmer/turning",
        text: "Turning Schedule",
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    items: [
      { href: "/farmer/reports", text: "My Reports" },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { href: "/farmer/notifications", text: "Notifications" },
      { href: "/farmer/profile", text: "Profile" },
      { href: "/farmer/settings", text: "Settings" },
      { href: "/farmer/help", text: "Help & Support" },
    ],
  },
];

export function FarmerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  // Automatically expand the group containing the current page.
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    NAV_GROUPS.filter((group) =>
      group.items.some((item) => item.href === pathname)
    ).map((group) => group.key)
  );

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

  // LOGOUT
  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  // CLOSE MOBILE SIDEBAR
  function closeSidebar() {
    setIsOpen(false);
  }

  // TOGGLE NAVIGATION GROUP
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

        <span className="mobile-topbar-title">
          Cacao Monitor
        </span>

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
              href="/farmer/dashboard"
              onClick={closeSidebar}
              className={`sidebar-link dashboard-link ${
                isActive("/farmer/dashboard") ? "active" : ""
              }`}
            >
              Dashboard
            </Link>
          </div>

          {/* COLLAPSIBLE NAVIGATION */}
          {NAV_GROUPS.map((group) => {
            const isExpanded = expandedGroups.includes(group.key);

            const hasActiveItem = group.items.some((item) =>
              isActive(item.href)
            );

            return (
              <div className="nav-section" key={group.key}>

                {/* GROUP BUTTON */}
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

                {/* SUBMENU */}
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

      {/* SIDEBAR STYLES */}
      <style jsx>{`

        /* DEFAULT */

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

        /* NAVIGATION */

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          padding: 5px 14px 12px;
        }

        .nav-section {
          margin-bottom: 2px;
        }

        /* SECTION LABEL */

        .sidebar-section-label {
          padding: 10px 12px 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #9893a8;
        }

        /* GROUP BUTTON */

        .sidebar-group-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          min-height: 40px;
          padding: 9px 12px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: #353348;
          font-family: inherit;
          font-size: 14px;
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
          width: 7px;
          height: 7px;
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
          margin: 2px 0 4px 10px;
          padding-left: 9px;
          border-left: 1px solid #e8e3f5;
          animation: submenuIn 0.2s ease;
        }

        .submenu-link {
          display: flex;
          align-items: center;
          min-height: 34px;
          margin: 1px 0;
          padding: 7px 10px;
          border-radius: 6px;
          color: #777387;
          font-size: 13px;
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
        }

        /* DASHBOARD */

        .dashboard-link {
          display: flex;
          align-items: center;
          min-height: 40px;
          margin-bottom: 4px;
          padding: 9px 12px;
          border-radius: 7px;
          color: #353348;
          font-size: 14px;
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
          box-shadow: 0 3px 10px rgba(103, 72, 237, 0.12);
        }

        /* LOGOUT */

        .sidebar-footer {
          flex-shrink: 0;
          padding: 9px 18px;
          border-top: 1px solid #eeeaf4;
          background: #fff;
        }

        .logout-link {
          display: flex;
          align-items: center;
          min-height: 38px;
          padding: 9px 12px;
          border-radius: 7px;
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
