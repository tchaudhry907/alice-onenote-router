// pages/login.js
export default function Login() {
  // Immediately redirect to the API route that starts the Microsoft login
  if (typeof window !== "undefined") {
    window.location.href = "/api/auth/login";
  }
  // Nothing to render; this page just redirects
  return null;
}
