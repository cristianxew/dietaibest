"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { getMyWeekAnalysis, type MyWeekData } from "@/actions/nutrition-week";
import { WeekStrip } from "@/components/nutrition-hub/my-week/WeekStrip";
import { FindingCard } from "@/components/nutrition-hub/my-week/FindingCard";
import { WeekHeatmap } from "@/components/nutrition-hub/my-week/WeekHeatmap";
import { ImproveDataCard } from "@/components/nutrition-hub/my-week/ImproveDataCard";
import { ProfileNudge } from "@/components/nutrition-hub/vs-day/ProfileNudge";

const TOP_FINDINGS = 3;

export function MyWeekBoard({ initial }: { initial: MyWeekData }) {
  const t = useTranslations("nutritionHub.myWeek");
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    const result = await getMyWeekAnalysis();
    if (result.error === null) setData(result.data);
  }, []);

  const { analysis } = data;
  const topFindings = analysis.findings.slice(0, TOP_FINDINGS);

  return (
    <div className="space-y-8">
      {!data.profileComplete && <ProfileNudge />}

      <div className="animate-fade-up">
        <WeekStrip days={analysis.days} />
      </div>

      {data.improveData.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <ImproveDataCard
            items={data.improveData}
            prominent={!analysis.microFindingsReliable}
            onMatched={refresh}
          />
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-display font-bold text-xl animate-fade-up">
          {t("findings.heading")}
        </h2>
        {topFindings.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-sage-200 dark:border-sage-500/20 bg-sage-50/50 dark:bg-sage-500/10 p-6 animate-fade-up">
            {t("findings.none")}
          </p>
        ) : (
          topFindings.map((finding, i) => (
            <div
              key={finding.id}
              className="animate-fade-up"
              style={{ animationDelay: `${100 + i * 75}ms` }}
            >
              <FindingCard
                finding={finding}
                allFindings={analysis.findings}
                onChanged={refresh}
              />
            </div>
          ))
        )}
      </section>

      <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
        <WeekHeatmap analysis={analysis} />
      </div>

      <p className="text-xs text-muted-foreground">
        {analysis.personalized
          ? `✦ ${t("basis.personalized")}`
          : `▢ ${t("basis.generic")}`}
      </p>
    </div>
  );
}
