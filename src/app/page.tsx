import { Penthouse } from "@/penthouse/Penthouse";
import { getPenthouseData } from "@/penthouse/data/server";

export const dynamic = "force-dynamic";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: { absolute: SITE_NAME } };

/**
 * First paint gets every zone's payload from the server; after that each panel's hook
 * (useSleepData, useProfessionalData, …) keeps itself fresh via /api/penthouse/:zone.
 */
export default async function Home() {
  const data = await getPenthouseData();
  return <Penthouse data={data} />;
}
