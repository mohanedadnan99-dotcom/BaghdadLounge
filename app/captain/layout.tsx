import "./captain.css";

export default function CaptainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="captain-scope">{children}</div>;
}
