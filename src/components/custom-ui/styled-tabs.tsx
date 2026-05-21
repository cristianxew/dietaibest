import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const StyledTabs = Tabs

const StyledTabsList = React.forwardRef<
    React.ElementRef<typeof TabsList>,
    React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
    <TabsList
        ref={ref}
        className={cn(
            "bg-muted border border-border p-1 h-auto",
            className
        )}
        {...props}
    />
))
StyledTabsList.displayName = "StyledTabsList"

const StyledTabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsTrigger>,
    React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
    <TabsTrigger
        ref={ref}
        className={cn(
            "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2.5 rounded-lg transition-all",
            className
        )}
        {...props}
    />
))
StyledTabsTrigger.displayName = "StyledTabsTrigger"

const StyledTabsContent = TabsContent

export { StyledTabs, StyledTabsList, StyledTabsTrigger, StyledTabsContent }
