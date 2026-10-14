import { Sidebar, MobileTop, MobileTabs } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileTop />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10 fade-in">{children}</main>
      </div>
      <MobileTabs />
    </div>
  );
}
