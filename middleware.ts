import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "maladireta_session";
const protectedRoutes = ["/dashboard", "/campaigns", "/admin", "/logs", "/settings"];

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function sign(body: string): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 16) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));

  return bytesToBase64Url(signature);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return false;
  }

  const expected = await sign(body);
  if (!expected || expected !== signature) {
    return false;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as { exp?: number };
    return Boolean(payload.exp && payload.exp > Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const validSession = await hasValidSession(request);

  if (isProtectedRoute && !validSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && validSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/campaigns/:path*", "/admin/:path*", "/logs/:path*", "/settings/:path*"]
};
