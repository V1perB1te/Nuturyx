import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/types";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { ROLES } from "@/lib/constants";

type ApiAuthSuccess =
  | { ok: true; kind: "bot" }
  | { ok: true; kind: "user"; userId: string; profile: Usuario };

type ApiAuthError = { ok: false; status: number; error: string };

export type ApiAuthResult = ApiAuthSuccess | ApiAuthError;

export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Usuario | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo,created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as Usuario;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  if (!profile.activo) {
    redirect("/login?error=usuario-inactivo");
  }

  return profile;
}

function createApiSupabaseClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
      global: {
        headers: {
          authorization: request.headers.get("authorization") ?? "",
        },
      },
    },
  );
}

export function isValidBotToken(request: NextRequest) {
  const configuredToken = process.env.BOT_API_TOKEN;
  if (!configuredToken) return false;
  const botToken = request.headers.get("x-bot-token");
  return botToken === configuredToken;
}

export async function authenticateApiRequest(
  request: NextRequest,
  options?: { allowBot?: boolean; requireAdmin?: boolean },
): Promise<ApiAuthResult> {
  const allowBot = options?.allowBot ?? false;
  const requireAdmin = options?.requireAdmin ?? false;

  if (allowBot && isValidBotToken(request)) {
    return { ok: true, kind: "bot" };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const supabase = createApiSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo,created_at,puede_crear_productos")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.activo) {
    return { ok: false, status: 401, error: "Usuario inactivo o sin perfil" };
  }

  if (requireAdmin && profile.rol !== ROLES.ADMIN) {
    return { ok: false, status: 403, error: "Permisos insuficientes" };
  }

  return { ok: true, kind: "user", userId: user.id, profile: profile as Usuario };
}
