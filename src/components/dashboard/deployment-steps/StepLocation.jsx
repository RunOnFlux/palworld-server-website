import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import CustomSelect from '../../common/CustomSelect';

const stepVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -20 : 20 }),
};

const StepLocation = memo(({
  direction = 1,
  geolocationForm,
  onGeolocationFormChange,
  availableContinents,
  availableCountries,
  allowedLocations,
  onAddLocation,
  onRemoveLocation,
  formatLocationLabel,
  getFlagIcon,
  onBack,
  onContinue
}) => {
  // Check if continent is already allowed (whole continent added)
  const continentAllowed = allowedLocations.includes(`ac${geolocationForm.continent}`);

  // Memoize continent options, filter out already-added continents
  const continentOptions = useMemo(() => [
    { value: '', label: 'Select Continent' },
    ...availableContinents.filter(cont => !allowedLocations.includes(`ac${cont.code}`)).map(cont => ({
      value: cont.code,
      label: cont.name,
      nodeCount: cont.nodeCount,
      ipCount: cont.ipCount
    }))
  ], [availableContinents, allowedLocations]);

  // Memoize country options — hide if whole continent is added, filter out already-added countries
  const countryOptions = useMemo(() => {
    if (continentAllowed) return [{ value: '', label: 'Entire continent already added' }];
    const filtered = availableCountries.filter(country => {
      const geoCode = `ac${geolocationForm.continent}_${country.code}`;
      return !allowedLocations.includes(geoCode);
    });
    return [
      { value: '', label: 'Any Country' },
      ...filtered.map(country => ({
        value: country.code,
        label: country.name,
        nodeCount: country.nodeCount,
        ipCount: country.ipCount,
        flag: getFlagIcon(country.code)
      }))
    ];
  }, [availableCountries, getFlagIcon, allowedLocations, geolocationForm.continent, continentAllowed]);

  return (
    <motion.div
      key="step4"
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <h3 className="text-base font-semibold text-white mb-3">Server Location</h3>

      <div className="space-y-3">
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-4 shadow-lg shadow-black/20">
          <h4 className="font-bold text-white mb-3 text-lg">Add Allowed Locations</h4>
          <p className="text-sm text-gray-400 mb-3">
            Select specific continents or countries where your server can be deployed. Leave empty for global deployment.
          </p>

          <div className="flex items-start gap-2.5 px-3 py-2.5 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Icon icon="heroicons:light-bulb" className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-amber-300">Tip:</span> add several locations to give your
              deployment more distinct hosts to land on. Each server instance needs its own public IP, so the
              <span className="font-medium"> IP count</span> — not the node count — is what guarantees a successful
              deploy, and more choices means a faster one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="continent" className="block text-sm font-medium text-text mb-2">
                Continent
              </label>
              <CustomSelect
                id="continent"
                value={geolocationForm.continent}
                onChange={(e) => onGeolocationFormChange({ continent: e.target.value, country: '' })}
                options={continentOptions}
                placeholder="Select Continent"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-text mb-2">
                Country (Optional)
              </label>
              <CustomSelect
                id="country"
                value={geolocationForm.country}
                onChange={(e) => onGeolocationFormChange({ ...geolocationForm, country: e.target.value })}
                options={countryOptions}
                placeholder="Any Country"
                disabled={!geolocationForm.continent}
                className="w-full"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onAddLocation}
            disabled={!geolocationForm.continent}
            className="btn-secondary w-full"
          >
            + Add Location
          </button>
        </div>

        {allowedLocations.length > 0 && (
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-2 border-gray-700/50 rounded-xl p-4 shadow-lg shadow-black/20">
            <h4 className="font-bold text-white mb-3 text-base">Allowed Locations ({allowedLocations.length})</h4>
            <div className="flex flex-wrap items-center gap-2">
              {allowedLocations.map(geoCode => (
                <span
                  key={geoCode}
                  className="inline-flex items-center gap-1.5 bg-blue-900/30 rounded-full px-3 py-1.5 border border-blue-500/30 text-sm leading-5 text-blue-300 font-medium"
                >
                  {geoCode.replace(/^ac/, '').includes('_') ? (
                    <Icon icon={getFlagIcon(geoCode.replace(/^ac/, '').split('_')[1])} width="18" height="13" className="rounded-sm flex-shrink-0" />
                  ) : (
                    <Icon icon={{ EU: 'heroicons:globe-europe-africa', AF: 'heroicons:globe-europe-africa', NA: 'heroicons:globe-americas', SA: 'heroicons:globe-americas', AS: 'heroicons:globe-asia-australia', OC: 'heroicons:globe-asia-australia' }[geoCode.replace(/^ac/, '')] || 'heroicons:globe-americas'} width="18" height="18" className="flex-shrink-0 text-blue-400" />
                  )}
                  {formatLocationLabel(geoCode)}
                  <button
                    type="button"
                    onClick={() => onRemoveLocation(geoCode)}
                    className="p-0.5 rounded-full text-blue-400/60 hover:text-red-400 hover:bg-red-500/20 !transition-none"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {allowedLocations.length === 0 && (
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-2xl p-5">
            <p className="text-sm text-blue-300 flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No locations specified. Your server will be deployed globally (any available location).</span>
            </p>
          </div>
        )}
      </div>

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

StepLocation.displayName = 'StepLocation';

export default StepLocation;
