import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <Header />
      <main id="contenido">{children}</main>
      <Footer />
    </>
  );
}
