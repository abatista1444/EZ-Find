import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedSearch } from '../api/sharedSearchesApi';
import MarketplaceSearch from '../components/MarketplaceSearch';
import './SharedSearch.css';

function SharedSearchPage() {
  const { token } = useParams();
  const [sharedSearch, setSharedSearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const marketplaceSearchRef = React.useRef(null);

  useEffect(() => {
    const loadSharedSearch = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const result = await getSharedSearch(token);
        setSharedSearch(result);
        setError(null);

        // Automatically trigger search with the shared parameters
        if (marketplaceSearchRef.current) {
          setTimeout(() => {
            marketplaceSearchRef.current.runSearch({
              query: result.query,
              location: result.location || '',
              minPrice: result.minPrice,
              maxPrice: result.maxPrice,
            });
          }, 100);
        }
      } catch (err) {
        console.error('Error loading shared search:', err);
        setError(err.message || 'Failed to load shared search');
        setSharedSearch(null);
      } finally {
        setLoading(false);
      }
    };

    loadSharedSearch();
  }, [token]);

  if (loading) {
    return (
      <div className="shared-search-page">
        <div className="shared-search-loading">
          <p>Loading shared search...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-search-page">
        <div className="shared-search-error">
          <h2>Unable to load shared search</h2>
          <p>{error}</p>
          <Link to="/" className="back-to-home-btn">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-search-page">
      <div className="shared-search-header">
        <div className="shared-search-header-content">
          <div>
            <h1>Shared Search Results</h1>
            {sharedSearch && sharedSearch.createdBy && (
              <p className="shared-by">
                Shared by <strong>{sharedSearch.createdBy}</strong>
              </p>
            )}
            {sharedSearch && sharedSearch.expiresAt && (
              <p className="expiration-info">
                This share expires on {new Date(sharedSearch.expiresAt).toLocaleDateString()} at{' '}
                {new Date(sharedSearch.expiresAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <Link to="/" className="shared-search-home-btn">
            ← New Search
          </Link>
        </div>
      </div>

      <div className="shared-search-main">
        <MarketplaceSearch
          ref={marketplaceSearchRef}
          sectionClassName="shared-search-section"
          title="Search Results"
          locationPrefix="Location: "
          errorsTitle="Marketplace Errors"
        />
      </div>
    </div>
  );
}

export default SharedSearchPage;
