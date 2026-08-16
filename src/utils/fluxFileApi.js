/**
 * Reading a Flux node's answers to a file operation on an app volume.
 *
 * These endpoints answer in three shapes and the dashboard read one of them:
 *
 *   200 - the work finished while the request was open, and the body carries the result.
 *   202 - the work outlived the node's inline deadline and continues as a job. The body
 *         carries a jobId to poll. Treating it as finished announces a file deleted while
 *         it is still on disk, and reloads a listing that still contains it.
 *   503 - the node is busy, not broken: a volume runs one operation at a time, and the
 *         node may still be fetching the image the work runs in.
 *
 * The trap is the fourth shape. A REFUSAL - no permission, a name already taken, a path
 * that does not exist - comes back as HTTP 200 with `status: 'error'` in the body. So
 * `res.ok` is true for a request that did nothing at all, and a caller that checks only
 * the status code carries on as though the work happened. That is how a mod toggle could
 * report success while both mods stayed enabled.
 *
 * Everything here goes through runFileOperation, which throws on all four failure shapes
 * with the node's own sentence, and returns only once the work has actually finished.
 */

/** A job has stopped moving when it reaches one of these. One L in Canceled, as the node spells it. */
const TERMINAL_STATUSES = ['Succeeded', 'Failed', 'Canceled', 'Evicted'];

/** What to wait when the node asks us to come back without saying how long. */
const DEFAULT_RETRY_SECONDS = 5;
const DEFAULT_POLL_SECONDS = 2;

/** A job that outlives this has stopped being something to hold a spinner for. */
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every failure shape arrives as one of these. `status` carries the HTTP code so callers
 * that turn 401/403 into a re-login prompt can still recognise one, and `code` the node's
 * own error code where it sent one - `ENOENT` is how a missing folder arrives.
 */
export class FluxFileError extends Error {
  constructor(message, status, code = null) {
    super(message);
    this.name = 'FluxFileError';
    this.status = status;
    this.code = code;
  }
}

/** `fileoperation.remove` -> `remove`: the tail is the part worth showing someone. */
function operationLabel(operation) {
  if (!operation?.kind) return null;

  return String(operation.kind).split('.').pop();
}

function retryAfterSeconds(res, fallback) {
  const header = Number(res.headers.get('retry-after'));

  return Number.isFinite(header) && header > 0 ? header : fallback;
}

async function readBody(res) {
  return res.json().catch(() => ({}));
}

/** The node puts its sentence in `data.message`, or makes `data` the sentence itself. */
function messageFrom(body, fallback) {
  const data = body?.data;
  if (typeof data === 'string') return data;

  return data?.message || fallback;
}

/**
 * Follow a job the node kept, and settle when it does.
 *
 * Completion is read from the status field and never from the HTTP code: a job that
 * failed is a 200 whose status says Failed.
 */
async function awaitOperation(base, statusUrl, zelidauth) {
  const giveUpAt = Date.now() + POLL_TIMEOUT_MS;

  for (;;) {
    const res = await fetch(`${base}${statusUrl}`, {
      cache: 'no-store',
      headers: { zelidauth, 'x-apicache-bypass': true },
    });
    const body = await readBody(res);

    if (!res.ok || body.status === 'error') {
      throw new FluxFileError(messageFrom(body, `Could not read the operation (HTTP ${res.status})`), res.status);
    }

    const view = body.data ?? {};
    if (view.status === 'Succeeded') return view;

    if (TERMINAL_STATUSES.includes(view.status)) {
      throw new FluxFileError(
        view.error?.detail || view.error?.title || `The operation ${String(view.status).toLowerCase()}`,
        res.status,
      );
    }

    if (Date.now() >= giveUpAt) {
      throw new FluxFileError('The operation is taking longer than expected and is still running on the server.', res.status);
    }

    await delay(retryAfterSeconds(res, DEFAULT_POLL_SECONDS) * 1000);
  }
}

/**
 * Run one file operation against a node and resolve only when it has finished.
 *
 * @param {string} base - node API origin, e.g. https://1-2-3-4-16127.node.api.runonflux.io
 * @param {string} path - the endpoint path, already encoded
 * @param {string} zelidauth - the auth header value, already serialised
 * @returns {Promise<object>} the node's data for a request that finished inline, or the
 *   terminal job view for one that continued in the background
 */
export async function runFileOperation(base, path, zelidauth) {
  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    headers: { zelidauth, 'x-apicache-bypass': true },
  });
  const body = await readBody(res);

  if (res.status === 503) {
    const running = operationLabel(body.data?.operation);
    const seconds = retryAfterSeconds(res, DEFAULT_RETRY_SECONDS);

    throw new FluxFileError(running
      ? `The server is busy with a ${running} on this volume — try again in ${seconds}s.`
      : `The server is busy — try again in ${seconds}s.`, 503);
  }

  if (!res.ok && res.status !== 202) {
    throw new FluxFileError(messageFrom(body, `Request failed (HTTP ${res.status})`), res.status);
  }

  if (body.status === 'error') {
    throw new FluxFileError(messageFrom(body, 'The server refused the request'), res.status, body.data?.code ?? null);
  }

  const job = res.status === 202 ? body.data : null;
  if (!job?.jobId) return body.data;

  return awaitOperation(base, job.statusUrl || `/apps/operations/${job.jobId}`, zelidauth);
}
