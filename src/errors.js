const CERT_ERRORS = [
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
];
const NETWORK_ERRORS = [
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
];

// turns raw API / network errors into messages a user can act on
function friendlyError(err) {
  const status = err?.status;
  const code = err?.code || err?.error?.code;
  const causeCode = err?.cause?.code || err?.cause?.cause?.code;
  const name = err?.constructor?.name || err?.name;

  if (status === 401)
    return 'Your API key is invalid or was revoked. Update it in Settings.';
  if (status === 429 && code === 'insufficient_quota') {
    return "You're out of OpenAI credit. Add credit at platform.openai.com → Billing.";
  }
  if (status === 429)
    return 'Too many requests right now. Wait a few seconds and retry.';
  if (status === 404)
    return 'The AI model is unavailable (it may have been retired). Check for an app update.';
  if (status >= 500)
    return 'OpenAI is having problems right now. Please retry in a moment.';

  if (
    name === 'APIConnectionTimeoutError' ||
    /timed? ?out/i.test(err?.message || '')
  ) {
    return 'The request took too long. Please retry.';
  }
  if (CERT_ERRORS.includes(causeCode)) {
    return 'A network security tool (like Zscaler) is blocking the connection. Ask IT, or try another network.';
  }
  if (name === 'APIConnectionError' || NETWORK_ERRORS.includes(causeCode)) {
    return "Can't reach OpenAI. Check your internet connection.";
  }
  if (err instanceof SyntaxError)
    return 'Got an unexpected reply from the AI. Please retry.';

  return err?.message || 'Something went wrong. Please retry.';
}

module.exports = { friendlyError };
