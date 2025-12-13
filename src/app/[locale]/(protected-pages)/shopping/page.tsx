import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  DollarSign,
  Truck,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

export default function ShoppingPage() {
  const t = useTranslations("shopping");

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
        {/* Back to Dashboard */}
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("backToDashboard")}
            </Button>
          </Link>
        </div>

        {/* Header Section */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t("title")} 🛒
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="mb-8 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-700 dark:text-purple-300 flex items-center">
              <ShoppingCart className="h-6 w-6 mr-2" />
              {t("comingSoon")}
            </CardTitle>
            <CardDescription className="text-purple-600 dark:text-purple-400 text-lg">
              {t("description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {t("features.smartLists")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {t("features.priceComparison")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {t("features.autoOrdering")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {t("features.nutritionLabels")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="font-medium text-purple-800 dark:text-purple-200">
                      {t("features.budgetTracking")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Smart Lists</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">AI</div>
              <p className="text-xs text-muted-foreground">
                Generated from meal plans
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Price Compare</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">30%</div>
              <p className="text-xs text-muted-foreground">
                Average savings found
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto Delivery</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24h</div>
              <p className="text-xs text-muted-foreground">
                Average delivery time
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
