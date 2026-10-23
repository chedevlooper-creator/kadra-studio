import { NextResponse, type NextRequest } from "next/server";

// This milestone is intentionally local-only; it has no multi-user session layer yet.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase())) {
    return new NextResponse("Bu çalışma alanı yalnızca yerel bilgisayarda kullanılabilir.", { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|images/|favicon.ico).*)"] };
