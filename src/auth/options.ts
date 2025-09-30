import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { Adapter } from "next-auth/adapters"
import { AuditAction } from "@prisma/client"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.passwordHash || !user.isActive) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      if (!token.role || !token.id) {
        const u = await prisma.user.findUnique({ where: { email: token.email! } });
        if (u) {
          token.role = (u as any)?.role ?? "VIEWER";
          token.id = u.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = token.role;
      (session.user as any).id = token.id;
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      try { 
        const userId = user.id as string;
        await prisma.auditLog.create({ data: { action: AuditAction.USER_SIGNED_IN, ...(userId && { actorId: userId }), targetUserId: userId } }); 
      } catch {}
    }
  },
  pages: { signIn: "/auth/signin" }
}
