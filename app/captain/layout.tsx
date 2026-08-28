import "./captain.css";
import CaptainSystemBanner from "./system-banner";

export default function CaptainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="captain-scope"><CaptainSystemBanner/>{children}</div>;
}
