import { Agent } from 'undici';

// This is the core of the "one-time resource" optimization: a single
// pooled, keep-alive connection manager created ONCE when the process
// boots and reused for every outbound call to Cloudflare Turnstile and
// Shopify for the life of the server.
//
// Without this, Node's global fetch would negotiate a fresh TCP + TLS
// handshake for every single outbound request, which is by far the
// dominant cost of an I/O-bound endpoint like this one once traffic is
// steady. undici pools/reuses sockets per-origin automatically, so this
// one Agent instance safely serves both challenges.cloudflare.com and
// your *.myshopify.com origin.
export const outboundAgent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connections: 32,
});

export async function closeOutboundAgent() {
  await outboundAgent.close();
}
