'use client';

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center space-y-4 text-center">
        <img src="/addu-logo.png" alt="City of Addu Logo" className="h-16 w-auto" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rahunu Registry</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the registry system
          </p>
        </div>
      </div>
      
      <Card className="border-border shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full h-11" disabled={isDisabled}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="text-center text-sm text-muted-foreground">
        Need access? Contact an administrator to request an account.
      </p>
    </div>
  );
}
