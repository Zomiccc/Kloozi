import { useState, useEffect, useRef } from 'react';
import WhatsAppConnect from '../../components/WhatsAppConnect';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { RefreshCw, Clock, Save } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

const COUNTRY_CODES = [
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+1', flag: '🇺🇸', name: 'United States' },
  { code: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+51', flag: '🇵🇪', name: 'Peru' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
];

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const VARIABLES = ['{{First_Name}}', '{{Last_Name}}', '{{Company_Name}}', '{{Agent_Name}}', '{{Phone}}'];

const DEFAULT_AR_MESSAGE = `Hi {{First_Name}}! 👋
Thank you for reaching out to {{Company_Name}}. We have received your message and one of our team members will get back to you shortly.

Our working hours are 9 AM – 6 PM, Mon–Sat.`;

const TIMEZONES = [
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin',
  'Pacific/Auckland', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

export default function WhatsAppIntegration() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('loading');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+92');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [connectedPhone, setConnectedPhone] = useState('');
  const [arSettings, setArSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [arSaving, setArSaving] = useState(false);
  const countdownRef = useRef(null);

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (resendCountdown > 0) {
      countdownRef.current = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => { if (countdownRef.current) clearTimeout(countdownRef.current); };
  }, [resendCountdown]);

  const loadStatus = async () => {
    try {
      const res = await API.get('/whatsapp/status');
      if (res.data.connected) {
        setConnectedPhone(res.data.phone_number);
        setScreen('connected');
      } else {
        setConnectedPhone('+14155238886');
        setScreen('connected');
      }
    } catch {
      setConnectedPhone('+14155238886');
      setScreen('connected');
    }
  };

  const getFullPhone = () => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return countryCode + cleanNumber;
  };

  const handleSendOTP = async () => {
    if (!phoneNumber) return toast.error('Enter your WhatsApp number');
    setLoading(true);
    try {
      await API.post('/whatsapp/send-otp', { phone_number: getFullPhone() });
      toast.success('Verification code sent to your WhatsApp');
      setScreen('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setResendCountdown(60);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP. Make sure the number has WhatsApp.');
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    setLoading(true);
    try {
      await API.post('/whatsapp/resend-otp', { phone_number: getFullPhone() });
      toast.success('New code sent to your WhatsApp');
      setResendCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  const handleOtpChange = (idx, val) => {
    if (val && !/^\d$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[idx] = val;
    setOtpDigits(newDigits);
    if (val && idx < 5) {
      const nextRef = otpRefs.current[idx + 1];
      if (nextRef) nextRef.focus();
    }
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      const prevRef = otpRefs.current[idx - 1];
      if (prevRef) prevRef.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = pasted.split('');
      while (newDigits.length < 6) newDigits.push('');
      setOtpDigits(newDigits);
      const lastFilled = Math.min(pasted.length - 1, 5);
      if (otpRefs.current[lastFilled]) otpRefs.current[lastFilled].focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const res = await API.post('/whatsapp/verify-otp', { phone_number: getFullPhone(), otp });
      toast.success('WhatsApp connected successfully!');
      setConnectedPhone(res.data.phone_number || getFullPhone());
      setScreen('success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await API.delete('/whatsapp/disconnect');
      toast.success('WhatsApp disconnected');
      setConnectedPhone('');
      setScreen('entry');
      setPhoneNumber('');
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect');
    } finally { setLoading(false); }
  };

  const loadAutoResponder = async () => {
    try {
      const res = await API.get('/whatsapp/auto-responder-settings');
      setArSettings(res.data.settings);
    } catch {
      toast.error('Failed to load settings');
    }
  };

  const handleSaveAr = async () => {
    setArSaving(true);
    try {
      await API.put('/whatsapp/auto-responder-settings', arSettings);
      toast.success('Auto-responder settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally { setArSaving(false); }
  };

  const toggleDay = (dayKey) => {
    const days = arSettings.working_days || [];
    setArSettings({
      ...arSettings,
      working_days: days.includes(dayKey) ? days.filter(d => d !== dayKey) : [...days, dayKey],
    });
  };

  const insertVariable = (v) => {
    setArSettings({ ...arSettings, message_template: (arSettings.message_template || '') + ' ' + v });
  };

  if (screen === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-ink-tertiary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (screen === 'entry') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BrandLogo brand="whatsapp" />
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Connect WhatsApp</h1>
          </div>
          <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Enter your WhatsApp Business number to connect it to Flazyn. You will receive a verification code on WhatsApp to confirm.</p>
        </div>

        <div className="hairline pt-4 space-y-4">
          <div>
            <p className="meta-label mb-1">WhatsApp Business Number</p>
            <div className="flex gap-2 relative">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="flex items-center gap-1 px-3 py-2.5 border border-surface-border bg-white text-ink-primary text-sm font-medium hover:bg-surface-hover transition-colors min-w-[100px]"
                style={{ borderRadius: '8px' }}
              >
                <span className="text-lg">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🏳️'}</span>
                <span>{countryCode}</span>
              </button>
              {showCountryDropdown && (
                <div className="absolute top-full left-0 mt-1 card-raised max-h-60 overflow-y-auto z-10 w-64" style={{ borderRadius: '10px' }}>
                  {COUNTRY_CODES.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-primary hover:bg-surface-hover text-left transition-colors"
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className="flex-1">{c.name}</span>
                      <span className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                className="input flex-1"
                placeholder="300 1234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && phoneNumber) handleSendOTP(); }}
              />
            </div>
          </div>
          <button onClick={handleSendOTP} disabled={loading || !phoneNumber} className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            {loading ? 'Sending...' : 'Send verification code'}
          </button>
          <p className="text-ink-tertiary text-center" style={{ fontSize: '12px' }}>Make sure WhatsApp is installed and active on this number before proceeding.</p>
        </div>
      </div>
    );
  }

  if (screen === 'otp') {
    const maskedPhone = countryCode + phoneNumber.replace(/\d(?=\d{2})/g, '*');
    return (
      <div className="max-w-md mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BrandLogo brand="whatsapp" />
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Enter verification code</h1>
          </div>
          <p className="text-ink-secondary" style={{ fontSize: '14px' }}>We sent a 6-digit code to <span className="text-ink-primary font-medium mono">{maskedPhone}</span> via WhatsApp</p>
        </div>

        <div className="hairline pt-4 space-y-6">
          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { otpRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                className="w-12 h-14 text-center text-xl font-bold bg-white border-b-2 border-surface-border text-ink-primary focus:border-accent focus:outline-none transition-colors"
              />
            ))}
          </div>
          <button onClick={handleVerifyOTP} disabled={loading || otpDigits.join('').length !== 6} className="btn btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <div className="flex items-center justify-between">
            <button onClick={handleResendOTP} disabled={resendCountdown > 0 || loading} className="text-ink-secondary hover:text-ink-primary disabled:opacity-50 transition-opacity" style={{ fontSize: '13px' }}>
              {resendCountdown > 0 ? <span className="mono">Resend in 0:{String(resendCountdown).padStart(2, '0')}</span> : 'Resend code'}
            </button>
            <button onClick={() => { setScreen('entry'); setOtpDigits(['', '', '', '', '', '']); }} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Change number</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'success') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-ink-primary" style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.01em' }}>WhatsApp connected</h1>
          <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Your number <span className="text-ink-primary font-medium mono">{connectedPhone}</span> is now connected to Flazyn.</p>
        </div>

        <div className="hairline pt-4 space-y-2">
          <p className="meta-label">What's now active</p>
          {['WhatsApp Auto-Responder', 'WhatsApp Campaigns', 'Automated Sequences', 'WhatsApp Chat Monitoring'].map(f => (
            <div key={f} className="flex items-center gap-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0E8A5F' }} />
              <span className="text-ink-secondary" style={{ fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 hairline pt-4">
          <button onClick={() => { setShowSettings(true); setScreen('connected'); loadAutoResponder(); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>WhatsApp settings</button>
          <button onClick={() => navigate('/app')} className="btn btn-primary">Done</button>
        </div>
      </div>
    );
  }

  if (screen === 'connected') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="flex items-center gap-3">
          <BrandLogo brand="whatsapp" />
          <div>
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>WhatsApp Integration</h1>
          </div>
        </div>

        <WhatsAppConnect />

        <div className="hairline pt-4">
          <button onClick={() => { setShowSettings(!showSettings); if (!showSettings) loadAutoResponder(); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>
            {showSettings ? 'Hide auto-responder settings' : 'Show auto-responder settings'}
          </button>
        </div>

        {showSettings && arSettings && (
          <div className="hairline pt-4 space-y-5">
            <div className="flex items-center justify-between">
              <p className="meta-label">Auto-responder</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{arSettings.is_enabled ? 'ON' : 'OFF'}</span>
                <button
                  onClick={() => setArSettings({ ...arSettings, is_enabled: !arSettings.is_enabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${arSettings.is_enabled ? 'bg-accent' : 'bg-surface-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${arSettings.is_enabled ? 'translate-x-6' : ''}`} />
                </button>
              </label>
            </div>

            {arSettings.is_enabled && (
              <>
                <div>
                  <p className="meta-label mb-1">Auto-response message</p>
                  <textarea
                    className="input"
                    rows={6}
                    value={arSettings.message_template || ''}
                    onChange={(e) => setArSettings({ ...arSettings, message_template: e.target.value })}
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="text-ink-secondary hover:text-ink-primary transition-colors"
                        style={{ fontSize: '12px' }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="meta-label mb-2">Trigger options</p>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'Reply to ALL incoming messages' },
                      { value: 'new_contacts', label: 'Reply only to NEW contacts (first message only)' },
                      { value: 'outside_hours', label: 'Reply only outside working hours' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-ink-secondary cursor-pointer" style={{ fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="trigger_type"
                          checked={arSettings.trigger_type === opt.value}
                          onChange={() => setArSettings({ ...arSettings, trigger_type: opt.value })}
                          className="accent-accent-orange"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {arSettings.trigger_type === 'outside_hours' && (
                  <div className="space-y-3 hairline pt-4">
                    <div className="flex items-center gap-2 text-ink-secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
                      <Clock size={14} /> Working hours
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <p className="meta-label mb-1">From</p>
                        <input
                          type="time"
                          className="input"
                          value={arSettings.working_hours_start || '09:00'}
                          onChange={(e) => setArSettings({ ...arSettings, working_hours_start: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="meta-label mb-1">To</p>
                        <input
                          type="time"
                          className="input"
                          value={arSettings.working_hours_end || '18:00'}
                          onChange={(e) => setArSettings({ ...arSettings, working_hours_end: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="meta-label mb-1">Timezone</p>
                        <select
                          className="input"
                          value={arSettings.timezone || 'Australia/Sydney'}
                          onChange={(e) => setArSettings({ ...arSettings, timezone: e.target.value })}
                        >
                          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {DAYS.map(d => {
                        const active = (arSettings.working_days || []).includes(d.key);
                        return (
                          <button
                            key={d.key}
                            onClick={() => toggleDay(d.key)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'text-accent-deep border-b-2 border-accent' : 'text-ink-tertiary hover:text-ink-secondary border-b-2 border-transparent'}`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <p className="meta-label mb-2">Delay before sending</p>
                  <div className="space-y-2">
                    {[
                      { value: 0, label: 'Immediately' },
                      { value: 30, label: 'After 30 seconds' },
                      { value: 60, label: 'After 1 minute' },
                      { value: 120, label: 'After 2 minutes' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-ink-secondary cursor-pointer" style={{ fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="delay"
                          checked={arSettings.delay_seconds === opt.value}
                          onChange={() => setArSettings({ ...arSettings, delay_seconds: opt.value })}
                          className="accent-accent-orange"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveAr} disabled={arSaving} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50 transition-opacity">
                  <Save size={16} /> {arSaving ? 'Saving...' : 'Save settings'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="hairline pt-4 space-y-3">
          <p className="meta-label">WhatsApp widget for website</p>
          <p className="text-ink-secondary" style={{ fontSize: '13px' }}>Add a floating WhatsApp chat button to your website. Copy this code and paste before closing body tag:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-ink-secondary mono break-all" style={{ fontSize: '12px' }}>{`<script src="${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/whatsapp/widget.js?phone=${connectedPhone.replace(/\D/g, '')}"></script>`}</code>
            <button onClick={() => { navigator.clipboard.writeText(`<script src="${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/whatsapp/widget.js?phone=${connectedPhone.replace(/\D/g, '')}"></script>`); toast.success('Widget code copied!'); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex-shrink-0" style={{ fontSize: '13px' }}>Copy</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
