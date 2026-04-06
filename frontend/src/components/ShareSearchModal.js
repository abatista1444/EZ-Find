import React, { useState, useEffect } from 'react';
import { createSharedSearch, copyToClipboard, constructShareUrl } from '../api/sharedSearchesApi';
import './ShareSearchModal.css';

function ShareSearchModal({ isOpen, onClose, searchParams, onShare }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setError(null);
      setShareUrl(null);
      setExpirationDate('');
      setCopied(false);
    }
  }, [isOpen]);

  const handleCreateShare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createSharedSearch(searchParams, expirationDate || null);
      const url = constructShareUrl(result.token);
      setShareUrl(url);

      // Notify parent component
      if (onShare) {
        onShare(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to create shareable link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await copyToClipboard(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share Search Results</h2>
          <button className="share-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="share-modal-body">
          {shareUrl ? (
            <div className="share-success">
              <div className="share-success-message">
                <p>✓ Your search has been shared!</p>
              </div>

              <div className="share-url-section">
                <label>Share this link:</label>
                <div className="share-url-container">
                  <input type="text" readOnly value={shareUrl} className="share-url-input" />
                  <button className="share-copy-btn" onClick={handleCopyUrl}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <p className="share-info-text">Anyone with this link can view your search results without signing in.</p>

              <button className="share-new-btn" onClick={() => setShareUrl(null)}>
                Create Another Share
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateShare}>
              <div className="form-group">
                <label htmlFor="expiration">
                  Expiration Date (optional)
                  <span className="optional-hint">Leave blank for permanent share</span>
                </label>
                <input
                  id="expiration"
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {error && <div className="share-error-message">{error}</div>}

              <div className="share-search-summary">
                <p className="summary-title">You're sharing:</p>
                <ul>
                  <li>
                    <strong>Search:</strong> {searchParams.query}
                  </li>
                  {searchParams.location && (
                    <li>
                      <strong>Location:</strong> {searchParams.location}
                    </li>
                  )}
                  {searchParams.minPrice && (
                    <li>
                      <strong>Min Price:</strong> ${searchParams.minPrice}
                    </li>
                  )}
                  {searchParams.maxPrice && (
                    <li>
                      <strong>Max Price:</strong> ${searchParams.maxPrice}
                    </li>
                  )}
                </ul>
              </div>

              <div className="share-modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Share Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareSearchModal;
