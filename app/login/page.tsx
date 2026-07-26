import { LoginForm } from '../admin/login/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return <LoginForm nextPath={params?.next || '/admin'} />;
}
