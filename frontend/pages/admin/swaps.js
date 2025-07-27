import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db, SHIFT_NAMES } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminSwaps() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchSwaps();
    }
  }, [filter]);

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
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchSwaps = async () => {
    setLoading(true);
    try {
      let swapsQuery;
      if (filter === 'all') {
        swapsQuery = query(collection(db, 'shiftSwaps'), orderBy('createdAt', 'desc'));
      } else {
        swapsQuery = query(
          collection(db, 'shiftSwaps'),
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      
      const snapshot = await getDocs(swapsQuery);
      
      const swapsList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          
          const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
          const fromUser = fromUserDoc.exists() ? fromUserDoc.data() : {};
          
          let toUser = null;
          if (data.toUserId) {
            const toUserDoc = await getDoc(doc(db, 'users', data.toUserId));
            toUser = toUserDoc.exists() ? toUserDoc.data() : {};
          }
          
          return {
            id: docSnap.id,
            ...data,
            fromUserName: `${fromUser.prefix || ''} ${fromUser.firstName || ''} ${fromUser.lastName || ''}`,
            fromUserWard: fromUser.currentWard || '',
            toUserName: toUser ? `${toUser.prefix || ''} ${toUser.firstName || ''} ${toUser.lastName || ''}` : null,
            toUserWard: toUser ? toUser.currentWard || '' : null
          };
        })
      );
      
      setSwaps(swapsList);
    } catch (error) {
      console.error('Error fetching swaps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (swapId) => {
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), {
        status: 'approved',
        adminApprovedAt: new Date(),
        adminApprovedBy: auth.currentUser.uid
      });
      
      alert('อนุมัติการแลกเวรสำเร็จ');
      fetchSwaps();
    } catch (error) {
      console.error('Error approving swap:', error);
      alert('ไม่สามารถอนุมัติการแลกเวรได้');
    }
  };

  const handleReject = async (swapId) => {
    const reason = prompt('กรุณาระบุเหตุผลที่ปฏิเสธ:');
    if (!reason) return;
    
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), {
        status: 'rejected',
        adminRejectedAt: new Date(),
        adminRejectedBy: auth.currentUser.uid,
        adminRejectReason: reason
      });
      
      alert('ปฏิเสธการแลกเวรสำเร็จ');
      fetchSwaps();
    } catch (error) {
      console.error('Error rejecting swap:', error);
      alert('ไม่สามารถปฏิเสธการแลกเวรได้');
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
        <title>จัดการการแลกเวร - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="admin-swaps">
        <div className="page-header">
          <h1>จัดการการแลกเวร</h1>
          <div className="filter-controls">
            <select
              className="form-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="pending">รอการอนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ปฏิเสธ</option>
              <option value="cancelled">ยกเลิก</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </div>
        </div>

        <div className="swaps-list">
          {swaps.length === 0 ? (
            <div className="empty-state card">
              <p>ไม่มีรายการแลกเวร</p>
            </div>
          ) : (
            swaps.map((swap, index) => (
              <div key={swap.id} className="swap-card card animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="swap-header">
                  <div className="swap-status">
                    <span className={`status-badge status-${swap.status}`}>
                      {swap.status === 'pending' ? 'รอการอนุมัติ' :
                       swap.status === 'approved' ? 'อนุมัติแล้ว' :
                       swap.status === 'rejected' ? 'ปฏิเสธ' : 'ยกเลิก'}
                    </span>
                  </div>
                  <div className="swap-date">
                    สร้างเมื่อ: {swap.createdAt?.toDate?.().toLocaleDateString('th-TH') || 'N/A'}
                  </div>
                </div>

                <div className="swap-content">
                  <div className="swap-parties">
                    <div className="party from-party">
                      <h4>ผู้ขอแลก</h4>
                      <p className="name">{swap.fromUserName}</p>
                      <p className="ward">{swap.fromUserWard}</p>
                      <div className="shift-info">
                        <span className="date">{new Date(swap.fromDate).toLocaleDateString('th-TH')}</span>
                        <span className="shift-badge">{SHIFT_NAMES[swap.fromShift]}</span>
                      </div>
                    </div>

                    <div className="swap-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                      </svg>
                    </div>

                    <div className="party to-party">
                      <h4>ผู้รับแลก</h4>
                      {swap.toUserId ? (
                        <>
                          <p className="name">{swap.toUserName}</p>
                          <p className="ward">{swap.toUserWard}</p>
                          {swap.toDate && (
                            <div className="shift-info">
                              <span className="date">{new Date(swap.toDate).toLocaleDateString('th-TH')}</span>
                              <span className="shift-badge">{SHIFT_NAMES[swap.toShift]}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="pending-text">รอผู้รับแลก</p>
                      )}
                    </div>
                  </div>

                  {swap.reason && (
                    <div className="swap-reason">
                      <strong>เหตุผล:</strong> {swap.reason}
                    </div>
                  )}

                  {swap.adminRejectReason && (
                    <div className="reject-reason">
                      <strong>เหตุผลที่ปฏิเสธ:</strong> {swap.adminRejectReason}
                    </div>
                  )}
                </div>

                {swap.status === 'pending' && swap.toUserId && (
                  <div className="swap-actions">
                    <button
                      className="btn btn-success"
                      onClick={() => handleApprove(swap.id)}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleReject(swap.id)}
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .admin-swaps {
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

        .filter-controls .form-select {
          width: 200px;
        }

        .swaps-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .swap-card {
          padding: 1.5rem;
          transition: var(--transition);
        }

        .swap-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .swap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: var(--radius);
          font-weight: 500;
          font-size: 0.875rem;
        }

        .status-pending {
          background: var(--warning);
          color: white;
        }

        .status-approved {
          background: var(--success);
          color: white;
        }

        .status-rejected {
          background: var(--danger);
          color: white;
        }

        .status-cancelled {
          background: var(--gray-400);
          color: white;
        }

        .swap-date {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .swap-parties {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 2rem;
          align-items: center;
          margin-bottom: 1rem;
        }

        .party {
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
        }

        .party h4 {
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.5rem;
        }

        .party .name {
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .party .ward {
          color: var(--primary);
          font-size: 0.875rem;
          margin-bottom: 0.75rem;
        }

        .shift-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .shift-info .date {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .shift-badge {
          padding: 0.25rem 0.5rem;
          background: var(--primary);
          color: white;
          border-radius: var(--radius);
          font-size: 0.75rem;
          font-weight: 500;
        }

        .swap-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-400);
        }

        .swap-arrow svg {
          width: 32px;
          height: 32px;
        }

        .pending-text {
          color: var(--gray-500);
          font-style: italic;
        }

        .swap-reason, .reject-reason {
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .reject-reason {
          background: #fee;
          color: var(--danger);
        }

        .swap-actions {
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
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .filter-controls .form-select {
            width: 100%;
          }

          .swap-parties {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .swap-arrow {
            transform: rotate(90deg);
          }

          .swap-actions {
            flex-direction: column;
          }

          .swap-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </Layout>
  );
}