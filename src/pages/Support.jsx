import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, AlertCircle, TicketCheck, Mail, Tag, FileText, MessageSquare, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

const ISSUE_TYPES = [
  'General question',
  'Billing & payments',
  'Server not starting',
  'Performance issue',
  'Account issue',
  'Other',
];

const ENDPOINT = 'https://relay.ssp.runonflux.io/v1/ticket';

const Support = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    type: ISSUE_TYPES[0],
    subject: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const dismissTimers = useRef([]);
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (user?.email) {
      setForm(f => ({ ...f, email: f.email || user.email }));
    }
  }, [user]);

  useEffect(() => {
    return () => {
      dismissTimers.current.forEach(clearTimeout);
      abortControllerRef.current?.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const validate = () => {
    const errs = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email) errs.email = 'Email is required';
    else if (!emailPattern.test(form.email)) errs.email = 'Invalid email address';
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setErrorMsg('');
    dismissTimers.current.forEach(clearTimeout);
    dismissTimers.current = [];
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-challenge': 'fluxos-support-form',
        },
        body: JSON.stringify(form),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to submit ticket. Please try again.');
      }

      const data = await res.json();
      if (data.status === 'error') {
        throw new Error(data.data?.message || 'Failed to submit ticket. Please try again.');
      }

      setSubmitted(true);
      setForm({ email: user?.email || '', type: ISSUE_TYPES[0], subject: '', description: '' });
      dismissTimers.current.push(setTimeout(() => setSubmitted(false), 8000));
    } catch (err) {
      if (err.name === 'AbortError') return;
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      dismissTimers.current.push(setTimeout(() => setErrorMsg(''), 8000));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors ${
      errors[field] ? 'border-red-500/60' : 'border-border/40 hover:border-border/60'
    }`;

  return (
    <>
      <Header onLoginClick={() => {}} />
      <main className="min-h-screen bg-background-alt pb-16 relative">
        {/* Pixel grid background */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px),
              repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px)`,
          }}
        />

        {/* Back button */}
        <div className="absolute top-20 left-4 z-40">
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface/80 text-white text-sm font-medium rounded-lg border border-border transition-colors cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Support image hero */}
        <div className="relative w-full flex justify-center items-center pt-28 pb-2">
          <img
            src="/games/palworld/support.webp"
            alt="Support"
            className="w-auto object-contain drop-shadow-2xl"
            style={{ maxHeight: '280px', maxWidth: '90%' }}
          />
        </div>

        <div className="relative max-w-2xl mx-auto px-8">
          {/* Left character */}
          <div className="hidden xl:block absolute -left-72 top-1/2 -translate-y-1/2 pointer-events-none">
            <img src="/games/palworld/support-left.webp" alt="" style={{ height: '350px', width: 'auto' }} />
          </div>
          {/* Right character */}
          <div className="hidden xl:block absolute -right-72 top-1/2 -translate-y-1/2 pointer-events-none">
            <img src="/games/palworld/support-right.webp" alt="" style={{ height: '350px', width: 'auto' }} />
          </div>

          {/* Subtitle chip */}
          <div className="flex justify-center mb-6 mt-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
              <TicketCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm text-primary whitespace-nowrap">Submit a ticket and we'll get back to you</p>
            </div>
          </div>

          {/* Card */}
          <motion.div
            className="bg-surface border border-border/30 rounded-2xl p-6 shadow-xl shadow-black/20"
            style={{ borderTop: '2px solid rgb(33,150,243)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(33,150,243,0.08), 0 4px 24px rgba(33,150,243,0.06)' }}
            initial={{ y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Success */}
            {submitted && (
              <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Ticket submitted!</p>
                  <p className="text-xs text-blue-300/80 mt-0.5">We'll review your request and respond via email.</p>
                </div>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Email + Issue Type — 2 columns */}
              <div className="grid grid-cols-1 gap-4">
                {/* Email */}
                <div>
                  <label className="text-sm font-semibold text-text mb-1.5 ml-2 block">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      maxLength={254}
                      placeholder="your@email.com"
                      readOnly={!!user?.email}
                      className={`${inputClass('email')} ${user?.email ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                </div>

                {/* Issue Type — custom dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <label className="text-sm font-semibold text-text mb-1.5 ml-2 block">Issue type</label>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(o => !o)}
                    className="relative w-full flex items-center justify-between pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border/40 hover:border-border/60 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors cursor-pointer"
                  >
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <span>{form.type}</span>
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-surface border border-border/40 rounded-xl shadow-xl shadow-black/30 overflow-hidden">
                      {ISSUE_TYPES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, type: t })); setDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                            form.type === t
                              ? 'bg-primary/15 text-primary font-medium'
                              : 'text-text-secondary hover:bg-surface-hover/50 hover:text-text'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-sm font-semibold text-text mb-1.5 ml-2 block">Subject *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    maxLength={200}
                    placeholder="Brief summary of your issue"
                    className={inputClass('subject')}
                  />
                </div>
                {errors.subject && <p className="text-xs text-red-400 mt-1">{errors.subject}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-text mb-1.5 ml-2 block">Description *</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-text-muted pointer-events-none" />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    maxLength={5000}
                    rows={5}
                    placeholder="Please describe your issue in detail..."
                    className={`${inputClass('description')} resize-none`}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  {errors.description
                    ? <p className="text-xs text-red-400">{errors.description}</p>
                    : <span />
                  }
                  <span className="text-xs text-text-muted">{form.description.length}/5000</span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || submitted}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Ticket
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Support;
