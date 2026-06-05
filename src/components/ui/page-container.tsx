import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Viewport shell mode: fills the available screen height with an inner-scroll
   * layout. The container becomes a flex column — children own their own padding
   * and scroll behavior (use a fixed header + scrollable body pattern inside).
   * Applied to pages like meal-plans and recipes.
   */
  viewport?: boolean;
}

export function PageContainer({ children, className, viewport = false }: PageContainerProps) {
  return (
    <div
      className={cn(
        viewport
          ? "flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden"
          : "relative p-6 lg:p-10",
        className
      )}
    >
      {children}
    </div>
  );
}
