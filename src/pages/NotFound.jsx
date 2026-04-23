import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { SEO } from '../components/common';

/**
 * 404 Not Found Page
 */
const NotFound = () => {
  return (
    <>
      <SEO
        title="404 - Page Not Found"
        description="The page you're looking for doesn't exist."
        noIndex={true}
      />

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-background-alt px-4">
        <div className="text-center max-w-4xl w-full">
          {/* 404 Image */}
          <div className="-mb-32 -mt-32">
            <img
              src="/games/palworld/404.webp"
              alt="404 Not Found"
              className="max-h-[85vh] w-auto mx-auto object-contain"
            />
          </div>

          {/* Message */}
          <p className="text-text-secondary mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
              Go Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface hover:bg-surface/80 text-white font-medium rounded-lg border border-border transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
