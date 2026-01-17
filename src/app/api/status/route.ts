import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer (.+)$/);

  if (!match) {
    return NextResponse.json({ ok: false, reason: "missing_bearer" }, { status: 401 });
  }

  const token = match[1];

  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data?.user) {
    return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    email: data.user.email,
  });
}
