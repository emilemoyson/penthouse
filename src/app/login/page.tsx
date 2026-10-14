import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-[360px] fade-in">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#4b93ec] to-[#1baf7a] text-white font-semibold">E</div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">Welcome back, Emile</h1>
            <p className="text-sm text-ink-3">Private dashboard</p>
          </div>
        </div>
        <LoginForm next={next && next.startsWith("/") ? next : "/"} />
      </div>
    </main>
  );
}
