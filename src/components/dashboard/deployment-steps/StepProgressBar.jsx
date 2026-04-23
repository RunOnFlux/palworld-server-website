import { memo } from 'react';

const steps = [
  { number: 1, title: 'Choose Plan' },
  { number: 2, title: 'Configure' },
  { number: 3, title: 'Environment' },
  { number: 4, title: 'Location' },
  { number: 5, title: 'Review' },
  { number: 6, title: 'Finalizing' },
];

// Move inline styles to constants to prevent recreation
const progressLineStyle = { marginLeft: '10%', marginRight: '10%' };

const StepProgressBar = memo(({ currentStep }) => {
  return (
    <div className="py-6 flex items-center">
      <div className="relative max-w-3xl mx-auto px-0 sm:px-4 w-full">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-700 rounded-full" style={progressLineStyle} />

        <div className="relative grid grid-cols-6 gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center relative">
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-transform duration-300 origin-left z-0 transform-gpu ${
                    currentStep > step.number ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              )}

              <div
                className={`relative w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-[transform,background-color,color,box-shadow,border-color] duration-200 z-10 transform-gpu ${
                  currentStep >= step.number
                    ? 'bg-blue-600 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/50 border-transparent'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                } ${currentStep === step.number ? 'scale-110' : 'scale-100'}`}
              >
                {currentStep > step.number ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.number}</span>
                )}

                {currentStep === step.number && (
                  <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
                )}
              </div>

              <div
                className={`mt-1.5 text-[10px] sm:text-xs font-bold transition-colors duration-200 text-center leading-tight w-full ${
                  currentStep >= step.number
                    ? 'text-blue-400'
                    : 'text-gray-600'
                }`}
              >
                {step.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

StepProgressBar.displayName = 'StepProgressBar';

export default StepProgressBar;
