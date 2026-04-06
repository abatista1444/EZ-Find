import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createSavedItem, fetchSavedItems } from '../api/savedItemsApi';
import { createSavedSearch } from '../api/savedSearchesApi';
import ShareSearchModal from './ShareSearchModal';
import SimpleShareModal from './SimpleShareModal';

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

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return '';
}

function getListingTitle(listing) {
  return firstNonEmptyString(listing.title, listing.itemName, listing.name, listing.Name) || 'Untitled listing';
}

function getListingImage(listing) {
  return firstNonEmptyString(
    listing.image,
    listing.imageUrl,
    listing.thumbnail,
    listing.photo,
    listing.photoUrl
  ) || null;
}

function buildSavedItemPayload(listing) {
  return {
    externalItemId: getExternalItemId(listing),
    title: getListingTitle(listing),
    description: listing.location || null,
    price: listing.price,
    url: listing.url,
    source: listing.source,
    image: getListingImage(listing),
    location: listing.location,
    postedAt: listing.postedAt,
  };
}

function filterListingsByPrice(listings, minPrice, maxPrice) {
  const min = minPrice ? Number(minPrice) : null;
  const max = maxPrice ? Number(maxPrice) : null;

  return listings.filter(listing => {
    const price = listing.price || 0;
    if (min !== null && price < min) return false;
    if (max !== null && price > max) return false;
    return true;
  });
}

function filterListingsByDateRange(listings, startDate, endDate) {
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;

  return listings.filter(listing => {
    if (!listing.postedAt) return true;
    const posted = new Date(listing.postedAt).getTime();
    if (start !== null && posted < start) return false;
    if (end !== null && posted > end) return false;
    return true;
  });
}

function filterListingsByLocation(listings, locationFilter) {
  if (!locationFilter.trim()) return listings;

  const filter = locationFilter.toLowerCase();
  return listings.filter(listing => {
    if (!listing.location) return false;
    return listing.location.toLowerCase().includes(filter);
  });
}

function getFilteredListings(listings, filters) {
  let result = listings;

  if (filters.priceRange.min || filters.priceRange.max) {
    result = filterListingsByPrice(result, filters.priceRange.min, filters.priceRange.max);
  }

  if (filters.dateRange.startDate || filters.dateRange.endDate) {
    result = filterListingsByDateRange(result, filters.dateRange.startDate, filters.dateRange.endDate);
  }

  if (filters.locationFilter) {
    result = filterListingsByLocation(result, filters.locationFilter);
  }

  return result;
}

function isFilterActive(filters) {
  return Boolean(
    filters.priceRange.min ||
    filters.priceRange.max ||
    filters.dateRange.startDate ||
    filters.dateRange.endDate ||
    filters.locationFilter
  );
}

