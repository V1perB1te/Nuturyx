import { NextRequest } from "next/server";
import { handleGetProductoDetalle } from "@/lib/comercial-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleGetProductoDetalle(request, params.id);
}
