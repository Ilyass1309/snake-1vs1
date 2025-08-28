import "./globals.css";

export const metadata = {
  title: "Snake Duel — Joueur vs IA",
  description: "Un Snake en duel contre une IA, Next.js + TypeScript + Canvas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="min-h-screen w-full flex flex-col items-center justify-center px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
