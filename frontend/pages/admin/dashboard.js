import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db, WARDS } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Head from 'next/head';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalNurses: 0,
    nursesByWard: {},
    pendingRequests: 0,
    activeSwaps: 0,
    currentMonthSchedules: 0
  });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setUser(userDoc.data());
      fetchDashboardStats();
    } catch (error) {
      console.error('Error checking admin auth:', error);
      router.push('/login');
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const nursesSnapshot = await getDocs(collection(db, 'users'));
      const nurses = nursesSnapshot.docs.filter(doc => doc.data().role === 'nurse');
      
      const wardCounts = {};
      WARDS.forEach(ward => wardCounts[ward] = 0);
      
      nurses.forEach(doc => {
        const ward = doc.data().currentWard;
        if (ward && wardCounts[ward] !== undefined) {
          wardCounts[ward]++;
        }
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const requestsQuery = query(
        collection(db, 'monthlyRequests'),
        where('month', '==', currentMonth),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);

      const swapsQuery = query(
        collection(db, 'shiftSwaps'),
        where('status', '==', 'pending')
      );
      const swapsSnapshot = await getDocs(swapsQuery);

      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('month', '==', currentMonth)
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);

      setStats({
        totalNurses: nurses.length,
        nursesByWard: wardCounts,
        pendingRequests: requestsSnapshot.size,
        activeSwaps: swapsSnapshot.size,
        currentMonthSchedules: schedulesSnapshot.size
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = Object.entries(stats.nursesByWard)
    .filter(([_, count]) => count > 0)
    .map(([ward, count]) => ({
      name: ward.replace('วอร์ด', ''),
      value: count
    }));

  const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93bbfc', '#c7d2fe', '#e0e7ff', '#ede9fe', '#f5f3ff'];

  const barData = Object.entries(stats.nursesByWard).map(([ward, count]) => ({
    ward: ward.replace('วอร์ด', ''),
    จำนวน: count
  }));

  if (loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>แดชบอร์ดผู้ดูแล - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="admin-dashboard">
        <div className="dashboard-header animate-slideUp">
          <h1>ภาพรวมระบบ</h1>
          <p>ยินดีต้อนรับ, {user?.firstName} {user?.lastName}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card card gradient-primary animate-fadeIn">
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>พยาบาลทั้งหมด</h3>
              <p className="stat-number">{stats.totalNurses}</p>
              <span className="stat-label">คน</span>
            </div>
          </div>

          <div className="stat-card card gradient-success animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>ตารางเดือนนี้</h3>
              <p className="stat-number">{stats.currentMonthSchedules}</p>
              <span className="stat-label">วอร์ด</span>
            </div>
          </div>

          <div className="stat-card card gradient-warning animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l5 5L22 8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>คำขอรออนุมัติ</h3>
              <p className="stat-number">{stats.pendingRequests}</p>
              <span className="stat-label">รายการ</span>
            </div>
          </div>

          <div className="stat-card card gradient-danger animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <div className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>การแลกเวร</h3>
              <p className="stat-number">{stats.activeSwaps}</p>
              <span className="stat-label">รายการ</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card card animate-slideIn">
            <h2>สัดส่วนพยาบาลแต่ละวอร์ด</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card card animate-slideIn">
            <h2>จำนวนพยาบาลตามวอร์ด</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ward" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="จำนวน" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="quick-actions card animate-slideUp">
          <h2>การดำเนินการด่วน</h2>
          <div className="actions-grid">
            <button className="action-btn" onClick={() => router.push('/admin/nurses')}>
              <div className="action-icon add">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8 7a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"/>
                </svg>
              </div>
              <span>เพิ่มพยาบาล</span>
            </button>
            <button className="action-btn" onClick={() => router.push('/admin/schedule/create')}>
              <div className="action-icon create">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M8 11h3M8 15h5"/>
                </svg>
              </div>
              <span>สร้างตาราง</span>
            </button>
            <button className="action-btn" onClick={() => router.push('/admin/requests')}>
              <div className="action-icon review">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l5 5L22 8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <span>ตรวจคำขอ</span>
            </button>
            <button className="action-btn" onClick={() => router.push('/admin/swaps')}>
              <div className="action-icon swap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                </svg>
              </div>
              <span>จัดการแลกเวร</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-dashboard {
          max-width: 1400px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .dashboard-header {
          margin-bottom: 2rem;
        }

        .dashboard-header h1 {
          font-size: 2rem;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .dashboard-header p {
          color: var(--gray-600);
          font-size: 1.125rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          color: white;
          padding: 2rem;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.1);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }

        .stat-card:hover::before {
          transform: translateX(0);
        }

        .gradient-primary {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        }

        .gradient-success {
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
        }

        .gradient-warning {
          background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
        }

        .gradient-danger {
          background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
        }

        .stat-icon {
          position: absolute;
          right: 1.5rem;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.3;
        }

        .stat-icon svg {
          width: 60px;
          height: 60px;
        }

        .stat-content h3 {
          font-size: 0.875rem;
          opacity: 0.9;
          margin-bottom: 0.5rem;
        }

        .stat-number {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 1rem;
          opacity: 0.8;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .chart-card h2 {
          font-size: 1.25rem;
          color: var(--gray-800);
          margin-bottom: 1.5rem;
        }

        .chart-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .quick-actions h2 {
          font-size: 1.25rem;
          color: var(--gray-800);
          margin-bottom: 1.5rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem 1rem;
          background: var(--gray-50);
          border: 2px solid transparent;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: var(--transition);
        }

        .action-btn:hover {
          background: var(--white);
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .action-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }

        .action-icon svg {
          width: 30px;
          height: 30px;
          color: white;
        }

        .action-icon.add {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        }

        .action-icon.create {
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
        }

        .action-icon.review {
          background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
        }

        .action-icon.swap {
          background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        }

        .action-btn:hover .action-icon {
          transform: scale(1.1) rotate(5deg);
        }

        .action-btn span {
          font-weight: 500;
          color: var(--gray-700);
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .charts-grid {
            grid-template-columns: 1fr;
          }

          .actions-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}