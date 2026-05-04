"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createPortalSession } from "@/actions/subscription";

export function ManageBillingButton() {
  const [isPending, startTransition] = useTransition();

  const handleManage = () => {
    startTransition(async () => {
      const result = await createPortalSession("/settings");
      if (result.error || !result.data) {
        toast.error(result.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = result.data.url;
    });
  };

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleManage}>
      {isPending ? "Opening portal…" : "Manage billing"}
    </Button>
  );
}
