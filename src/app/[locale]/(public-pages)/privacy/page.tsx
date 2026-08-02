import {
  buildLegalMetadata,
  buildLegalPage,
  generateLegalStaticParams,
} from "@/components/legal/legal-route";

export const generateStaticParams = generateLegalStaticParams;
export const generateMetadata = buildLegalMetadata("privacy");

export default buildLegalPage("privacy");
