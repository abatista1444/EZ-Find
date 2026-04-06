import React, { useState, useEffect } from 'react';
import { fetchSuggestions } from '../api/suggestionsApi';
import { createSavedItem, removeSavedItem } from '../api/savedItemsApi';

/**
 * SuggestionsSection displays personalized recommendations based on user's
 * saved items and recent search results. Uses content-based filtering.
 */
export default function SuggestionsSection({
  recentSearchResults = [],
  savedExternalIds = new Set(),
  onSavedIdsChange,
  locationPrefix = 'Location: '
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingByExternalId, setSavingByExternalId] = useState({});
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch suggestions when search results change
  useEffect(() => {
    if (!Array.isArray(recentSearchResults) || recentSearchResults.length === 0) {
      setSuggestions([]);
      setMetadata({});
      return;
    }

    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const { suggestions: newSuggestions, metadata: newMetadata } = await fetchSuggestions(
          recentSearchResults,
          10
        );
        setSuggestions(newSuggestions);
        setMetadata(newMetadata);
      } catch (err) {
        console.error('Failed to load suggestions:', err);
        setSuggestions([]);
        setMetadata({ error: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [recentSearchResults]);

  const handleSaveSuggestion = async (suggestion) => {
    const externalId = suggestion.id || suggestion.url;

    setSavingByExternalId(prev => ({
      ...prev,
      [externalId]: true,
    }));

    try {
      const payload = {
        externalItemId: externalId,
        title: suggestion.title,
        description: suggestion.location || null,
        price: suggestion.price,
        url: suggestion.url,
        source: suggestion.source,
        image: suggestion.image,
        location: suggestion.location,
        postedAt: suggestion.postedAt,
      };

      await createSavedItem(payload);

      // Update saved IDs
      if (onSavedIdsChange) {
        onSavedIdsChange(prev => {
          const next = new Set(prev);
          next.add(externalId);
          return next;
        });
      }

      setSaveMessage('Item saved successfully.');
    } catch (err) {
      if (err.status === 409) {
        setSaveMessage('Item is already in your saved list.');
      } else {
        setSaveMessage(err.message || 'Failed to save item. Please try again.');
      }
    } finally {
      setSavingByExternalId(prev => ({
        ...prev,
        [externalId]: false,
      }));
    }
  };

  const handleRemoveSuggestion = async (suggestion) => {
    const externalId = suggestion.id || suggestion.url;

    setSavingByExternalId(prev => ({
      ...prev,
      [externalId]: true,
    }));

    try {
      await removeSavedItem(externalId);

      if (onSavedIdsChange) {
        onSavedIdsChange(prev => {
          const next = new Set(prev);
          next.delete(externalId);
          return next;
        });
      }

      setSaveMessage('Item removed from saved items.');
    } catch (err) {
      setSaveMessage(err.message || 'Failed to remove item. Please try again.');
    } finally {
      setSavingByExternalId(prev => ({
        ...prev,
        [externalId]: false,
      }));
    }
  };

  // No suggestions or search results yet
  if (recentSearchResults.length === 0 || suggestions.length === 0) {
    return null;
  }

  return (
    <section className="suggestions-section">
      <h2>Suggested for You</h2>

      {metadata.reason && (
        <div className="suggestions-info">
          <p>{metadata.reason}</p>
        </div>
      )}

      {metadata.userProfile && (
        <div className="suggestions-profile">
          <p className="profile-label">Based on your interests:</p>
          {metadata.userProfile.keywords && metadata.userProfile.keywords.length > 0 && (
            <div className="profile-keywords">
              {metadata.userProfile.keywords.slice(0, 3).map(kw => (
                <span key={kw} className="keyword-tag">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {saveMessage && <p className="save-message">{saveMessage}</p>}

      {loading ? (
        <div className="suggestions-loading">
          <p>Analyzing your interests...</p>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="suggestions-grid">
          {suggestions.map(suggestion => {
            const externalId = suggestion.id || suggestion.url;
            const isSaved = savedExternalIds && savedExternalIds.has(externalId);
            const isSaving = Boolean(savingByExternalId[externalId]);

            return (
              <div key={externalId} className="listing-card">
                <div className="listing-image listing-image--placeholder">
                  {suggestion.image ? (
                    <img
                      src={suggestion.image}
                      alt={suggestion.title}
                      onError={e => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="listing-image-placeholder-text">No image available</span>
                  )}
                </div>
                <div className="listing-content">
                  <span className="source-badge">
                    {typeof suggestion.source === 'string' ? suggestion.source.toUpperCase() : 'UNKNOWN'}
                  </span>
                  <h3>{suggestion.title}</h3>
                  <p className="price">
                    {typeof suggestion.price === 'number' && suggestion.price >= 0
                      ? `$${suggestion.price.toFixed(2)}`
                      : 'Price unavailable'}
                  </p>
                  {suggestion.location && <p className="location">{locationPrefix}{suggestion.location}</p>}
                  {suggestion.postedAt && (
                    <p className="posted-at">Posted: {new Date(suggestion.postedAt).toLocaleDateString()}</p>
                  )}
                  <div className="listing-actions">
                    <a
                      href={suggestion.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-listing"
                    >
                      View on {suggestion.source}
                    </a>
                    <button
                      type="button"
                      className={`save-item-btn ${isSaved ? 'save-item-btn--saved' : ''}`}
                      onClick={() => (isSaved ? handleRemoveSuggestion(suggestion) : handleSaveSuggestion(suggestion))}
                      disabled={isSaving}
                    >
                      {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Item'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="suggestions-empty">
          <p>No suggestions at this time. Try searching for more items to improve recommendations.</p>
        </div>
      )}
    </section>
  );
}
