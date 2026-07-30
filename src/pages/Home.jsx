import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { LoginModal } from '../components/auth';
import { SEO } from '../components/common';
import { Hero, Features, PricingPlans, ServerLocations, HomeContent, FAQ, GuideLinks, ManageShowcase } from '../components/sections';
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

      {/* What the management panel can do — carousel + capability tiles.
          Ahead of the feature list: showing the product argues better than claiming it. */}
      <ManageShowcase />

      {/* Features Section */}
      <Features />

      {/* Pricing Plans Section */}
      <PricingPlans
        onGetStarted={handleLoginClick}
        onBuyNow={handlePlanSelect}
      />

      {/* Server Locations Section */}
      <ServerLocations />

      {/* Long-form content + internal links */}
      <HomeContent />

      {/* Internal links to guides */}
      <GuideLinks />

      {/* FAQ Section */}
      <FAQ />

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
