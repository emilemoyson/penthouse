"use server";

import { deleteGroceryRun, finishPantryItem, updatePantryItem } from "@/penthouse/data/actions";

/* Thin wrappers for the kitchen page: same writes as the penthouse panel, without returning the panel payload. */

export async function setPantryQty(id: number, qty: number) {
  await updatePantryItem(id, { qty });
}

export async function setPantryPlace(id: number, place: "fridge" | "freezer" | "pantry") {
  await updatePantryItem(id, { place });
}

export async function setPantryUseBy(id: number, useBy: string | null) {
  await updatePantryItem(id, { use_by: useBy });
}

export async function removePantryItem(id: number) {
  await finishPantryItem(id);
}

export async function removeRun(id: number) {
  await deleteGroceryRun(id);
}
