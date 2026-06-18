import { LoginForm } from './LoginForm';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm nextPath={params?.next || '/admin/telao'} />;
}
