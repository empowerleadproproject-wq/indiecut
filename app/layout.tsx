import './globals.css';
import './mobile.css';
import type { Metadata } from 'next';
import WebsiteAnalyticsTracker from './WebsiteAnalyticsTracker';

export const metadata: Metadata = {
  title: 'Indie Cut',
  description: 'Entertainment, culture, film, television, music, and independent voices.'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><WebsiteAnalyticsTracker/>{children}</body></html>;
}
