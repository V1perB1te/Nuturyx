import { NextRequest } from "next/server";
import { handleGetProductos } from "@/lib/comercial-api";

export async function GET(request: NextRequest) {
  return handleGetProductos(request);
}
