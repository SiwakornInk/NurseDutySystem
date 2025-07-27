import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db, SHIFT_NAMES } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import axios from 'axios';
import Head from 'next/head';

export default function Swaps() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mySwaps, setMySwaps] = useState([]);
  const [availableSwaps, setAvailableSwaps] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [myShifts, setMyShifts] = useState([]);
  const [formData, setFormData] = useState({
    fromDate: '',
    fromShift: '',
    targetNurseId: '',
    toDate: '',
    toShift: '',
    reason: ''
  });

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const currentMonth = new Date().toISOString().slice(0, 7);

      const scheduleQuery = query(
        collection(db, 'schedules'),
        where('month', '==', currentMonth),
        where('nurseIds', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );
      const scheduleSnapshot = await getDocs(scheduleQuery);
      
      if (!scheduleSnapshot.empty) {
        const schedule = scheduleSnapshot.docs[0].data();
        setCurrentSchedule(schedule);
        
        const userShifts = schedule.shifts[userId] || {};
        const shiftsArray = Object.entries(userShifts)
          .filter(([_, shifts]) => shifts.length > 0)
          .map(([date, shifts]) => ({ date, shifts }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setMyShifts(shiftsArray);
      }

      const mySwapsQuery = query(
        collection(db, 'shiftSwaps'),
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );
      const mySwapsSnapshot = await getDocs(mySwapsQuery);
      const mySwapsList = await Promise.all(
        mySwapsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const fromUser = await getDoc(doc(db, 'users', data.fromUserId));
          const toUser = await getDoc(doc(db, 'users', data.toUserId));
          
          return {
            id: docSnap.id,
            ...data,
            fromUserName: fromUser.exists() ? 
              `${fromUser.data().firstName} ${fromUser.data().lastName}` : 'Unknown',
            toUserName: toUser.exists() ? 
              `${toUser.data().firstName} ${toUser.data().lastName}` : 'Unknown'
          };
        })
      );
      setMySwaps(mySwapsList);

      const availableQuery = query(
        collection(db, 'shiftSwaps'),
        where('status', '==', 'pending'),
        where('toUserId', '==', null)
      );
      const availableSnapshot = await getDocs(availableQuery);
      const availableList = await Promise.all(
        availableSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (data.fromUserId === userId) return null;
          
          const fromUser = await getDoc(doc(db, 'users', data.fromUserId));
          return {
            id: docSnap.id,
            ...data,
            fromUserName: fromUser.exists() ? 
              `${fromUser.data().firstName} ${fromUser.data().lastName}` : 'Unknown'
          };
        })
      );
      setAvailableSwaps(availableList.filter(Boolean));

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSwap = async () => {
    try {
      const swapData = {
        fromUserId: auth.currentUser.uid,
        toUserId: formData.targetNurseId || null,
        fromDate: formData.fromDate,
        fromShift: parseInt(formData.fromShift),
        toDate: formData.toDate,
        toShift: formData.toShift ? parseInt(formData.toShift) : null,
        reason: formData.reason,
        status: 'pending',
        participants: formData.targetNurseId ? 
          [auth.currentUser.uid, formData.targetNurseId] : 
          [auth.currentUser.uid],
        createdAt: new Date()
      };

      if (formData.targetNurseId) {
        const validation = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/validate-swap`,
          {
            fromNurseId: swapData.fromUserId,
            toNurseId: swapData.toUserId,
            fromDate: swapData.fromDate,
            toDate: swapData.toDate,
            fromShift: swapData.fromShift,
            toShift: swapData.toShift
          }
        );

        if (!validation.data.valid) {
          alert(validation.data.reason);
          return;
        }
      }

      await addDoc(collection(db, 'shiftSwaps'), swapData);
      alert('สร้างคำขอแลกเวรสำเร็จ');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating swap:', error);
      alert('ไม่สามารถสร้างคำขอแลกเวรได้');
    }
  };

  const handleAcceptSwap = async (swapId) => {
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), {
        toUserId: auth.currentUser.uid,
        status: 'approved',
        approvedAt: new Date(),
        participants: [auth.currentUser.uid, ...mySwaps.find(s => s.id === swapId).participants]
      });
      
      alert('ยอมรับการแลกเวรสำเร็จ');
      fetchData();
    } catch (error) {
      console.error('Error accepting swap:', error);
      alert('ไม่สามารถยอมรับการแลกเวรได้');
    }
  };

  const handleCancelSwap = async (swapId) => {
    if (!confirm('ยืนยันการยกเลิกคำขอแลกเวร?')) return;
    
    try {
      await updateDoc(doc(db, 'shiftSwaps', swapId), {
        status: 'cancelled',
        cancelledAt: new Date()
      });
      
      alert('ยกเลิกคำขอสำเร็จ');
      fetchData();
    } catch (error) {
      console.error('Error cancelling swap:', error);
      alert('ไม่สามารถยกเลิกคำขอได้');
    }
  };

  const resetForm = () => {
    setFormData({
      fromDate: '',
      fromShift: '',
      targetNurseId: '',
      toDate: '',
      toShift: '',
      reason: ''
    });
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
        <title>แลกเวร - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="swaps-container">
        <div className="page-header">
          <h1>จัดการการแลกเวร</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!currentSchedule || myShifts.length === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
            สร้างคำขอแลกเวร
          </button>
        </div>

        <div className="swaps-sections">
          <div className="my-swaps-section">
            <div className="section-header">
              <h2>คำขอของฉัน</h2>
              <span className="badge">{mySwaps.length}</span>
            </div>

            {mySwaps.length === 0 ? (
              <div className="empty-state card">
                <p>ยังไม่มีคำขอแลกเวร</p>
              </div>
            ) : (
              <div className="swaps-list">
                {mySwaps.map(swap => (
                  <div key={swap.id} className="swap-card card animate-fadeIn">
                    <div className="swap-header">
                      <div className="swap-parties">
                        <div className="party from">
                          <span className="label">จาก:</span>
                          <strong>{swap.fromUserName}</strong>
                          <span className="date">{new Date(swap.fromDate).toLocaleDateString('th-TH')}</span>
                          <span className="badge badge-primary">{SHIFT_NAMES[swap.fromShift]}</span>
                        </div>
                        <div className="swap-arrow">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                          </svg>
                        </div>
                        <div className="party to">
                          <span className="label">ไป:</span>
                          <strong>{swap.toUserName || 'รอผู้รับ'}</strong>
                          {swap.toDate && (
                            <>
                              <span className="date">{new Date(swap.toDate).toLocaleDateString('th-TH')}</span>
                              <span className="badge badge-primary">{SHIFT_NAMES[swap.toShift]}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`swap-status status-${swap.status}`}>
                        {swap.status === 'pending' ? 'รออนุมัติ' : 
                         swap.status === 'approved' ? 'อนุมัติแล้ว' : 
                         swap.status === 'rejected' ? 'ปฏิเสธ' : 'ยกเลิก'}
                      </div>
                    </div>
                    
                    {swap.reason && (
                      <div className="swap-reason">
                        <strong>เหตุผล:</strong> {swap.reason}
                      </div>
                    )}

                    {swap.status === 'pending' && swap.fromUserId === auth.currentUser.uid && (
                      <div className="swap-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancelSwap(swap.id)}
                        >
                          ยกเลิกคำขอ
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="available-swaps-section">
            <div className="section-header">
              <h2>คำขอที่รอคนรับ</h2>
              <span className="badge">{availableSwaps.length}</span>
            </div>

            {availableSwaps.length === 0 ? (
              <div className="empty-state card">
                <p>ไม่มีคำขอที่รอคนรับ</p>
              </div>
            ) : (
              <div className="swaps-list">
                {availableSwaps.map(swap => (
                  <div key={swap.id} className="swap-card card animate-fadeIn">
                    <div className="swap-offer">
                      <div className="offer-from">
                        <strong>{swap.fromUserName}</strong>
                        <p>ต้องการแลกเวร</p>
                      </div>
                      <div className="offer-details">
                        <div className="offer-shift">
                          <span className="date">{new Date(swap.fromDate).toLocaleDateString('th-TH')}</span>
                          <span className="badge badge-primary">{SHIFT_NAMES[swap.fromShift]}</span>
                        </div>
                        {swap.reason && <p className="reason">{swap.reason}</p>}
                      </div>
                      <button
                        className="btn btn-success"
                        onClick={() => handleAcceptSwap(swap.id)}
                      >
                        รับแลกเวร
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>สร้างคำขอแลกเวร</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="swap-form">
                <div className="form-section">
                  <h3>เวรที่ต้องการแลก</h3>
                  <div className="form-group">
                    <label className="form-label">เลือกเวรของคุณ</label>
                    <select
                      className="form-select"
                      value={`${formData.fromDate}-${formData.fromShift}`}
                      onChange={(e) => {
                        const [date, shift] = e.target.value.split('-');
                        setFormData({ ...formData, fromDate: date, fromShift: shift });
                      }}
                    >
                      <option value="">-- เลือกเวร --</option>
                      {myShifts.map(({ date, shifts }) => 
                        shifts.map(shift => (
                          <option key={`${date}-${shift}`} value={`${date}-${shift}`}>
                            {new Date(date).toLocaleDateString('th-TH')} - {SHIFT_NAMES[shift]}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-section">
                  <h3>รายละเอียดการแลก</h3>
                  <div className="form-group">
                    <label className="form-label">รูปแบบการแลก</label>
                    <div className="swap-type-options">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="swapType"
                          value="open"
                          checked={!formData.targetNurseId}
                          onChange={() => setFormData({ ...formData, targetNurseId: '', toDate: '', toShift: '' })}
                        />
                        <span>เปิดให้ใครก็ได้รับแลก</span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="swapType"
                          value="specific"
                          checked={!!formData.targetNurseId}
                          onChange={() => setFormData({ ...formData, targetNurseId: 'select' })}
                        />
                        <span>ระบุคนที่ต้องการแลกด้วย</span>
                      </label>
                    </div>
                  </div>

                  {formData.targetNurseId && (
                    <>
                      <div className="form-group">
                        <label className="form-label">เลือกพยาบาล</label>
                        <select
                          className="form-select"
                          value={formData.targetNurseId}
                          onChange={(e) => setFormData({ ...formData, targetNurseId: e.target.value })}
                        >
                          <option value="select">-- เลือกพยาบาล --</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">เวรที่ต้องการได้</label>
                        <div className="form-grid">
                          <input
                            type="date"
                            className="form-input"
                            value={formData.toDate}
                            onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                          />
                          <select
                            className="form-select"
                            value={formData.toShift}
                            onChange={(e) => setFormData({ ...formData, toShift: e.target.value })}
                          >
                            <option value="">-- เลือกเวร --</option>
                            <option value="1">เช้า</option>
                            <option value="2">บ่าย</option>
                            <option value="3">ดึก</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label">เหตุผล</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="ระบุเหตุผลในการขอแลกเวร"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleCreateSwap}
                disabled={!formData.fromDate || !formData.fromShift}
              >
                สร้างคำขอ
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .swaps-container {
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

        .swaps-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          font-size: 1.25rem;
          color: var(--gray-800);
        }

        .swaps-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .swap-card {
          padding: 1.5rem;
        }

        .swap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .swap-parties {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex: 1;
        }

        .party {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .party .label {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .party strong {
          color: var(--gray-800);
        }

        .party .date {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .swap-arrow {
          color: var(--gray-400);
        }

        .swap-arrow svg {
          width: 24px;
          height: 24px;
        }

        .swap-status {
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

        .swap-reason {
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }

        .swap-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .swap-offer {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .offer-from {
          flex-shrink: 0;
        }

        .offer-from strong {
          display: block;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .offer-from p {
          color: var(--gray-600);
          font-size: 0.875rem;
        }

        .offer-details {
          flex: 1;
        }

        .offer-shift {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .reason {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--gray-500);
        }

        .swap-form .form-section {
          margin-bottom: 2rem;
        }

        .swap-form h3 {
          font-size: 1rem;
          color: var(--gray-700);
          margin-bottom: 1rem;
        }

        .swap-type-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .radio-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .radio-label input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .swaps-sections {
            grid-template-columns: 1fr;
          }

          .swap-parties {
            flex-direction: column;
            align-items: flex-start;
          }

          .swap-arrow {
            transform: rotate(90deg);
          }

          .swap-offer {
            flex-direction: column;
            align-items: stretch;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}