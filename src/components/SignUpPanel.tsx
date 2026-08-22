"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@omelora/sunrise";
import {
  activityStatus,
  displayName,
  findProfileByEmail,
  slotsFilled,
} from "@/lib/activities";
import type { Activity, SignUp } from "@/lib/types";

interface SignUpPanelProps {
  activity: Activity;
}

export function SignUpPanel({ activity }: SignUpPanelProps) {
  const [signUps, setSignUps] = useState<SignUp[]>(activity.signUps);
  const [email, setEmail] = useState("");
  const [spots, setSpots] = useState("1");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filled = slotsFilled(signUps);
  const remaining = Math.max(activity.slotsTotal - filled, 0);
  const status = activityStatus(activity, signUps);
  const isFull = status === "full";

  const matchedProfile = useMemo(
    () => findProfileByEmail(email),
    [email]
  );

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setLookupError(null);
    setFormError(null);
    setSuccess(null);

    const trimmed = value.trim();
    if (!trimmed) {
      setMatchedName(null);
      return;
    }

    const profile = findProfileByEmail(trimmed);
    if (profile) {
      setMatchedName(`${profile.firstName} ${profile.lastName}`);
      setLookupError(null);
    } else if (trimmed.includes("@")) {
      setMatchedName(null);
      setLookupError(
        "No Omelora profile matches this email. Only approved members can sign up."
      );
    } else {
      setMatchedName(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (isFull) {
      setFormError("This activity is full.");
      return;
    }

    const profile = matchedProfile ?? findProfileByEmail(email);
    if (!profile) {
      setLookupError(
        "No Omelora profile matches this email. Only approved members can sign up."
      );
      return;
    }

    const spotCount = Number.parseInt(spots, 10);
    if (!Number.isFinite(spotCount) || spotCount < 1) {
      setFormError("Enter at least 1 spot.");
      return;
    }
    if (spotCount > remaining) {
      setFormError(`Only ${remaining} spot${remaining === 1 ? "" : "s"} remaining.`);
      return;
    }

    const alreadySigned = signUps.some(
      (s) => s.email.toLowerCase() === profile.email.toLowerCase()
    );
    if (alreadySigned) {
      setFormError("This profile is already signed up for this activity.");
      return;
    }

    const next: SignUp = {
      id: `local-${Date.now()}`,
      profileId: profile.id,
      firstName: profile.firstName,
      lastInitial: profile.lastName.charAt(0).toUpperCase(),
      spots: spotCount,
      email: profile.email,
    };

    setSignUps((prev) => [...prev, next]);
    setSuccess(`Signed up ${profile.firstName} for ${spotCount} spot${spotCount === 1 ? "" : "s"}.`);
    setEmail("");
    setSpots("1");
    setMatchedName(null);
  };

  return (
    <div className="space-y-5">
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Sign Ups</CardTitle>
            <Badge variant={isFull ? "warning" : "primary"}>
              {filled}/{activity.slotsTotal}
            </Badge>
          </div>
          <CardDescription>
            {isFull
              ? "All spots are filled."
              : `${remaining} spot${remaining === 1 ? "" : "s"} remaining.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one has signed up yet. Be the first!
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {signUps.map((signUp) => (
                <li
                  key={signUp.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="font-medium text-foreground">
                    {displayName(signUp)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {signUp.spots} spot{signUp.spots === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card variant="outline">
        <CardHeader>
          <CardTitle>Sign up for this activity</CardTitle>
          <CardDescription>
            Enter the email on your Omelora profile to claim spots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                error={!!lookupError}
                hint={lookupError ?? undefined}
                disabled={isFull}
              />
              {matchedName && !lookupError ? (
                <p className="text-xs font-medium text-sunrise-700">
                  Matched profile: {matchedName}
                </p>
              ) : null}
            </div>

            <Input
              label="Number of spots"
              name="spots"
              type="number"
              min={1}
              max={Math.max(remaining, 1)}
              value={spots}
              onChange={(e) => {
                setSpots(e.target.value);
                setFormError(null);
                setSuccess(null);
              }}
              error={!!formError}
              hint={formError ?? undefined}
              disabled={isFull}
            />

            {success ? (
              <p className="text-sm font-medium text-emerald-700">{success}</p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isFull || !!lookupError || !email.trim()}
            >
              {isFull ? "Activity full" : "Sign up"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Try a mock profile email like{" "}
              <span className="font-medium text-foreground">
                jordan.lee@example.com
              </span>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
