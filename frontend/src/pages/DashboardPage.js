import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MarketplaceSearch from '../components/MarketplaceSearch';
import './Dashboard.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSavedItemsClick = () => {
    navigate('/saved-items');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      alert('Please enter a search query');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (location) {
        params.append('location', location);
      }

      const response = await fetch(`http://localhost:5000/api/search?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setListings(data.listings || []);
      setErrors(data.errors || []);
      setImageErrorsByListing({});
      setSaveMessage('');
    } catch (err) {
      console.error('Search error:', err);
      alert(`Search failed: ${err.message}`);
      setListings([]);
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (listingKey) => {
    if (!listingKey) {
      return;
    }

    setImageErrorsByListing(prev => {
      if (prev[listingKey]) {
        return prev;
      }

      return {
        ...prev,
        [listingKey]: true,
      };
    });
  };

  const handleSaveListing = async (listing) => {
    const payload = buildSavedItemPayload(listing);

    if (!payload.externalItemId || !payload.url || !payload.source) {
      setSaveMessage('This item is missing required details and cannot be saved.');
      return;
    }

    setSavingByExternalId(prev => ({
      ...prev,
      [payload.externalItemId]: true,
    }));

    try {
      await createSavedItem(payload);
      setSavedExternalIds(prev => {
        const next = new Set(prev);
        next.add(payload.externalItemId);
        return next;
      });
      setSaveMessage('Item saved successfully.');
    } catch (err) {
      if (err.status === 409) {
        setSavedExternalIds(prev => {
          const next = new Set(prev);
          next.add(payload.externalItemId);
          return next;
        });
        setSaveMessage('Item is already in your saved list.');
      } else {
        setSaveMessage(err.message || 'Failed to save item. Please try again.');
      }
    } finally {
      setSavingByExternalId(prev => ({
        ...prev,
        [payload.externalItemId]: false,
      }));
    }
  };

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

          <div className="placeholder-grid welcome-actions-grid">
            <div className="placeholder-card action-card" onClick={handleSavedItemsClick}>
              <h3>Saved Items</h3>
              <p>View and manage items you've saved for later.</p>
              <button className="card-action-btn">Open Saved Items</button>
            </div>
            <div className="placeholder-card">
              <h3>Saved Searches</h3>
              <p>Get notified when new items match your searches.</p>
            </div>
          </div>
        </div>

        <MarketplaceSearch sectionClassName="dashboard-search-section" />
      </main>
    </div>
  );
}
