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
  availableRegions = [],
  allowedLocations,
  onAddLocation,
  onRemoveLocation,
  formatLocationLabel,
  getFlagIcon,
  capacity = null,
  onBack,
  onContinue,
  showNav = true
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

  // Check if the selected country is already allowed as a whole
  const countryAllowed = allowedLocations.includes(`ac${geolocationForm.continent}_${geolocationForm.country}`);

  // Region options. The parent only sends regions when the selected country
  // genuinely splits into several viable ones, so an empty list means this
  // country has nothing useful to narrow down and the field stays hidden.
  const regionOptions = useMemo(() => {
    if (countryAllowed) return [{ value: '', label: 'Entire country already added' }];
    const base = `ac${geolocationForm.continent}_${geolocationForm.country}_`;
    const filtered = availableRegions.filter(r => !allowedLocations.includes(`${base}${r.code}`));
    return [
      { value: '', label: 'Any Region' },
      ...filtered.map(region => ({
        value: region.code,
        label: region.name,
        nodeCount: region.nodeCount,
        ipCount: region.ipCount
      }))
    ];
  }, [availableRegions, allowedLocations, geolocationForm.continent, geolocationForm.country, countryAllowed]);

  const showRegions = !!geolocationForm.country && availableRegions.length > 0;

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

          {/* Two lines: the advice, then why it works. Split so the point is readable at a
              glance instead of being buried in a four-line paragraph. */}
          <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex-shrink-0">
              <Icon icon="heroicons:light-bulb" className="w-5 h-5 text-amber-400" />
            </span>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-amber-300">
                Tip: add several locations to give your deployment more hosts to land on.
              </p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Every instance needs its own public IP, so the <span className="font-medium">IP count</span> — not the node count — decides whether a deploy succeeds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="continent" className="block text-sm font-medium text-text mb-2">
                Continent
              </label>
              <CustomSelect
                id="continent"
                value={geolocationForm.continent}
                onChange={(e) => onGeolocationFormChange({ continent: e.target.value, country: '', region: '' })}
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
                onChange={(e) => onGeolocationFormChange({ ...geolocationForm, country: e.target.value, region: '' })}
                options={countryOptions}
                placeholder="Any Country"
                disabled={!geolocationForm.continent}
                className="w-full"
              />
            </div>
          </div>

          {showRegions && (
            <div className="mb-3">
              <label htmlFor="region" className="block text-sm font-medium text-text mb-2">
                Region (Optional)
              </label>
              <CustomSelect
                id="region"
                value={geolocationForm.region || ''}
                onChange={(e) => onGeolocationFormChange({ ...geolocationForm, region: e.target.value })}
                options={regionOptions}
                placeholder="Any Region"
                className="w-full"
              />
              <p className="mt-2 text-xs text-gray-400">
                This country has hosts in several regions. Narrowing to one cuts latency for
                players nearby, but leaves fewer hosts to deploy on — leave it on
                <span className="font-medium"> Any Region</span> if you are not sure.
              </p>
            </div>
          )}

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

        {/* Capacity of the whole selection — locations are pooled, so this is the only
            level at which the question means anything. `ipCount` is arithmetic and always
            there; `freeIpCount` is measured and null when we could not tell, in which case
            we say nothing about free room rather than guess. Advisory here; the same fact
            is put in front of the customer again on Continue (see DeploymentDialog). */}
        {capacity && (
          capacity.ipCount < capacity.instances ? (
            <div className="bg-amber-500/[0.08] border-2 border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-300">
                    These locations are too small for this plan
                  </p>
                  <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                    They match {capacity.ipCount} {capacity.ipCount === 1 ? 'node' : 'nodes'} able to run it,
                    and your server runs on {capacity.instances}. Add another location above.
                  </p>
                </div>
              </div>
            </div>
          ) : capacity.freeIpCount === null ? null : capacity.freeIpCount >= capacity.instances ? (
            // Room, but say whether there is any to spare. A selection sized exactly to the
            // instance count works today and breaks the moment one node fills up — the old
            // picker expressed that by hiding the location, which was too blunt; the fact
            // is still worth stating.
            capacity.ipCount <= capacity.instances ? (
              <p className="text-xs text-amber-200/80 flex items-start gap-2 px-1">
                <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span>
                  All {capacity.ipCount} nodes in your locations have room, which is exactly what your
                  server needs and nothing spare. If one fills up before you deploy, it has nowhere to go.
                </span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {capacity.freeIpCount} of {capacity.ipCount} nodes in your locations have room for this plan right now.
              </p>
            )
          ) : (
            <div className="bg-amber-500/[0.08] border-2 border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="min-w-0">
                  {capacity.freeIpCount === 0 ? (
                    <>
                      <p className="text-sm font-semibold text-amber-300">
                        No node in your locations has room for this plan right now
                      </p>
                      <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                        All {capacity.ipCount} of them are already running other apps.
                        Your server has nowhere to deploy until you add another location.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-amber-300">
                        Only {capacity.freeIpCount} of {capacity.ipCount} nodes in your locations {capacity.freeIpCount === 1 ? 'has' : 'have'} room for this plan right now
                      </p>
                      <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                        Your server runs on {capacity.instances}, so{' '}
                        {capacity.instances - capacity.freeIpCount}{' '}
                        {capacity.instances - capacity.freeIpCount === 1 ? 'copy has' : 'copies have'} nowhere to go.
                        Add another location above to fix it.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
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

      {showNav && (
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
      )}
    </motion.div>
  );
});

StepLocation.displayName = 'StepLocation';

export default StepLocation;
