// lib/msgraph.v6.js
// Minimal shim Graph v6 client shape

export function graphClient() {
  // Return a tiny client with get/post no-ops that won’t throw
  return {
    async get(_path) {
      return { ok: false, error: "graphClient.get stubbed", data: null };
    },
    async post(_path, _body) {
      return { ok: false, error: "graphClient.post stubbed", data: null };
    },
  };
}

// Optional: default export for flexibility
export default { graphClient };
