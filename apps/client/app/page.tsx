"use client";

import { authClient } from "../lib/auth-client";
import { AuthForm } from "./auth-form";
import { Chat } from "./chat";
import styles from "./page.module.css";

export default function Home() {
  const { data: session, isPending, isRefetching } = authClient.useSession();

  // Better Auth reports isPending on every refetch while signed out; showing
  // the loader then would unmount the form and wipe what the user typed.
  if (isPending && !isRefetching) {
    return (
      <main className={styles.center}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return <Chat key={session.user.id} userName={session.user.name} />;
}
