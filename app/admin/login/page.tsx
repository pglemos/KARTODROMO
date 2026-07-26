import { LoginForm } from './LoginForm';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const nextPath = params?.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/admin';
  return <LoginForm nextPath={nextPath} />;
}
