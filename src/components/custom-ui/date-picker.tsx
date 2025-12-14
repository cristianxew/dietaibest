"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

export type DatePickerProps = Omit<React.ComponentProps<typeof DayPicker>, "mode" | "selected" | "onSelect"> & {
    date?: Date
    onDateChange: (date?: Date) => void
    placeholder?: string
    id?: string
}

interface DatePickerDropdownProps {
    value: string | number
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
    options?: { value: string | number; label: string; disabled?: boolean }[]
    children?: React.ReactNode
    className?: string
}

function DatePickerDropdown({ value, onChange, options, children, className }: DatePickerDropdownProps) {
    const parsedOptions = React.useMemo(() => {
        if (options?.length) return options

        // Parse children (options) if options prop is not provided
        const opts: { value: string | number; label: string; disabled?: boolean }[] = []
        React.Children.forEach(children, (child) => {
            if (React.isValidElement(child) && (child.type === 'option' || (child.props as any)?.value !== undefined)) {
                opts.push({
                    value: (child.props as any)?.value,
                    label: (child.props as any)?.children,
                    disabled: (child.props as any)?.disabled
                })
            }
        })
        return opts
    }, [options, children])

    const selectedValue = value?.toString()

    return (
        <Select
            value={selectedValue}
            onValueChange={(newValue) => {
                const changeEvent = {
                    target: { value: newValue },
                } as React.ChangeEvent<HTMLSelectElement>
                onChange?.(changeEvent)
            }}
        >
            <SelectTrigger className={cn(
                "h-8 w-fit gap-1 border-none bg-transparent px-2 font-medium focus:ring-0 hover:bg-accent hover:text-accent-foreground text-sm shadow-none",
                className
            )}>
                <SelectValue>{parsedOptions.find(o => o.value.toString() === selectedValue)?.label || value}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="center">
                <ScrollArea className="h-64">
                    {parsedOptions.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value.toString()}
                            disabled={option.disabled}
                            className="text-sm cursor-pointer"
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </ScrollArea>
            </SelectContent>
        </Select>
    )
}

function CustomNav() {
    return <></> // Hide the default nav - we'll render buttons in MonthCaption
}

function CustomMonthCaption({ calendarMonth }: { calendarMonth: { date: Date } }) {
    const { goToMonth, previousMonth, nextMonth, formatters } = useDayPicker()

    const handlePreviousClick = () => {
        if (previousMonth) {
            goToMonth(previousMonth)
        }
    }

    const handleNextClick = () => {
        if (nextMonth) {
            goToMonth(nextMonth)
        }
    }

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: formatters.formatMonthDropdown(new Date(2024, i, 1)),
        disabled: false
    }))

    const yearOptions = Array.from({ length: 201 }, (_, i) => ({
        value: 1900 + i,
        label: String(1900 + i),
        disabled: false
    }))

    return (
        <div className="flex items-center justify-between w-full h-10 px-1">
            <Button
                variant="outline"
                className={cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted border-border/50"
                )}
                disabled={!previousMonth}
                onClick={handlePreviousClick}
                aria-label="Go to previous month"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
                <DatePickerDropdown
                    value={calendarMonth.date.getMonth()}
                    onChange={(e) => {
                        const newDate = new Date(calendarMonth.date)
                        newDate.setMonth(parseInt(e.target.value))
                        goToMonth(newDate)
                    }}
                    options={monthOptions}
                />
                <DatePickerDropdown
                    value={calendarMonth.date.getFullYear()}
                    onChange={(e) => {
                        const newDate = new Date(calendarMonth.date)
                        newDate.setFullYear(parseInt(e.target.value))
                        goToMonth(newDate)
                    }}
                    options={yearOptions}
                />
            </div>

            <Button
                variant="outline"
                className={cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted border-border/50"
                )}
                disabled={!nextMonth}
                onClick={handleNextClick}
                aria-label="Go to next month"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

