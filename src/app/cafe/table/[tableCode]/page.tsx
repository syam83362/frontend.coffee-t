import { TableOrdering } from '@/components/table-ordering';

export default async function CafeTablePage({ params }: { params: Promise<{ tableCode: string }> }) {
  const { tableCode } = await params;
  return <TableOrdering tableCode={tableCode} />;
}