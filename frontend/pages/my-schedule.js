import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db, SHIFT_NAMES } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import Head from 'next/head';

export default function MySchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [schedule, setSchedule] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    fetchSchedule();
  }, [selectedMonth]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const scheduleQuery = query(
        collection(db, 'schedules'),
        where('month', '==', selectedMonth),
        where('nurseIds', 'array-contains', auth.currentUser.uid),
        limit(1)
      );
      
      const snapshot = await getDocs(scheduleQuery);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSchedule({ id: snapshot.docs[0].id, ...data });
      } else {
        setSchedule(null);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).getDay();
  };

  const getShiftForDay = (day) => {
    if (!schedule || !schedule.shifts || !schedule.shifts[auth.currentUser.uid]) {
      return [];
    }
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    return schedule.shifts[auth.currentUser.uid][dateStr] || [];
  };

  const renderCalendarView = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const shifts = getShiftForDay(day);
      const isToday = new Date().toISOString().slice(0, 10) === `${selectedMonth}-${String(day).padStart(2, '0')}`;
      
      days.push(
        <div key={day} className={`calendar-cell ${isToday ? 'today' : ''} animate-fadeIn`}>
          <div className="day-number">{day}</div>
          <div className="day-shifts">
            {shifts.length === 0 ? (
              <span className="shift-badge off">หยุด</span>
            ) : (
              shifts.map((shift, idx) => (
                <span key={idx} className={`shift-badge shift-${shift}`}>
                  {SHIFT_NAMES[shift]}
                </span>
              ))
            )}
          </div>
        </div>
      );
    }
    
    return <div className="calendar-grid">{days}</div>;
  };

  const renderListView = () => {
    const daysInMonth = getDaysInMonth();
    const shifts = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayShifts = getShiftForDay(day);
      if (dayShifts.length > 0) {
        const date = new Date(selectedMonth + '-' + String(day).padStart(2, '0'));
        shifts.push({
          date,
          day,
          shifts: dayShifts
        });
      }
    }
    
    return (
      <div className="list-view">
        {shifts.length === 0 ? (
          <div className="no-shifts">ไม่มีเวรในเดือนนี้</div>
        ) : (
          shifts.map((item, index) => (
            <div key={index} className="list-item animate-slideIn" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="list-date">
                <div className="date-day">{item.day}</div>
                <div className="date-weekday">
                  {item.date.toLocaleDateString('th-TH', { weekday: 'short' })}
                </div>
              </div>
              <div className="list-shifts">
                {item.shifts.map((shift, idx) => (
                  <span key={idx} className={`shift-badge shift-${shift}`}>
                    {SHIFT_NAMES[shift]}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
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
        <title>ตารางเวรของฉัน - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="my-schedule">
        <div className="schedule-header card animate-slideUp">
          <div className="header-content">
            <h1>ตารางเวรของฉัน</h1>
            <div className="header-controls">
              <input
                type="month"
                className="form-input month-selector"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                  onClick={() => setViewMode('calendar')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  ปฏิทิน
                </button>
                <button
                  className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  รายการ
                </button>
              </div>
            </div>
          </div>
        </div>

        {schedule ? (
          <>
            <div className="schedule-summary card animate-fadeIn">
              <h2>สรุปตารางเวร</h2>
              <div className="summary-grid">
                <div className="summary-item morning">
                  <div className="summary-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <h3>เวรเช้า</h3>
                    <p>{schedule.statistics?.[auth.currentUser.uid]?.morning || 0} ครั้ง</p>
                  </div>
                </div>
                <div className="summary-item afternoon">
                  <div className="summary-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 18a5 5 0 00-10 0"/>
                      <line x1="12" y1="2" x2="12" y2="9"/>
                      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <h3>เวรบ่าย</h3>
                    <p>{schedule.statistics?.[auth.currentUser.uid]?.afternoon || 0} ครั้ง</p>
                  </div>
                </div>
                <div className="summary-item night">
                  <div className="summary-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <h3>เวรดึก</h3>
                    <p>{schedule.statistics?.[auth.currentUser.uid]?.night || 0} ครั้ง</p>
                  </div>
                </div>
                <div className="summary-item off">
                  <div className="summary-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM12 8v8M8 12h8"/>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <h3>วันหยุด</h3>
                    <p>{schedule.statistics?.[auth.currentUser.uid]?.off || 0} วัน</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="schedule-view card animate-slideUp">
              {viewMode === 'calendar' ? renderCalendarView() : renderListView()}
            </div>
          </>
        ) : (
          <div className="no-schedule card">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v18H3zM12 8v8M8 12h8"/>
              </svg>
            </div>
            <h2>ยังไม่มีตารางเวร</h2>
            <p>ตารางเวรสำหรับเดือนนี้ยังไม่ถูกสร้าง</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .my-schedule {
          max-width: 1200px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .schedule-header {
          margin-bottom: 2rem;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-content h1 {
          font-size: 1.75rem;
          color: var(--gray-800);
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .month-selector {
          width: auto;
        }

        .view-toggle {
          display: flex;
          background: var(--gray-100);
          border-radius: var(--radius);
          padding: 4px;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          color: var(--gray-600);
          border-radius: calc(var(--radius) - 4px);
          cursor: pointer;
          transition: var(--transition);
        }

        .toggle-btn.active {
          background: var(--white);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .toggle-btn svg {
          width: 20px;
          height: 20px;
        }

        .schedule-summary {
          margin-bottom: 2rem;
        }

        .schedule-summary h2 {
          font-size: 1.25rem;
          margin-bottom: 1.5rem;
          color: var(--gray-800);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .summary-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
        }

        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-icon svg {
          width: 24px;
          height: 24px;
        }

        .summary-item.morning .summary-icon {
          background: #fef3c7;
          color: #f59e0b;
        }

        .summary-item.afternoon .summary-icon {
          background: #dbeafe;
          color: #3b82f6;
        }

        .summary-item.night .summary-icon {
          background: #e9d5ff;
          color: #8b5cf6;
        }

        .summary-item.off .summary-icon {
          background: #d1fae5;
          color: #10b981;
        }

        .summary-content h3 {
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .summary-content p {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--gray-800);
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: var(--gray-200);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .calendar-cell {
          background: var(--white);
          min-height: 100px;
          padding: 0.5rem;
          position: relative;
        }

        .calendar-cell.empty {
          background: var(--gray-50);
        }

        .calendar-cell.today {
          background: #fef3c7;
        }

        .day-number {
          font-weight: 600;
          color: var(--gray-700);
          margin-bottom: 0.5rem;
        }

        .day-shifts {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .shift-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: var(--radius);
          text-align: center;
        }

        .shift-badge.off {
          background: var(--gray-100);
          color: var(--gray-600);
        }

        .shift-badge.shift-1 {
          background: #fef3c7;
          color: #92400e;
        }

        .shift-badge.shift-2 {
          background: #dbeafe;
          color: #1e40af;
        }

        .shift-badge.shift-3 {
          background: #e9d5ff;
          color: #6b21a8;
        }

        .list-view {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .list-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--gray-50);
          border-radius: var(--radius);
          transition: var(--transition);
        }

        .list-item:hover {
          background: var(--gray-100);
          transform: translateX(4px);
        }

        .list-date {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .date-day {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }

        .date-weekday {
          color: var(--gray-600);
        }

        .list-shifts {
          display: flex;
          gap: 0.5rem;
        }

        .no-schedule {
          text-align: center;
          padding: 4rem 2rem;
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

        .no-schedule h2 {
          font-size: 1.5rem;
          color: var(--gray-800);
          margin-bottom: 0.5rem;
        }

        .no-schedule p {
          color: var(--gray-600);
        }

        .no-shifts {
          text-align: center;
          padding: 3rem;
          color: var(--gray-500);
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .header-controls {
            flex-direction: column;
            width: 100%;
          }

          .month-selector {
            width: 100%;
          }

          .calendar-cell {
            min-height: 80px;
            padding: 0.25rem;
          }

          .day-number {
            font-size: 0.875rem;
          }

          .shift-badge {
            font-size: 0.625rem;
            padding: 0.125rem 0.25rem;
          }
        }
      `}</style>
    </Layout>
  );
}