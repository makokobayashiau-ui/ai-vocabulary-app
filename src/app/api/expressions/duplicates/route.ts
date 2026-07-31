import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isMissingRpcFunction(error: RpcError) {
  return error.code === "PGRST202";
}

function logDuplicateCheckError(context: string, error: RpcError) {
  console.error(context, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const normalized = normalize(q);
  if (!normalized || normalized.length > 300) return NextResponse.json({ count: 0 });
  const { data, error } = await supabase.rpc("count_expression_occurrences", { target_value: q });
  if (!error && typeof data === "number") return NextResponse.json({ count: data });

  if (error && !isMissingRpcFunction(error)) {
    logDuplicateCheckError("count_expression_occurrences RPC failed", error);
    return NextResponse.json(
      { error: "Could not check saved matches." },
      { status: 500 },
    );
  }

  const { count, error: fallbackError } = await supabase.from("expressions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("normalized_expression", normalized).is("deleted_at", null);

  if (fallbackError) {
    logDuplicateCheckError("duplicate fallback query failed", fallbackError);
    return NextResponse.json(
      { error: "Could not check saved matches." },
      { status: 500 },
    );
  }

  return NextResponse.json({ count: count ?? 0 });
}
