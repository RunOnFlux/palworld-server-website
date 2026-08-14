// A volume file operation answers in more than one shape, and two of the shapes
// are not failures.
//
//   200 - finished inline. The node's envelope can still report an application
//         error inside it, so the body is read rather than the status alone.
//   202 - outlived the node's inline deadline and continues as a job. The body
//         carries a jobId to poll; treating it as finished reports a file gone
//         while it is still being removed.
//   503 - busy, not broken. Either another operation is running for this app
//         (the node runs one at a time) or it is still fetching the image the
//         work runs in. `fetch` does not throw on it, so an unchecked call
//         swallows the refusal entirely.
//
// The node's contract is in FluxOS `ZelBack/src/services/utils/jobRegistry.js`.

// Spelled as the node spells them: one L in Canceled. Evicted is the node
// taking the work away, which is neither a failure of the request nor something
// the caller asked for.
const TERMINAL_STATUSES = ['Succeeded', 'Failed', 'Canceled', 'Evicted'];

const DEFAULT_RETRY_SECONDS = 5;
const DEFAULT_POLL_SECONDS = 2;
const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1000;

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function secondsFrom(headerValue, fallback) {
  const seconds = Number(headerValue);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}

/**
 * Reads a volume operation response once and says which of the shapes it is.
 *
 * The body is consumed here and nowhere else - a Response can only be read
 * once, so every caller goes through this rather than checking `res.ok` and
 * then reaching for `res.json()` again.
 *
 * @returns {{state: 'done'|'job'|'busy'|'error', ...}}
 */
export async function readVolumeResponse(res) {
  const body = await res.json().catch(() => null);
  const payload = body?.data ?? null;

  if (res.status === 503) {
    const seconds = secondsFrom(res.headers.get('retry-after'), DEFAULT_RETRY_SECONDS);
    const running = payload?.operation?.kind
      ? String(payload.operation.kind).split('.').pop()
      : null;

    return {
      state: 'busy',
      retryAfterSeconds: seconds,
      message: running
        ? `A ${running} is already running for this server. Try again in ${seconds} seconds.`
        : `The node is busy. Try again in ${seconds} seconds.`,
    };
  }

  if (res.status === 202 && payload?.jobId) {
    return {
      state: 'job',
      job: {
        jobId: payload.jobId,
        statusUrl: payload.statusUrl || `/apps/operations/${payload.jobId}`,
      },
    };
  }

  if (!res.ok) {
    return {
      state: 'error',
      code: payload?.code ?? null,
      message: payload?.message || `HTTP ${res.status}`,
    };
  }

  if (body?.status === 'error') {
    return {
      state: 'error',
      code: payload?.code ?? null,
      message: payload?.message || 'The operation failed.',
    };
  }

  return { state: 'done' };
}

/**
 * Polls a job to a terminal state and returns the node's terminal view.
 *
 * Completion is read from the status field and never from the HTTP code: a job
 * that failed is a 200 whose status says Failed.
 */
export async function pollOperation(base, authHeader, job, options = {}) {
  const { timeoutMs = DEFAULT_POLL_TIMEOUT_MS } = options;
  const giveUpAt = Date.now() + timeoutMs;

  for (;;) {
    const res = await fetch(`${base}${job.statusUrl}`, { headers: { zelidauth: authHeader } });
    if (!res.ok) throw new Error(`Could not read the operation (HTTP ${res.status})`);

    const body = await res.json().catch(() => null);
    const view = body?.data ?? {};

    if (TERMINAL_STATUSES.includes(view.status)) return view;

    if (Date.now() >= giveUpAt) {
      throw new Error('The operation is taking longer than expected. It is still running on the node.');
    }

    await delay(secondsFrom(res.headers.get('retry-after'), DEFAULT_POLL_SECONDS) * 1000);
  }
}

/** The message for a job that reached a terminal state other than Succeeded. */
export function jobFailureMessage(view) {
  return view.error?.detail || view.error?.title || `The operation did not finish (${view.status}).`;
}
