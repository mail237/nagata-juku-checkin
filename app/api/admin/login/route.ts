import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-constants";
import { createAdminSessionToken } from "@/lib/admin-session";
import { requireEnv } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pin = typeof body.pin === "string" ? body.pin : "";
    const expected = requireEnv("ADMIN_PIN");
    if (pin !== expected) {
      return NextResponse.json({ ok: false, error: "PINが違います" }, { status: 401 });
    }
    const token = createAdminSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}
