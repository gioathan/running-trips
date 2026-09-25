"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_SECTIONS = [
  {
    heading: "Content",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/trips", label: "Trips" },
      { href: "/admin/race-categories", label: "Race Categories" },
      { href: "/admin/content", label: "Content Pages" },
      { href: "/admin/site-settings", label: "Site Settings" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/newsletter", label: "Newsletter" },
      { href: "/admin/contact-messages", label: "Contact Messages" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-ink/10 bg-white p-6 md:block">
      <Link href="/admin" className="text-headline-sm">
        Α
      </Link>
      <nav className="mt-8 space-y-8">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="text-label-sm uppercase text-ink-muted">{section.heading}</p>
            <ul className="mt-2 space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-md px-3 py-2 text-body-md",
                        isActive ? "bg-ink text-white" : "text-ink hover:bg-surface-low"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
