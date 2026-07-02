declare module "*.css" {
  const content: string;
  export default content;
}

// PWA install prompt (Chrome/Edge — not available on iOS Safari)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
