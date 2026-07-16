"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { openDietaiChat } from "@/lib/chat/open-chat";

interface AskDietaiButtonProps {
  prompt: string;
  className?: string;
}

export function AskDietaiButton({ prompt, className }: AskDietaiButtonProps) {
  const t = useTranslations("nutritionHub.common");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => openDietaiChat(prompt)}
    >
      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-brand-500" />
      {t("askDietai")}
    </Button>
  );
}
