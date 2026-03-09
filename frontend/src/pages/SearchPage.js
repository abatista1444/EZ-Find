import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MarketplaceSearch from '../components/MarketplaceSearch';
import './Search.css';

export default function SearchPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.firstName || user?.FirstName || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="search-page">
      <header className="search-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>EZFind Search</h1>
        <div className="search-user">
          <span>{firstName}!</span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="search-main">
        <MarketplaceSearch
          title="EZFind Search"
          locationPrefix="📍 "
          errorsTitle="⚠️ Marketplace Errors"
        />
      </main>
    </div>
  );
}
