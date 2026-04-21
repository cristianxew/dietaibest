import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("relative p-6 lg:p-10 max-w-[1400px] mx-auto", className)}>
      {children}
    </div>
  );
}
