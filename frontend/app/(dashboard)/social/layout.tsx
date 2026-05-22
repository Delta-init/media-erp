"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenSquare, MessageCircle } from "lucide-react";

const TABS = [
  { href: "/social",    label: "Create Post",  icon: PenSquare },
  { href: "/social/dm", label: "Messages",     icon: MessageCircle },
];

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="mb-5 flex items-center gap-1 rounded-2xl bg-muted/50 p-1 border w-fit">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-card text-foreground shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
