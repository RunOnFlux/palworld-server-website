import { useClientLatency, nodeTargetFor, latencyClass, LATENCY_TOOLTIP } from '../../utils/clientLatency';

/**
 * The latency figure for one server, measured client-side. It is a component rather than a
 * helper because the dashboard renders servers in a map, and hooks cannot run inside one.
 */
export default function ClientLatencyValue({ server, enabled = true, className = '' }) {
  const { host, port } = nodeTargetFor(server);
  const { latency, measuring } = useClientLatency(host, port, { enabled });

  if (!enabled || (!latency && !measuring)) {
    return <span className={`text-gray-600 ${className}`}>-</span>;
  }

  if (!latency) {
    return <span className={`text-xs text-gray-500 ${className}`}>Measuring...</span>;
  }

  return (
    <span className={`${latencyClass(latency)} ${className}`} title={LATENCY_TOOLTIP}>
      {latency}ms
    </span>
  );
}
