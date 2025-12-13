import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  Calendar,
  BookOpen,
  ShoppingCart,
  User,
} from "lucide-react";
import { OnboardingPrompt } from "@/components/dashboard/OnboardingPrompt";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
        {/* Onboarding Prompt - shows if user hasn't completed setup */}
        <OnboardingPrompt />

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t("welcome")} 🍽️
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t("subtitle")}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("quickActions.createMealPlan")}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" />
                {t("quickActions.newPlan")}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("quickActions.browseRecipes")}
              </CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <BookOpen className="h-4 w-4 mr-2" />
                {t("quickActions.explore")}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("quickActions.shoppingList")}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t("quickActions.viewList")}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("quickActions.profile")}
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <User className="h-4 w-4 mr-2" />
                {t("quickActions.settings")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("recentActivity.title")}</CardTitle>
              <CardDescription>{t("recentActivity.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Calendar className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{t("recentActivity.welcome")}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t("recentActivity.getStarted")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t("quickStats.title")}</CardTitle>
              <CardDescription>{t("quickStats.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {t("quickStats.mealPlans")}
                  </span>
                  <span className="text-2xl font-bold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {t("quickStats.savedRecipes")}
                  </span>
                  <span className="text-2xl font-bold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {t("quickStats.shoppingLists")}
                  </span>
                  <span className="text-2xl font-bold">0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("gettingStarted.title")}</CardTitle>
            <CardDescription>{t("gettingStarted.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-medium mb-2">
                  {t("gettingStarted.step1.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("gettingStarted.step1.description")}
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-medium mb-2">
                  {t("gettingStarted.step2.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("gettingStarted.step2.description")}
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-medium mb-2">
                  {t("gettingStarted.step3.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("gettingStarted.step3.description")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
