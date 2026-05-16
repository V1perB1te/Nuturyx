import { NextRequest } from "next/server";
import { handleGetPedidos, handlePostPedido } from "@/lib/comercial-api";

export async function GET(request: NextRequest) {
  return handleGetPedidos(request);
}

export async function POST(request: NextRequest) {
  return handlePostPedido(request);
}
