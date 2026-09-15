"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/mt/button";
import { Textarea } from "@/components/ui/textarea";
import { addJob } from "@/lib/actions";

export function AddJobDialog({ children, open, onOpenChange }: { children?: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = onOpenChange ?? setInner;
  const [pending, start] = useTransition();

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg rounded-2xl border-outline-variant">
        <form action={(fd) => start(async () => { await addJob(fd); setOpen(false); toast("Added. The agent evaluates it next run."); })} className="contents">
          <DialogHeader>
            <DialogTitle className="font-display font-medium">Add a job</DialogTitle>
            <DialogDescription>Paste a posting URL or the full text. The agent evaluates it against your profile.</DialogDescription>
          </DialogHeader>
          <Textarea name="text" required rows={8} placeholder="https://… or paste the posting" className="rounded-xl font-mono text-[0.8125rem]" autoFocus />
          <DialogFooter>
            <Button type="button" variant="text" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" icon="add" disabled={pending}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
