import { redirect } from 'next/navigation';
import { DEFAULT_UID } from '@/lib/livetime/demo-data';

export default function HomePage() {
  const uid = process.env.NEXT_PUBLIC_DEFAULT_UID || DEFAULT_UID;
  redirect(`/placar-telao-tb50?uid=${encodeURIComponent(uid)}`);
}
