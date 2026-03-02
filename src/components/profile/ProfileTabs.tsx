// src/components/ProfileTabs.tsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function ProfileTabs() {
  const pathname = usePathname();
  const tabs = [
    { name: "Account", href: "/profile/account" },
    { name: "Subscription", href: "/profile/subscription" },
  ];
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-4" aria-label="Profile Sections">
        {tabs.map((tab) => {
          const isActive = pathname?.endsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-2 ${
                isActive
                  ? "font-medium border-b-2 border-primary text-primary"
                  : "text-gray-600"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

