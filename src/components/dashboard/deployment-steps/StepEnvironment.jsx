import { memo, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../common/CustomSelect';

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};

// Moved outside component to prevent recreation on every render
const PARAMETER_DESCRIPTIONS = {
  COMMUNITY: 'List your server in the in-game community server browser so anyone can find it. Leave as false for a private server — you can still share your address directly. If you enable it, set a Server Password in the dashboard Config tab unless you want the server open to everyone.',
  TYPE: 'Server configuration type.',
  DIFFICULTY: 'Game difficulty level (peaceful, easy, normal, hard). Affects mob damage, hunger, and spawn rates.',
  GAME_MODE: 'Default game mode for players: survival, creative, adventure, or spectator.',
  GAMEMODE: 'Default game mode for players: survival, creative, adventure, or spectator.',
  MODE: 'Server game mode setting.',
  MAX_PLAYERS: 'Maximum number of players allowed online simultaneously. We never cap this — set it to whatever you need, and change it any time from the dashboard.',
  PVP: 'Enable (TRUE) or disable (FALSE) player vs player combat.',
  ENABLE_WHITELIST: 'If TRUE, only whitelisted players can join. Manage whitelist via server console.',
  ALLOW_FLIGHT: 'Allow flight in survival mode. Usually FALSE to prevent cheating.',
  WORLD_SEED: 'Seed for world generation. Use a specific number for reproducible worlds, or leave blank for random.',
  LEVEL_NAME: 'Name of the world folder. Default is "world".',
  LEVEL_TYPE: 'World type: DEFAULT, FLAT, LARGEBIOMES, AMPLIFIED, or CUSTOMIZED.',
  GENERATE_STRUCTURES: 'Generate villages, temples, strongholds. Usually TRUE.',
  VIEW_DISTANCE: 'Render distance in chunks (3-32). Higher values require more RAM. Recommended: 10 for 4GB, 12 for 8GB.',
  SIMULATION_DISTANCE: 'Distance mobs and farms work (chunks). Lower = better performance.',
  MOTD: 'Message of the Day shown in server list. Supports color codes with &.',
  SERVER_NAME: 'Server name displayed to players.',
  SERVER_PORT: 'Server port number. Default 25565. Change only if needed.',
  RCON_PASSWORD: 'Remote console password. IMPORTANT: Use a strong password! Used for remote admin access.',
  OPS: 'Comma-separated list of operator (admin) usernames.',
  ENABLE_RCON: 'Enable remote console. Set to TRUE if you need remote management.',
  SPAWN_PROTECTION: 'Radius around spawn where only OPs can build/break (blocks). 0 disables.',
  ENABLE_COMMAND_BLOCK: 'Allow command blocks for custom commands and redstone logic. Usually FALSE for survival servers to prevent exploits.',
  'ENABLE_COMMAND_BLOCK\t': 'Allow command blocks for custom commands and redstone logic. Usually FALSE for survival servers to prevent exploits.',
  SPAWN_NPCS: 'Spawn villagers and other NPCs.',
  SPAWN_ANIMALS: 'Spawn passive animals (cows, pigs, chickens).',
  SPAWN_MONSTERS: 'Spawn hostile mobs (zombies, skeletons, etc). Set FALSE for a peaceful server without enemies.',
  HARDCORE: 'Hardcore mode - when a player dies, they are permanently banned from the server. Extremely difficult!',
  ALLOW_NETHER: 'Allow players to travel to the Nether dimension. Disable to restrict gameplay to the Overworld only.',
  ALLOW_CHEATS: 'Allow players to use cheat commands like teleport, give items, and change time.',
  ONLINE_MODE: 'Verify player accounts with Xbox Live. FALSE allows cracked/offline clients but reduces security.',
  DEFAULT_PLAYER_PERMISSION_LEVEL: 'Default permission for new players: visitor (read-only), member (normal play), operator (full admin).',
  FORCE_GAMEMODE: 'Force players to join in default gamemode (prevents keeping creative items).',
  VERSION: 'Game version (uses latest by default).',
  MODPACK: 'URL or name of modpack to install (for FORGE/FABRIC servers).',
  PLUGINS: 'Comma-separated list of plugins to install (for PAPER/SPIGOT).',
  API_KEY: '⚠️ SENSITIVE: API key for external integrations. Never share this!',
  SECRET_KEY: '⚠️ SENSITIVE: Secret key for authentication. Keep private!',
  TOKEN: '⚠️ SENSITIVE: Authentication token. Do not expose!',
};

