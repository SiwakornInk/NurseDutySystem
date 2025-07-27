import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (auth.currentUser) {
        router.push('/dashboard');
      }
    };
    checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
      }

      const userData = userDoc.data();
      if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message === 'Firebase: Error (auth/invalid-credential).' ? 
        'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!resetEmail.endsWith('@gmail.com')) {
      setError('กรุณาใช้อีเมล @gmail.com เท่านั้น');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess(true);
      setTimeout(() => {
        setResetMode(false);
        setResetSuccess(false);
        setResetEmail('');
      }, 5000);
    } catch (err) {
      setError('ไม่พบอีเมลนี้ในระบบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>เข้าสู่ระบบ - ระบบจัดตารางเวรพยาบาล</title>
      </Head>
      <div className="login-container">
        <div className="login-bg gradient-bg"></div>
        <div className="login-content">
          <div className="login-card card animate-slideUp">
            <div className="login-header">
              <div className="hospital-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M4 21V7l8-4v18M20 21V7l-8-4M9 9h.01M9 12h.01M9 15h.01M9 18h.01"/>
                </svg>
              </div>
              <h1>ระบบจัดตารางเวรพยาบาล</h1>
              <p>โรงพยาบาลมหาวิทยาลัยนเรศวร</p>
            </div>

            {!resetMode ? (
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label className="form-label">อีเมล</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">รหัสผ่าน</label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>

                {error && <div className="error-message animate-fadeIn">{error}</div>}

                <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                  {loading ? <span className="loading-spinner"></span> : 'เข้าสู่ระบบ'}
                </button>

                <div className="login-footer">
                  <a href="#" onClick={(e) => { e.preventDefault(); setResetMode(true); setError(''); }}>
                    ลืมรหัสผ่าน?
                  </a>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="login-form animate-fadeIn">
                <h2>รีเซ็ตรหัสผ่าน</h2>
                <p className="reset-description">
                  กรอกอีเมลที่ใช้ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
                </p>

                <div className="form-group">
                  <label className="form-label">อีเมล</label>
                  <input
                    type="email"
                    className="form-input"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                    disabled={loading}
                  />
                </div>

                {error && <div className="error-message animate-fadeIn">{error}</div>}
                {resetSuccess && (
                  <div className="success-message animate-fadeIn">
                    ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="loading-spinner"></span> : 'ส่งลิงก์รีเซ็ต'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => { setResetMode(false); setError(''); setResetEmail(''); }}
                    disabled={loading}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: -1;
        }

        .login-content {
          width: 100%;
          max-width: 450px;
          padding: 1rem;
        }

        .login-card {
          position: relative;
          overflow: hidden;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .hospital-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1rem;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          animation: pulse 2s infinite;
        }

        .hospital-icon svg {
          width: 40px;
          height: 40px;
        }

        .login-header h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .login-header p {
          color: var(--gray-600);
          font-size: 1.125rem;
        }

        .login-form h2 {
          text-align: center;
          margin-bottom: 1rem;
          color: var(--gray-800);
        }

        .reset-description {
          text-align: center;
          color: var(--gray-600);
          margin-bottom: 2rem;
        }

        .login-btn {
          width: 100%;
          padding: 1rem;
          font-size: 1.125rem;
        }

        .login-footer {
          text-align: center;
          margin-top: 1.5rem;
        }

        .login-footer a {
          color: var(--primary);
          font-weight: 500;
          transition: var(--transition);
        }

        .login-footer a:hover {
          color: var(--primary-dark);
        }

        .error-message, .success-message {
          padding: 0.75rem 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
          text-align: center;
          font-size: 0.875rem;
        }

        .error-message {
          background: #fee;
          color: var(--danger);
          border: 1px solid #fcc;
        }

        .success-message {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
        }

        .form-actions button {
          flex: 1;
        }
      `}</style>
    </>
  );
}