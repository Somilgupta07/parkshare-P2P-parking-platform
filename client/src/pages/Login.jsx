import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from?.pathname || '/';
  const [step, setStep] = useState('phone');
  const [form, setForm] = useState({ phone: '+91', otp: '', name: '', role: 'seeker' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (user) return <Navigate to={from} replace />;

  const run = (fn) => async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await fn(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const sendOtp = run(async () => {
    const d = await requestOtp(form.phone.trim());
    setInfo(d.devOtp ? `Dev mode OTP: ${d.devOtp}` : 'OTP sent to your phone');
    setStep('otp');
  });

  const verify = run(async () => {
    const payload = { phone: form.phone.trim(), otp: form.otp, role: form.role };
    if (form.name.trim()) payload.name = form.name.trim();
    await verifyOtp(payload);
    navigate(from, { replace: true });
  });

  return (
    <div className="card narrow">
      <h2>Login / Sign up</h2>
      {error && <p className="error">{error}</p>}
      {step === 'phone' ? (
        <form onSubmit={sendOtp}>
          <label>Phone number (with country code)
            <input value={form.phone} onChange={set('phone')} placeholder="+919876543210" required />
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send OTP'}</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          {info && <p className="muted">{info}</p>}
          <label>OTP
            <input value={form.otp} onChange={set('otp')} inputMode="numeric" maxLength={6} placeholder="6-digit code" required />
          </label>
          <label>Name (new users)
            <input value={form.name} onChange={set('name')} placeholder="Your name" />
          </label>
          <label>I want to
            <select value={form.role} onChange={set('role')}>
              <option value="seeker">Find parking</option>
              <option value="host">List my parking space</option>
            </select>
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Verifying...' : 'Verify & continue'}</button>
          <button type="button" className="btn ghost" onClick={() => setStep('phone')}>Change number</button>
        </form>
      )}
    </div>
  );
}
