import { NextResponse } from "next/server";

export function apiError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    {
      exito: false,
      error: message,
      details: details ?? null,
    },
    { status },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
