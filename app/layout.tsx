import './globals.css';
import './mobile.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import WebsiteAnalyticsTracker from './WebsiteAnalyticsTracker';
import MarketingPixels from './MarketingPixels';

export const metadata: Metadata = {
  metadataBase: new URL('https://indiecut.info'),
  title: {
    default: 'IndieCut',
    template: '%s | IndieCut'
  },
  applicationName: 'IndieCut',
  description: 'Entertainment, culture, film, television, music, and independent voices.',
  alternates: { canonical: '/' },
  openGraph: {
    siteName: 'IndieCut',
    type: 'website',
    url: 'https://indiecut.info',
    title: 'IndieCut',
    description: 'Entertainment, culture, film, television, music, and independent voices.'
  }
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><Suspense fallback={null}><WebsiteAnalyticsTracker/><MarketingPixels/></Suspense>{children}</body></html>;
}
