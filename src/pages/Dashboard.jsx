import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { SEO } from '../components/common';
import DeploymentDialog from '../components/dashboard/DeploymentDialog';
import GameServersDashboard from '../components/dashboard/GameServersDashboard';

/**
 * Dashboard Page
 * User's server management dashboard
 */
const Dashboard = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [showDeployment, setShowDeployment] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Redirect if not authenticated (but wait for auth to finish loading)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleDeployNew = () => {
    setShowDeployment(true);
  };

  const handleDeploymentSuccess = () => {
    setShowDeployment(false);
    // Trigger GameServersDashboard to reload
    setRefreshTrigger(prev => prev + 1);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* SEO */}
      <SEO
        title="Dashboard"
        description="Manage your game servers"
        noIndex={true}
      />

      {/* Dashboard Container */}
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
          {/* Game Style Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-3"
          >
            <svg
              className="w-full h-auto"
              viewBox="0 0 700 50"
              preserveAspectRatio="xMidYMid meet"
              style={{ minHeight: '35px', maxHeight: '70px' }}
            >
              <defs>
                {/* Blue tech texture pattern */}
                <pattern id="blueTexture" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#42A5F5"/>
                  <rect x="0" y="4" width="8" height="4" fill="#2196F3"/>
                  <rect x="0" y="6" width="8" height="2" fill="#1565C0"/>
                  <rect x="2" y="2" width="1" height="1" fill="#90CAF9"/>
                  <rect x="5" y="1" width="1" height="1" fill="#90CAF9"/>
                  <rect x="1" y="5" width="1" height="1" fill="#1976D2"/>
                  <rect x="6" y="5" width="1" height="1" fill="#1976D2"/>
                </pattern>

                {/* Shadow filter */}
                <filter id="gameShadow">
                  <feDropShadow dx="4" dy="4" stdDeviation="0" floodColor="#0D47A1"/>
                  <feDropShadow dx="6" dy="6" stdDeviation="0" floodColor="#000000"/>
                </filter>
              </defs>

              <text
                x="50%"
                y="38"
                textAnchor="middle"
                fontFamily="'Courier New', 'Arial Black', monospace"
                fontSize="48"
                fontWeight="bold"
                letterSpacing="6"
                fill="url(#blueTexture)"
                filter="url(#gameShadow)"
                style={{ imageRendering: 'pixelated', paintOrder: 'stroke fill' }}
              >
                Palworld Dashboard
              </text>
            </svg>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-5"
          >
            <p className="text-text-muted text-sm sm:text-lg text-center">
              Manage your game servers running on the Flux decentralized cloud
            </p>
          </motion.div>

          {/* Action Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-between items-center mb-4"
          >
            <div className="flex items-center gap-2 sm:gap-4 flex-nowrap">
              <h2 className="text-lg sm:text-2xl font-bold text-text whitespace-nowrap">Your Servers</h2>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all duration-200 group whitespace-nowrap"
              >
                <Home className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                <span className="hidden sm:inline text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">Back to Home</span>
              </button>
            </div>
            <button
              onClick={handleDeployNew}
              className="btn-primary flex items-center gap-2 whitespace-nowrap py-2 sm:py-3 px-3 sm:px-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden md:inline">Deploy New Server</span>
            </button>
          </motion.div>

          {/* Server List - Game Servers Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GameServersDashboard refreshTrigger={refreshTrigger} />
          </motion.div>
        </div>
      </div>

      {/* Deployment Dialog */}
      <DeploymentDialog
        isOpen={showDeployment}
        onClose={() => setShowDeployment(false)}
        onSuccess={handleDeploymentSuccess}
      />
    </>
  );
};

export default Dashboard;
