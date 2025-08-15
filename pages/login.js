export default function Login() {
  // SSR-less guard: if someone hits this statically rendered page,
  // bounce them to the API route that starts the OAuth flow.
  if (typeof window !== 'undefined') {
    window.location.href = '/api/auth/login';
  }
  return null;
}
