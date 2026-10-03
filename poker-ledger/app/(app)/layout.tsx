import { Nav } from "@/components/ui/Nav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallBanner } from "@/components/InstallBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineBanner />
      <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-36">{children}</main>
      <InstallBanner />
      <Nav />
    </>
  );
}
