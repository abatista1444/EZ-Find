import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import MarketplaceSearch from '../components/MarketplaceSearch';
import ChatbotSidebar from '../components/ChatbotSidebar';
import SuggestionsSection from '../components/SuggestionsSection';
import { fetchSavedItems } from '../api/savedItemsApi';
import './Dashboard.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const marketplaceSearchRef = useRef(null);
  const [recentSearchResults, setRecentSearchResults] = useState([]);
  const [savedExternalIds, setSavedExternalIds] = useState(new Set());

  const firstName = user?.firstName || user?.FirstName || 'User';
  const lastName = user?.lastName || user?.LastName || '';

  const handleSavedItemsClick = () => {
    navigate('/saved-items');
  };

  const handleSavedSearchesClick = () => {
    navigate('/saved-searches');
  };

  const handleRunSearch = (searchParams) => {
    if (marketplaceSearchRef.current) {
      marketplaceSearchRef.current.runSearch(searchParams);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleAccountClick = () => {
    navigate('/account');
  };

  const handleSavedIdsChange = (updater) => {
    setSavedExternalIds(prev => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  };

  // Update suggestions when search results change
  const handleSearchResultsUpdate = () => {
    if (marketplaceSearchRef.current) {
      const results = marketplaceSearchRef.current.getRecentResults?.();
      if (Array.isArray(results)) {
        setRecentSearchResults(results);
      }
    }
  };

  // Preload saved items on mount
  useEffect(() => {
    const loadSavedItems = async () => {
      try {
        const items = await fetchSavedItems();
        setSavedExternalIds(new Set(items.map(item => item.externalItemId)));
      } catch (err) {
        console.error('Failed to load saved items:', err);
      }
    };

    loadSavedItems();
  }, []);

  // Handle running search from saved searches page
  useEffect(() => {
    if (location.state?.runSearch && marketplaceSearchRef.current) {
      marketplaceSearchRef.current.runSearch(location.state.runSearch);
      // Clear the state so it doesn't run again on re-renders
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.runSearch, navigate, location.pathname]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dash-logo">EZFind</h1>
        <div className="dash-user">
          <span>Welcome, {firstName}!</span>
          <button className="logout-btn" onClick={handleAccountClick}>Account</button>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <div className="dashboard-container">
        <main className="dashboard-main">
          <div className="welcome-card">
            <h2>Hello, {firstName} {lastName} 👋</h2>
            <p>You're successfully logged in to EZFind — your unified marketplace.</p>
            <div className="user-info">
              <p><strong>Email:</strong> {user.email ?? user.Email}</p>
              {user.city && <p><strong>Location:</strong> {user.city}{user.state ? `, ${user.state}` : ''}</p>}
            </div>

            <div className="placeholder-grid welcome-actions-grid">
              <div className="placeholder-card action-card" onClick={handleSavedItemsClick}>
                <h3>Saved Items</h3>
                <p>View and manage items you've saved for later.</p>
                <button className="card-action-btn">Open Saved Items</button>
              </div>
              <div className="placeholder-card action-card" onClick={handleSavedSearchesClick}>
                <h3>Saved Searches</h3>
                <p>Run your favorite searches again with one click.</p>
                <button className="card-action-btn">Open Saved Searches</button>
              </div>
            </div>
          </div>

          <MarketplaceSearch
            ref={marketplaceSearchRef}
            sectionClassName="dashboard-search-section"
          />

          <SuggestionsSection
            recentSearchResults={recentSearchResults}
            savedExternalIds={savedExternalIds}
            onSavedIdsChange={handleSavedIdsChange}
          />
        </main>

        <ChatbotSidebar onSearch={handleRunSearch} />
      </div>

      {/* Polling interval to update suggestions with new search results */}
      <HiddenSuggestionUpdater marketplaceSearchRef={marketplaceSearchRef} onUpdate={handleSearchResultsUpdate} />
    </div>
  );
}

/**
 * Hidden component that polls for search result updates.
 * This ensures suggestions stay in sync when search results change.
 */
function HiddenSuggestionUpdater({ marketplaceSearchRef, onUpdate }) {
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdate();
    }, 500);

    return () => clearInterval(interval);
  }, [onUpdate]);

  return null;
}
