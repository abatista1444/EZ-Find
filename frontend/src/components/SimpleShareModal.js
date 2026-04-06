import React, { useState } from 'react';
import './SimpleShareModal.css';

function SimpleShareModal({ isOpen, onClose, itemUrl, itemTitle }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(itemUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="simple-share-overlay" onClick={onClose}>
      <div className="simple-share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="simple-share-header">
          <h3>Share this item</h3>
          <button className="simple-share-close" onClick={onClose}>✕</button>
        </div>

        <div className="simple-share-body">
          <p className="item-title">{itemTitle}</p>

          <div className="url-copy-section">
            <input
              type="text"
              readOnly
              value={itemUrl}
              className="share-url-field"
              onClick={(e) => e.target.select()}
            />
            <button
              className="copy-btn"
              onClick={handleCopy}
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>

          <p className="share-hint">Link copied to clipboard • Share with anyone</p>
        </div>
      </div>
    </div>
  );
}

export default SimpleShareModal;
