import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { auth, db, WARDS, SHIFT_NAMES } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import axios from 'axios';
import Head from 'next/head';

export default function CreateSchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [nurses, setNurses] = useState([]);
  const [requests, setRequests] = useState({ soft: {}, hard: [] });
  const [scheduleParams, setScheduleParams] = useState({
    requiredNurses: { 1: 2, 2: 2, 3: 2 },
    targetOffDays: 8,
    solverTimeLimit: 120
  });
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    checkAdminAuth();
    const now = new Date();
    setSelectedMonth(now.toISOString().slice(0, 7));
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
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchWardData = async () => {
    if (!selectedWard || !selectedMonth) return;
    
    setLoading(true);
    try {
      const nursesQuery = query(
        collection(db, 'users'),
        where('role', '==', 'nurse'),
        where('currentWard', '==', selectedWard)
      );
      const nursesSnapshot = await getDocs(nursesQuery);
      const nursesList = nursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNurses(nursesList);

      const softRequests = {};
      const hardRequests = [];

      for (const nurse of nursesList) {
        const softQuery = query(
          collection(db, 'monthlyRequests'),
          where('userId', '==', nurse.id),
          where('month', '==', selectedMonth)
        );
        const softSnapshot = await getDocs(softQuery);
        if (!softSnapshot.empty) {
          softRequests[nurse.id] = softSnapshot.docs.map(doc => doc.data());
        }

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;
        
        const hardQuery = query(
          collection(db, 'hardRequests'),
          where('userId', '==', nurse.id),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          where('status', '==', 'approved')
        );
        const hardSnapshot = await getDocs(hardQuery);
        hardSnapshot.docs.forEach(doc => {
          hardRequests.push({
            ...doc.data(),
            nurseId: nurse.id
          });
        });
      }

      setRequests({ soft: softRequests, hard: hardRequests });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWard && selectedMonth) {
      fetchWardData();
    }
  }, [selectedWard, selectedMonth]);

  const handleGenerateSchedule = async () => {
    if (!selectedWard || !selectedMonth || nurses.length === 0) {
      alert('กรุณาเลือกวอร์ดและเดือนที่ต้องการสร้างตาราง');
      return;
    }

    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`;

      const payload = {
        wardId: selectedWard,
        nurses: nurses.map(n => ({
          id: n.id,
          firstName: n.firstName,
          lastName: n.lastName,
          isGovernmentOfficial: n.isGovernmentOfficial || false
        })),
        startDate,
        endDate,
        requiredNurses: scheduleParams.requiredNurses,
        targetOffDays: scheduleParams.targetOffDays,
        solverTimeLimit: scheduleParams.solverTimeLimit,
        monthlyRequests: requests.soft,
        hardRequests: requests.hard,
        carryOverFlags: nurses.reduce((acc, n) => {
          acc[n.id] = n.carry_over_priority_flag || false;
          return acc;
        }, {})
      };

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/generate-schedule`,
        payload
      );

      if (response.data && !response.data.error) {
        setGeneratedSchedule(response.data);
        setShowSummary(false);
      } else {
        throw new Error(response.data.error || 'เกิดข้อผิดพลาดในการสร้างตาราง');
      }
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert(error.message || 'ไม่สามารถสร้างตารางเวรได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!generatedSchedule) return;

    try {
      await addDoc(collection(db, 'schedules'), {
        ...generatedSchedule,
        createdAt: new Date(),
        createdBy: auth.currentUser.uid,
        nurseIds: nurses.map(n => n.id)
      });

      if (generatedSchedule.nextCarryOverFlags) {
        for (const [nurseId, flag] of Object.entries(generatedSchedule.nextCarryOverFlags)) {
          const nurseRef = doc(db, 'users', nurseId);
          await updateDoc(nurseRef, { carry_over_priority_flag: flag });
        }
      }

      alert('บันทึกตารางเวรสำเร็จ');
      router.push('/admin/schedules');
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('ไม่สามารถบันทึกตารางเวรได้');
    }
  };

  const renderSchedulePreview = () => {
    if (!generatedSchedule) return null;

    const daysInMonth = new Date(
      parseInt(selectedMonth.split('-')[0]),
      parseInt(selectedMonth.split('-')[1]),
      0
    ).getDate();

    return (
      <div className="schedule-preview">
        <h3>ตารางเวรที่สร้าง - {selectedWard}</h3>
        <div className="table-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
                <th>เช้า</th>
                <th>บ่าย</th>
                <th>ดึก</th>
                <th>รวม</th>
                <th>หยุด</th>
              </tr>
            </thead>
            <tbody>
              {nurses.map(nurse => {
                const nurseShifts = generatedSchedule.shifts[nurse.id];
                const stats = generatedSchedule.statistics[nurse.id];
                
                return (
                  <tr key={nurse.id}>
                    <td className="nurse-name">
                      {nurse.prefix} {nurse.firstName} {nurse.lastName}
                      {nurse.isGovernmentOfficial && <span className="gov-badge">ข้าราชการ</span>}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const date = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
                      const shifts = nurseShifts?.[date] || [];
                      
                      return (
                        <td key={i} className="shift-cell">
                          {shifts.length === 0 ? (
                            <span className="shift-off">-</span>
                          ) : (
                            shifts.map(s => SHIFT_NAMES[s]).join(',')
                          )}
                        </td>
                      );
                    })}
                    <td>{stats?.morning || 0}</td>
                    <td>{stats?.afternoon || 0}</td>
                    <td>{stats?.night || 0}</td>
                    <td>{stats?.total || 0}</td>
                    <td>{stats?.off || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="schedule-actions">
          <button className="btn btn-success" onClick={handleSaveSchedule}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            บันทึกตารางเวร
          </button>
          <button className="btn btn-secondary" onClick={() => setGeneratedSchedule(null)}>
            ยกเลิก
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <Head>
        <title>สร้างตารางเวร - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="create-schedule">
        <div className="page-header">
          <h1>สร้างตารางเวร</h1>
        </div>

        {!generatedSchedule ? (
          <>
            <div className="schedule-form card animate-slideUp">
              <h2>ข้อมูลการสร้างตาราง</h2>
              
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">เลือกวอร์ด</label>
                  <select
                    className="form-select"
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(e.target.value)}
                  >
                    <option value="">-- เลือกวอร์ด --</option>
                    {WARDS.map(ward => (
                      <option key={ward} value={ward}>{ward}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">เลือกเดือน</label>
                  <input
                    type="month"
                    className="form-input"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    min={new Date().toISOString().slice(0, 7)}
                  />
                </div>
              </div>

              {selectedWard && nurses.length > 0 && (
                <div className="ward-info">
                  <p>จำนวนพยาบาลในวอร์ด: <strong>{nurses.length} คน</strong></p>
                  <p>พยาบาลข้าราชการ: <strong>{nurses.filter(n => n.isGovernmentOfficial).length} คน</strong></p>
                </div>
              )}
            </div>

            {selectedWard && nurses.length > 0 && (
              <>
                <div className="schedule-params card animate-fadeIn">
                  <h2>ตั้งค่าการสร้างตาราง</h2>
                  
                  <div className="params-grid">
                    <div className="param-group">
                      <h3>จำนวนพยาบาลต่อเวร</h3>
                      <div className="shift-inputs">
                        <div className="form-group">
                          <label>เวรเช้า</label>
                          <input
                            type="number"
                            className="form-input"
                            min="1"
                            value={scheduleParams.requiredNurses[1]}
                            onChange={(e) => setScheduleParams({
                              ...scheduleParams,
                              requiredNurses: {
                                ...scheduleParams.requiredNurses,
                                1: parseInt(e.target.value) || 1
                              }
                            })}
                          />
                        </div>
                        <div className="form-group">
                          <label>เวรบ่าย</label>
                          <input
                            type="number"
                            className="form-input"
                            min="1"
                            value={scheduleParams.requiredNurses[2]}
                            onChange={(e) => setScheduleParams({
                              ...scheduleParams,
                              requiredNurses: {
                                ...scheduleParams.requiredNurses,
                                2: parseInt(e.target.value) || 1
                              }
                            })}
                          />
                        </div>
                        <div className="form-group">
                          <label>เวรดึก</label>
                          <input
                            type="number"
                            className="form-input"
                            min="1"
                            value={scheduleParams.requiredNurses[3]}
                            onChange={(e) => setScheduleParams({
                              ...scheduleParams,
                              requiredNurses: {
                                ...scheduleParams.requiredNurses,
                                3: parseInt(e.target.value) || 1
                              }
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="param-group">
                      <h3>ตั้งค่าอื่นๆ</h3>
                      <div className="form-group">
                        <label>วันหยุดขั้นต่ำต่อเดือน</label>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          value={scheduleParams.targetOffDays}
                          onChange={(e) => setScheduleParams({
                            ...scheduleParams,
                            targetOffDays: parseInt(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="form-group">
                        <label>เวลาคำนวณสูงสุด (วินาที)</label>
                        <input
                          type="number"
                          className="form-input"
                          min="10"
                          max="300"
                          value={scheduleParams.solverTimeLimit}
                          onChange={(e) => setScheduleParams({
                            ...scheduleParams,
                            solverTimeLimit: parseInt(e.target.value) || 60
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {Object.keys(requests.soft).length > 0 || requests.hard.length > 0 ? (
                  <div className="requests-summary card animate-slideIn">
                    <h2>สรุปคำขอของพยาบาล</h2>
                    
                    {Object.keys(requests.soft).length > 0 && (
                      <div className="soft-requests">
                        <h3>Soft Requests</h3>
                        {Object.entries(requests.soft).map(([nurseId, reqs]) => {
                          const nurse = nurses.find(n => n.id === nurseId);
                          return (
                            <div key={nurseId} className="request-item">
                              <strong>{nurse?.firstName} {nurse?.lastName}</strong>
                              <ul>
                                {reqs.map((req, idx) => (
                                  <li key={idx}>
                                    {req.type} {req.value && `(${req.value})`}
                                    {req.isHighPriority && <span className="badge badge-warning">สำคัญมาก</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {requests.hard.length > 0 && (
                      <div className="hard-requests">
                        <h3>Hard Requests (วันหยุด)</h3>
                        {requests.hard.map((req, idx) => {
                          const nurse = nurses.find(n => n.id === req.nurseId);
                          return (
                            <div key={idx} className="request-item">
                              <strong>{nurse?.firstName} {nurse?.lastName}</strong>
                              <span>วันที่ {new Date(req.date).getDate()}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-requests card">
                    <p>ไม่มีคำขอจากพยาบาลในเดือนนี้</p>
                  </div>
                )}

                <div className="generate-actions">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowSummary(true)}
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ตรวจสอบก่อนสร้าง
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          renderSchedulePreview()
        )}

        {showSummary && (
          <div className="modal-overlay" onClick={() => setShowSummary(false)}>
            <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>ยืนยันการสร้างตารางเวร</h2>
                <button className="modal-close" onClick={() => setShowSummary(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <div className="summary-content">
                  <div className="summary-item">
                    <span>วอร์ด:</span>
                    <strong>{selectedWard}</strong>
                  </div>
                  <div className="summary-item">
                    <span>เดือน:</span>
                    <strong>{new Date(selectedMonth + '-01').toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long'
                    })}</strong>
                  </div>
                  <div className="summary-item">
                    <span>จำนวนพยาบาล:</span>
                    <strong>{nurses.length} คน</strong>
                  </div>
                  <div className="summary-item">
                    <span>เวรต่อวัน:</span>
                    <strong>เช้า {scheduleParams.requiredNurses[1]} / บ่าย {scheduleParams.requiredNurses[2]} / ดึก {scheduleParams.requiredNurses[3]}</strong>
                  </div>
                  <div className="summary-item">
                    <span>วันหยุดขั้นต่ำ:</span>
                    <strong>{scheduleParams.targetOffDays} วัน</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowSummary(false);
                    handleGenerateSchedule();
                  }}
                  disabled={loading}
                >
                  {loading ? <span className="loading-spinner"></span> : 'สร้างตารางเวร'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowSummary(false)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .create-schedule {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
        }

        .schedule-form h2, .schedule-params h2, .requests-summary h2 {
          font-size: 1.25rem;
          color: var(--gray-800);
          margin-bottom: 1.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .ward-info {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
        }

        .params-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .param-group h3 {
          font-size: 1rem;
          color: var(--gray-700);
          margin-bottom: 1rem;
        }

        .shift-inputs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .requests-summary {
          margin-bottom: 2rem;
        }

        .soft-requests, .hard-requests {
          margin-bottom: 1.5rem;
        }

        .soft-requests h3, .hard-requests h3 {
          font-size: 1rem;
          color: var(--gray-700);
          margin-bottom: 1rem;
        }

        .request-item {
          padding: 0.75rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          margin-bottom: 0.5rem;
        }

        .request-item ul {
          margin: 0.5rem 0 0 1.5rem;
          padding: 0;
        }

        .no-requests {
          text-align: center;
          padding: 3rem;
          color: var(--gray-500);
        }

        .generate-actions {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
        }

        .btn-lg {
          padding: 1rem 2rem;
          font-size: 1.125rem;
        }

        .schedule-preview {
          background: white;
          border-radius: var(--radius-lg);
          padding: 2rem;
          box-shadow: var(--shadow-md);
        }

        .schedule-preview h3 {
          font-size: 1.5rem;
          color: var(--gray-800);
          margin-bottom: 1.5rem;
        }

        .table-container {
          overflow-x: auto;
          margin-bottom: 2rem;
        }

        .schedule-table {
          width: 100%;
          border-collapse: collapse;
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
        }

        .nurse-name {
          text-align: left !important;
          white-space: nowrap;
          font-weight: 500;
        }

        .gov-badge {
          display: inline-block;
          margin-left: 0.5rem;
          padding: 0.125rem 0.5rem;
          background: var(--primary);
          color: white;
          font-size: 0.75rem;
          border-radius: 9999px;
        }

        .shift-cell {
          font-weight: 500;
        }

        .shift-off {
          color: var(--gray-400);
        }

        .schedule-actions {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--gray-50);
          border-radius: var(--radius);
        }

        @media (max-width: 768px) {
          .shift-inputs {
            grid-template-columns: 1fr;
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
}