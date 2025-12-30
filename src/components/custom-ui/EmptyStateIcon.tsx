import React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

const emptyStateIconVariants = cva(
    "inline-flex items-center justify-center rounded-2xl",
    {
        variants: {
            variant: {
                brand: "bg-brand-100/50 dark:bg-brand-500/10",
                sage: "bg-sage-100/50 dark:bg-sage-500/10",
                gold: "bg-gold-100/50 dark:bg-gold-500/10",
                gray: "bg-muted/50 dark:bg-muted/20",
            },
            size: {
                sm: "w-12 h-12 rounded-xl",
                md: "w-16 h-16 rounded-2xl",
                lg: "w-20 h-20 rounded-3xl",
            },
        },
        defaultVariants: {
            variant: "brand",
            size: "md",
        },
    }
);

const iconVariants = cva("", {
    variants: {
        variant: {
            brand: "text-brand-500/70 dark:text-brand-400/70",
            sage: "text-sage-500/70 dark:text-sage-400/70",
            gold: "text-gold-500/70 dark:text-gold-400/70",
            gray: "text-muted-foreground/70",
        },
        size: {
            sm: "w-6 h-6",
            md: "w-8 h-8",
            lg: "w-10 h-10",
        },
    },
    defaultVariants: {
        variant: "brand",
        size: "md",
    },
});

interface EmptyStateIconProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateIconVariants> {
    icon: LucideIcon;
}

export function EmptyStateIcon({
    className,
    variant,
    size,
    icon: Icon,
    ...props
}: EmptyStateIconProps) {
    return (
        <div
            className={cn(emptyStateIconVariants({ variant, size, className }))}
            {...props}
        >
            <Icon className={cn(iconVariants({ variant, size }))} />
        </div>
    );
}
