"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface ProblemSectionProps {
    className?: string;
}

const painPoints = [
    {
        icon: "solar:confounded-square-bold-duotone",
        title: "Conflicting Advice Everywhere",
        description:
            "One article says eat more carbs, another says avoid them completely. You're left confused about what's actually healthy for your body.",
    },
    {
        icon: "solar:clock-circle-bold-duotone",
        title: "Meal Planning Takes Forever",
        description:
            "Between work and life, who has time to plan meals, check nutrition labels, and build shopping lists from scratch every week?",
    },
    {
        icon: "solar:calculator-bold-duotone",
        title: "Tracking Feels Like a Chore",
        description:
            "Calorie counting apps make you log every single bite. It's exhausting, unsustainable, and takes the joy out of eating.",
    },
];

export function ProblemSection({ className }: ProblemSectionProps) {
    return (
        <section
            className={cn(
                "py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border",
                className
            )}
        >
            <div className="max-w-7xl mx-auto">
                {/* Section intro */}
                <div className="max-w-3xl mx-auto text-center mb-16">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
                        Sound Familiar?
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-6">
                        Eating Healthy Shouldn&apos;t Be{" "}
                        <span className="text-gold-500">This Hard</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        You want to eat nutritious, balanced meals. But between the noise,
                        the time constraints, and the mental load—it feels impossible to get
                        it right.
                    </p>
                </div>

                {/* Pain points grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {painPoints.map((point, index) => (
                        <div
                            key={index}
                            className="group relative p-8 bg-card rounded-2xl border border-border hover:border-gold-200 dark:hover:border-gold-500/30 hover:shadow-lg hover:shadow-gold-500/5 transition-all duration-300"
                        >
                            <div className="w-14 h-14 rounded-xl bg-gold-50 dark:bg-gold-500/10 border border-gold-100 dark:border-gold-500/20 flex items-center justify-center mb-6">
                                <Icon
                                    icon={point.icon}
                                    width={28}
                                    className="text-gold-500"
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-3">
                                {point.title}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {point.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Emotional hook */}
                <div className="mt-16 max-w-2xl mx-auto text-center">
                    <p className="text-lg md:text-xl text-muted-foreground italic">
                        &ldquo;I just want to know I&apos;m making good choices without
                        spending hours researching and planning every meal.&rdquo;
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground">
                        — What we hear from our users every single day
                    </p>
                </div>
            </div>
        </section>
    );
}
