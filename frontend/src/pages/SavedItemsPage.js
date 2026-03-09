import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchSavedItems, removeSavedItem } from '../api/savedItemsApi';
import './SavedItems.css';

function formatPrice(price) {
  const value = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(value) || value < 0) {
    return 'Price unavailable';
  }

  return `$${value.toFixed(2)}`;
}

function compareBySort(sortBy) {
  return (a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.dateSaved).getTime() - new Date(b.dateSaved).getTime();
    }

    if (sortBy === 'priceAsc') {
      return (Number(a.price) || Number.MAX_SAFE_INTEGER) - (Number(b.price) || Number.MAX_SAFE_INTEGER);
    }

    if (sortBy === 'priceDesc') {
      return (Number(b.price) || -1) - (Number(a.price) || -1);
    }

    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }

    return new Date(b.dateSaved).getTime() - new Date(a.dateSaved).getTime();
  };
}

export default function SavedItemsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingByExternalId, setRemovingByExternalId] = useState({});
  const [sortBy, setSortBy] = useState('newest');
  const [filterQuery, setFilterQuery] = useState('');

  const firstName = user?.firstName || user?.FirstName || 'User';

  useEffect(() => {
    let isMounted = true;

    const loadItems = async () => {
      setLoading(true);
      try {
        const savedItems = await fetchSavedItems();
        if (!isMounted) {
          return;
        }

        setItems(savedItems);
        setError('');
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err.message || 'Failed to load saved items');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadItems();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedFilter = filterQuery.trim().toLowerCase();

    return [...items]
      .filter(item => {
        if (!normalizedFilter) {
          return true;
        }

        const haystack = [item.title, item.source, item.location, item.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedFilter);
      })
      .sort(compareBySort(sortBy));
  }, [items, sortBy, filterQuery]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleRemove = async (externalItemId) => {
    setRemovingByExternalId(prev => ({
      ...prev,
      [externalItemId]: true,
    }));

    try {
      await removeSavedItem(externalItemId);
      setItems(prev => prev.filter(item => item.externalItemId !== externalItemId));
    } catch (err) {
      setError(err.message || 'Failed to remove saved item');
    } finally {
      setRemovingByExternalId(prev => ({
        ...prev,
        [externalItemId]: false,
      }));
    }
  };

  return (
    <div className="saved-items-page">
      <header className="saved-items-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>Saved Items</h1>
        <div className="saved-items-user">
          <span>{firstName}!</span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="saved-items-main">
        <section className="saved-items-toolbar">
          <div className="toolbar-group">
            <label htmlFor="saved-items-filter">Filter</label>
            <input
              id="saved-items-filter"
              type="text"
              value={filterQuery}
              placeholder="Search title, source, location"
              onChange={(event) => setFilterQuery(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="toolbar-group">
            <label htmlFor="saved-items-sort">Sort by</label>
            <select
              id="saved-items-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              disabled={loading}
            >
              <option value="newest">Newest saved</option>
              <option value="oldest">Oldest saved</option>
              <option value="priceAsc">Price: low to high</option>
              <option value="priceDesc">Price: high to low</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </section>

        {error && <p className="saved-items-error">{error}</p>}

        {loading ? (
          <div className="saved-items-state">Loading saved items...</div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="saved-items-state">No saved items yet. Save listings from Search to see them here.</div>
        ) : (
          <section className="saved-items-grid">
            {filteredAndSortedItems.map(item => (
              <article key={item.externalItemId} className="saved-item-card">
                {item.image ? (
                  <img className="saved-item-image" src={item.image} alt={item.title || 'Saved listing'} />
                ) : (
                  <div className="saved-item-image saved-item-image--placeholder">No image</div>
                )}
                <div className="saved-item-content">
                  <span className="saved-source">{(item.source || 'unknown').toUpperCase()}</span>
                  <h3>{item.title}</h3>
                  <p className="saved-price">{formatPrice(item.price)}</p>
                  {item.location && <p className="saved-meta">{item.location}</p>}
                  <p className="saved-meta">Saved: {new Date(item.dateSaved).toLocaleDateString()}</p>
                  <div className="saved-item-actions">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="open-link-btn">
                      Open Listing
                    </a>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemove(item.externalItemId)}
                      disabled={Boolean(removingByExternalId[item.externalItemId])}
                    >
                      {removingByExternalId[item.externalItemId] ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
