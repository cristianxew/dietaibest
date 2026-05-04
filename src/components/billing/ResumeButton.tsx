"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resumeSubscription } from "@/actions/subscription";

interface ResumeButtonProps {
  onSuccess?: () => void;
}

export function ResumeButton({ onSuccess }: ResumeButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleResume = () => {
    startTransition(async () => {
      const result = await resumeSubscription();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription will continue as normal.");
      onSuccess?.();
    });
  };

  return (
    <Button size="sm" disabled={isPending} onClick={handleResume}>
      {isPending ? "Resuming…" : "Resume plan"}
    </Button>
  );
}
