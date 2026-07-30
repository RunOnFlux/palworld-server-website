import { memo } from 'react';
import { Clock } from 'lucide-react';
import PropTypes from 'prop-types';
import CustomSelect from '../common/CustomSelect';
import {
  timeZoneOptions,
  formatHour,
  describeNextReboot,
  REBOOT_WARN_MINUTES,
} from '../../config/serverMaintenance';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: formatHour(h) }));

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
    style={{
      background: checked ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(51,65,85,0.5)',
      boxShadow: checked ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
    }}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 mt-0.5 ml-0.5 ${
      checked ? 'translate-x-5' : 'translate-x-0'
    }`} />
  </button>
);

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
};

/**
 * Automatic-restart controls, shared by the deploy wizard and the dashboard's
 * Deployment Settings tab so both write the exact same env vars.
 *
 * The schedule is expressed in the customer's own time zone (prefilled from the
 * browser) because the container otherwise runs on UTC — see serverMaintenance.js.
 */
const AutoRestartFields = memo(({ settings, onChange }) => {
  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-4 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-2 flex-shrink-0">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Automatic restarts</div>
            <p className="text-xs text-gray-400 mt-1">
              Palworld servers slowly leak memory and eventually stop accepting players even though
              they are still running. A daily restart clears it. Your world is saved first, and
              players get a {REBOOT_WARN_MINUTES}-minute warning in-game.
            </p>
          </div>
        </div>
        <Toggle
          checked={!!settings.enabled}
          onChange={(v) => set({ enabled: v })}
          label="Enable automatic restarts"
        />
      </div>

      {settings.enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label htmlFor="autoRestartHour" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Restart time
              </label>
              <CustomSelect
                id="autoRestartHour"
                value={String(settings.hour)}
                onChange={(e) => set({ hour: Number(e.target.value) })}
                options={HOUR_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="autoRestartTz" className="block text-xs font-semibold text-gray-300 mb-1.5">
                Time zone
              </label>
              <CustomSelect
                id="autoRestartTz"
                value={settings.timeZone}
                onChange={(e) => set({ timeZone: e.target.value })}
                options={timeZoneOptions(settings.timeZone)}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-3 rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">Restart even if players are online</div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Off means a busy server is skipped that day — safer for players, but the restart may
                never happen on a server that is always in use.
              </p>
            </div>
            <Toggle
              checked={!!settings.force}
              onChange={(v) => set({ force: v })}
              label="Restart even if players are online"
            />
          </div>

          <p className="text-[11px] text-blue-300/80 mt-2.5">{describeNextReboot(settings)}</p>
        </>
      )}
    </div>
  );
});

AutoRestartFields.propTypes = {
  settings: PropTypes.shape({
    enabled: PropTypes.bool,
    hour: PropTypes.number,
    timeZone: PropTypes.string,
    force: PropTypes.bool,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

AutoRestartFields.displayName = 'AutoRestartFields';

export default AutoRestartFields;
