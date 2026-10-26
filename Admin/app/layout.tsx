import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HOSTRIF Admin Portal',
  description: 'Operator, Proxy, and AdsPower Infrastructure Management'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0f1117] text-[#f1f5f9] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
