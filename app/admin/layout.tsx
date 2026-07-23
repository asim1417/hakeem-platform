import { ClerkRoot } from "@/components/providers/ClerkRoot";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ClerkRoot>{children}</ClerkRoot>;
}
