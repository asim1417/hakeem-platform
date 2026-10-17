import { DeskProvider } from "@/components/editorial/DeskProvider";
import "./editorial.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DeskProvider>{children}</DeskProvider>;
}
