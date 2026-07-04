import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { LoginModal } from '../components/auth';
import { SEO } from '../components/common';
import { Hero, Features, PricingPlans, ServerLocations, HomeContent, FAQ, GuideLinks } from '../components/sections';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import DeploymentDialog from '../components/dashboard/DeploymentDialog';
import marketplaceService from '../services/marketplaceService';

/**
 * Home/Landing Page
 * Complete landing page with all sections
 */
const Home = () => {
  const queryClient = useQueryClient();

  // Prefetch plans into React Query cache
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['serverPlans'],
      queryFn: () => marketplaceService.getServerPlans(),
      staleTime: 10 * 60 * 1000,
    });
  }, [queryClient]);

  const [showLogin, setShowLogin] = useState(false);
  const [showDeployment, setShowDeployment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  // Memoized handlers to prevent unnecessary re-renders
  const handlePlanSelect = useCallback((plan) => {
    setSelectedPlan(plan);
    setShowDeployment(true);
  }, []);

  const handleDeploymentSuccess = useCallback(() => {
    setShowDeployment(false);
    setSelectedPlan(null);
  }, []);

  const handleLoginClick = useCallback(() => {
    setShowLogin(true);
  }, []);

  const handleLoginClose = useCallback(() => {
    setShowLogin(false);
  }, []);

  const handleDeploymentClose = useCallback(() => {
    setShowDeployment(false);
  }, []);

  return (
    <>
      {/* SEO */}
      <SEO />

      {/* Header/Navbar */}
      <Header onLoginClick={handleLoginClick} />

      {/* Hero Section */}
      <Hero onGetStarted={handleLoginClick} />

      {/* Features Section */}
      <Features />

      {/* Pricing Plans Section */}
      <PricingPlans
        onGetStarted={handleLoginClick}
        onBuyNow={handlePlanSelect}
      />

      {/* Comparison CTA — links to the full hosting comparison guide */}
      <section className="py-8 sm:py-10 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/decentralized-palworld-hosting"
              className="group flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 p-6 sm:p-8 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 hover:border-primary/70 hover:from-primary/20 hover:to-primary/20 transition-all duration-300 shadow-lg shadow-primary/5 hover:shadow-primary/20"
            >
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="hidden sm:flex flex-shrink-0 items-center justify-center w-14 h-14 rounded-xl bg-primary/20 border border-primary/30">
                  <BarChart3 className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-text">
                    Why host on the Flux decentralized cloud
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    No single point of failure, no lock-in, dedicated resources, DDoS protection, 99.9% uptime and 32 players.
                  </p>
                </div>
              </div>
              <span className="inline-flex flex-shrink-0 items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold whitespace-nowrap shadow-md group-hover:gap-3 transition-all duration-300">
                Learn why
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Server Locations Section */}
      <ServerLocations />

      {/* Long-form content + internal links */}
      <HomeContent />

      {/* FAQ Section */}
      <FAQ />

      {/* Internal links to guides */}
      <GuideLinks />

      {/* Footer */}
      <Footer />

      {/* Login Modal */}
      <LoginModal isOpen={showLogin} onClose={handleLoginClose} />

      {/* Deployment Dialog */}
      <DeploymentDialog
        isOpen={showDeployment}
        onClose={handleDeploymentClose}
        onSuccess={handleDeploymentSuccess}
        preSelectedPlan={selectedPlan}
      />
    </>
  );
};

export default Home;
