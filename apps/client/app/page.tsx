"use client";

import { authClient } from "../lib/auth-client";
import { AuthForm } from "./auth-form";
import { Chat } from "./chat";
import styles from "./page.module.css";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
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
