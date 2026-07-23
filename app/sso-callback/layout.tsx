import { ClerkRoot } from "@/components/providers/ClerkRoot";

export default function SsoCallbackLayout({ children }: { children: React.ReactNode }) {
  return <ClerkRoot>{children}</ClerkRoot>;
}
