"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Card, CardContent, Input } from "@omelora/sunrise";

const LOGO_URL =
  "https://images.fillout.com/orgid-737092/flowpublicid-uti4bix9xv/widgetid-default/s679vNSfbFqQ99wz8NMNkJ/pasted-image-1783539610152-r5ns4yw4.png";

const APPLY_URL = "https://form.fillout.com/t/2VfsyEfiduus";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const result = await signIn("email", {
        email: trimmed,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setStatus("error");
        setErrorMessage("Something went wrong sending the link. Try again.");
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong sending the link. Try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sunrise-50 px-4 py-10 sm:px-6">
      <Card
        variant="elevated"
        className="w-full max-w-[440px] border border-border shadow-lg"
      >
        <CardContent className="flex flex-col gap-6 p-2 sm:p-4">
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_URL}
              alt="Omelora"
              className="h-14 w-14 rounded-2xl object-cover shadow-sm"
            />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
              {status === "sent"
                ? "Check your email"
                : "Sign in to Omelora Bridge"}
            </h1>
          </div>

          {status === "sent" ? (
            <div className="flex flex-col gap-5 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">{email.trim()}</span>
                . Open it on this device to finish signing in.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full font-medium"
                onClick={() => {
                  setStatus("idle");
                  setErrorMessage(null);
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full gap-3 bg-background font-medium"
                disabled
                title="Google sign-in coming soon"
              >
                <GoogleIcon />
                Sign in with Google
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-xs text-muted-foreground">
                  or use email
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleContinue} className="flex flex-col gap-5">
                <Input
                  label="Email address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                {errorMessage ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full font-semibold shadow-sm"
                  disabled={status === "loading" || !email.trim()}
                >
                  {status === "loading" ? "Sending link…" : "Continue"}
                </Button>
              </form>
            </>
          )}

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Only approved Omelora members can sign in.
            <br />
            Not signed up yet?{" "}
            <a
              href={APPLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              Apply here
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
