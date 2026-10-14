"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function refreshJobs() {
  revalidateTag("jobs");
  revalidatePath("/jobs");
}
