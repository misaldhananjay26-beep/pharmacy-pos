import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/roles";

/** Landing route: send each role to the screen they actually work in. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(HOME_FOR_ROLE[user.role]);
}