// Simple month caption without dropdowns - just arrows and month/year text
function SimpleMonthCaption({ calendarMonth }: { calendarMonth: { date: Date } }) {
    const { goToMonth, previousMonth, nextMonth } = useDayPicker()

    const handlePreviousClick = () => {
        if (previousMonth) {
            goToMonth(previousMonth)
        }
    }

    const handleNextClick = () => {
        if (nextMonth) {
            goToMonth(nextMonth)
        }
    }

    return (
        <div className="flex items-center justify-between w-full h-10 px-1">
            <Button
                variant="outline"
                className={cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted border-border/50"
                )}
                disabled={!previousMonth}
                onClick={handlePreviousClick}
                aria-label="Go to previous month"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm font-medium">
                {format(calendarMonth.date, "MMMM yyyy")}
            </span>

            <Button
                variant="outline"
                className={cn(
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted border-border/50"
                )}
                disabled={!nextMonth}
                onClick={handleNextClick}
                aria-label="Go to next month"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

export function DatePicker({
    date,
    onDateChange,
    className,
    placeholder = "Pick a date",
    id,
    ...props
}: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 transition-colors",
                        !date && "text-muted-foreground",
                        className
                    )}
                    disabled={props.disabled === true}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-md border-border/50" align="start">
                <DayPicker
                    mode="single"
                    selected={date}
                    onSelect={onDateChange}
                    startMonth={new Date(1900, 0)}
                    endMonth={new Date(2100, 11)}
                    showOutsideDays={true}
                    className={cn("p-3")}
                    classNames={{
                        months: "flex flex-col gap-2",
                        month: "flex flex-col gap-4",
                        month_caption: "w-full",
                        nav: "hidden",
                        month_grid: "w-full border-collapse",
                        weekdays: "flex",
                        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem] text-center",
                        week: "flex w-full mt-2",
                        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                        day_button: cn(
                            buttonVariants({ variant: "ghost" }),
                            "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground"
                        ),
                        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
                        today: "bg-accent text-accent-foreground rounded-md",
                        outside: "text-muted-foreground opacity-50",
                        disabled: "text-muted-foreground opacity-50",
                        hidden: "invisible",
                        range_start: "rounded-l-md",
                        range_end: "rounded-r-md",
                        range_middle: "bg-accent/50",
                    }}
                    components={{
                        Nav: CustomNav,
                        MonthCaption: CustomMonthCaption,
                    }}
                    {...props}
                />
            </PopoverContent>
        </Popover>
    )
}

// ============================================================================
// Date Range Picker
// ============================================================================

export interface DateRange {
    from: Date | undefined
    to?: Date | undefined
}

export type DateRangePickerProps = {
    dateRange?: DateRange
    onDateRangeChange: (range: DateRange | undefined) => void
    placeholder?: string
    id?: string
    className?: string
    disabled?: boolean
    numberOfMonths?: number
}

export function DateRangePicker({
    dateRange,
    onDateRangeChange,
    className,
    placeholder = "Select date range",
    id,
    disabled,
    numberOfMonths = 1,
}: DateRangePickerProps) {
    const formatDateRange = () => {
        if (!dateRange?.from) return placeholder
        if (!dateRange.to) return format(dateRange.from, "MMM d, yyyy")
        return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
    }

    const handleReset = () => {
        onDateRangeChange(undefined)
    }

    const hasSelection = dateRange?.from || dateRange?.to

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant={"outline"}
                    className={cn(
                        "justify-start text-left font-normal bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 transition-colors",
                        !dateRange?.from && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateRange()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-md border-border/50" align="start">
                <DayPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={onDateRangeChange}
                    numberOfMonths={numberOfMonths}
                    startMonth={new Date(1900, 0)}
                    endMonth={new Date(2100, 11)}
                    showOutsideDays={true}
                    className={cn("p-3")}
                    classNames={{
                        months: "flex flex-col gap-2",
                        month: "flex flex-col gap-4",
                        month_caption: "w-full",
                        nav: "hidden",
                        month_grid: "w-full border-collapse",
                        weekdays: "flex",
                        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem] text-center",
                        week: "flex w-full mt-2",
                        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                        day_button: cn(
                            buttonVariants({ variant: "ghost" }),
                            "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground"
                        ),
                        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        today: "bg-accent text-accent-foreground rounded-md",
                        outside: "text-muted-foreground opacity-50",
                        disabled: "text-muted-foreground opacity-50",
                        hidden: "invisible",
                        range_start: "bg-primary text-primary-foreground rounded-l-md",
                        range_end: "bg-primary text-primary-foreground rounded-r-md",
                        range_middle: "bg-primary/20 text-foreground",
                    }}
                    components={{
                        Nav: CustomNav,
                        MonthCaption: SimpleMonthCaption,
                    }}
                />
                {hasSelection && (
                    <div className="border-t border-border/50 p-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="w-full text-muted-foreground hover:text-foreground"
                        >
                            Reset selection
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
