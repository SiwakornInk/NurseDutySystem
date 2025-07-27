import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db, WARDS } from '../../lib/firebase';
import { collection, query, getDocs, doc, getDoc, deleteDoc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminSchedules() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [selectedWard, setSelectedWard] = useState('all');

  useEffect(() => {
    checkAdminAndFetch();
  }, [selectedWard]);

  const checkAdminAndFetch = async () => {
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
      fetchSchedules();
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      let schedulesQuery = collection(db, 'schedules');
      const snapshot = await getDocs(query(schedulesQuery, orderBy('createdAt', 'desc')));
      
      let schedulesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (selectedWard !== 'all') {
        schedulesList = schedulesList.filter(schedule => schedule.wardId === selectedWard);
      }

      setSchedules(schedulesList);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!confirm('ยืนยันการลบตารางเวรนี้? การกระทำนี้ไม่สามารถยกเลิกได้')) return;
    
    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      alert('ลบตารางเวรสำเร็จ');
      fetchSchedules();
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถลบตารางเวรได้');
    }
  };

  const handleView = (scheduleId) => {
    router.push(`/admin/schedules/${scheduleId}`);
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

      <div className="schedules-management">
        <div className="page-header">
          <h1>ตารางเวรทั้งหมด</h1>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/admin/schedule/create')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            สร้างตารางเวรใหม่
          </button>
        </div>

        <div className="filters card">
          <label>กรองตามวอร์ด:</label>
          <select
            className="form-select"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            {WARDS.map(ward => (
              <option key={ward} value={ward}>{ward}</option>
            ))}
          </select>
        </div>

        <div className="schedules-grid">
          {schedules.map((schedule, index) => (
            <div key={schedule.id} className="schedule-card card animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="schedule-header">
                <h3>{schedule.wardId}</h3>
                <span className="schedule-month">
                  {new Date(schedule.month + '-01').toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </span>
              </div>

              <div className="schedule-stats">
                <div className="stat-item">
                  <span className="stat-label">จำนวนพยาบาล</span>
                  <span className="stat-value">{schedule.nurseIds?.length || 0} คน</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">สถานะ Solver</span>
                  <span className={`badge ${schedule.solverStatus === 'OPTIMAL' ? 'badge-success' : 'badge-warning'}`}>
                    {schedule.solverStatus}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">ค่า Penalty</span>
                  <span className="stat-value">{schedule.objectiveValue?.toFixed(0) || 0}</span>
                </div>
              </div>

              <div className="schedule-footer">
                <span className="created-date">
                  สร้างเมื่อ: {schedule.createdAt?.toDate?.().toLocaleDateString('th-TH') || 'N/A'}
                </span>
                <div className="schedule-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleView(schedule.id)}
                  >
                    ดู
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {schedules.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p>ยังไม่มีตารางเวร</p>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/admin/schedule/create')}
            >
              สร้างตารางเวรแรก
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .schedules-management {
          max-width: 1200px;
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

        .filters {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .filters label {
          font-weight: 500;
          color: var(--gray-700);
        }

        .filters .form-select {
          width: auto;
          min-width: 200px;
        }

        .schedules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .schedule-card {
          display: flex;
          flex-direction: column;
          transition: var(--transition);
        }

        .schedule-card:hover {
          transform: translateY(-4px);
        }

        .schedule-header {
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--gray-200);
          margin-bottom: 1rem;
        }

        .schedule-header h3 {
          font-size: 1.125rem;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .schedule-month {
          color: var(--primary);
          font-weight: 500;
        }

        .schedule-stats {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-label {
          color: var(--gray-600);
          font-size: 0.875rem;
        }

        .stat-value {
          font-weight: 600;
          color: var(--gray-800);
        }

        .schedule-footer {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid var(--gray-200);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .created-date {
          font-size: 0.75rem;
          color: var(--gray-500);
        }

        .schedule-actions {
          display: flex;
          gap: 0.5rem;
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
          margin-bottom: 1.5rem;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .schedules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}