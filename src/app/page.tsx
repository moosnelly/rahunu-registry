import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth/options";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Welcome back to the Rahunu Registry portal.</p>
    </main>
  );
}
