'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { IPODetailClient } from './ipo-detail-client';
import LoadingSpinner from '@/components/LoadingSpinner';

function DetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  return <IPODetailClient ipoId={id} />;
}

export default function AdminDetailPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DetailContent />
    </Suspense>
  );
}
