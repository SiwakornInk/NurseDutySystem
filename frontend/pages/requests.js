import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import Head from 'next/head';

export default function Requests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('soft');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [requests, setRequests] = useState({ soft: [], hard: [] });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    value: '',
    isHighPriority: false,
    date: '',
    shiftType: ''
  });
  const [userQuota, setUserQuota] = useState({ used: 0, total: 5 });

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    const now = new Date();
    setSelectedMonth(now.toISOString().slice(0, 7));
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchRequests();
      if (activeTab === 'hard') {
        fetchQuota();
      }
    }
  }, [selectedMonth, activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      
      if (activeTab === 'soft') {
        const softQuery = query(
          collection(db, 'monthlyRequests'),
          where('userId', '==', userId),
          where('month', '==', selectedMonth)
        );
        const softSnapshot = await getDocs(softQuery);
        setRequests(prev => ({
          ...prev,
          soft: softSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      } else {
        const hardQuery = query(
          collection(db, 'hardRequests'),
          where('userId', '==', userId),
          orderBy('date', 'asc')
        );
        const hardSnapshot = await getDocs(hardQuery);
        setRequests(prev => ({
          ...prev,
          hard: hardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const userId = auth.currentUser.uid;
      const currentYear = new Date().getFullYear();
      
      const quotaQuery = query(
        collection(db, 'hardRequests'),
        where('userId', '==', userId),
        where('year', '==', currentYear),
        where('status', '==', 'approved')
      );
      
      const snapshot = await getDocs(quotaQuery);
      setUserQuota({ used: snapshot.size, total: 5 });
    } catch (error) {
      console.error('Error fetching quota:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (activeTab === 'soft') {
        const softRequestData = {
          userId: auth.currentUser.uid,
          month: selectedMonth,
          type: formData.type,
          value: formData.value,
          isHighPriority: formData.isHighPriority,
          createdAt: new Date(),
          status: 'pending'
        };
        
        await addDoc(collection(db, 'monthlyRequests'), softRequestData);
      } else {
        if (userQuota.used >= userQuota.total) {
          alert('โควต้าวันหยุดประจำปีเต็มแล้ว');
          return;
        }
        
        const hardRequestData = {
          userId: auth.currentUser.uid,
          date: formData.date,
          year: new Date(formData.date).getFullYear(),
          createdAt: new Date(),
          status: 'pending'
        };
        
        await addDoc(collection(db, 'hardRequests'), hardRequestData);
      }
      
      setShowModal(false);
      resetForm();
      fetchRequests();
      if (activeTab === 'hard') fetchQuota();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('เกิดข้อผิดพลาดในการส่งคำขอ');
    }
  };

  const handleDelete = async (requestId) => {
    if (!confirm('ยืนยันการลบคำขอนี้?')) return;
    
    try {
      const collection = activeTab === 'soft' ? 'monthlyRequests' : 'hardRequests';
      await deleteDoc(doc(db, collection, requestId));
      fetchRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('ไม่สามารถลบคำขอได้');
    }
  };

  const resetForm = () => {
    setFormData({
      type: '',
      value: '',
      isHighPriority: false,
      date: '',
      shiftType: ''
    });
  };

  const requestTypeOptions = [
    { value: 'no_specific_days', label: 'ขอหยุดวันที่ระบุ' },
    { value: 'request_specific_shifts', label: 'ขอเวรที่ต้องการ' },
    { value: 'no_morning_shifts', label: 'ไม่ขึ้นเวรเช้า' },
    { value: 'no_afternoon_shifts', label: 'ไม่ขึ้นเวรบ่าย' },
    { value: 'no_night_shifts', label: 'ไม่ขึ้นเวรดึก' },
    { value: 'no_sundays', label: 'ไม่ขึ้นเวรวันอาทิตย์' },
    { value: 'no_mondays', label: 'ไม่ขึ้นเวรวันจันทร์' },
    { value: 'no_tuesdays', label: 'ไม่ขึ้นเวรวันอังคาร' },
    { value: 'no_wednesdays', label: 'ไม่ขึ้นเวรวันพุธ' },
    { value: 'no_thursdays', label: 'ไม่ขึ้นเวรวันพฤหัสบดี' },
    { value: 'no_fridays', label: 'ไม่ขึ้นเวรวันศุกร์' },
    { value: 'no_saturdays', label: 'ไม่ขึ้นเวรวันเสาร์' }
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
        <title>ขอหยุด/ขอเวร - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="requests-container">
        <div className="requests-header card animate-slideUp">
          <h1>จัดการคำขอ</h1>
          <p>ส่งคำขอหยุดหรือขอเวรที่ต้องการล่วงหน้า</p>
        </div>

        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'soft' ? 'active' : ''}`}
            onClick={() => setActiveTab('soft')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11H3v9h6m0-9v9m0-9h6m-6 0V2h6v9m0 0v9h6v-9m-6 0h6"/>
            </svg>
            Soft Request (รายเดือน)
          </button>
          <button
            className={`tab-btn ${activeTab === 'hard' ? 'active' : ''}`}
            onClick={() => setActiveTab('hard')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Hard Request (วันหยุดประจำปี)
          </button>
        </div>

        {activeTab === 'soft' ? (
          <div className="soft-requests animate-fadeIn">
            <div className="request-controls card">
              <div className="month-selector-wrapper">
                <label>เลือกเดือน</label>
                <input
                  type="month"
                  className="form-input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  min={new Date().toISOString().slice(0, 7)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
                disabled={requests.soft.length >= 2}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                เพิ่มคำขอ
              </button>
            </div>

            <div className="requests-list">
              {requests.soft.length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11H3v9h6m0-9v9m0-9h6m-6 0V2h6v9m0 0v9h6v-9m-6 0h6"/>
                    </svg>
                  </div>
                  <p>ยังไม่มีคำขอสำหรับเดือนนี้</p>
                </div>
              ) : (
                requests.soft.map((request, index) => (
                  <div key={request.id} className="request-item card animate-slideIn" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="request-content">
                      <div className="request-type">
                        {requestTypeOptions.find(opt => opt.value === request.type)?.label || request.type}
                      </div>
                      {request.value && <div className="request-value">ค่า: {request.value}</div>}
                      {request.isHighPriority && (
                        <span className="badge badge-warning">สำคัญมาก</span>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(request.id)}
                    >
                      ลบ
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="hard-requests animate-fadeIn">
            <div className="quota-info card">
              <h3>โควต้าวันหยุดประจำปี</h3>
              <div className="quota-display">
                <div className="quota-used">{userQuota.used}</div>
                <div className="quota-separator">/</div>
                <div className="quota-total">{userQuota.total}</div>
              </div>
              <div className="quota-bar">
                <div
                  className="quota-fill"
                  style={{ width: `${(userQuota.used / userQuota.total) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="request-controls card">
              <button
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
                disabled={userQuota.used >= userQuota.total}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                ขอวันหยุด
              </button>
            </div>

            <div className="requests-list">
              {requests.hard.length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <p>ยังไม่มีคำขอวันหยุด</p>
                </div>
              ) : (
                requests.hard.map((request, index) => (
                  <div key={request.id} className="request-item card animate-slideIn" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="request-content">
                      <div className="request-date">
                        {new Date(request.date).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <span className={`badge badge-${request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {request.status === 'approved' ? 'อนุมัติแล้ว' : request.status === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ'}
                      </span>
                    </div>
                    {request.status === 'pending' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(request.id)}
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeTab === 'soft' ? 'เพิ่ม Soft Request' : 'ขอวันหยุด'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {activeTab === 'soft' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">ประเภทคำขอ</label>
                    <select
                      className="form-select"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="">-- เลือกประเภท --</option>
                      {requestTypeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {(formData.type === 'no_specific_days' || formData.type === 'request_specific_shifts') && (
                    <div className="form-group">
                      <label className="form-label">
                        {formData.type === 'no_specific_days' ? 'วันที่ต้องการหยุด' : 'วันที่และเวร'}
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        placeholder={formData.type === 'no_specific_days' ? 'เช่น 15, 20' : 'เช่น 15:เช้า, 20:บ่าย'}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.isHighPriority}
                        onChange={(e) => setFormData({ ...formData, isHighPriority: e.target.checked })}
                      />
                      <span>ระบุเป็นคำขอสำคัญมาก (High Priority)</span>
                    </label>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">วันที่ต้องการหยุด</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={activeTab === 'soft' ? !formData.type : !formData.date}
              >
                ส่งคำขอ
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .requests-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .requests-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .requests-header h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .requests-header p {
          color: var(--gray-600);
        }

        .tabs-container {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
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

        .tab-btn:hover:not(.active) {
          border-color: var(--gray-300);
          background: var(--gray-50);
        }

        .tab-btn svg {
          width: 24px;
          height: 24px;
        }

        .request-controls {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 2rem;
          padding: 1.5rem;
        }

        .month-selector-wrapper label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--gray-700);
        }

        .quota-info {
          text-align: center;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          color: white;
        }

        .quota-info h3 {
          font-size: 1.125rem;
          margin-bottom: 1rem;
        }

        .quota-display {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .quota-used {
          font-size: 3rem;
          font-weight: 700;
        }

        .quota-separator {
          font-size: 2rem;
          opacity: 0.7;
        }

        .quota-total {
          font-size: 2rem;
          opacity: 0.9;
        }

        .quota-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          overflow: hidden;
        }

        .quota-fill {
          height: 100%;
          background: white;
          transition: width 0.3s ease;
        }

        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .request-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
        }

        .request-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .request-type, .request-date {
          font-weight: 500;
          color: var(--gray-800);
        }

        .request-value {
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .empty-state {
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

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-header h2 {
          font-size: 1.5rem;
          color: var(--gray-800);
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--gray-600);
          transition: var(--transition);
        }

        .modal-close:hover {
          color: var(--gray-800);
        }

        .modal-close svg {
          width: 24px;
          height: 24px;
        }

        .modal-body {
          margin-bottom: 1.5rem;
        }

        .modal-footer {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .tabs-container {
            flex-direction: column;
          }

          .request-controls {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .quota-display {
            gap: 0.25rem;
          }

          .quota-used {
            font-size: 2.5rem;
          }

          .quota-total {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </Layout>
  );
}