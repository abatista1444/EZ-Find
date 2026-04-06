import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchSavedSearches,
  updateSavedSearch,
  removeSavedSearch,
} from '../api/savedSearchesApi';
import './SavedSearches.css';

function formatPrice(price) {
  if (!price) return null;
  const value = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(value) || value < 0) return null;
  return `$${value.toFixed(2)}`;
}

function SavedSearchCard({
  search,
  isEditing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
  onRun,
  isSaving,
  isDeleting,
  editFormData,
  onEditFormChange,
}) {
  if (isEditing) {
    return (
      <div className="saved-search-card editing">
        <form onSubmit={(e) => {
          e.preventDefault();
          onEditSave(search.searchId);
        }}>
          <div className="form-group">
            <label htmlFor={`name-${search.searchId}`}>Search Name</label>
            <input
              id={`name-${search.searchId}`}
              type="text"
              value={editFormData.name}
              onChange={(e) => onEditFormChange('name', e.target.value)}
              placeholder="e.g., My Seattle Bikes"
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`query-${search.searchId}`}>Query</label>
            <input
              id={`query-${search.searchId}`}
              type="text"
              value={editFormData.query}
              onChange={(e) => onEditFormChange('query', e.target.value)}
              placeholder="e.g., bicycle"
              disabled={isSaving}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`location-${search.searchId}`}>Location (optional)</label>
            <input
              id={`location-${search.searchId}`}
              type="text"
              value={editFormData.location}
              onChange={(e) => onEditFormChange('location', e.target.value)}
              placeholder="e.g., Seattle, WA"
              disabled={isSaving}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor={`minPrice-${search.searchId}`}>Min Price (optional)</label>
              <input
                id={`minPrice-${search.searchId}`}
                type="number"
                step="0.01"
                min="0"
                value={editFormData.minPrice}
                onChange={(e) => onEditFormChange('minPrice', e.target.value || '')}
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label htmlFor={`maxPrice-${search.searchId}`}>Max Price (optional)</label>
              <input
                id={`maxPrice-${search.searchId}`}
                type="number"
                step="0.01"
                min="0"
                value={editFormData.maxPrice}
                onChange={(e) => onEditFormChange('maxPrice', e.target.value || '')}
                placeholder="9999.99"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onEditCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="saved-search-card">
      <div className="search-header">
        <h4>{search.name}</h4>
        <span className="search-query">{search.query}</span>
      </div>

      <div className="search-details">
        {search.location && <p className="detail"><strong>Location:</strong> {search.location}</p>}
        {(search.minPrice || search.maxPrice) && (
          <p className="detail">
            <strong>Price Range:</strong> {formatPrice(search.minPrice) || 'Any'} - {formatPrice(search.maxPrice) || 'Any'}
          </p>
        )}
      </div>

      <div className="search-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onRun(search)}
          disabled={isSaving || isDeleting}
        >
          Run Search
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onEditStart(search)}
          disabled={isSaving || isDeleting}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => onDelete(search.searchId)}
          disabled={isSaving || isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function SavedSearchesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSearchId, setEditingSearchId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    query: '',
    location: '',
    minPrice: '',
    maxPrice: '',
  });
  const [savingSearchId, setSavingSearchId] = useState(null);
  const [deletingSearchId, setDeletingSearchId] = useState(null);
  const [message, setMessage] = useState('');

  const firstName = user?.firstName || user?.FirstName || 'User';

  useEffect(() => {
    loadSearches();
  }, []);

  const loadSearches = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSavedSearches();
      setSearches(data);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
      setError('Failed to load saved searches');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleEditStart = (search) => {
    setEditingSearchId(search.searchId);
    setEditFormData({
      name: search.name,
      query: search.query,
      location: search.location || '',
      minPrice: search.minPrice || '',
      maxPrice: search.maxPrice || '',
    });
  };

  const handleEditCancel = () => {
    setEditingSearchId(null);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditSave = async (searchId) => {
    if (!editFormData.name.trim() || !editFormData.query.trim()) {
      setError('Search name and query are required');
      return;
    }

    setSavingSearchId(searchId);
    setError('');

    try {
      const payload = {
        name: editFormData.name.trim(),
        query: editFormData.query.trim(),
        location: editFormData.location.trim() || undefined,
        minPrice: editFormData.minPrice ? Number(editFormData.minPrice) : undefined,
        maxPrice: editFormData.maxPrice ? Number(editFormData.maxPrice) : undefined,
      };

      await updateSavedSearch(searchId, payload);

      setSearches(prev =>
        prev.map(s =>
          s.searchId === searchId
            ? { ...s, ...payload, location: payload.location || null, minPrice: payload.minPrice || null, maxPrice: payload.maxPrice || null }
            : s
        )
      );

      setEditingSearchId(null);
      setMessage('Search updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.status === 409) {
        setError('A search with this name already exists');
      } else {
        setError(err.message || 'Failed to update search');
      }
    } finally {
      setSavingSearchId(null);
    }
  };

  const handleDelete = async (searchId) => {
    if (!window.confirm('Are you sure you want to delete this saved search?')) {
      return;
    }

    setDeletingSearchId(searchId);
    setError('');

    try {
      await removeSavedSearch(searchId);
      setSearches(prev => prev.filter(s => s.searchId !== searchId));
      setMessage('Search deleted successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete search');
    } finally {
      setDeletingSearchId(null);
    }
  };

  const handleRunSearch = (search) => {
    navigate('/dashboard', {
      state: {
        runSearch: {
          query: search.query,
          location: search.location || '',
          minPrice: search.minPrice,
          maxPrice: search.maxPrice,
        }
      }
    });
  };

  return (
    <div className="saved-searches-page">
      <header className="saved-searches-header">
        <div className="saved-searches-user">
          <h1 className="saved-searches-logo">EZFind</h1>
        </div>
        <div className="saved-searches-user">
          <span>Welcome, {firstName}!</span>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="saved-searches-main">
        <section className="saved-searches-page-intro">
          <button className="saved-searches-back-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <h2>Saved Searches</h2>
        </section>

        {error && <p className="saved-searches-error">{error}</p>}
        {message && <p className="saved-searches-message">{message}</p>}

        {loading ? (
          <div className="saved-searches-state">Loading saved searches...</div>
        ) : searches.length === 0 ? (
          <div className="saved-searches-state">No saved searches yet. Save a search from the dashboard to see it here.</div>
        ) : (
          <section className="searches-list">
            {searches.map(search => (
              <SavedSearchCard
                key={search.searchId}
                search={search}
                isEditing={editingSearchId === search.searchId}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                onDelete={handleDelete}
                onRun={handleRunSearch}
                isSaving={savingSearchId === search.searchId}
                isDeleting={deletingSearchId === search.searchId}
                editFormData={editFormData}
                onEditFormChange={handleEditFormChange}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
