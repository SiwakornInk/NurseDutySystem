import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { auth, db, WARDS, checkWardHasAdmin } from '../../lib/firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Head from 'next/head';

export default function AdminNurses() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [nurses, setNurses] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferNurse, setTransferNurse] = useState(null);
  const [newWard, setNewWard] = useState('');
  const [editingNurse, setEditingNurse] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    prefix: 'นาง',
    firstName: '',
    lastName: '',
    phone: '',
    isAdmin: false,
    position: 'พยาบาล',
    isGovernmentOfficial: false
  });
  const [errors, setErrors] = useState({});

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
      if (!userDoc.exists() || !userDoc.data().isAdmin) {
        router.push('/dashboard');
        return;
      }
      
      const userData = userDoc.data();
      setCurrentUser(userData);
      setSelectedWard(userData.currentWard);
      fetchNurses(userData.currentWard);
    } catch (error) {
      console.error('Error:', error);
      router.push('/login');
    }
  };

  const fetchNurses = async (ward) => {
    setLoading(true);
    try {
      const nursesQuery = query(
        collection(db, 'users'),
        where('currentWard', '==', ward || selectedWard)
      );
      const snapshot = await getDocs(nursesQuery);
      
      const nursesList = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      setNurses(nursesList);
    } catch (error) {
      console.error('Error fetching nurses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!newWard) {
      alert('กรุณาเลือกวอร์ดปลายทาง');
      return;
    }

    // ตรวจสอบว่าถ้าย้าย admin ออก วอร์ดเดิมจะยังมี admin เหลือไหม
    if (transferNurse.isAdmin) {
      const hasOtherAdmin = await checkWardHasAdmin(transferNurse.currentWard, transferNurse.id);
      if (!hasOtherAdmin) {
        alert('ไม่สามารถย้ายได้ เนื่องจากวอร์ดนี้จะไม่มี Admin เหลือ\nกรุณาแต่งตั้ง Admin คนใหม่ก่อน');
        return;
      }
    }

    try {
      const updateData = {
        currentWard: newWard,
        updatedAt: new Date()
      };

      // ถ้าย้ายไปวอร์ดอื่น ต้องเอาสิทธิ์ admin ออก
      if (transferNurse.isAdmin && newWard !== transferNurse.currentWard) {
        updateData.isAdmin = false;
      }

      // อัพเดทข้อมูลพยาบาล
      await updateDoc(doc(db, 'users', transferNurse.id), updateData);

      // เพิ่มประวัติการย้ายวอร์ด
      const wardHistoryRef = collection(db, 'users', transferNurse.id, 'wardHistory');
      await addDoc(wardHistoryRef, {
        fromWard: transferNurse.currentWard,
        toWard: newWard,
        date: new Date().toISOString(),
        transferredBy: auth.currentUser.uid,
        wasAdmin: transferNurse.isAdmin
      });

      alert('ย้ายวอร์ดสำเร็จ');
      setShowTransferModal(false);
      setTransferNurse(null);
      setNewWard('');
      fetchNurses(selectedWard);
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถย้ายวอร์ดได้');
    }
  };

  const handleToggleAdmin = async (nurse) => {
    try {
      await updateDoc(doc(db, 'users', nurse.id), {
        isAdmin: !nurse.isAdmin,
        updatedAt: new Date()
      });
      
      alert(`${nurse.isAdmin ? 'ถอดถอน' : 'แต่งตั้ง'} Admin สำเร็จ`);
      fetchNurses(selectedWard);
    } catch (error) {
      console.error('Error:', error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!editingNurse) {
      if (!formData.email) newErrors.email = 'กรุณากรอกอีเมล';
      else if (!formData.email.endsWith('@gmail.com')) newErrors.email = 'ต้องใช้อีเมล @gmail.com เท่านั้น';
      
      if (!formData.password) newErrors.password = 'กรุณากรอกรหัสผ่าน';
      else if (formData.password.length < 6) newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }
    
    if (!formData.firstName) newErrors.firstName = 'กรุณากรอกชื่อ';
    if (!formData.lastName) newErrors.lastName = 'กรุณากรอกนามสกุล';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      if (editingNurse) {
        await updateDoc(doc(db, 'users', editingNurse.id), {
          prefix: formData.prefix,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          position: formData.position,
          isGovernmentOfficial: formData.isGovernmentOfficial,
          updatedAt: new Date()
        });
        
        alert('แก้ไขข้อมูลสำเร็จ');
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        await addDoc(collection(db, 'users'), {
          uid: userCredential.user.uid,
          email: formData.email,
          prefix: formData.prefix,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          currentWard: currentUser.currentWard,
          position: formData.position,
          isGovernmentOfficial: formData.isGovernmentOfficial,
          isAdmin: formData.isAdmin,
          createdAt: new Date(),
          startDate: new Date().toISOString(),
          wardHistory: [{
            ward: currentUser.currentWard,
            date: new Date().toISOString(),
            isAdmin: formData.isAdmin
          }]
        });
        
        alert('เพิ่มพยาบาลสำเร็จ');
      }
      
      setShowModal(false);
      resetForm();
      fetchNurses(selectedWard);
    } catch (error) {
      console.error('Error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'อีเมลนี้ถูกใช้งานแล้ว' });
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const handleEdit = (nurse) => {
    setEditingNurse(nurse);
    setFormData({
      email: nurse.email,
      password: '',
      prefix: nurse.prefix,
      firstName: nurse.firstName,
      lastName: nurse.lastName,
      phone: nurse.phone || '',
      position: nurse.position || 'พยาบาล',
      isGovernmentOfficial: nurse.isGovernmentOfficial || false,
      isAdmin: nurse.isAdmin || false
    });
    setShowModal(true);
  };

  const handleDelete = async (nurseId) => {
    const nurse = nurses.find(n => n.id === nurseId);
    
    if (nurse.isAdmin) {
      const hasOtherAdmin = await checkWardHasAdmin(nurse.currentWard, nurseId);
      if (!hasOtherAdmin) {
        alert('ไม่สามารถลบได้ เนื่องจากเป็น Admin คนเดียวของวอร์ด');
        return;
      }
    }
    
    if (!confirm('ยืนยันการลบพยาบาลคนนี้?')) return;
    
    try {
      await deleteDoc(doc(db, 'users', nurseId));
      alert('ลบข้อมูลสำเร็จ');
      fetchNurses(selectedWard);
    } catch (error) {
      console.error('Error:', error);
      alert('ไม่สามารถลบข้อมูลได้');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      prefix: 'นาง',
      firstName: '',
      lastName: '',
      phone: '',
      position: 'พยาบาล',
      isGovernmentOfficial: false,
      isAdmin: false
    });
    setEditingNurse(null);
    setErrors({});
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
        <title>จัดการพยาบาล - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="nurses-management">
        <div className="page-header">
          <h1>จัดการข้อมูลพยาบาล - {currentUser?.currentWard}</h1>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8 7a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"/>
            </svg>
            เพิ่มพยาบาล
          </button>
        </div>

        <div className="ward-info card">
          <p>จำนวนพยาบาลทั้งหมด: <strong>{nurses.length} คน</strong></p>
          <p>Admin: <strong>{nurses.filter(n => n.isAdmin).length} คน</strong></p>
          <p>ข้าราชการ: <strong>{nurses.filter(n => n.isGovernmentOfficial).length} คน</strong></p>
        </div>

        <div className="nurses-grid">
          {nurses.map((nurse, index) => (
            <div key={nurse.id} className="nurse-card card animate-fadeIn" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="nurse-header">
                <div className="nurse-avatar">
                  {nurse.profileImage ? (
                    <img src={nurse.profileImage} alt={nurse.firstName} />
                  ) : (
                    <span>{nurse.firstName?.[0]}{nurse.lastName?.[0]}</span>
                  )}
                </div>
                <div className="nurse-info">
                  <h3>{nurse.prefix} {nurse.firstName} {nurse.lastName}</h3>
                  <p className="nurse-position">{nurse.position}</p>
                  <div className="nurse-badges">
                    {nurse.isAdmin && (
                      <span className="badge badge-primary">Admin</span>
                    )}
                    {nurse.isGovernmentOfficial && (
                      <span className="badge badge-secondary">ข้าราชการ</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="nurse-details">
                <div className="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span>{nurse.email}</span>
                </div>
                {nurse.phone && (
                  <div className="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                    <span>{nurse.phone}</span>
                  </div>
                )}
              </div>

              <div className="nurse-actions">
                {nurse.id !== auth.currentUser.uid && (
                  <>
                    <button 
                      className={`btn ${nurse.isAdmin ? 'btn-warning' : 'btn-success'} btn-sm`}
                      onClick={() => handleToggleAdmin(nurse)}
                    >
                      {nurse.isAdmin ? 'ถอดถอน Admin' : 'แต่งตั้ง Admin'}
                    </button>
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={() => {
                        setTransferNurse(nurse);
                        setShowTransferModal(true);
                      }}
                    >
                      ย้ายวอร์ด
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(nurse)}>
                  แก้ไข
                </button>
                {nurse.id !== auth.currentUser.uid && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(nurse.id)}>
                    ลบ
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {nurses.length === 0 && (
          <div className="empty-state">
            <p>ไม่พบข้อมูลพยาบาล</p>
          </div>
        )}
      </div>

      {/* Modal เพิ่ม/แก้ไขพยาบาล */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingNurse ? 'แก้ไขข้อมูลพยาบาล' : 'เพิ่มพยาบาลใหม่'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                {!editingNurse && (
                  <>
                    <div className="form-group">
                      <label className="form-label">อีเมล <span className="required">*</span></label>
                      <input
                        type="email"
                        className={`form-input ${errors.email ? 'error' : ''}`}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="example@gmail.com"
                      />
                      {errors.email && <span className="error-text">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">รหัสผ่านเริ่มต้น <span className="required">*</span></label>
                      <input
                        type="password"
                        className={`form-input ${errors.password ? 'error' : ''}`}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                      />
                      {errors.password && <span className="error-text">{errors.password}</span>}
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">คำนำหน้า <span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                  >
                    <option value="นาย">นาย</option>
                    <option value="นาง">นาง</option>
                    <option value="นางสาว">นางสาว</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">ชื่อ <span className="required">*</span></label>
                  <input
                    type="text"
                    className={`form-input ${errors.firstName ? 'error' : ''}`}
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                  {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">นามสกุล <span className="required">*</span></label>
                  <input
                    type="text"
                    className={`form-input ${errors.lastName ? 'error' : ''}`}
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                  {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ตำแหน่ง</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isGovernmentOfficial}
                    onChange={(e) => setFormData({ ...formData, isGovernmentOfficial: e.target.checked })}
                  />
                  <span>เป็นข้าราชการ (ทำงานเฉพาะเวรเช้า จันทร์-ศุกร์)</span>
                </label>
                
                {!editingNurse && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isAdmin}
                      onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                    />
                    <span>แต่งตั้งเป็น Admin ของวอร์ด</span>
                  </label>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingNurse ? 'บันทึกการแก้ไข' : 'เพิ่มพยาบาล'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ย้ายวอร์ด */}
      {showTransferModal && transferNurse && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>ย้ายวอร์ด</h2>
              <button className="modal-close" onClick={() => setShowTransferModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="transfer-info">
                <p><strong>พยาบาล:</strong> {transferNurse.prefix} {transferNurse.firstName} {transferNurse.lastName}</p>
                <p><strong>วอร์ดปัจจุบัน:</strong> {transferNurse.currentWard}</p>
                {transferNurse.isAdmin && (
                  <div className="warning-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>หากย้ายไปวอร์ดอื่น จะถูกถอดถอนสิทธิ์ Admin อัตโนมัติ</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">เลือกวอร์ดปลายทาง</label>
                <select
                  className="form-select"
                  value={newWard}
                  onChange={(e) => setNewWard(e.target.value)}
                >
                  <option value="">-- เลือกวอร์ด --</option>
                  {WARDS.filter(w => w !== transferNurse.currentWard).map(ward => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-primary" 
                onClick={handleTransfer}
                disabled={!newWard}
              >
                ยืนยันการย้าย
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferNurse(null);
                  setNewWard('');
                }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .nurses-management {
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

        .ward-info {
          display: flex;
          gap: 2rem;
          padding: 1rem 1.5rem;
          margin-bottom: 2rem;
          background: var(--gray-50);
        }

        .ward-info p {
          margin: 0;
          color: var(--gray-600);
        }

        .ward-info strong {
          color: var(--gray-800);
        }

        .nurses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .nurse-card {
          transition: var(--transition);
        }

        .nurse-card:hover {
          transform: translateY(-4px);
        }

        .nurse-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .nurse-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 1.25rem;
          overflow: hidden;
          flex-shrink: 0;
        }

        .nurse-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .nurse-info {
          flex: 1;
        }

        .nurse-info h3 {
          font-size: 1.125rem;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .nurse-position {
          color: var(--gray-600);
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .nurse-badges {
          display: flex;
          gap: 0.5rem;
        }

        .badge-secondary {
          background: var(--secondary);
          color: white;
        }

        .nurse-details {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--gray-200);
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--gray-600);
          font-size: 0.875rem;
        }

        .detail-item svg {
          width: 16px;
          height: 16px;
          color: var(--gray-400);
        }

        .nurse-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .modal-lg {
          max-width: 600px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .checkbox-group {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .form-input.error, .form-select.error {
          border-color: var(--danger);
        }

        .error-text {
          display: block;
          color: var(--danger);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .required {
          color: var(--danger);
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

        .empty-state {
          text-align: center;
          padding: 4rem;
          color: var(--gray-500);
        }

        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        .btn-warning {
          background: var(--warning);
          color: white;
        }

        .btn-warning:hover {
          background: #d97706;
        }

        .transfer-info {
          margin-bottom: 1.5rem;
        }

        .transfer-info p {
          margin-bottom: 0.5rem;
          color: var(--gray-700);
        }

        .warning-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: var(--radius);
          color: #92400e;
          margin-top: 1rem;
        }

        .warning-box svg {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .nurses-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .nurse-actions {
            flex-direction: column;
          }

          .nurse-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </Layout>
  );
}