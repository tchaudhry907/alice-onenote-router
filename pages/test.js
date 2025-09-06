// pages/test.js
// Always redirect /test -> /onenote-test

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/onenote-test",
      permanent: false,
    },
  };
}

export default function TestRedirect() {
  return null;
}
