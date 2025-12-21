"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { ChevronLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  type: "bot" | "user";
  content: React.ReactNode;
  action?: {
    icon: string;
    label: string;
    sublabel: string;
  };
}

const demoMessages: ChatMessage[] = [
  {
    id: "1",
    type: "bot",
    content: (
      <>
        I noticed your protein intake was low yesterday. I&apos;ve adjusted today&apos;s
        dinner to include{" "}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          Grilled Salmon (32g Protein)
        </span>
        . Shall I add it to the shopping list?
      </>
    ),
  },
  {
    id: "2",
    type: "user",
    content: "Yes, please. Also, I'm eating out for lunch tomorrow.",
  },
  {
    id: "3",
    type: "bot",
    content: (
      <>
        Understood. I&apos;ve updated your calorie budget for tomorrow&apos;s lunch to{" "}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          800 kcal
        </span>{" "}
        to compensate.
      </>
    ),
    action: {
      icon: "solar:cart-large-2-bold-duotone",
      label: "Updated List",
      sublabel: "Added: Atlantic Salmon",
    },
  },
];

interface AgentSidebarProps {
  className?: string;
}

export function AgentSidebar({ className }: AgentSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  return (
    <div
      className={cn(
        "fixed flex sidebar-transition h-[60vh] z-50 top-1/2 -translate-y-1/2 right-0 items-center",
        isOpen
          ? "translate-x-0"
          : "translate-x-[calc(100%-2.5rem)] md:translate-x-[calc(100%-3rem)]",
        className
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900",
          "w-10 md:w-12 h-32 md:h-40 rounded-l-xl shadow-xl",
          "flex flex-col gap-4 items-center justify-center",
          "border-y border-l border-white/10 dark:border-neutral-800/20",
          "hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors z-20",
          "outline-none"
        )}
      >
        <Icon
          icon="solar:magic-stick-3-bold-duotone"
          width={20}
          height={20}
          className="text-brand-400"
        />
        <div className="h-px w-6 bg-white/20 dark:bg-neutral-400/30" />
        <ChevronLeft
          className={cn(
            "w-5 h-5 transition-transform duration-500",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Sidebar Content */}
      <div className="w-full max-w-sm md:w-[26rem] h-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-200 dark:border-neutral-700 shadow-2xl p-6 flex flex-col relative z-10 rounded-bl-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-800">
              <Icon icon="solar:user-rounded-bold-duotone" width={20} />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-brand-500 border-2 border-white dark:border-neutral-900 rounded-full" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Nutrition Assistant
            </div>
            <div className="text-[0.65rem] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-medium">
              Online • Agent Active
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
          {demoMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.type === "user" && "flex-row-reverse"
              )}
            >
              {message.type === "bot" && (
                <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-1">
                  <Icon
                    icon="solar:bot-bold"
                    className="text-neutral-500 dark:text-neutral-400"
                    width={14}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div
                  className={cn(
                    "p-3 text-xs leading-relaxed",
                    message.type === "bot"
                      ? "bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl rounded-tl-none text-neutral-600 dark:text-neutral-300"
                      : "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-2xl rounded-tr-none"
                  )}
                >
                  {message.content}
                </div>

                {/* Action Card */}
                {message.action && (
                  <div className="bg-white dark:bg-neutral-800 border border-brand-100 dark:border-brand-800/30 p-2 rounded-xl flex items-center gap-3 shadow-sm">
                    <div className="bg-brand-50 dark:bg-brand-900/30 p-1.5 rounded-lg text-brand-600 dark:text-brand-400">
                      <Icon icon={message.action.icon} width={16} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[0.65rem] uppercase text-neutral-400 font-medium tracking-wide">
                        {message.action.label}
                      </div>
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {message.action.sublabel}
                      </div>
                    </div>
                    <button className="text-[0.65rem] bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors">
                      View
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="relative mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a command or log food..."
            className={cn(
              "w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700",
              "rounded-xl py-3 px-4 pr-10 text-xs",
              "focus:outline-none focus:ring-2 focus:ring-neutral-900/5 dark:focus:ring-neutral-100/10",
              "focus:border-neutral-900 dark:focus:border-neutral-500 transition-all",
              "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
              "text-neutral-900 dark:text-neutral-100"
            )}
          />
          <button className="absolute right-2 bottom-2 top-[1.3rem] p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
