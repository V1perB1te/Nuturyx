import { NextRequest } from "next/server";
import { handleGetPedidoFactura } from "@/lib/comercial-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleGetPedidoFactura(request, params.id);
}
