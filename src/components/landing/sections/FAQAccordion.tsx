"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

/** Single-open accordion; the first item starts open. */
export function FAQAccordion({ items }: FAQAccordionProps) {
  // -1 means all collapsed.
  const [openIndex, setOpenIndex] = useState(0);
  const baseId = useId();

  return (
    <div className="border-t border-lp-line">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        const questionId = `${baseId}-q-${i}`;
        const answerId = `${baseId}-a-${i}`;

        return (
          <div key={item.question} className="border-b border-lp-line py-7">
            <h3 className="font-lp-display text-[22px] font-medium leading-[1.3] tracking-[-0.01em] text-lp-fg">
              <button
                type="button"
                id={questionId}
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-6 text-left"
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className="relative size-[22px] shrink-0">
                  <span className="absolute top-1/2 left-1/2 h-[1.5px] w-3.5 -translate-1/2 bg-lp-fg" />
                  <span
                    className={cn(
                      "absolute top-1/2 left-1/2 h-3.5 w-[1.5px] -translate-1/2 bg-lp-fg transition-transform duration-[250ms]",
                      isOpen && "rotate-90"
                    )}
                  />
                </span>
              </button>
            </h3>
            {/* Animates grid rows 0fr → 1fr instead of a max-height cap, so long
                (translated) answers are never clipped. */}
            <div
              id={answerId}
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!isOpen}
              className={cn(
                "grid max-w-[60ch] text-[15px] leading-[1.65] text-lp-fg-soft [transition:grid-template-rows_.35s_ease,margin-top_.25s,opacity_.25s] motion-reduce:transition-none",
                isOpen ? "mt-3.5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
