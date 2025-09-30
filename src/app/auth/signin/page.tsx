'use client';

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get("email") as string;
    const passwordValue = formData.get("password") as string;

    const result = await signIn("credentials", {
      redirect: false,
      email: emailValue,
      password: passwordValue,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      setError("Invalid credentials. Please try again.");
      setSubmitting(false);
      return;
    }

    if (result?.url) {
      window.location.href = result.url;
    }
  };

  const isDisabled = useMemo(() => !email || !password || submitting, [email, password, submitting]);

  return (
    <div className="grid w-full max-w-md gap-6">
      <Card className="border-none shadow-xl shadow-sky-900/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-semibold text-slate-900">Welcome Back</CardTitle>
          <p className="text-sm text-slate-500">Log in with your credentials to access Secretariat of Addu City Council.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={isDisabled}>
              {submitting ? "Signing In..." : "Login"}
            </Button>
          </form>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Or continue with</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="w-full">SSO</Button>
              <Button type="button" variant="outline" className="w-full">2FA</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-slate-500">
        Need access? Please contact an administrator to request an account.
      </p>
    </div>
  );
}
