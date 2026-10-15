import { Penthouse } from "@/penthouse/Penthouse";
import { getPenthouseData } from "@/penthouse/data/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Penthouse" };

/**
 * First paint gets every zone's payload from the server; after that each panel's hook
 * (useSleepData, useProfessionalData, …) keeps itself fresh via /api/penthouse/:zone.
 */
export default async function Home() {
  const data = await getPenthouseData();
  return <Penthouse data={data} />;
}
