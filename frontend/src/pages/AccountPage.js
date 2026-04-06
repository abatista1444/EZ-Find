import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '../api/accountApi';
import './Account.css';

export default function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    country: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    password: '',
  });

  // UI state
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [profileErrors, setProfileErrors] = useState([]);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [emailErrors, setEmailErrors] = useState([]);

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Initialize forms with user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.FirstName || '',
        lastName: user.LastName || '',
        address: user.Address || '',
        city: user.City || '',
        state: user.State || '',
        country: user.Country || '',
      });
      setEmailForm({ ...emailForm, currentEmail: user.Email, newEmail: '' });
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Profile form handlers
  const handleProfileChange = e => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
    setProfileErrors([]);
    setProfileSuccess(false);
  };

  const handleProfileSubmit = async e => {
    e.preventDefault();
    setProfileErrors([]);
    setProfileSuccess(false);
    setProfileSubmitting(true);

    try {
      const result = await accountApi.updateProfile({
        firstName: profileForm.firstName || undefined,
        lastName: profileForm.lastName || undefined,
        address: profileForm.address || undefined,
        city: profileForm.city || undefined,
        state: profileForm.state || undefined,
        country: profileForm.country || undefined,
      });
      setProfileSuccess(true);
      if (refreshUser) refreshUser();
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      const errors = err.errors || [{ msg: err.message || 'Failed to update profile' }];
      setProfileErrors(errors);
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Password form handlers
  const handlePasswordChange = e => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    setPasswordErrors([]);
    setPasswordSuccess(false);
  };

  const handlePasswordSubmit = async e => {
    e.preventDefault();
    setPasswordErrors([]);
    setPasswordSuccess(false);
    setPasswordSubmitting(true);

    try {
      await accountApi.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const errors = err.errors || [{ msg: err.message || 'Failed to change password' }];
      setPasswordErrors(errors);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Email form handlers
  const handleEmailChange = e => {
    const { name, value } = e.target;
    setEmailForm(prev => ({ ...prev, [name]: value }));
    setEmailErrors([]);
    setEmailSuccess(false);
  };

  const handleEmailSubmit = async e => {
    e.preventDefault();
    setEmailErrors([]);
    setEmailSuccess(false);
    setEmailSubmitting(true);

    try {
      const result = await accountApi.changeEmail(
        emailForm.newEmail,
        emailForm.password
      );
      setEmailSuccess(true);
      setEmailForm({ ...emailForm, newEmail: '', password: '', currentEmail: result.user.Email });
      if (refreshUser) refreshUser();
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (err) {
      const errors = err.errors || [{ msg: err.message || 'Failed to change email' }];
      setEmailErrors(errors);
    } finally {
      setEmailSubmitting(false);
    }
  };

  if (!user) {
    return null; // Protected route will handle redirect
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-logo">EZFind</h1>
        <div className="account-user">
          <span>Welcome, {user.FirstName}!</span>
          <button className="account-logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="account-main">
        <div className="account-container">
          {/* Profile Section */}
          <div className="account-form-section">
            <h2 className="account-section-title">Profile Information</h2>

            {profileSuccess && (
              <div className="account-success-message">
                Profile updated successfully!
              </div>
            )}

            {profileErrors.length > 0 && (
              <div className="account-error-message">
                {profileErrors.map((err, i) => (
                  <p key={i}>{err.msg}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div className="account-form-row">
                <div className="account-form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={profileForm.firstName}
                    onChange={handleProfileChange}
                  />
                </div>
                <div className="account-form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={profileForm.lastName}
                    onChange={handleProfileChange}
                  />
                </div>
              </div>

              <div className="account-form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={profileForm.address}
                  onChange={handleProfileChange}
                />
              </div>

              <div className="account-form-row">
                <div className="account-form-group">
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    value={profileForm.city}
                    onChange={handleProfileChange}
                  />
                </div>
                <div className="account-form-group">
                  <label>State</label>
                  <input
                    type="text"
                    name="state"
                    value={profileForm.state}
                    onChange={handleProfileChange}
                  />
                </div>
                <div className="account-form-group">
                  <label>Country</label>
                  <input
                    type="text"
                    name="country"
                    value={profileForm.country}
                    onChange={handleProfileChange}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="account-btn"
                disabled={profileSubmitting}
              >
                {profileSubmitting ? 'Updating…' : 'Save Profile'}
              </button>
            </form>
          </div>

          {/* Password Section */}
          <div className="account-form-section">
            <h2 className="account-section-title">Change Password</h2>

            {passwordSuccess && (
              <div className="account-success-message">
                Password changed successfully!
              </div>
            )}

            {passwordErrors.length > 0 && (
              <div className="account-error-message">
                {passwordErrors.map((err, i) => (
                  <p key={i}>{err.msg}</p>
                ))}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div className="account-form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="account-form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                />
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Minimum 8 characters, must include uppercase letter and number
                </p>
              </div>

              <button
                type="submit"
                className="account-btn"
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Email Section */}
          <div className="account-form-section">
            <h2 className="account-section-title">Change Email</h2>

            {emailSuccess && (
              <div className="account-success-message">
                Email changed successfully!
              </div>
            )}

            {emailErrors.length > 0 && (
              <div className="account-error-message">
                {emailErrors.map((err, i) => (
                  <p key={i}>{err.msg}</p>
                ))}
              </div>
            )}

            <form onSubmit={handleEmailSubmit}>
              <div className="account-form-group">
                <label>Current Email</label>
                <input
                  type="email"
                  value={user.Email}
                  disabled
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>

              <div className="account-form-group">
                <label>New Email</label>
                <input
                  type="email"
                  name="newEmail"
                  value={emailForm.newEmail}
                  onChange={handleEmailChange}
                  required
                />
              </div>

              <div className="account-form-group">
                <label>Password (for verification)</label>
                <input
                  type="password"
                  name="password"
                  value={emailForm.password}
                  onChange={handleEmailChange}
                  required
                />
              </div>

              <button
                type="submit"
                className="account-btn"
                disabled={emailSubmitting}
              >
                {emailSubmitting ? 'Updating…' : 'Change Email'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
