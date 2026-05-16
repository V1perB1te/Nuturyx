import { NextRequest } from "next/server";
import { handlePutConfirmarPedido } from "@/lib/comercial-api";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return handlePutConfirmarPedido(request, params.id);
}