const StepEnvironment = memo(({
  direction = 1,
  selectedPlan,
  environmentParams,
  onEnvironmentParamsChange,
  showAdvanced,
  onShowAdvancedToggle,
  onBack,
  onContinue
}) => {
  const userEnvParams = selectedPlan?._app?.compose?.[0]?.userEnvironmentParameters;
  const regularParams = userEnvParams?.filter(param => !param.advanced) || [];
  const advancedParams = userEnvParams?.filter(param => param.advanced) || [];

  return (
    <motion.div
      key="step3"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="text-center pb-3">
        <h3 className="text-xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent mb-2">
          Environment Parameters
        </h3>
        <p className="text-sm text-gray-400">Configure your server environment settings</p>
      </div>

      {userEnvParams ? (
        <div className="space-y-4">
          {regularParams.map(param => {
            const dropdownValues = param.values || param.parameterConfig?.values || null;
            const hasDropdown = dropdownValues && Array.isArray(dropdownValues) && dropdownValues.length > 0;
            const defaultValue = param.defaultValue || param.parameterConfig?.defaultValue || '';

            return (
              <div key={param.name} className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-4 shadow-lg shadow-black/20">
                <label htmlFor={param.name} className="block text-sm font-semibold text-white mb-2">
                  {param.label || param.name}
                  {!param.optional && <span className="text-red-400 ml-1">*</span>}
                  {param.optional && <span className="ml-2 text-xs text-gray-500 font-normal">(Optional)</span>}
                  {defaultValue && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">(Default: {defaultValue})</span>
                  )}
                </label>
                {hasDropdown ? (
                  <CustomSelect
                    id={param.name}
                    value={environmentParams[param.name] || ''}
                    onChange={(e) => onEnvironmentParamsChange({
                      ...environmentParams,
                      [param.name]: e.target.value
                    })}
                    options={dropdownValues.map(val => ({ value: val, label: val }))}
                    placeholder={defaultValue ? `Select or use default (${defaultValue})` : `Select ${param.label || param.name}`}
                    required={!param.optional}
                    className="w-full"
                  />
                ) : (
                  <input
                    type="text"
                    id={param.name}
                    value={environmentParams[param.name] || ''}
                    onChange={(e) => onEnvironmentParamsChange({
                      ...environmentParams,
                      [param.name]: e.target.value
                    })}
                    placeholder={param.placeholder || ''}
                    required={!param.optional}
                    className="input w-full"
                  />
                )}
                {PARAMETER_DESCRIPTIONS[param.name] && (
                  <p className="text-xs text-gray-400 mt-2 flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{PARAMETER_DESCRIPTIONS[param.name]}</span>
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-xl px-4 py-3 border border-gray-700/30">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500/20 to-yellow-500/20 rounded-lg p-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Advanced Options</div>
                <div className="text-xs text-gray-400">
                  {advancedParams.length > 0
                    ? 'Optional configuration parameters'
                    : 'No advanced options available'}
                </div>
              </div>
            </div>
            {advancedParams.length > 0 ? (
              <button
                type="button"
                onClick={onShowAdvancedToggle}
                className={`px-4 py-2 rounded-lg font-semibold text-xs transition-[background-color,color,box-shadow] duration-200 ${
                  showAdvanced
                    ? 'bg-gradient-to-r from-blue-600 to-yellow-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700/70'
                }`}
              >
                {showAdvanced ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Hide
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show
                  </span>
                )}
              </button>
            ) : (
              <span className="px-4 py-2 rounded-lg bg-gray-800/50 text-gray-500 text-xs font-semibold border border-gray-700/30">
                None
              </span>
            )}
          </div>

          {advancedParams.length > 0 && (
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  {advancedParams.map(param => {
                    const dropdownValues = param.values || param.parameterConfig?.values || null;
                    const hasDropdown = dropdownValues && Array.isArray(dropdownValues) && dropdownValues.length > 0;
                    const defaultValue = param.defaultValue || param.parameterConfig?.defaultValue || '';

                    return (
                      <div key={param.name} className="bg-gradient-to-br from-blue-900/20 to-yellow-900/20 border-2 border-blue-700/30 rounded-xl p-4 shadow-lg shadow-blue-900/10">
                        <label htmlFor={param.name} className="block text-sm font-semibold text-white mb-2">
                          {param.label || param.name}
                          {!param.optional && <span className="text-red-400 ml-1">*</span>}
                          {param.optional && <span className="ml-2 text-xs text-blue-400 font-normal">(Optional)</span>}
                          {defaultValue && (
                            <span className="ml-2 text-xs text-blue-400 font-normal">(Default: {defaultValue})</span>
                          )}
                        </label>
                        {hasDropdown ? (
                          <CustomSelect
                            id={param.name}
                            value={environmentParams[param.name] || ''}
                            onChange={(e) => onEnvironmentParamsChange({
                              ...environmentParams,
                              [param.name]: e.target.value
                            })}
                            options={dropdownValues.map(val => ({ value: val, label: val }))}
                            placeholder={defaultValue ? `Use default (${defaultValue})` : 'Select option'}
                            required={!param.optional}
                            className="w-full"
                          />
                        ) : (
                          <input
                            type="text"
                            id={param.name}
                            value={environmentParams[param.name] || ''}
                            onChange={(e) => onEnvironmentParamsChange({
                              ...environmentParams,
                              [param.name]: e.target.value
                            })}
                            placeholder={param.placeholder || ''}
                            required={!param.optional}
                            className="input w-full"
                          />
                        )}
                        {PARAMETER_DESCRIPTIONS[param.name] && (
                          <p className="text-xs text-gray-400 mt-2 flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{PARAMETER_DESCRIPTIONS[param.name]}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-8 text-center shadow-lg shadow-black/20">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-base">
            No environment configuration required for this server.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            You can proceed to the next step.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4 relative z-0">
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary flex-1"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary flex-1"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
});

StepEnvironment.displayName = 'StepEnvironment';

export default StepEnvironment;
