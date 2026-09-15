"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/mt/button";

export function SaveButton() {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!pending) return;
    return () => { toast("Saved"); };
  }, [pending]);
  return <Button size="sm" type="submit" icon="save" className="shadow-sm" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>;
}
