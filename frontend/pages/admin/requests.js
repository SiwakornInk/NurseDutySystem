import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminRequests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [selectedMonth, currentUser]);

  const checkAdminAuth = async () => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists() || !userDoc.data().isAdmin) {
        router.push('/dashboard');
        return;
      }
      setCurrentUser(userDoc.data());
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchRequests = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // ดึง Soft Requests ของวอร์ดตัวเอง
      const requestsQuery = query(
        collection(db, 'monthlyRequests'),
        where('wardId', '==', currentUser.currentWard),
        where('month', '==', selectedMonth),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(requestsQuery);
      
      const requestsList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          return {
            id: docSnap.id,
            ...data,
            userName: `${userData.prefix || ''} ${userData.firstName || ''} ${userData.lastName || ''}`,
            position: userData.position || 'พยาบาล'
          };
        })
      );
      
      setRequests(requestsList);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestTypeLabels = {
    'no_specific_days': 'ขอหยุดวันที่ระบุ',
    'request_specific_shifts': 'ขอเวรที่ต้องการ',
    'no_morning_shifts': 'ไม่ขึ้นเวรเช้า',
    'no_afternoon_shifts': 'ไม่ขึ้นเวรบ่าย',
    'no_night_shifts': 'ไม่ขึ้นเวรดึก',
    'no_night_afternoon_double': 'ไม่ขึ้นเวรดึก-บ่าย',
    'no_sundays': 'ไม่ขึ้นเวรวันอาทิตย์',
    'no_mondays': 'ไม่ขึ้นเวรวันจันทร์',
    'no_tuesdays': 'ไม่ขึ้นเวรวันอังคาร',
    'no_wednesdays': 'ไม่ขึ้นเวรวันพุธ',
    'no_thursdays': 'ไม่ขึ้นเวรวันพฤหัสบดี',
    'no_fridays': 'ไม่ขึ้นเวรวันศุกร์',
    'no_saturdays': 'ไม่ขึ้นเวรวันเสาร์'
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
        <title>ดูคำขอของพยาบาล - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="admin-requests">
        <div className="page-header">
          <h1>คำขอของพยาบาล - {currentUser?.currentWard}</h1>
          <p className="subtitle">ดูคำขอ Soft Request ของพยาบาลในวอร์ด</p>
        </div>

        <div className="section-controls card">
          <label>เดือน:</label>
          <input
            type="month"
            className="form-input"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <div className="requests-count">
            <span className="badge badge-primary">
              {requests.length} คำขอ
            </span>
            {requests.filter(r => r.isLocked).length > 0 && (
              <span className="badge badge-secondary">
                {requests.filter(r => r.isLocked).length} ล็อคแล้ว
              </span>
            )}
          </div>
        </div>

        <div className="requests-grid">
          {requests.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11H3v9h6m0-9v9m0-9h6m-6 0V2h6v9m0 0v9h6v-9m-6 0h6"/>
                </svg>
              </div>
              <p>ยังไม่มีคำขอสำหรับเดือนนี้</p>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="request-card card animate-fadeIn">
                <div className="request-header">
                  <div className="request-info">
                    <h3>{request.userName}</h3>
                    <p className="position">{request.position}</p>
                  </div>
                  {request.isLocked && (
                    <span className="badge badge-secondary">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      ล็อคแล้ว
                    </span>
                  )}
                </div>

                <div className="request-body">
                  {request.requests && request.requests.length > 0 ? (
                    <div className="request-list">
                      {request.requests.map((req, idx) => (
                        <div key={idx} className="request-item">
                          <div className="request-type">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 11 12 14 22 4"/>
                              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                            </svg>
                            {requestTypeLabels[req.type] || req.type}
                          </div>
                          {req.value && (
                            <div className="request-value">{req.value}</div>
                          )}
                          {req.isHighPriority && (
                            <span className="badge badge-warning">สำคัญมาก</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-requests">ไม่มีคำขอ</p>
                  )}
                </div>

                <div className="request-footer">
                  <span className="update-time">
                    อัพเดทล่าสุด: {request.updatedAt?.toDate?.().toLocaleDateString('th-TH') || 'N/A'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .admin-requests {
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
          margin-bottom: 2rem;
        }

        .page-header h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--gray-600);
        }

        .section-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .section-controls label {
          font-weight: 500;
          color: var(--gray-700);
        }

        .section-controls .form-input {
          width: auto;
        }

        .requests-count {
          margin-left: auto;
          display: flex;
          gap: 0.5rem;
        }

        .requests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .request-card {
          padding: 1.5rem;
          transition: var(--transition);
        }

        .request-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .request-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .request-info h3 {
          font-size: 1.125rem;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .request-info .position {
          color: var(--gray-600);
          font-size: 0.875rem;
        }

        .badge-secondary {
          background: var(--secondary);
          color: white;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .badge-secondary svg {
          width: 14px;
          height: 14px;
        }

        .request-body {
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }

        .request-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .request-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .request-type {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
          color: var(--gray-800);
        }

        .request-type svg {
          width: 16px;
          height: 16px;
          color: var(--success);
        }

        .request-value {
          margin-left: 1.5rem;
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .no-requests {
          text-align: center;
          color: var(--gray-500);
        }

        .request-footer {
          display: flex;
          justify-content: flex-end;
        }

        .update-time {
          font-size: 0.75rem;
          color: var(--gray-500);
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
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
          .section-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .requests-count {
            margin-left: 0;
            margin-top: 0.5rem;
          }

          .requests-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}