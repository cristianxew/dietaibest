import {
  buildLegalMetadata,
  buildLegalPage,
  generateLegalStaticParams,
} from "@/components/legal/legal-route";

export const generateStaticParams = generateLegalStaticParams;
export const generateMetadata = buildLegalMetadata("cookies");

export default buildLegalPage("cookies");
