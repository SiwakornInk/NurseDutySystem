import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function Layout({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ uid: firebaseUser.uid, ...userDoc.data() });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = user?.isAdmin ? [
    { href: '/admin/dashboard', icon: 'dashboard', label: 'แดชบอร์ด' },
    { href: '/admin/nurses', icon: 'users', label: 'จัดการพยาบาล' },
    { href: '/admin/schedules', icon: 'calendar', label: 'ตารางเวรทั้งหมด' },
    { href: '/admin/schedule/create', icon: 'plus', label: 'สร้างตารางเวร' },
    { href: '/admin/requests', icon: 'inbox', label: 'อนุมัติคำขอ' },
    { href: '/admin/swaps', icon: 'swap', label: 'จัดการการแลกเวร' },
    { href: '/admin/profile', icon: 'user', label: 'โปรไฟล์' }
  ] : [
    { href: '/dashboard', icon: 'home', label: 'หน้าแรก' },
    { href: '/my-schedule', icon: 'calendar', label: 'ตารางเวรของฉัน' },
    { href: '/schedules', icon: 'grid', label: 'ตารางเวรทั้งหมด' },
    { href: '/requests', icon: 'edit', label: 'ขอหยุด/ขอเวร' },
    { href: '/swaps', icon: 'swap', label: 'แลกเวร' },
    { href: '/profile', icon: 'user', label: 'โปรไฟล์' },
  ];

  const getIcon = (iconName) => {
    const icons = {
      dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
      edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
      swap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
      user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
      inbox: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
      plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    };
    return icons[iconName] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-content">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="navbar-title">ระบบจัดตารางเวรพยาบาล</h1>
          <div className="navbar-user">
            <span className="user-name">{user?.firstName} {user?.lastName}</span>
            <button className="logout-btn" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className="main-container">
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-header">
            <h2>{user?.isAdmin ? 'เมนูผู้ดูแล' : 'เมนูหลัก'}</h2>
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-item ${router.pathname === item.href ? 'active' : ''}`}>
                <span className="nav-icon">{getIcon(item.icon)}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>

      <style jsx>{`
        .layout {
          min-height: 100vh;
          background: var(--gray-50);
        }

        .navbar {
          background: var(--white);
          box-shadow: var(--shadow);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .navbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .menu-toggle {
          display: none;
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
          color: var(--gray-600);
        }

        .menu-toggle svg {
          width: 24px;
          height: 24px;
        }

        .navbar-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--primary);
        }

        .navbar-user {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-name {
          color: var(--gray-700);
          font-weight: 500;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: none;
          border: 1px solid var(--gray-300);
          border-radius: var(--radius);
          color: var(--gray-600);
          cursor: pointer;
          transition: var(--transition);
        }

        .logout-btn:hover {
          background: var(--gray-50);
          border-color: var(--gray-400);
          color: var(--gray-800);
        }

        .logout-btn svg {
          width: 18px;
          height: 18px;
        }

        .main-container {
          display: flex;
          max-width: 1600px;
          margin: 0 auto;
          min-height: calc(100vh - 73px);
        }

        .sidebar {
          width: 250px;
          background: var(--white);
          box-shadow: var(--shadow);
          transition: transform 0.3s ease;
        }

        .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--gray-200);
        }

        .sidebar-header h2 {
          font-size: 1.125rem;
          color: var(--gray-700);
        }

        .sidebar-nav {
          padding: 1rem 0;
        }

        .nav-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .nav-label {
          font-weight: 500;
        }

        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .menu-toggle {
            display: block;
          }

          .navbar-title {
            font-size: 1.25rem;
          }

          .user-name {
            display: none;
          }

          .sidebar {
            position: fixed;
            left: 0;
            top: 73px;
            height: calc(100vh - 73px);
            transform: translateX(-100%);
            z-index: 99;
          }

          .sidebar-open {
            transform: translateX(0);
          }

          .main-content {
            padding: 1rem;
          }
        }
      `}</style>

      <style jsx global>{`
        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1.5rem;
          color: var(--gray-600);
          text-decoration: none;
          transition: var(--transition);
        }

        .nav-item:hover {
          background: var(--gray-50);
          color: var(--primary);
        }

        .nav-item.active {
          background: var(--primary-light);
          color: var(--primary);
          border-right: 3px solid var(--primary);
        }
      `}</style>
    </div>
  );
}