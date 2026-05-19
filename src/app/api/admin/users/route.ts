import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { listManagedUsers } from "@/services/admin/user-admin-service";

export async function GET() {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const users = await listManagedUsers();

  return NextResponse.json({ users });
}
