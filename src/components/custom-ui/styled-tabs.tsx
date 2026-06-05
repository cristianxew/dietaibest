"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

// Built directly on Radix primitives to avoid fighting shadcn's hardcoded
// dark:data-[state=active]:* overrides which can't be reliably overridden via cn().

const StyledTabs = TabsPrimitive.Root

const StyledTabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-1 h-auto",
            className
        )}
        {...props}
    />
))
StyledTabsList.displayName = "StyledTabsList"

const StyledTabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "inline-flex items-center justify-center px-4 py-2.5 rounded-lg",
            "text-sm font-medium border border-transparent transition-all",
            "text-muted-foreground",
            "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
            "disabled:pointer-events-none disabled:opacity-50",
            className
        )}
        {...props}
    />
))
StyledTabsTrigger.displayName = "StyledTabsTrigger"

const StyledTabsContent = TabsPrimitive.Content

export { StyledTabs, StyledTabsList, StyledTabsTrigger, StyledTabsContent }
