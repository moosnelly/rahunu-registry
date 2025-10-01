import { PrismaClient } from "@prisma/client";
import { validateEnvironment } from "./env";

// Validate environment variables on server startup
// Skip during Next.js build phase (when env vars aren't injected yet)
if (typeof window === 'undefined' && process.env.DATABASE_URL) {
  validateEnvironment();
}

const g = global as any;
export const prisma = g.prisma || new PrismaClient({ 
  log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"] 
});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
