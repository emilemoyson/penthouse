import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-[380px] fade-in">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#4b93ec] to-[#1baf7a] text-white font-semibold">O</div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">The Office</h1>
            <p className="text-sm text-ink-3">Your training, sleep, food and week in one apartment.</p>
          </div>
        </div>
        <LoginForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} error={error} />
        <p className="mt-8 text-xs leading-relaxed text-ink-3">
          Your data is only visible to you. Connectors can be removed at any time, and you can delete your account and
          everything in it from the Connectors page. Built by Emile Moyson for IE NYC.
        </p>
      </div>
    </main>
  );
}
