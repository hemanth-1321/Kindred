"use client";

import { type FormEvent, useState } from "react";
import { authClient } from "../lib/auth-client";
import styles from "./page.module.css";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setSubmitting(true);
    setError(null);
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({
            name: String(form.get("name") ?? ""),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
    }
  }

  return (
    <main className={styles.center}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Kindred</h1>
        <p className={styles.muted}>
          {mode === "sign-in"
            ? "Sign in to continue your conversation."
            : "Create an account to get started."}
        </p>

        {mode === "sign-up" && (
          <label className={styles.field}>
            Name
            <input name="name" required autoComplete="name" />
          </label>
        )}
        <label className={styles.field}>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className={styles.field}>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.primary} disabled={submitting}>
          {submitting
            ? "Please wait…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>

        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
        >
          {mode === "sign-in"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
