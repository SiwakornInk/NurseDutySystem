import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminRequests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('soft');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [requests, setRequests] = useState({ soft: [], hard: [] });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchRequests();
    }
  }, [activeTab, selectedMonth]);

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
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      if (activeTab === 'soft') {
        const softQuery = query(
          collection(db, 'monthlyRequests'),
          where('month', '==', selectedMonth),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(softQuery);
        
        const softRequests = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};
            
            return {
              id: docSnap.id,
              ...data,
              userName: `${userData.prefix || ''} ${userData.firstName || ''} ${userData.lastName || ''}`,
              ward: userData.currentWard || ''
            };
          })
        );
        
        setRequests(prev => ({ ...prev, soft: softRequests }));
      } else {
        const hardQuery = query(
          collection(db, 'hardRequests'),
          where('status', '==', 'pending'),
          orderBy('date', 'asc')
        );
        const snapshot = await getDocs(hardQuery);
        
        const hardRequests = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};
            
            return {
              id: docSnap.id,
              ...data,
              userName: `${userData.prefix || ''} ${userData.firstName || ''} ${userData.lastName || ''}`,
              ward: userData.currentWard || ''
            };
          })
        );
        
        setRequests(prev => ({ ...prev, hard: hardRequests }));
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, type) => {
    try {
      const collection = type === 'soft' ? 'monthlyRequests' : 'hardRequests';
      await updateDoc(doc(db, collection, requestId), {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: auth.currentUser.uid
      });
      
      alert('อนุมัติคำขอสำเร็จ');
      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('ไม่สามารถอนุมัติคำขอได้');
    }
  };

  const handleReject = async (requestId, type) => {
    const reason = prompt('กรุณาระบุเหตุผลที่ปฏิเสธ:');
    if (!reason) return;
    
    try {
      const collection = type === 'soft' ? 'monthlyRequests' : 'hardRequests';
      await updateDoc(doc(db, collection, requestId), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: auth.currentUser.uid,
        rejectReason: reason
      });
      
      alert('ปฏิเสธคำขอสำเร็จ');
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('ไม่สามารถปฏิเสธคำขอได้');
    }
  };

  const requestTypeLabels = {
    'no_specific_days': 'ขอหยุดวันที่ระบุ',
    'request_specific_shifts': 'ขอเวรที่ต้องการ',
    'no_morning_shifts': 'ไม่ขึ้นเวรเช้า',
    'no_afternoon_shifts': 'ไม่ขึ้นเวรบ่าย',
    'no_night_shifts': 'ไม่ขึ้นเวรดึก',
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
        <title>อนุมัติคำขอ - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="admin-requests">
        <div className="page-header">
          <h1>จัดการคำขอต่างๆ</h1>
        </div>

        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'soft' ? 'active' : ''}`}
            onClick={() => setActiveTab('soft')}
          >
            Soft Requests ({requests.soft.filter(r => r.status === 'pending').length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'hard' ? 'active' : ''}`}
            onClick={() => setActiveTab('hard')}
          >
            Hard Requests ({requests.hard.length})
          </button>
        </div>

        {activeTab === 'soft' && (
          <div className="soft-section">
            <div className="section-controls card">
              <label>เดือน:</label>
              <input
                type="month"
                className="form-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div className="requests-list">
              {requests.soft.filter(r => r.status === 'pending').length === 0 ? (
                <div className="empty-state card">
                  <p>ไม่มีคำขอที่รอการอนุมัติ</p>
                </div>
              ) : (
                requests.soft.filter(r => r.status === 'pending').map((request) => (
                  <div key={request.id} className="request-card card animate-fadeIn">
                    <div className="request-header">
                      <div className="request-info">
                        <h3>{request.userName}</h3>
                        <p className="ward">{request.ward}</p>
                      </div>
                      {request.isHighPriority && (
                        <span className="badge badge-warning">สำคัญมาก</span>
                      )}
                    </div>

                    <div className="request-body">
                      <div className="request-detail">
                        <strong>ประเภท:</strong> {requestTypeLabels[request.type] || request.type}
                      </div>
                      {request.value && (
                        <div className="request-detail">
                          <strong>รายละเอียด:</strong> {request.value}
                        </div>
                      )}
                      <div className="request-detail">
                        <strong>วันที่ส่งคำขอ:</strong> {request.createdAt?.toDate?.().toLocaleDateString('th-TH') || 'N/A'}
                      </div>
                    </div>

                    <div className="request-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApprove(request.id, 'soft')}
                      >
                        อนุมัติ
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(request.id, 'soft')}
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'hard' && (
          <div className="hard-section">
            <div className="requests-list">
              {requests.hard.length === 0 ? (
                <div className="empty-state card">
                  <p>ไม่มีคำขอวันหยุดที่รอการอนุมัติ</p>
                </div>
              ) : (
                requests.hard.map((request) => (
                  <div key={request.id} className="request-card card animate-fadeIn">
                    <div className="request-header">
                      <div className="request-info">
                        <h3>{request.userName}</h3>
                        <p className="ward">{request.ward}</p>
                      </div>
                      <div className="request-date">
                        <span className="date-label">ขอหยุดวันที่</span>
                        <span className="date-value">
                          {new Date(request.date).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="request-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApprove(request.id, 'hard')}
                      >
                        อนุมัติ
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(request.id, 'hard')}
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-requests {
          max-width: 1000px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .page-header h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
          margin-bottom: 2rem;
        }

        .tabs-container {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .tab-btn {
          flex: 1;
          padding: 1rem;
          border: 2px solid var(--gray-200);
          background: var(--white);
          border-radius: var(--radius);
          cursor: pointer;
          transition: var(--transition);
          font-size: 1rem;
          font-weight: 500;
          color: var(--gray-600);
        }

        .tab-btn.active {
          border-color: var(--primary);
          background: var(--primary);
          color: var(--white);
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

        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
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

        .request-info .ward {
          color: var(--primary);
          font-weight: 500;
        }

        .request-date {
          text-align: right;
        }

        .date-label {
          display: block;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .date-value {
          display: block;
          font-weight: 600;
          color: var(--gray-800);
        }

        .request-body {
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }

        .request-detail {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-700);
        }

        .request-detail:last-child {
          margin-bottom: 0;
        }

        .request-detail strong {
          color: var(--gray-800);
          margin-right: 0.5rem;
        }

        .request-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--gray-500);
        }

        @media (max-width: 768px) {
          .tabs-container {
            flex-direction: column;
          }

          .request-header {
            flex-direction: column;
            gap: 1rem;
          }

          .request-date {
            text-align: left;
          }

          .request-actions {
            justify-content: stretch;
          }

          .request-actions .btn {
            flex: 1;
          }
        }
      `}</style>
    </Layout>
  );
}