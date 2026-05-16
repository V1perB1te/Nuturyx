import { NextRequest } from "next/server";
import { handlePutEstadoPedido } from "@/lib/comercial-api";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return handlePutEstadoPedido(request, params.id);
}
