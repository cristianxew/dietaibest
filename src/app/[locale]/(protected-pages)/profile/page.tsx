import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ProfilePageContent } from "@/components/profile/ProfilePageContent";
import { getUserProfile } from "@/actions/profile";
import { PageContainer } from "@/components/ui/page-container";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const { data: profile, error } = await getUserProfile();

  if (error || !profile) {
    // Redirect to onboarding if no profile exists
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none sticky top-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end border-b border-border/40 pb-8">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ProfilePageContent initialData={profile} />
        </div>
      </PageContainer>
    </div>
  );
}
