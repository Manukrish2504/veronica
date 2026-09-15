"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setStatus } from "@/lib/actions";
import { STATUS_LABEL, type Status } from "@/lib/types";

const OPTIONS = Object.keys(STATUS_LABEL) as Status[];

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition();
  return (
    <Select value={status} onValueChange={(v) => start(async () => { await setStatus(id, v as Status); toast(`Status: ${STATUS_LABEL[v as Status]}`); })}>
      <SelectTrigger size="sm" className="h-9 w-[170px] rounded-full border-outline-variant bg-transparent px-4 text-[0.8125rem] font-medium shadow-none hover:bg-surface-1" disabled={pending} aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-outline-variant">
        {OPTIONS.map((s) => <SelectItem key={s} value={s} className="rounded-xl">{STATUS_LABEL[s]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
