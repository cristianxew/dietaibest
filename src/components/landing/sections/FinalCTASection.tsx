"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinalCTASectionProps {
    className?: string;
}

export function FinalCTASection({ className }: FinalCTASectionProps) {
    return (
        <section
            className={cn(
                "py-20 md:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden",
                className
            )}
        >
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-gold-500/10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-3xl" />
            </div>

            <div className="max-w-4xl mx-auto text-center">
                {/* Headline */}
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-6">
                    Your Journey to{" "}
                    <span className="text-gradient bg-gradient-to-r from-brand-500 via-brand-400 to-gold-500">
                        Healthier Eating
                    </span>{" "}
                    Starts Now
                </h2>

                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
                    Join thousands of people who&apos;ve discovered the joy of eating well
                    without the stress. Your first meal plan is free—no credit card
                    required.
                </p>

                {/* Benefits reminder */}
                <div className="flex flex-wrap justify-center gap-6 mb-10">
                    {[
                        "Personalized meal plans",
                        "Professional nutrition analysis",
                        "Save hours every week",
                    ].map((benefit) => (
                        <div key={benefit} className="flex items-center gap-2 text-foreground">
                            <Icon icon="solar:check-circle-bold" className="text-sage-500" width={20} />
                            <span>{benefit}</span>
                        </div>
                    ))}
                </div>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
                    <Link
                        href="/sign-up"
                        className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-semibold shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <Icon icon="solar:chef-hat-bold-duotone" width={22} />
                        Start Your Free Plan
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>

                {/* Trust elements */}
                <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:shield-check-bold" className="text-sage-500" width={18} />
                        <span>30-day money-back guarantee</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:lock-bold" className="text-sage-500" width={18} />
                        <span>Secure & private</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:card-bold" className="text-sage-500" width={18} />
                        <span>No credit card required</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
