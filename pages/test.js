// pages/test.js
export async function getServerSideProps() {
  return { redirect: { destination: "/onenote-test", permanent: false } };
}
export default function TestRedirect() { return null; }
