"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-2">Password</span>
        <input name="password" type="password" autoFocus autoComplete="current-password" className="field" required />
      </label>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <button
        disabled={pending}
        className="h-10 w-full rounded-[10px] bg-ink text-bg text-sm font-medium transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
