import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dash-logo">EZFind</h1>
        <div className="dash-user">
          <span>Welcome, {user.firstName}!</span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <h2>Hello, {user.firstName} {user.lastName} 👋</h2>
          <p>You're successfully logged in to EZFind — your unified marketplace.</p>
          <div className="user-info">
            <p><strong>Email:</strong> {user.email ?? user.Email}</p>
            {user.city && <p><strong>Location:</strong> {user.city}{user.state ? `, ${user.state}` : ''}</p>}
          </div>
        </div>

        <div className="placeholder-grid">
          <div className="placeholder-card">
            <h3>🔍 Browse Items</h3>
            <p>Search across Facebook Marketplace, Craigslist, and eBay in one place.</p>
          </div>
          <div className="placeholder-card">
            <h3>❤️ Saved Items</h3>
            <p>View and manage items you've saved for later.</p>
          </div>
          <div className="placeholder-card">
            <h3>🔔 Saved Searches</h3>
            <p>Get notified when new items match your searches.</p>
          </div>
          <div className="placeholder-card">
            <h3>💳 Payment Methods</h3>
            <p>Manage your payment options for quick checkout.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
