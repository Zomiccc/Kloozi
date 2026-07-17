import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, CheckCircle2, ChevronLeft, AlertCircle, Copy, Code } from 'lucide-react';

const steps = ['Requirements', 'Login', 'Select Setup', 'Enter Number', 'Verify', 'Permissions', 'Success'];

export default function WhatsAppIntegration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const requirements = [
    'You must have the WhatsApp Business app installed on your phone (not regular WhatsApp)',
    'WhatsApp Business app version 2.24.17 or higher',
    'A Facebook account with access to Meta Business Manager',
  ];

  const handleLogin = () => { setLoading(true); setTimeout(() => { setLoading(false); setStep(2); }, 1500); };
  const handleSetup = () => setStep(3);
  const handleNumber = () => { if (!phoneNumber) return toast.error('Enter your number'); setLoading(true); setTimeout(() => { setLoading(false); setStep(4); toast.success('OTP sent to your WhatsApp'); }, 1000); };
  const handleVerify = () => { if (!otp) return toast.error('Enter OTP'); setLoading(true); setTimeout(() => { setLoading(false); setStep(5); }, 1000); };
  const handlePermissions = async () => {
    setLoading(true);
    try {
      await API.post('/integrations/connect', { type: 'whatsapp', credentials: { phone: phoneNumber, mode: 'coexistence' } });
      setLoading(false); setStep(6); toast.success('WhatsApp connected!');
    } catch { toast.error('Connection failed'); setLoading(false); }
  };

  if (step === 6) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-green-600" /></div>
          <h2 className="text-xl font-bold text-dark-900">WhatsApp Connected!</h2>
          <p className="text-sm text-dark-400 mt-2">Your WhatsApp Business number <strong>{phoneNumber}</strong> is now connected. You can still use your WhatsApp Business app normally.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">What's Now Active:</h3>
          <ul className="space-y-2 text-sm text-dark-600">
            {['WhatsApp Auto-Responder', 'WhatsApp Campaigns', 'Automated WhatsApp Sequences', 'WhatsApp Chat Assistant', 'WhatsApp Contact Import', 'WhatsApp Lead Distribution', 'WhatsApp Chat Monitoring'].map(f => (
              <li key={f} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500" /> {f}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Confirm in WhatsApp Business App:</h3>
          <p className="text-sm text-dark-400">Go to WhatsApp Business app → Settings → Account → Business Platform and you should see "CRM Final" listed there.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">WhatsApp Widget for Website</h3>
          <p className="text-sm text-dark-400 mb-3">Add a floating WhatsApp chat button to your website. Copy this code and paste before closing body tag:</p>
          <div className="bg-dark-50 rounded-lg p-3 relative">
            <code className="text-xs text-dark-700 block overflow-x-auto">{`<script src="${window.location.origin}/api/whatsapp/widget.js?phone=${phoneNumber.replace(/\D/g, '')}"></script>`}</code>
            <button onClick={() => { navigator.clipboard.writeText(`<script src="${window.location.origin}/api/whatsapp/widget.js?phone=${phoneNumber.replace(/\D/g, '')}"></script>`); toast.success('Copied!'); }} className="absolute top-2 right-2 p-1 hover:bg-dark-100 rounded"><Copy size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><MessageSquare size={24} className="text-green-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">WhatsApp Business Connection</h2><p className="text-sm text-dark-400">Connect your existing WhatsApp Business app</p></div>
        </div>
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${i <= step ? 'bg-primary-600 text-white' : 'bg-dark-100 text-dark-400'}`}>{i + 1}</div>
              {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i < step ? 'bg-primary-600' : 'bg-dark-100'}`} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Requirements:</p>
            {requirements.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-dark-50 rounded-lg">
                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-dark-600">{r}</p>
              </div>
            ))}
            <button onClick={() => setStep(1)} className="btn btn-primary w-full">Next</button>
          </div>
        )}

        {step === 1 && (
          <div className="text-center py-8">
            <p className="text-sm text-dark-600 mb-6">Login with your Facebook account linked to your Meta Business Manager.</p>
            <button onClick={handleLogin} disabled={loading} className="bg-[#1877F2] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto hover:bg-[#166FE5]">
              <MessageSquare size={20} /> {loading ? 'Connecting...' : 'Login with Facebook'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Select your setup:</p>
            <div className="border-2 border-primary-500 rounded-lg p-4 bg-primary-50">
              <p className="font-medium text-dark-900">Connect your existing WhatsApp Business app</p>
              <p className="text-xs text-dark-400 mt-1">Use your current WhatsApp Business number with CRM Final via Meta Coexistence</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex items-center gap-1"><ChevronLeft size={16} /> Back</button>
              <button onClick={handleSetup} className="btn btn-primary flex-1">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Enter your WhatsApp Business phone number:</p>
            <input className="input" placeholder="+1 234 567 8900" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn btn-secondary flex items-center gap-1"><ChevronLeft size={16} /> Back</button>
              <button onClick={handleNumber} disabled={loading || !phoneNumber} className="btn btn-primary flex-1">{loading ? 'Sending OTP...' : 'Send OTP'}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Enter the OTP sent to your WhatsApp:</p>
            <input className="input text-center text-lg tracking-widest" placeholder="------" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="btn btn-secondary flex items-center gap-1"><ChevronLeft size={16} /> Back</button>
              <button onClick={handleVerify} disabled={loading || !otp} className="btn btn-primary flex-1">{loading ? 'Verifying...' : 'Verify'}</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800">Grant Permission for Coexistence</p>
              <p className="text-xs text-blue-700 mt-1">This allows CRM Final to send messages from your existing WhatsApp Business number. You can confirm by going to WhatsApp Business app → Settings → Account → Business Platform.</p>
            </div>
            <button onClick={handlePermissions} disabled={loading} className="btn btn-primary w-full">{loading ? 'Connecting...' : 'Grant Permission & Connect'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
