interface SectionHeadProps {
  eyebrow: string;
  /** Section title; wrap the accent words in `<em>`. */
  title: React.ReactNode;
  /** Optional supporting copy shown to the right (below on narrow screens). */
  rhs?: React.ReactNode;
}

export function SectionHead({ eyebrow, title, rhs }: SectionHeadProps) {
  return (
    <div className="mb-16 flex items-end gap-16 max-[761px]:mb-12 max-[761px]:flex-col max-[761px]:items-start max-[761px]:gap-6">
      <div className="flex-1">
        <p className="mb-[18px] font-lp-mono text-[11px] uppercase tracking-[0.16em] text-lp-primary">
          {eyebrow}
        </p>
        <h2 className="max-w-[18ch] font-lp-display text-[clamp(36px,5vw,56px)] font-medium leading-[1.05] tracking-[-0.02em] text-lp-fg [&_em]:italic [&_em]:text-lp-primary">
          {title}
        </h2>
      </div>
      {rhs ? (
        <p className="max-w-[38ch] text-[16px] leading-[1.6] text-lp-fg-soft">{rhs}</p>
      ) : null}
    </div>
  );
}
