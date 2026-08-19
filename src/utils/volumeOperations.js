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

// A Retry-After is a hint from the node, and the timeout is only as strong as
// the longest thing that can be slept on the strength of one. Capped so an
// absurd value cannot park the poll for hours past the deadline it was given.
const MAX_POLL_INTERVAL_SECONDS = 30;

// A poll that cannot be read is not a failed operation. The node.api proxy
// answers 502 under load and a restarted node forgets its jobs, so a single bad
// read says nothing about whether the work is still going - only a run of them
// does.
const MAX_CONSECUTIVE_POLL_FAILURES = 3;

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function secondsFrom(headerValue, fallback, max = Infinity) {
  const seconds = Number(headerValue);

  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, max) : fallback;
}

/**
 * The path a job is polled at.
 *
 * The node offers one in the body, and it is used only when it is a path on the
 * node we already called. Taken as given, `@elsewhere` would make
 * `${base}${statusUrl}` a URL whose host is somebody else's, and the zelidauth
 * header would go there with it. `//host` is the same trick without the userinfo.
 */
function statusPathFor(payload) {
  const offered = payload?.statusUrl;

  return typeof offered === 'string' && offered.startsWith('/') && !offered.startsWith('//')
    ? offered
    : `/apps/operations/${payload.jobId}`;
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
        statusUrl: statusPathFor(payload),
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
  let failures = 0;
  let lastFailure = null;

  for (;;) {
    let waitSeconds = DEFAULT_POLL_SECONDS;

    try {
      const res = await fetch(`${base}${job.statusUrl}`, { headers: { zelidauth: authHeader } });
      if (!res.ok) throw new Error(`Could not read the operation (HTTP ${res.status})`);

      const body = await res.json().catch(() => null);
      const view = body?.data ?? {};

      if (TERMINAL_STATUSES.includes(view.status)) return view;

      failures = 0;
      waitSeconds = secondsFrom(res.headers.get('retry-after'), DEFAULT_POLL_SECONDS, MAX_POLL_INTERVAL_SECONDS);
    } catch (error) {
      failures += 1;
      lastFailure = error;
      // Thrown as it arrived when it is the master node itself that has gone:
      // callers read a TypeError as "this node is no longer the master" and go
      // looking for the new one, and wrapping it takes that away from them.
      if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) throw lastFailure;
    }

    if (Date.now() >= giveUpAt) {
      throw new Error('The operation is taking longer than expected. It is still running on the node.');
    }

    await delay(waitSeconds * 1000);
  }
}

/**
 * Whether a refused operation was refused because the name is already taken.
 *
 * Two shapes, because the node that answers is not necessarily the one this was
 * written against. FluxOS #1778 attaches `EEXIST`; a node without it reports
 * whatever `mkdir` said, with the exit status where the code should be - so the
 * wording is all there is to go on there. Wording is the weaker signal and is
 * only consulted when there is no code to read.
 */
export function isAlreadyExists(outcome) {
  if (outcome?.code === 'EEXIST') return true;

  return typeof outcome?.message === 'string' && /(already exists|file exists)/i.test(outcome.message);
}

/** The message for a job that reached a terminal state other than Succeeded. */
export function jobFailureMessage(view) {
  return view.error?.detail || view.error?.title || `The operation did not finish (${view.status}).`;
}

/**
 * The first `{"status":"error"}` envelope inside a body that is not a document.
 *
 * Brace-counted rather than parsed from the first `{`, because an upload's body
 * is a concatenation with the envelope somewhere in it, and string-aware
 * because the node's own sentence may carry a brace.
 */
function errorEnvelopeIn(text) {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
      } else if (inString) {
        if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const candidate = JSON.parse(text.slice(start, i + 1));
            if (candidate?.status === 'error') return candidate;
          } catch { /* not an envelope - keep looking */ }
          break;
        }
      }
    }
  }

  return null;
}

/**
 * Reads an upload's answer, which its status code does not carry.
 *
 * `ioutils/fileupload` streams progress down the body as the bytes arrive, so
 * the status line is spent long before the outcome is known. A refusal that
 * arrives after that is written INTO the body as an error envelope and the
 * response stays 200 - so `res.ok` is true for an upload that never landed.
 * FluxOS `IOUtils.fileUpload` does this today, and the
 * `fileSystemManager.uploadAppsFiles` that replaces it in #1778 keeps the shape
 * for anything that fails once the body has started.
 *
 * The body is a concatenation rather than a document - `[received,total]` on
 * every progress tick, the field name as each part completes, the envelope if
 * it fails - so it is scanned rather than parsed.
 *
 * Reading it to the end is also what makes the upload FINISHED. `fetch`
 * resolves when the headers arrive, and on this endpoint the headers go out
 * with the first progress tick - so a caller that only reads `res.ok` carries
 * on while the file is still being written.
 *
 * #1778 answers properly while nothing has been written yet: a 503 with a
 * Retry-After for a busy volume, a 200 envelope for a refusal. Both are read.
 *
 * @returns {{state: 'done'|'busy'|'error', ...}} the shape readVolumeResponse uses.
 */
export async function readUploadResponse(res) {
  const text = await res.text().catch(() => '');
  const envelope = errorEnvelopeIn(text);

  if (res.status === 503) {
    const seconds = secondsFrom(res.headers.get('retry-after'), DEFAULT_RETRY_SECONDS);
    const kind = envelope?.data?.operation?.kind;
    const running = kind ? String(kind).split('.').pop() : null;

    return {
      state: 'busy',
      retryAfterSeconds: seconds,
      message: running
        ? `A ${running} is already running for this server. Try again in ${seconds} seconds.`
        : `The node is busy. Try again in ${seconds} seconds.`,
    };
  }

  if (envelope) {
    return {
      state: 'error',
      code: envelope.data?.code ?? null,
      message: envelope.data?.message || 'The upload did not finish.',
    };
  }

  if (!res.ok) {
    return { state: 'error', code: null, message: text.trim() || `HTTP ${res.status}` };
  }

  return { state: 'done' };
}

/**
 * The node's sentence when an upload body carries a refusal, or null.
 *
 * For callers holding the text already - the XHR uploads, which use XHR for
 * their progress events and so have `responseText` rather than a Response.
 */
export function uploadFailureIn(text) {
  const envelope = errorEnvelopeIn(String(text || ''));

  return envelope ? (envelope.data?.message || 'The upload did not finish.') : null;
}
