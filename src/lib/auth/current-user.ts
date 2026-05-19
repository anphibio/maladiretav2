import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: session.userId,
      email: session.email,
      active: true
    }
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireCurrentUserForApi() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ message: "Sessão inválida ou expirada." }, { status: 401 })
    };
  }

  return { user, response: null };
}

export async function requireAdminForApi() {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return { user: null, response };
  }

  if (user.role !== "ADMIN") {
    return {
      user: null,
      response: NextResponse.json({ message: "Acesso restrito a administradores." }, { status: 403 })
    };
  }

  return { user, response: null };
}
