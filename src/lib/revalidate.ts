import { revalidatePath } from "next/cache";

/** Refresh every page in a workspace after a mutation. */
export function refreshWorkspace(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}
