import './globals.css';
import './mobile.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import WebsiteAnalyticsTracker from './WebsiteAnalyticsTracker';
import MarketingPixels from './MarketingPixels';
import IndieCutRadioPlayer from './IndieCutRadioPlayer';

const SITE_URL='https://indiecut.info';
const SITE_DESCRIPTION='Verified entertainment journalism covering film, television, music, culture, celebrity news and independent creators.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'IndieCut',
    template: '%s | IndieCut'
  },
  applicationName: 'IndieCut',
  description: SITE_DESCRIPTION,
  category: 'entertainment',
  alternates: {
    canonical: '/',
    types: {'application/rss+xml':'/rss.xml'}
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  },
  openGraph: {
    siteName: 'IndieCut',
    type: 'website',
    url: SITE_URL,
    title: 'IndieCut',
    description: SITE_DESCRIPTION
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IndieCut',
    description: SITE_DESCRIPTION
  }
};

const siteJsonLd={
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'Organization',
      '@id':`${SITE_URL}/#organization`,
      name:'IndieCut',
      url:SITE_URL,
      description:SITE_DESCRIPTION
    },
    {
      '@type':'WebSite',
      '@id':`${SITE_URL}/#website`,
      url:SITE_URL,
      name:'IndieCut',
      description:SITE_DESCRIPTION,
      publisher:{'@id':`${SITE_URL}/#organization`},
      inLanguage:'en-US'
    }
  ]
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(siteJsonLd).replace(/</g,'\\u003c')}}/><Suspense fallback={null}><WebsiteAnalyticsTracker/><MarketingPixels/></Suspense>{children}<IndieCutRadioPlayer/></body></html>;
}
