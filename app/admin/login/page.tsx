import { redirect } from 'next/navigation';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params?.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/admin/telao';
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}
