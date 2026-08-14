import { IPODetailClient } from './ipo-detail-client';

export function generateStaticParams() {
  return [{ ipoId: 'placeholder' }];
}

export default async function IPODetailPage({ params }: { params: Promise<{ ipoId: string }> }) {
  const { ipoId } = await params;
  return <IPODetailClient ipoId={ipoId} />;
}
