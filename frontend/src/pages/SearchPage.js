import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createSavedItem, fetchSavedItems } from '../api/savedItemsApi';
import './Search.css';

function formatPrice(price) {
  const value = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(value) || value < 0) {
    return 'Price unavailable';
  }

  return `$${value.toFixed(2)}`;
}

function normalizeImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') {
    return null;
  }

  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function buildImageCandidates(imageUrl) {
  const normalized = normalizeImageUrl(imageUrl);
  if (!normalized) {
    return [];
  }

  const candidates = [normalized];
  const craigslistImageMatch = normalized.match(/^(https:\/\/images\.craigslist\.org\/[A-Za-z0-9_]+)_(\d+x\d+)\.jpg$/i);
  if (!craigslistImageMatch) {
    return candidates;
  }

  const prefix = craigslistImageMatch[1];
  const currentSize = craigslistImageMatch[2].toLowerCase();
  const preferredSizes = ['300x300', '600x450', '1200x900'];

  preferredSizes
    .filter(size => size !== currentSize)
    .forEach(size => {
      candidates.push(`${prefix}_${size}.jpg`);
    });

  return candidates;
}

function LazyListingImage({ listingKey, imageUrl, altText, onPermanentError }) {
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = useMemo(() => buildImageCandidates(imageUrl), [imageUrl]);
  const activeSrc = isInView && candidates[candidateIndex] ? candidates[candidateIndex] : null;
  const hasCandidate = candidates.length > 0;

  useEffect(() => {
    setCandidateIndex(0);
    setIsInView(false);
  }, [listingKey, imageUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (!entry || !entry.isIntersecting) {
          return;
        }

        setIsInView(true);
        observer.unobserve(node);
      },
      {
        root: null,
        rootMargin: '350px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [listingKey]);

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(prev => prev + 1);
      return;
    }

    onPermanentError(listingKey);
  };

  return (
    <div ref={containerRef} className={`listing-image ${activeSrc ? '' : 'listing-image--placeholder'}`}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={altText}
          decoding="async"
          fetchPriority="low"
          onError={handleError}
        />
      ) : (
        <span className="listing-image-placeholder-text">
          {hasCandidate && !isInView ? 'Loading image...' : 'No image available'}
        </span>
      )}
    </div>
  );
}

function getExternalItemId(listing) {
  const rawId = typeof listing.id === 'string' ? listing.id.trim() : '';
  if (rawId) {
    return rawId;
  }

  const source = typeof listing.source === 'string' ? listing.source.trim().toLowerCase() : 'unknown';
  const url = typeof listing.url === 'string' ? listing.url.trim() : '';

  return `${source}:${url}`;
}

function buildSavedItemPayload(listing) {
  return {
    externalItemId: getExternalItemId(listing),
    title: listing.title || 'Untitled listing',
    description: listing.location || null,
    price: listing.price,
    url: listing.url,
    source: listing.source,
    image: listing.image,
    location: listing.location,
    postedAt: listing.postedAt,
  };
}

function ListingCard({ listing, hasImageError, onImageError, onSave, isSaving, isSaved }) {
  const listingKey = listing.id || listing.url;
  const imageUrl = hasImageError ? null : listing.image;
  const sourceLabel = typeof listing.source === 'string' ? listing.source.toUpperCase() : 'UNKNOWN';
  const imageAltText = listing.title || 'Craigslist listing image';

  return (
    <div className="listing-card">
      <LazyListingImage
        listingKey={listingKey}
        imageUrl={imageUrl}
        altText={imageAltText}
        onPermanentError={onImageError}
      />
      <div className="listing-content">
        <span className="source-badge">{sourceLabel}</span>
        <h3>{listing.title}</h3>
        <p className="price">{formatPrice(listing.price)}</p>
        {listing.location && <p className="location">📍 {listing.location}</p>}
        {listing.postedAt && (
          <p className="posted-at">
            Posted: {new Date(listing.postedAt).toLocaleDateString()}
          </p>
        )}
        <div className="listing-actions">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="view-listing"
          >
            View on {listing.source}
          </a>
          <button
            type="button"
            className={`save-item-btn ${isSaved ? 'save-item-btn--saved' : ''}`}
            onClick={() => onSave(listing)}
            disabled={isSaving || isSaved}
          >
            {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [listings, setListings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [imageErrorsByListing, setImageErrorsByListing] = useState({});
  const [savedExternalIds, setSavedExternalIds] = useState(new Set());
  const [savingByExternalId, setSavingByExternalId] = useState({});
  const [saveMessage, setSaveMessage] = useState('');

  const firstName = user?.firstName || user?.FirstName || 'User';

  useEffect(() => {
    let isMounted = true;

    const loadSavedItems = async () => {
      try {
        const items = await fetchSavedItems();
        if (!isMounted) {
          return;
        }

        setSavedExternalIds(new Set(items.map(item => item.externalItemId)));
      } catch (err) {
        console.error('Failed to preload saved items:', err);
      }
    };

    loadSavedItems();

    return () => {
      isMounted = false;
    };
  }, []);

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
      if (location) params.append('location', location);

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
    } catch (err) {
      console.error('Search error:', err);
      alert(`Search failed: ${err.message}`);
      setListings([]);
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
        <form className="search-form" onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="query">What are you looking for?</label>
            <input
              id="query"
              type="text"
              placeholder="e.g., bicycle, couch, laptop..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location (optional)</label>
            <input
              id="location"
              type="text"
              placeholder="e.g., Seattle, WA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? 'Searching...' : 'Search Craigslist'}
          </button>
        </form>

        {saveMessage && <p className="save-message">{saveMessage}</p>}

        {hasSearched && (
          <>
            {errors.length > 0 && (
              <div className="errors-section">
                <h3>⚠️ Marketplace Errors</h3>
                <ul>
                  {errors.map((err, idx) => (
                    <li key={idx}>
                      <strong>{err.source}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {listings.length === 0 && !loading && (
              <div className="no-results">
                <p>No listings found. Try a different search or location.</p>
              </div>
            )}

            {listings.length > 0 && (
              <div className="results-section">
                <h2>
                  Results ({listings.length})
                </h2>
                <div className="listings-grid">
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id || listing.url}
                      listing={listing}
                      hasImageError={Boolean(imageErrorsByListing[listing.id || listing.url])}
                      onImageError={handleImageError}
                      onSave={handleSaveListing}
                      isSaving={Boolean(savingByExternalId[getExternalItemId(listing)])}
                      isSaved={savedExternalIds.has(getExternalItemId(listing))}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
