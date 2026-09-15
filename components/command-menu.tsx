"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { AddJobDialog } from "@/components/add-job-dialog";
import { Icon } from "@/components/mt/icon";
import { runSearchNow, togglePause } from "@/lib/actions";

export function CommandMenu({ jobs, paused }: { jobs: { id: string; title: string; company: string }[]; paused: boolean }) {
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); } };
    const openIt = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("veronica:search", openIt);
    return () => { document.removeEventListener("keydown", down); window.removeEventListener("veronica:search", openIt); };
  }, []);

  const run = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen} title="Veronica" description="Jump anywhere or run an action" className="rounded-2xl! border-outline-variant">
        <Command>
          <CommandInput placeholder="Jump to a job or run an action…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run(() => setAdd(true))}><Icon name="add" size={18} />Add job<CommandShortcut>URL or text</CommandShortcut></CommandItem>
              <CommandItem onSelect={() => run(() => start(() => runSearchNow()))}><Icon name="travel_explore" size={18} />Run search now</CommandItem>
              <CommandItem onSelect={() => run(() => start(() => togglePause()))}><Icon name={paused ? "play_arrow" : "pause"} size={18} />{paused ? "Resume agent" : "Pause agent"}</CommandItem>
              <CommandItem onSelect={() => run(() => window.dispatchEvent(new Event("veronica:agent")))}><Icon name="smart_toy" size={18} />Open agent activity</CommandItem>
              <CommandItem onSelect={() => run(() => router.push("/settings"))}><Icon name="settings" size={18} />Open settings</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Jobs">
              {jobs.map((j) => (
                <CommandItem key={j.id} value={`${j.title} ${j.company}`} onSelect={() => run(() => router.push(`/jobs/${j.id}`))}>
                  <Icon name="work" size={18} />{j.title}<span className="text-muted-foreground">{j.company}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      <AddJobDialog open={add} onOpenChange={setAdd} />
    </>
  );
}