function ListingCard({ listing, hasImageError, onImageError, onSave, isSaving, isSaved, locationPrefix, onShare }) {
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
        {listing.location && <p className="location">{locationPrefix}{listing.location}</p>}
        {listing.postedAt && (
          <p className="posted-at">Posted: {new Date(listing.postedAt).toLocaleDateString()}</p>
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
            className="share-item-btn"
            onClick={() => onShare(listing)}
            title="Share this item"
          >
            Share
          </button>
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

function SearchFilters({ filters, onFilterChange, onClearFilters, enabled, isCollapsed, onToggleCollapse }) {
  const handlePriceMinChange = (e) => {
    onFilterChange({
      ...filters,
      priceRange: { ...filters.priceRange, min: e.target.value },
    });
  };

  const handlePriceMaxChange = (e) => {
    onFilterChange({
      ...filters,
      priceRange: { ...filters.priceRange, max: e.target.value },
    });
  };

  const handleDateStartChange = (e) => {
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, startDate: e.target.value },
    });
  };

  const handleDateEndChange = (e) => {
    onFilterChange({
      ...filters,
      dateRange: { ...filters.dateRange, endDate: e.target.value },
    });
  };

  const handleLocationChange = (e) => {
    onFilterChange({
      ...filters,
      locationFilter: e.target.value,
    });
  };

  const hasActiveFilters = isFilterActive(filters);

  return (
    <div className="search-filters-section">
      <button
        type="button"
        className={`filters-toggle ${hasActiveFilters ? 'filters-toggle--active' : ''}`}
        onClick={onToggleCollapse}
        disabled={!enabled}
      >
        <span className="filters-toggle-icon">{isCollapsed ? '▶' : '▼'}</span>
        <span className="filters-toggle-text">Advanced Filters</span>
        {hasActiveFilters && <span className="filters-active-badge">Active</span>}
      </button>

      {!isCollapsed && (
        <div className="filters-content">
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="price-min">Price Range</label>
              <div className="filter-input-pair">
                <input
                  id="price-min"
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange.min}
                  onChange={handlePriceMinChange}
                  disabled={!enabled}
                  min="0"
                />
                <span className="filter-separator">—</span>
                <input
                  id="price-max"
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange.max}
                  onChange={handlePriceMaxChange}
                  disabled={!enabled}
                  min="0"
                />
              </div>
            </div>

            <div className="filter-group">
              <label htmlFor="date-start">Posted Date Range</label>
              <div className="filter-input-pair">
                <input
                  id="date-start"
                  type="date"
                  value={filters.dateRange.startDate}
                  onChange={handleDateStartChange}
                  disabled={!enabled}
                />
                <span className="filter-separator">—</span>
                <input
                  id="date-end"
                  type="date"
                  value={filters.dateRange.endDate}
                  onChange={handleDateEndChange}
                  disabled={!enabled}
                />
              </div>
            </div>

            <div className="filter-group">
              <label htmlFor="location-filter">Location Filter</label>
              <input
                id="location-filter"
                type="text"
                placeholder="e.g., Seattle, Brooklyn"
                value={filters.locationFilter}
                onChange={handleLocationChange}
                disabled={!enabled}
              />
            </div>
          </div>

          <button
            type="button"
            className="clear-filters-btn"
            onClick={onClearFilters}
            disabled={!enabled || !hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

export default forwardRef(function MarketplaceSearch(
  {
    sectionClassName = '',
    title = 'Search Marketplace Listings',
    locationPrefix = 'Location: ',
    errorsTitle = 'Marketplace Errors',
  },
  ref
) {
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [isSimpleShareOpen, setIsSimpleShareOpen] = useState(false);
  const [shareItemData, setShareItemData] = useState(null);
  const [filters, setFilters] = useState({
    priceRange: { min: '', max: '' },
    dateRange: { startDate: '', endDate: '' },
    locationFilter: '',
  });
  const [showFilters, setShowFilters] = useState(false);

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

  useImperativeHandle(ref, () => ({
    runSearch: (searchParams) => {
      const { query: paramQuery, location: paramLocation, minPrice, maxPrice } = searchParams;
      setQuery(paramQuery || '');
      setLocation(paramLocation || '');
      setFilters(prev => ({
        ...prev,
        priceRange: {
          min: minPrice ? minPrice.toString() : '',
          max: maxPrice ? maxPrice.toString() : '',
        },
      }));

      // Trigger search immediately
      setTimeout(() => {
        // We need to build a form-like event and call handleSearch
        const formEvent = new Event('submit');
        const formElement = {
          preventDefault: () => {},
          target: {
            query: { value: paramQuery || '' },
            location: { value: paramLocation || '' },
          },
        };

        // Set the state and trigger search
        setQuery(paramQuery || '');
        setLocation(paramLocation || '');
        setLoading(true);
        setHasSearched(true);

        const params = new URLSearchParams();
        params.append('q', paramQuery || '');
        if (paramLocation) {
          params.append('location', paramLocation);
        }
        if (minPrice) {
          params.append('minPrice', minPrice);
        }
        if (maxPrice) {
          params.append('maxPrice', maxPrice);
        }

        fetch(`http://localhost:5000/api/search?${params}`, {
          method: 'GET',
          credentials: 'include',
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            setListings(data.listings || []);
            setErrors(data.errors || []);
            setImageErrorsByListing({});
            setSaveMessage('');
          })
          .catch(err => {
            console.error('Search error:', err);
            setListings([]);
            setErrors([]);
          })
          .finally(() => {
            setLoading(false);
          });
      }, 0);
    },
    getRecentResults: () => listings,
  }), [listings]);

  const filteredListings = useMemo(() => {
    return getFilteredListings(listings, filters);
  }, [listings, filters]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      priceRange: { min: '', max: '' },
      dateRange: { startDate: '', endDate: '' },
      locationFilter: '',
    });
  };

  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
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
      if (filters.priceRange.min) {
        params.append('minPrice', filters.priceRange.min);
      }
      if (filters.priceRange.max) {
        params.append('maxPrice', filters.priceRange.max);
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

  const handleSaveSearch = async () => {
    if (!query.trim()) {
      setSaveMessage('Please enter a search query to save.');
      return;
    }

    setIsSavingSearch(true);

    try {
      // Generate a default search name from the query and location
      const defaultName = location ? `${query} - ${location}` : query;

      await createSavedSearch({
        name: defaultName,
        query: query.trim(),
        location: location.trim() || undefined,
        minPrice: filters.priceRange.min ? Number(filters.priceRange.min) : undefined,
        maxPrice: filters.priceRange.max ? Number(filters.priceRange.max) : undefined,
      });

      setSaveMessage('Search saved successfully! View it in Saved Searches.');
    } catch (err) {
      if (err.status === 409) {
        setSaveMessage('A search with this name already exists. Edit it in Saved Searches.');
      } else {
        setSaveMessage(err.message || 'Failed to save search. Please try again.');
      }
    } finally {
      setIsSavingSearch(false);
    }
  };

  const handleShareListing = (listing) => {
    setShareItemData({
      url: listing.url,
      title: listing.title,
    });
    setIsSimpleShareOpen(true);
  };

  return (
    <section className={sectionClassName}>
      <h2 className="dashboard-section-title">{title}</h2>
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

        <div className="search-form-actions">
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? 'Searching...' : 'Search Craigslist'}
          </button>
          <button
            type="button"
            className="save-search-btn"
            onClick={handleSaveSearch}
            disabled={loading || isSavingSearch || !query.trim()}
            title="Save this search to run it again later"
          >
            {isSavingSearch ? 'Saving...' : '💾 Save Search'}
          </button>
        </div>

        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          enabled={true}
          isCollapsed={showFilters}
          onToggleCollapse={handleToggleFilters}
        />
      </form>

      {saveMessage && <p className="save-message">{saveMessage}</p>}

      {hasSearched && (
        <>
          {errors.length > 0 && (
            <div className="errors-section">
              <h3>{errorsTitle}</h3>
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
              <div className="results-header">
                <h2>
                  Results ({listings.length})
                  {isFilterActive(filters) && filteredListings.length !== listings.length && (
                    <span className="filter-count"> - {filteredListings.length} matching filters</span>
                  )}
                </h2>
                {listings.length > 0 && (
                  <button
                    className="share-search-btn"
                    onClick={() => setIsShareModalOpen(true)}
                    title="Share this search with others"
                  >
                    📤 Share
                  </button>
                )}
              </div>

              {filteredListings.length === 0 && listings.length > 0 ? (
                <div className="no-results">
                  <p>No listings match your filters. Try adjusting them.</p>
                </div>
              ) : (
                <div className="listings-grid">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id || listing.url}
                      listing={listing}
                      hasImageError={Boolean(imageErrorsByListing[listing.id || listing.url])}
                      onImageError={handleImageError}
                      onShare={handleShareListing}
                      onSave={handleSaveListing}
                      isSaving={Boolean(savingByExternalId[getExternalItemId(listing)])}
                      isSaved={savedExternalIds.has(getExternalItemId(listing))}
                      locationPrefix={locationPrefix}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ShareSearchModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        searchParams={{
          query,
          location,
          minPrice: filters.priceRange.min,
          maxPrice: filters.priceRange.max,
        }}
        onShare={() => {
          setIsShareModalOpen(false);
        }}
      />

      <SimpleShareModal
        isOpen={isSimpleShareOpen}
        onClose={() => setIsSimpleShareOpen(false)}
        itemUrl={shareItemData?.url}
        itemTitle={shareItemData?.title}
      />
    </section>
  );
});
