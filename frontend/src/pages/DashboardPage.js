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
  const [hasLoadedInitialSuggestions, setHasLoadedInitialSuggestions] = useState(false);

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
      let newIds;
      if (typeof updater === 'function') {
        newIds = updater(prev);
      } else {
        newIds = updater;
      }
      // Persist saved IDs to sessionStorage
      sessionStorage.setItem('ezfind_savedIds', JSON.stringify(Array.from(newIds)));
      return newIds;
    });
  };

  // Update suggestions when search results change
  const handleSearchResultsUpdate = () => {
    if (marketplaceSearchRef.current) {
      const results = marketplaceSearchRef.current.getRecentResults?.();
      if (Array.isArray(results) && results.length > 0) {
        setRecentSearchResults(results);
        // Persist suggestions to sessionStorage so they survive navigation
        sessionStorage.setItem('ezfind_suggestions', JSON.stringify(results));
      }
    }
  };

  // Load initial suggestions on mount by auto-searching with top keyword
  useEffect(() => {
    // Try to restore saved IDs from sessionStorage first
    const cachedSavedIds = sessionStorage.getItem('ezfind_savedIds');
    if (cachedSavedIds) {
      try {
        const ids = JSON.parse(cachedSavedIds);
        if (Array.isArray(ids)) {
          setSavedExternalIds(new Set(ids));
        }
      } catch (err) {
        console.warn('Failed to restore cached saved IDs:', err);
      }
    }

    // Check if we've already loaded suggestions this session
    const hasLoadedThisSession = sessionStorage.getItem('ezfind_suggestionsLoaded') === 'true';

    // Try to restore suggestions from sessionStorage first
    const cachedSuggestions = sessionStorage.getItem('ezfind_suggestions');
    if (cachedSuggestions) {
      try {
        const suggestions = JSON.parse(cachedSuggestions);
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          setRecentSearchResults(suggestions);
          setHasLoadedInitialSuggestions(true);
          return;
        }
      } catch (err) {
        console.warn('Failed to restore cached suggestions:', err);
      }
    }

    // If already loaded in this session, skip
    if (hasLoadedThisSession) {
      setHasLoadedInitialSuggestions(true);
      return;
    }

    const loadInitialSuggestions = async () => {
      try {
        const items = await fetchSavedItems();
        const savedIds = new Set(items.map(item => item.externalItemId));
        setSavedExternalIds(savedIds);
        // Persist saved IDs immediately
        sessionStorage.setItem('ezfind_savedIds', JSON.stringify(Array.from(savedIds)));

        // Extract top keyword from saved items to do initial search
        if (items.length > 0 && marketplaceSearchRef.current) {
          const commonWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'is', 'are', 'was', 'be', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
            'can', 'new', 'used', 'item', 'listing', 'post', 'ad', 'sale'
          ]);

          // Extract keywords from all saved items
          const allWords = [];
          for (const item of items) {
            const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
            const tokens = text
              .split(/\s+/)
              .filter(w => w.length > 3 && !commonWords.has(w))
              .map(w => w.replace(/[^a-z0-9]/g, ''));
            allWords.push(...tokens);
          }

          // Get the most common keyword
          const wordFreq = {};
          for (const word of allWords) {
            if (word) wordFreq[word] = (wordFreq[word] || 0) + 1;
          }

          const topKeyword = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

          // Perform initial search with top keyword to populate suggestions
          if (topKeyword) {
            console.log('Dashboard: Performing initial search with keyword:', topKeyword);
            marketplaceSearchRef.current.runSearch({
              query: topKeyword,
              location: ''
            });
            // Mark that we've loaded suggestions this session
            sessionStorage.setItem('ezfind_suggestionsLoaded', 'true');
          }
        }

        setHasLoadedInitialSuggestions(true);
      } catch (err) {
        console.error('Failed to load initial suggestions:', err);
        setHasLoadedInitialSuggestions(true);
      }
    };

    loadInitialSuggestions();
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

          {hasLoadedInitialSuggestions && recentSearchResults.length > 0 && (
            <SuggestionsSection
              recentSearchResults={recentSearchResults}
              savedExternalIds={savedExternalIds}
              onSavedIdsChange={handleSavedIdsChange}
            />
          )}

          <MarketplaceSearch
            ref={marketplaceSearchRef}
            sectionClassName="dashboard-search-section"
          />

          {hasLoadedInitialSuggestions && recentSearchResults.length > 0 && (
            <SuggestionsSection
              recentSearchResults={recentSearchResults}
              savedExternalIds={savedExternalIds}
              onSavedIdsChange={handleSavedIdsChange}
            />
          )}
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
 * Only re-queries when results actually change to minimize API calls.
 */
function HiddenSuggestionUpdater({ marketplaceSearchRef, onUpdate }) {
  const previousResultsRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const results = marketplaceSearchRef.current?.getRecentResults?.();

      // Only call onUpdate if results actually changed
      if (Array.isArray(results)) {
        const currentHash = JSON.stringify(results.map(r => r.id || r.url));
        const previousHash = previousResultsRef.current;

        if (currentHash !== previousHash) {
          previousResultsRef.current = currentHash;
          onUpdate();
        }
      }
    }, 2000); // Poll every 2 seconds instead of 1 to reduce API calls

    return () => clearInterval(interval);
  }, [onUpdate]);

  return null;
}
