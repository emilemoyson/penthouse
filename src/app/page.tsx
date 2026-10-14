import { Penthouse } from "@/penthouse/Penthouse";
import { loadPenthouse } from "@/penthouse/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Penthouse" };

export default async function Home() {
  const data = await loadPenthouse();
  return <Penthouse data={data} />;
}
