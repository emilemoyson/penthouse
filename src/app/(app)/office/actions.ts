"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const TodoIn = z.object({
  title: z.string().trim().min(1).max(200),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

/** Office page: add a to-do by hand. Ids start with "manual-" so the email task never overwrites them. */
export async function addTodo(input: z.input<typeof TodoIn>) {
  const t = TodoIn.parse(input);
  const sql = await db();
  await sql`insert into todos (id, title, due, sender) values (${"manual-" + randomUUID()}, ${t.title}, ${t.due ?? null}, 'You')`;
  revalidatePath("/office");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function setTodoDone(id: string, done: boolean) {
  const sql = await db();
  await sql`update todos set done = ${done}, done_at = ${done ? new Date() : null} where id = ${id}`;
  revalidatePath("/office");
  revalidatePath("/dashboard");
  revalidatePath("/");
}
