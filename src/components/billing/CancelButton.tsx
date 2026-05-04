"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelSubscription } from "@/actions/subscription";

interface CancelButtonProps {
  onSuccess?: () => void;
}

export function CancelButton({ onSuccess }: CancelButtonProps) {
  const t = useTranslations("billing");
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelSubscription();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Subscription set to cancel at period end.");
      onSuccess?.();
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleCancel}
    >
      {isPending ? t("status.canceled") + "…" : "Cancel plan"}
    </Button>
  );
}
