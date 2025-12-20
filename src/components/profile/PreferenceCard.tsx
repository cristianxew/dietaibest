import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PreferenceCardProps {
    label: string;
    isSelected: boolean;
    onClick: () => void;
    className?: string;
    icon?: React.ReactNode;
}

export function PreferenceCard({
    label,
    isSelected,
    onClick,
    className,
    icon,
}: PreferenceCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "cursor-pointer rounded-lg border p-2 transition-all duration-200 hover:shadow-md",
                "flex flex-col items-center justify-center gap-1.5 text-center h-full min-h-[72px]",
                isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
                className
            )}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="relative">
                <div
                    className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                >
                    {isSelected ? (
                        <Check className="h-3.5 w-3.5" />
                    ) : (
                        icon || <span className="text-xs font-semibold">{label.charAt(0)}</span>
                    )}
                </div>
            </div>
            <span
                className={cn(
                    "text-xs font-medium transition-colors line-clamp-2 leading-tight",
                    isSelected ? "text-primary" : "text-foreground"
                )}
            >
                {label}
            </span>
        </div>
    );
}
