import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Trash2, RefreshCw, Clock, Save } from 'lucide-react';
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
        // Sandbox mode - always show as connected
        setConnectedPhone('+14155238886');
        setScreen('connected');
      }
    } catch {
      // Sandbox mode - always show as connected
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
        <div className="animate-spin w-8 h-8 border-4 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (screen === 'entry') {
    return (
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Automations
        </button>
        <div className="card text-center py-8">
          <div className="w-20 h-20 bg-surface-page rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 border-surface-border">
            <BrandLogo brand="whatsapp" />
          </div>
          <h2 className="text-xl font-bold text-ink-primary">Connect Your WhatsApp Business Number</h2>
          <p className="text-sm text-ink-secondary mt-2 mb-8">
            Enter your WhatsApp Business number to connect it to Zomic. You will receive a verification code on WhatsApp to confirm.
          </p>
          <div className="text-left space-y-4">
            <div>
              <label className="text-sm font-medium text-ink-secondary">WhatsApp Business Number</label>
              <div className="flex gap-2 mt-1 relative">
                <button
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="flex items-center gap-1 px-3 py-2.5 border border-surface-border rounded-lg bg-surface-hover text-ink-primary text-sm font-medium hover:bg-surface-hover transition-colors min-w-[100px]"
                >
                  <span className="text-lg">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag || '🏳️'}</span>
                  <span>{countryCode}</span>
                </button>
                {showCountryDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-surface-border rounded-lg shadow-modal max-h-60 overflow-y-auto z-10 w-64">
                    {COUNTRY_CODES.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-primary hover:bg-surface-hover text-left transition-colors"
                      >
                        <span className="text-lg">{c.flag}</span>
                        <span className="flex-1">{c.name}</span>
                        <span className="text-ink-tertiary">{c.code}</span>
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
            <button
              onClick={handleSendOTP}
              disabled={loading || !phoneNumber}
              className="w-full btn btn-green py-3 rounded-lg font-medium flex items-center justify-center gap-2  disabled:opacity-50 transition-colors shadow-lg "
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <BrandLogo brand="whatsapp" />}
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            <p className="text-xs text-ink-tertiary text-center">
              Make sure WhatsApp is installed and active on this number before proceeding.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'otp') {
    const maskedPhone = countryCode + phoneNumber.replace(/\d(?=\d{2})/g, '*');
    return (
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Automations
        </button>
        <div className="card text-center py-8">
          <div className="w-20 h-20 bg-surface-page rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 border-surface-border">
            <BrandLogo brand="whatsapp" />
          </div>
          <h2 className="text-xl font-bold text-ink-primary">Enter Verification Code</h2>
          <p className="text-sm text-ink-secondary mt-2 mb-8">
            We sent a 6-digit code to <strong className="text-ink-primary">{maskedPhone}</strong> via WhatsApp
          </p>
          <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
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
                className="w-12 h-14 text-center text-xl font-bold bg-white border-2 border-surface-border rounded-lg text-ink-primary focus:border-[#25D366] focus:outline-none transition-colors"
              />
            ))}
          </div>
          <button
            onClick={handleVerifyOTP}
            disabled={loading || otpDigits.join('').length !== 6}
            className="w-full btn btn-green py-3 rounded-lg font-medium flex items-center justify-center gap-2  disabled:opacity-50 mb-4 transition-colors shadow-lg "
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={handleResendOTP}
              disabled={resendCountdown > 0 || loading}
              className="text-ink-secondary hover:text-ink-primary disabled:opacity-50 transition-colors"
            >
              {resendCountdown > 0 ? `Resend in 0:${String(resendCountdown).padStart(2, '0')}` : 'Resend Code'}
            </button>
            <button
              onClick={() => { setScreen('entry'); setOtpDigits(['', '', '', '', '', '']); }}
              className="text-ink-secondary hover:text-ink-primary transition-colors"
            >
              Change Number
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'success') {
    return (
      <div className="max-w-md mx-auto">
        <div className="card text-center py-12">
          <div className="w-20 h-20 bg-surface-page rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce ring-1 border-surface-border">
            <CheckCircle2 size={40} className="text-[#25D366]" />
          </div>
          <h2 className="text-2xl font-bold text-ink-primary">WhatsApp Connected!</h2>
          <p className="text-sm text-ink-secondary mt-2 mb-8">
            Your number <strong className="text-ink-primary">{connectedPhone}</strong> is now connected to Zomic.
          </p>
          <div className="text-left bg-[#25D366]/10 border border-[#25D366]/20 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-[#25D366] mb-3">What's now active:</p>
            <ul className="space-y-2 text-sm text-ink-secondary">
              {['WhatsApp Auto-Responder', 'WhatsApp Campaigns', 'Automated Sequences', 'WhatsApp Chat Monitoring'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#25D366]" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowSettings(true); setScreen('connected'); loadAutoResponder(); }}
              className="flex-1 px-4 py-3 rounded-lg font-medium bg-surface-hover text-ink-primary border border-surface-border hover:bg-surface-hover transition-colors"
            >
              WhatsApp Settings
            </button>
            <button
              onClick={() => navigate('/app')}
              className="flex-1 btn btn-green py-3 rounded-lg font-medium  transition-colors shadow-lg "
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'connected') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors">
          <ArrowLeft size={16} /> Back to Automations
        </button>

        {/* Sandbox Mode Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <div className="text-yellow-600 mt-0.5">⚠️</div>
          <div>
            <p className="font-medium text-yellow-800">Running in Sandbox Mode</p>
            <p className="text-sm text-yellow-700 mt-1">Contacts must join sandbox before receiving messages. Go live after Meta business verification.</p>
          </div>
        </div>

        {/* Sandbox Connection Status */}
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 border-green-200">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-ink-primary">WhatsApp Sandbox Connected via Twilio</h2>
          <p className="text-sm text-ink-secondary mt-2">
            Sandbox Number: <strong className="text-ink-primary">+1 415 523 8886</strong>
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 text-left">
            <p className="font-medium text-blue-800 mb-2">📱 How to receive messages:</p>
            <p className="text-sm text-blue-700">
              Ask your contacts to send <code className="bg-blue-100 px-1 py-0.5 rounded">JOIN [keyword]</code> to <strong>+1 415 523 8886</strong> on WhatsApp first.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Replace [keyword] with your sandbox keyword configured in Twilio.
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button onClick={() => { setShowSettings(!showSettings); if (!showSettings) loadAutoResponder(); }} className="px-4 py-2 rounded-lg text-sm bg-surface-hover text-ink-primary border border-surface-border hover:bg-surface-hover transition-colors">
              {showSettings ? 'Hide Settings' : 'WhatsApp Settings'}
            </button>
          </div>
        </div>

        {showSettings && arSettings && (
          <div className="card space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink-primary">Auto-Responder Settings</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-ink-secondary">{arSettings.is_enabled ? 'ON' : 'OFF'}</span>
                <button
                  onClick={() => setArSettings({ ...arSettings, is_enabled: !arSettings.is_enabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${arSettings.is_enabled ? 'bg-[#25D366]' : 'bg-surface-hover'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${arSettings.is_enabled ? 'translate-x-6' : ''}`} />
                </button>
              </label>
            </div>

            {arSettings.is_enabled && (
              <>
                <div>
                  <label className="text-sm font-medium text-ink-secondary">Auto-response message</label>
                  <textarea
                    className="input mt-1"
                    rows={6}
                    value={arSettings.message_template || ''}
                    onChange={(e) => setArSettings({ ...arSettings, message_template: e.target.value })}
                  />
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="text-xs bg-surface-page text-ink-secondary px-2 py-1 rounded hover:bg-surface-hover transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-secondary">Trigger options</label>
                  <div className="space-y-2 mt-2">
                    {[
                      { value: 'all', label: 'Reply to ALL incoming messages' },
                      { value: 'new_contacts', label: 'Reply only to NEW contacts (first message only)' },
                      { value: 'outside_hours', label: 'Reply only outside working hours' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                        <input
                          type="radio"
                          name="trigger_type"
                          checked={arSettings.trigger_type === opt.value}
                          onChange={() => setArSettings({ ...arSettings, trigger_type: opt.value })}
                          className="accent-accent-blue"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {arSettings.trigger_type === 'outside_hours' && (
                  <div className="space-y-3 p-4 bg-surface-hover rounded-lg border border-surface-border">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink-secondary">
                      <Clock size={16} /> Working hours
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-ink-tertiary">From</label>
                        <input
                          type="time"
                          className="input mt-1"
                          value={arSettings.working_hours_start || '09:00'}
                          onChange={(e) => setArSettings({ ...arSettings, working_hours_start: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-ink-tertiary">To</label>
                        <input
                          type="time"
                          className="input mt-1"
                          value={arSettings.working_hours_end || '18:00'}
                          onChange={(e) => setArSettings({ ...arSettings, working_hours_end: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {DAYS.map(d => {
                        const active = (arSettings.working_days || []).includes(d.key);
                        return (
                          <button
                            key={d.key}
                            onClick={() => toggleDay(d.key)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${active ? 'btn btn-primary' : 'bg-surface-hover text-ink-secondary hover:bg-surface-hover'}`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-ink-secondary">Delay before sending</label>
                  <div className="space-y-2 mt-2">
                    {[
                      { value: 0, label: 'Immediately' },
                      { value: 30, label: 'After 30 seconds' },
                      { value: 60, label: 'After 1 minute' },
                      { value: 120, label: 'After 2 minutes' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                        <input
                          type="radio"
                          name="delay"
                          checked={arSettings.delay_seconds === opt.value}
                          onChange={() => setArSettings({ ...arSettings, delay_seconds: opt.value })}
                          className="accent-accent-blue"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveAr}
                  disabled={arSaving}
                  className="w-full btn btn-primary py-3 rounded-lg font-medium flex items-center justify-center gap-2  disabled:opacity-50 transition-colors"
                >
                  <Save size={16} /> {arSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="card">
          <h3 className="font-semibold text-ink-primary mb-3">WhatsApp Widget for Website</h3>
          <p className="text-sm text-ink-secondary mb-3">Add a floating WhatsApp chat button to your website. Copy this code and paste before closing body tag:</p>
          <div className="bg-surface-page rounded-2xl p-3 border border-surface-border">
            <code className="text-xs text-ink-secondary block overflow-x-auto">{`<script src="${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/whatsapp/widget.js?phone=${connectedPhone.replace(/\D/g, '')}"></script>`}</code>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(`<script src="${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/whatsapp/widget.js?phone=${connectedPhone.replace(/\D/g, '')}"></script>`); toast.success('Widget code copied!'); }} className="mt-3 text-xs text-accent-blue hover:underline">Copy to clipboard</button>
        </div>
      </div>
    );
  }

  return null;
}
