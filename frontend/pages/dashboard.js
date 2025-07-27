import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db, SHIFT_NAMES } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Head from 'next/head';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState({
    morning: 0,
    afternoon: 0,
    night: 0,
    total: 0,
    overtime: 0
  });
  const [recentSwaps, setRecentSwaps] = useState([]);
  const [upcomingShifts, setUpcomingShifts] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userId = auth.currentUser.uid;
      const currentMonth = new Date().toISOString().slice(0, 7);

      const scheduleQuery = query(
        collection(db, 'schedules'),
        where('month', '==', currentMonth),
        where('nurseIds', 'array-contains', userId),
        limit(1)
      );
      const scheduleSnapshot = await getDocs(scheduleQuery);
      
      if (!scheduleSnapshot.empty) {
        const scheduleData = scheduleSnapshot.docs[0].data();
        setCurrentSchedule(scheduleData);
        calculateMonthlyStats(scheduleData, userId);
        extractUpcomingShifts(scheduleData, userId);
      }

      const swapsQuery = query(
        collection(db, 'shiftSwaps'),
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const swapsSnapshot = await getDocs(swapsQuery);
      setRecentSwaps(swapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyStats = (schedule, userId) => {
    const shifts = schedule.shifts?.[userId] || {};
    let stats = { morning: 0, afternoon: 0, night: 0, total: 0, overtime: 0 };

    Object.values(shifts).forEach(dayShifts => {
      if (Array.isArray(dayShifts)) {
        dayShifts.forEach(shift => {
          if (shift === 1) stats.morning++;
          else if (shift === 2) stats.afternoon++;
          else if (shift === 3) stats.night++;
          stats.total++;
        });
        if (dayShifts.length > 1) stats.overtime += dayShifts.length - 1;
      }
    });

    setMonthlyStats(stats);
  };

  const extractUpcomingShifts = (schedule, userId) => {
    const today = new Date();
    const shifts = schedule.shifts?.[userId] || {};
    const upcoming = [];

    Object.entries(shifts).forEach(([date, dayShifts]) => {
      const shiftDate = new Date(date);
      if (shiftDate >= today && upcoming.length < 7) {
        if (Array.isArray(dayShifts) && dayShifts.length > 0) {
          upcoming.push({ date, shifts: dayShifts });
        }
      }
    });

    setUpcomingShifts(upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)));
  };

  const pieData = [
    { name: 'เวรเช้า', value: monthlyStats.morning, color: '#fbbf24' },
    { name: 'เวรบ่าย', value: monthlyStats.afternoon, color: '#3b82f6' },
    { name: 'เวรดึก', value: monthlyStats.night, color: '#8b5cf6' }
  ];

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
        <title>แดชบอร์ด - ระบบจัดตารางเวรพยาบาล</title>
      </Head>
      
      <div className="dashboard">
        <div className="welcome-card card animate-slideUp">
          <div className="welcome-content">
            <h1>สวัสดี, {auth.currentUser?.displayName || 'พยาบาล'}</h1>
            <p>วันนี้ {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card card animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon morning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>เวรเช้า</h3>
              <p className="stat-value">{monthlyStats.morning}</p>
              <p className="stat-label">ครั้ง</p>
            </div>
          </div>

          <div className="stat-card card animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon afternoon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 18a5 5 0 00-10 0"/>
                <line x1="12" y1="2" x2="12" y2="9"/>
                <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
                <line x1="1" y1="18" x2="3" y2="18"/>
                <line x1="21" y1="18" x2="23" y2="18"/>
                <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
                <line x1="23" y1="22" x2="1" y2="22"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>เวรบ่าย</h3>
              <p className="stat-value">{monthlyStats.afternoon}</p>
              <p className="stat-label">ครั้ง</p>
            </div>
          </div>

          <div className="stat-card card animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <div className="stat-icon night">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>เวรดึก</h3>
              <p className="stat-value">{monthlyStats.night}</p>
              <p className="stat-label">ครั้ง</p>
            </div>
          </div>

          <div className="stat-card card animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <div className="stat-icon total">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>รวมทั้งหมด</h3>
              <p className="stat-value">{monthlyStats.total}</p>
              <p className="stat-label">เวร</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="chart-card card animate-slideIn">
            <h2>สัดส่วนการขึ้นเวร</h2>
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
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="upcoming-shifts-card card animate-slideIn">
            <h2>เวรที่กำลังจะถึง</h2>
            <div className="shifts-list">
              {upcomingShifts.length > 0 ? (
                upcomingShifts.map((item, index) => (
                  <div key={index} className="shift-item animate-fadeIn" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="shift-date">
                      <span className="day">{new Date(item.date).getDate()}</span>
                      <span className="month">{new Date(item.date).toLocaleDateString('th-TH', { month: 'short' })}</span>
                    </div>
                    <div className="shift-details">
                      <p className="shift-day">{new Date(item.date).toLocaleDateString('th-TH', { weekday: 'long' })}</p>
                      <div className="shift-badges">
                        {item.shifts.map((shift, i) => (
                          <span key={i} className={`badge badge-${shift === 1 ? 'morning' : shift === 2 ? 'afternoon' : 'night'}`}>
                            {SHIFT_NAMES[shift]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">ไม่มีเวรในช่วง 7 วันข้างหน้า</p>
              )}
            </div>
          </div>
        </div>

        <div className="recent-activity card animate-slideUp">
          <h2>กิจกรรมล่าสุด</h2>
          <div className="activity-list">
            {recentSwaps.length > 0 ? (
              recentSwaps.map((swap, index) => (
                <div key={swap.id} className="activity-item animate-fadeIn" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="activity-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <div className="activity-content">
                    <p>{swap.status === 'pending' ? 'รอการอนุมัติ' : swap.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}</p>
                    <span className="activity-time">{new Date(swap.createdAt?.toDate()).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data">ไม่มีกิจกรรมล่าสุด</p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          max-width: 1400px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .welcome-card {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          overflow: hidden;
        }

        .welcome-content h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .welcome-content p {
          opacity: 0.9;
        }

        .welcome-icon {
          font-size: 4rem;
          opacity: 0.2;
          transform: rotate(15deg);
        }

        .welcome-icon svg {
          width: 120px;
          height: 120px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
        }

        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon svg {
          width: 30px;
          height: 30px;
        }

        .stat-icon.morning {
          background: #fef3c7;
          color: #f59e0b;
        }

        .stat-icon.afternoon {
          background: #dbeafe;
          color: #3b82f6;
        }

        .stat-icon.night {
          background: #e9d5ff;
          color: #8b5cf6;
        }

        .stat-icon.total {
          background: #d1fae5;
          color: #10b981;
        }

        .stat-content h3 {
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--gray-800);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .chart-card h2, .upcoming-shifts-card h2, .recent-activity h2 {
          font-size: 1.25rem;
          margin-bottom: 1.5rem;
          color: var(--gray-800);
        }

        .chart-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .shifts-list, .activity-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .shift-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          transition: var(--transition);
        }

        .shift-item:hover {
          background: var(--gray-100);
          transform: translateX(4px);
        }

        .shift-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--white);
          border-radius: var(--radius);
          padding: 0.5rem 1rem;
          min-width: 60px;
          box-shadow: var(--shadow-sm);
        }

        .shift-date .day {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }

        .shift-date .month {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .shift-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .shift-day {
          font-weight: 500;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .shift-badges {
          display: flex;
          gap: 0.5rem;
        }

        .badge-morning {
          background: #fef3c7;
          color: #92400e;
        }

        .badge-afternoon {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-night {
          background: #e9d5ff;
          color: #6b21a8;
        }

        .activity-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          align-items: center;
        }

        .activity-icon {
          width: 40px;
          height: 40px;
          background: var(--primary);
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .activity-icon svg {
          width: 20px;
          height: 20px;
        }

        .activity-content {
          flex: 1;
        }

        .activity-content p {
          font-weight: 500;
          color: var(--gray-800);
        }

        .activity-time {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .no-data {
          text-align: center;
          color: var(--gray-500);
          padding: 2rem;
        }

        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .welcome-card {
            flex-direction: column;
            text-align: center;
          }

          .welcome-icon {
            margin-top: 1rem;
          }
        }
      `}</style>
    </Layout>
  );
}