import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export', // Ajoute cette ligne pour forcer un site 100% statique
    images: {
        unoptimized: true, // Nécessaire pour l'export statique si vous utilisez <Image />
    },
};

export default nextConfig;