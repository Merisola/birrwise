import type { Metadata } from 'next';
import './globals.css';
import { UIProvider } from '@/context/UIContext';
import { PageWrapper } from '@/components/layout/PageWrapper';

export const metadata: Metadata = {
  title: 'Birrwise · Personal Finance',
  description: 'Personal finance web app for Ethiopian Birr (ETB)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UIProvider>
          <PageWrapper>{children}</PageWrapper>
        </UIProvider>
      </body>
    </html>
  );
}
