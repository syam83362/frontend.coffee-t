import type { Metadata } from 'next';
import { TableOrdering } from '@/components/table-ordering';

export const metadata: Metadata = {
  title: 'Order from your table',
  robots: { index: false, follow: false },
};

export default async function CafeTablePage({ params }: { params: Promise<{ tableCode: string }> }) {
  const { tableCode } = await params;
  return <TableOrdering tableCode={tableCode} />;
}
