import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth, db, storage } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, updatePassword } from 'firebase/auth';
import Head from 'next/head';

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    prefix: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentWard: '',
    position: 'พยาบาล',
    startDate: '',
    profileImage: ''
  });
  const [wardHistory, setWardHistory] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfile({
          prefix: userData.prefix || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || auth.currentUser.email,
          phone: userData.phone || '',
          currentWard: userData.currentWard || '',
          position: userData.position || 'พยาบาล',
          startDate: userData.startDate || '',
          profileImage: userData.profileImage || ''
        });
        setWardHistory(userData.wardHistory || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'ไฟล์รูปภาพต้องไม่เกิน 5MB');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        profileImage: downloadURL
      });

      setProfile(prev => ({ ...prev, profileImage: downloadURL }));
      showMessage('success', 'อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Error uploading image:', error);
      showMessage('error', 'อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        phone: profile.phone,
        updatedAt: new Date()
      });

      if (auth.currentUser.displayName !== `${profile.prefix} ${profile.firstName} ${profile.lastName}`) {
        await updateProfile(auth.currentUser, {
          displayName: `${profile.prefix} ${profile.firstName} ${profile.lastName}`
        });
      }

      showMessage('success', 'บันทึกข้อมูลสำเร็จ');
      setEditMode(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      showMessage('error', 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      showMessage('error', 'รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    if (passwords.new.length < 6) {
      showMessage('error', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setSaving(true);
    try {
      await updatePassword(auth.currentUser, passwords.new);
      showMessage('success', 'เปลี่ยนรหัสผ่านสำเร็จ');
      setPasswordMode(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      showMessage('error', 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
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
        <title>โปรไฟล์ - ระบบจัดตารางเวรพยาบาล</title>
      </Head>

      <div className="profile-container">
        <div className="profile-header card animate-slideUp">
          <div className="profile-cover gradient-bg"></div>
          <div className="profile-info">
            <div className="profile-avatar">
              {profile.profileImage ? (
                <img src={profile.profileImage} alt={profile.firstName} />
              ) : (
                <div className="avatar-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                  </svg>
                </div>
              )}
              <label className="avatar-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4v16m8-8H4"/>
                  </svg>
                </div>
              </label>
            </div>
            <div className="profile-details">
              <h1>{profile.prefix} {profile.firstName} {profile.lastName}</h1>
              <p className="position">{profile.position}</p>
              <p className="ward">{profile.currentWard}</p>
            </div>
          </div>
        </div>

        {message.text && (
          <div className={`message ${message.type} animate-fadeIn`}>
            {message.text}
          </div>
        )}

        <div className="profile-content">
          <div className="info-section card animate-fadeIn">
            <div className="section-header">
              <h2>ข้อมูลส่วนตัว</h2>
              {!editMode && (
                <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                  แก้ไขข้อมูล
                </button>
              )}
            </div>

            <div className="info-grid">
              <div className="info-item">
                <label>คำนำหน้า</label>
                <p>{profile.prefix}</p>
              </div>
              <div className="info-item">
                <label>ชื่อ</label>
                <p>{profile.firstName}</p>
              </div>
              <div className="info-item">
                <label>นามสกุล</label>
                <p>{profile.lastName}</p>
              </div>
              <div className="info-item">
                <label>อีเมล</label>
                <p>{profile.email}</p>
              </div>
              <div className="info-item">
                <label>เบอร์โทรศัพท์</label>
                {editMode ? (
                  <input
                    type="tel"
                    className="form-input"
                    value={profile.phone}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  />
                ) : (
                  <p>{profile.phone || '-'}</p>
                )}
              </div>
              <div className="info-item">
                <label>วันที่เริ่มงาน</label>
                <p>{profile.startDate ? new Date(profile.startDate).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : '-'}</p>
              </div>
            </div>

            {editMode && (
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? <span className="loading-spinner"></span> : 'บันทึก'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditMode(false);
                    fetchProfile();
                  }}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>

          <div className="security-section card animate-fadeIn">
            <div className="section-header">
              <h2>ความปลอดภัย</h2>
            </div>

            {!passwordMode ? (
              <button className="btn btn-primary" onClick={() => setPasswordMode(true)}>
                เปลี่ยนรหัสผ่าน
              </button>
            ) : (
              <div className="password-form">
                <div className="form-group">
                  <label className="form-label">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwords.new}
                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="form-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleChangePassword}
                    disabled={saving}
                  >
                    {saving ? <span className="loading-spinner"></span> : 'เปลี่ยนรหัสผ่าน'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setPasswordMode(false);
                      setPasswords({ current: '', new: '', confirm: '' });
                    }}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>

          {wardHistory.length > 0 && (
            <div className="history-section card animate-fadeIn">
              <h2>ประวัติการย้ายวอร์ด</h2>
              <div className="history-timeline">
                {wardHistory.map((history, index) => (
                  <div key={index} className="timeline-item animate-slideIn" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <h4>{history.ward}</h4>
                      <p>{new Date(history.date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .profile-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .profile-header {
          position: relative;
          padding: 0;
          margin-bottom: 2rem;
          overflow: visible;
        }

        .profile-cover {
          height: 200px;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        }

        .profile-info {
          display: flex;
          align-items: flex-end;
          gap: 2rem;
          padding: 0 2rem 2rem;
          margin-top: -60px;
        }

        .profile-avatar {
          position: relative;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: var(--white);
          padding: 4px;
          box-shadow: var(--shadow-lg);
        }

        .profile-avatar img, .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-placeholder {
          background: var(--gray-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-400);
        }

        .avatar-placeholder svg {
          width: 60px;
          height: 60px;
        }

        .avatar-upload {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 36px;
          height: 36px;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition);
          box-shadow: var(--shadow-md);
        }

        .avatar-upload:hover {
          background: var(--primary-dark);
          transform: scale(1.1);
        }

        .upload-icon {
          color: var(--white);
          width: 20px;
          height: 20px;
        }

        .upload-icon svg {
          width: 100%;
          height: 100%;
        }

        .profile-details h1 {
          font-size: 1.75rem;
          margin-bottom: 0.25rem;
          color: var(--gray-800);
        }

        .profile-details .position {
          font-size: 1.125rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .profile-details .ward {
          color: var(--primary);
          font-weight: 500;
        }

        .message {
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .message.success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .message.error {
          background: #fee;
          color: var(--danger);
          border: 1px solid #fcc;
        }

        .profile-content {
          display: grid;
          gap: 1.5rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          font-size: 1.25rem;
          color: var(--gray-800);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .info-item label {
          display: block;
          font-size: 0.875rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
        }

        .info-item p {
          font-size: 1rem;
          color: var(--gray-800);
          font-weight: 500;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .password-form {
          max-width: 400px;
        }

        .history-timeline {
          position: relative;
          padding-left: 2rem;
        }

        .history-timeline::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: var(--gray-300);
        }

        .timeline-item {
          position: relative;
          margin-bottom: 1.5rem;
        }

        .timeline-marker {
          position: absolute;
          left: -24px;
          top: 8px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
          border: 2px solid var(--white);
          box-shadow: var(--shadow);
        }

        .timeline-content {
          background: var(--gray-50);
          padding: 1rem;
          border-radius: var(--radius);
        }

        .timeline-content h4 {
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .timeline-content p {
          color: var(--gray-600);
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .profile-info {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}