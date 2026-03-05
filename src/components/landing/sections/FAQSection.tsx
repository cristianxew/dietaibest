"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface FAQSectionProps {
    className?: string;
}

const faqs = [
    {
        question: "How is DietAI different from other meal planning apps?",
        answer:
            "Most apps just count calories and require endless manual logging. DietAI takes a plan-first approach: we create personalized meal plans based on your actual goals and preferences, provide professional-grade 28-nutrient analysis on every recipe, and give you actionable feedback on your nutrition—not just numbers. Think of it as having a nutritionist in your pocket.",
    },
    {
        question: "Do I need to count calories or track everything I eat?",
        answer:
            "No! That's exactly what we're trying to eliminate. DietAI creates balanced meal plans for you, so you know you're hitting your nutrition targets without obsessive tracking. If you follow your plan, the math is already done. You can optionally track meals, but it's not required.",
    },
    {
        question: "Can DietAI accommodate my dietary restrictions?",
        answer:
            "Absolutely. During onboarding, you'll tell us about any allergies, intolerances, or dietary preferences (vegan, vegetarian, keto, paleo, gluten-free, etc.). Your meal plans automatically exclude any problematic ingredients and suggest suitable alternatives.",
    },
    {
        question: "How does the AI recipe import work?",
        answer:
            "Found a recipe you love online? Just paste the URL and DietAI extracts everything automatically: ingredients, instructions, prep time, and full nutritional information. You can also upload photos of recipes or scan cookbook pages as PDFs. Our AI handles the heavy lifting so you can focus on cooking.",
    },
    {
        question: "What about family meal planning?",
        answer:
            "Family meal planning is coming soon! We're building a Family plan that will let you create individual dietary profiles for up to 5 family members, with unified meal plans and consolidated shopping lists. Stay tuned—it's one of our most requested features.",
    },
    {
        question: "What if I don't like a meal in my plan?",
        answer:
            "Easy—just swap it! Tap any meal and you'll see alternatives that still fit your nutrition goals. Over time, DietAI learns what you like and suggests fewer things you'll want to swap. You're always in control.",
    },
    {
        question: "Is my nutrition data secure?",
        answer:
            "Yes. We take privacy seriously. Your data is encrypted, stored securely, and never sold to third parties. We use your information solely to provide personalized meal planning—nothing else. You can export or delete your data anytime.",
    },
    {
        question: "Can I cancel anytime?",
        answer:
            "Yes, absolutely. There are no contracts or commitments. You can cancel your subscription at any time from your account settings, and you'll continue to have access until the end of your billing period. We also offer a 30-day money-back guarantee if you're not satisfied.",
    },
];

export function FAQSection({ className }: FAQSectionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            id="faq"
            className={cn(
                "py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border",
                className
            )}
        >
            <div className="max-w-4xl mx-auto">
                {/* Section header */}
                <div className="text-center mb-16">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
                        FAQ
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-6">
                        Questions? We&apos;ve Got{" "}
                        <span className="text-gradient bg-gradient-to-r from-brand-500 to-gold-500">
                            Answers
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Everything you need to know about DietAI.
                    </p>
                </div>

                {/* FAQ accordion */}
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className={cn(
                                "bg-card rounded-xl border transition-all duration-200",
                                openIndex === index
                                    ? "border-brand-200 dark:border-brand-800 shadow-lg shadow-brand-500/5"
                                    : "border-border"
                            )}
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between gap-4 p-6 text-left"
                            >
                                <span className="font-semibold text-foreground">
                                    {faq.question}
                                </span>
                                <Icon
                                    icon={
                                        openIndex === index
                                            ? "solar:minus-circle-linear"
                                            : "solar:add-circle-linear"
                                    }
                                    width={24}
                                    className={cn(
                                        "flex-shrink-0 transition-colors",
                                        openIndex === index ? "text-primary" : "text-muted-foreground"
                                    )}
                                />
                            </button>
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-200",
                                    openIndex === index ? "max-h-96" : "max-h-0"
                                )}
                            >
                                <p className="px-6 pb-6 text-muted-foreground leading-relaxed">
                                    {faq.answer}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Contact prompt */}
                <div className="mt-12 text-center">
                    <p className="text-muted-foreground">
                        Still have questions?{" "}
                        <a
                            href="mailto:support@dietai.best"
                            className="text-primary font-medium hover:underline"
                        >
                            Contact our support team
                        </a>
                    </p>
                </div>
            </div>
        </section>
    );
}
