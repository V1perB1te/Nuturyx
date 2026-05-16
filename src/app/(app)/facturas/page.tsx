import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function FacturasPage() {
  await requireProfile();
  redirect("/facturas/nueva");
}
