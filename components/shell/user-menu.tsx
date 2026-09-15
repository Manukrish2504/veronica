"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/mt/avatar";
import { Icon } from "@/components/mt/icon";
import { signOut } from "@/lib/auth-actions";

export function UserMenu({ profile }: { profile: { name: string; email: string; initials: string } }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="state-layer flex items-center gap-2.5 pl-1 pr-3 h-10 rounded-full hover:bg-surface-2 transition" aria-label="Account menu">
          <Avatar initials={profile.initials} size={32} />
          <span className="hidden md:block max-w-[180px] truncate text-[0.8125rem] font-medium">{profile.name}</span>
          <Icon name="expand_more" size={18} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[300px] rounded-2xl border-outline-variant p-2 shadow-lg">
        <div className="flex items-center gap-3 p-3">
          <Avatar initials={profile.initials} size={44} />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{profile.name}</div>
            <div className="text-[0.75rem] text-muted-foreground truncate">{profile.email}</div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")} className="h-10 rounded-xl px-3 text-sm gap-3"><Icon name="settings" size={18} /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")} className="h-10 rounded-xl px-3 text-sm gap-3"><Icon name={dark ? "light_mode" : "dark_mode"} size={18} /> {dark ? "Violet Lite" : "Midnight"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { void signOut(); }} className="h-10 rounded-xl px-3 text-sm gap-3"><Icon name="logout" size={18} /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
