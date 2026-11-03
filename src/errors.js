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

const NAMES = { openai: 'OpenAI', anthropic: 'Anthropic', ollama: 'Ollama' };
const BILLING = {
  openai: 'platform.openai.com → Billing',
  anthropic: 'platform.claude.com → Billing',
};

// turns raw API / network errors into messages a user can act on
function friendlyError(err, provider = 'openai') {
  const status = err?.status;
  const code = err?.code || err?.error?.code;
  const causeCode = err?.cause?.code || err?.cause?.cause?.code;
  const errName = err?.constructor?.name || err?.name;
  const name = NAMES[provider] || 'the AI service';
  const isConnectionError =
    errName === 'APIConnectionError' || NETWORK_ERRORS.includes(causeCode);

  if (code === 'MODEL_REFUSED')
    return 'Claude declined to edit this text. Try rewording it, or pick another model in Settings.';

  // local server: nothing to pay for, but it has to be running and have the model
  if (provider === 'ollama') {
    if (isConnectionError || errName === 'TypeError')
      return "Ollama isn't running. Open the Ollama app (or run `ollama serve`), then retry.";
    if (status === 404 || code === 'OLLAMA_MODEL_MISSING')
      return "That model isn't installed. Run `ollama pull <model>` in Terminal, or pick another in Settings.";
  }

  if (status === 401)
    return 'Your API key is invalid or was revoked. Update it in Settings.';
  // OpenAI reports this as 429 insufficient_quota, Anthropic as a 400 about the credit balance
  if (
    (status === 429 && code === 'insufficient_quota') ||
    (status === 400 && /credit balance/i.test(err?.message || ''))
  ) {
    return `You're out of ${name} credit. Add credit at ${BILLING[provider] || 'your provider'}.`;
  }
  if (status === 429)
    return 'Too many requests right now. Wait a few seconds and retry.';
  if (status === 404)
    return 'The AI model is unavailable (it may have been retired). Pick another in Settings.';
  if (status >= 500)
    return `${name} is having problems right now. Please retry in a moment.`;

  if (
    errName === 'APIConnectionTimeoutError' ||
    /timed? ?out/i.test(err?.message || '')
  ) {
    return 'The request took too long. Please retry.';
  }
  if (CERT_ERRORS.includes(causeCode)) {
    return 'A network security tool (like Zscaler) is blocking the connection. Ask IT, try another network, or switch to a local Ollama model.';
  }
  if (isConnectionError) {
    return `Can't reach ${name}. Check your internet connection.`;
  }
  if (err instanceof SyntaxError)
    return 'Got an unexpected reply from the AI. Please retry.';

  return err?.message || 'Something went wrong. Please retry.';
}

module.exports = { friendlyError };
