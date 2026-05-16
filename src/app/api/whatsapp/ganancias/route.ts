import { NextRequest } from "next/server";
import { handleGetGanancias } from "@/lib/comercial-api";

export async function GET(request: NextRequest) {
  return handleGetGanancias(request);
}
