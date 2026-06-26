// pages/leads/index.tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// Redirect /leads to /leads/list by default, or use query param to remember view
export default function LeadsIndex() {
  const router = useRouter();

  useEffect(() => {
    const savedView = typeof window !== 'undefined'
      ? sessionStorage.getItem('leadsView') || 'list'
      : 'list';
    router.replace(`/leads/${savedView}`);
  }, []);

  return null;
}