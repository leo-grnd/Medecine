import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "J-Master Med - Méthode des J",
    description: "Optimisez vos révisions de médecine avec la méthode des répétitions espacées.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr">
        <body>
        {children}
        </body>
        </html>
    );
}