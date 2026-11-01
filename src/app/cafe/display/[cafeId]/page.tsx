import type { Metadata } from 'next';
import { CafeDisplay } from '@/components/cafe-display';

export const metadata: Metadata = {
  title: 'Order display',
  robots: { index: false, follow: false },
};

export default async function CafeDisplayPage({ params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  return <CafeDisplay cafeId={cafeId} />;
}
