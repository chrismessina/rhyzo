import type { Metadata } from 'next';
import HomeContent from './home-content';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Rhyzo — Decentralized Identity Resolution',
  description: 'A modern finger command for the decentralized web. Resolve handles to verified identities across services.',
  openGraph: {
    title: 'Rhyzo — Decentralized Identity Resolution',
    description: 'A modern finger command for the decentralized web. Resolve handles to verified identities across services.',
    url: baseUrl,
    siteName: 'Rhyzo',
    type: 'website',
    images: [{ url: `${baseUrl}/icon-512.png`, width: 512, height: 512, alt: 'Rhyzo' }],
  },
};

export default function Home() {
  return <HomeContent />;
}
