import { CafeDisplay } from '@/components/cafe-display';

export default async function CafeDisplayPage({ params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  return <CafeDisplay cafeId={cafeId} />;
}