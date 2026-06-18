'use client';

import { useEffect, useState } from 'react';
import WebsiteApp from '@/src/App';

export function PublicSiteClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-white" aria-hidden="true" />;
  }

  return <WebsiteApp />;
}
