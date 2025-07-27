import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function Schedules() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    fetchUserAndSchedules();
  }, [selectedMonth]);

  const fetchUserAndSchedules = async () => {
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        router.push('/login');
        return;
      }
      
      const userData = userDoc.data();
      setUser(userData);

      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('wardId', '==', userData.currentWard),
        where('month', '==', selectedMonth)
      );
      
      const snapshot = await getDocs(schedulesQuery);
      const schedulesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSchedules(schedulesList);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <title>ตารางเวรทั้งหมด - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="all-schedules">
        <div className="page-header">
          <h1>ตารางเวร{user?.currentWard || ''}</h1>
          <div className="month-selector">
            <input
              type="month"
              className="form-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>

        {schedules.length > 0 ? (
          <div className="schedule-display">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="schedule-container card animate-slideUp">
                <h2>
                  ตารางเวรประจำเดือน {new Date(selectedMonth + '-01').toLocaleDateString('th-TH', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </h2>
                
                <div className="table-container">
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">ชื่อ-นามสกุล</th>
                        {Array.from({ length: new Date(
                          parseInt(selectedMonth.split('-')[0]),
                          parseInt(selectedMonth.split('-')[1]),
                          0
                        ).getDate() }, (_, i) => (
                          <th key={i}>{i + 1}</th>
                        ))}
                        <th colSpan="6">สรุป</th>
                      </tr>
                      <tr>
                        {Array.from({ length: new Date(
                          parseInt(selectedMonth.split('-')[0]),
                          parseInt(selectedMonth.split('-')[1]),
                          0
                        ).getDate() }, (_, i) => {
                          const date = new Date(selectedMonth + `-${String(i + 1).padStart(2, '0')}`);
                          const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
                          return <th key={i}>{days[date.getDay()]}</th>;
                        })}
                        <th>เช้า</th>
                        <th>บ่าย</th>
                        <th>ดึก</th>
                        <th>รวม</th>
                        <th>หยุด</th>
                        <th>OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.nurseIds?.map(nurseId => {
                        const nurseSchedule = schedule.shifts?.[nurseId] || {};
                        const stats = schedule.statistics?.[nurseId] || {};
                        
                        return (
                          <tr key={nurseId} className={nurseId === auth.currentUser.uid ? 'highlight-row' : ''}>
                            <td className="nurse-name">
                              {nurseId === auth.currentUser.uid ? (
                                <strong>{user?.prefix} {user?.firstName} {user?.lastName}</strong>
                              ) : (
                                <span>พยาบาล</span>
                              )}
                            </td>
                            {Array.from({ length: new Date(
                              parseInt(selectedMonth.split('-')[0]),
                              parseInt(selectedMonth.split('-')[1]),
                              0
                            ).getDate() }, (_, i) => {
                              const dateStr = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
                              const shifts = nurseSchedule[dateStr] || [];
                              
                              return (
                                <td key={i} className={`shift-cell ${getShiftClass(shifts)}`}>
                                  {getShiftDisplay(shifts)}
                                </td>
                              );
                            })}
                            <td>{stats.morning || 0}</td>
                            <td>{stats.afternoon || 0}</td>
                            <td>{stats.night || 0}</td>
                            <td>{stats.total || 0}</td>
                            <td>{stats.off || 0}</td>
                            <td>{stats.overtime || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p>ยังไม่มีตารางเวรสำหรับเดือนนี้</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .all-schedules {
          max-width: 1400px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .page-header h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
        }

        .schedule-container h2 {
          font-size: 1.5rem;
          color: var(--gray-800);
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .table-container {
          overflow-x: auto;
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }

        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 0.875rem;
        }

        .schedule-table th,
        .schedule-table td {
          border: 1px solid var(--gray-200);
          padding: 0.5rem;
          text-align: center;
        }

        .schedule-table th {
          background: var(--gray-50);
          font-weight: 600;
          color: var(--gray-700);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .nurse-name {
          text-align: left !important;
          padding-left: 1rem !important;
          white-space: nowrap;
          position: sticky;
          left: 0;
          background: white;
          z-index: 5;
        }

        .highlight-row {
          background: #fef3c7 !important;
        }

        .highlight-row td {
          font-weight: 500;
        }

        .shift-cell {
          font-weight: 500;
        }

        .shift-morning {
          background: #fef3c7;
          color: #92400e;
        }

        .shift-afternoon {
          background: #dbeafe;
          color: #1e40af;
        }

        .shift-night {
          background: #e9d5ff;
          color: #6b21a8;
        }

        .shift-double {
          background: linear-gradient(135deg, #e9d5ff 50%, #fef3c7 50%);
          color: #6b21a8;
        }

        .shift-off {
          background: var(--gray-50);
          color: var(--gray-400);
        }

        .empty-state {
          text-align: center;
          padding: 4rem;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          background: var(--gray-100);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-400);
        }

        .empty-icon svg {
          width: 40px;
          height: 40px;
        }

        .empty-state p {
          color: var(--gray-600);
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .schedule-table {
            font-size: 0.75rem;
          }

          .schedule-table th,
          .schedule-table td {
            padding: 0.25rem;
          }
        }
      `}</style>
    </Layout>
  );

  function getShiftClass(shifts) {
    if (shifts.length === 0) return 'shift-off';
    if (shifts.length > 1) return 'shift-double';
    if (shifts.includes(1)) return 'shift-morning';
    if (shifts.includes(2)) return 'shift-afternoon';
    if (shifts.includes(3)) return 'shift-night';
    return '';
  }

  function getShiftDisplay(shifts) {
    if (shifts.length === 0) return '-';
    const shiftNames = { 1: 'ช', 2: 'บ', 3: 'ด' };
    return shifts.map(s => shiftNames[s] || '?').join(',');
  }
}