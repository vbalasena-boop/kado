import { getMyBusiness } from "@/lib/auth";
import ValidateClient from "./ValidateClient";

export const dynamic = "force-dynamic";

export default async function ValidatePage() {
  const { business } = await getMyBusiness();
  if (!business) return null;
  return <ValidateClient />;
}
