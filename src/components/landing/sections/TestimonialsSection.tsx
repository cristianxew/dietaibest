"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface TestimonialsSectionProps {
    className?: string;
}

const testimonials = [
    {
        quote:
            "I finally understand what I'm actually eating. The nutrition insights are eye-opening—I had no idea how much iron and fiber I was missing.",
        author: "Sarah M.",
        role: "Health Enthusiast",
        avatar: "SM",
        avatarBg: "bg-brand-100",
        avatarText: "text-brand-700",
        result: "Eating 40% more vegetables",
    },
    {
        quote:
            "I used to spend Sunday afternoons meal planning. Now it takes 10 minutes. The shopping list feature alone is worth it.",
        author: "James K.",
        role: "Marketing Director",
        avatar: "JK",
        avatarBg: "bg-blue-100",
        avatarText: "text-blue-700",
        result: "Saves 4+ hours every week",
    },
    {
        quote:
            "I've tried every diet app out there. DietAI is the first one that actually taught me about nutrition instead of just counting calories.",
        author: "Maria L.",
        role: "Yoga Instructor",
        avatar: "ML",
        avatarBg: "bg-sage-100",
        avatarText: "text-sage-700",
        result: "Lost 15 lbs in 3 months",
    },
    {
        quote:
            "As someone who lifts 5x a week, hitting my protein targets was always a struggle. DietAI makes it effortless—my recovery has never been better.",
        author: "Alex R.",
        role: "Software Engineer & Fitness Enthusiast",
        avatar: "AR",
        avatarBg: "bg-gold-100",
        avatarText: "text-gold-700",
        result: "Consistently hitting 150g protein daily",
    },
];

const stats = [
    { value: "2,500+", label: "Active Users" },
    { value: "4.9/5", label: "Average Rating" },
    { value: "85%", label: "Stick With It 3+ Months" },
    { value: "5hrs", label: "Saved Per Week" },
];

export function TestimonialsSection({ className }: TestimonialsSectionProps) {
    return (
        <section
            id="testimonials"
            className={cn(
                "py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border",
                className
            )}
        >
            <div className="max-w-7xl mx-auto">
                {/* Section header */}
                <div className="max-w-3xl mx-auto text-center mb-16">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
                        Success Stories
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-6">
                        Real People,{" "}
                        <span className="text-gradient bg-gradient-to-r from-brand-500 to-sage-500">
                            Real Results
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Join thousands of people who&apos;ve transformed their relationship
                        with food.
                    </p>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 p-8 bg-card rounded-2xl border border-border">
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center">
                            <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                                {stat.value}
                            </div>
                            <div className="text-sm text-muted-foreground">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Testimonials grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="relative p-8 bg-card rounded-2xl border border-border"
                        >
                            {/* Quote icon */}
                            <Icon
                                icon="solar:quote-up-square-bold-duotone"
                                className="text-muted-foreground/20 absolute top-6 right-6"
                                width={40}
                            />

                            {/* Stars */}
                            <div className="flex gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Icon
                                        key={star}
                                        icon="solar:star-bold"
                                        className="text-gold-500"
                                        width={18}
                                    />
                                ))}
                            </div>

                            {/* Quote */}
                            <blockquote className="text-foreground leading-relaxed mb-6">
                                &ldquo;{testimonial.quote}&rdquo;
                            </blockquote>

                            {/* Result badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-100 dark:bg-sage-950 text-sage-700 dark:text-sage-300 text-sm font-medium rounded-full mb-6">
                                <Icon icon="solar:graph-up-bold" width={14} />
                                {testimonial.result}
                            </div>

                            {/* Author */}
                            <div className="flex items-center gap-4">
                                <div
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center font-semibold",
                                        testimonial.avatarBg,
                                        testimonial.avatarText
                                    )}
                                >
                                    {testimonial.avatar}
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {testimonial.author}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {testimonial.role}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
