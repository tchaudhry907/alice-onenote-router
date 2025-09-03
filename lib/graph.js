import fetch from "node-fetch";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Call Microsoft Graph with a bearer token
export async function graphRequest(token, path, method = "GET", body) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Graph error ${res.status}: ${error}`);
  }

  return res.json();
}

// Example: get signed-in user's profile
export function getMe(token) {
  return graphRequest(token, "/me");
}

// Example: get all notebooks
export function getNotebooks(token) {
  return graphRequest(token, "/me/onenote/notebooks");
}

// Example: create a page in a section
export function createPage(token, sectionId, htmlContent) {
  return graphRequest(
    token,
    `/me/onenote/sections/${sectionId}/pages`,
    "POST",
    htmlContent
  );
}
