import React, { useState } from 'react';
import { processMessage } from '../api/chatbotApi';
import './ChatbotSidebar.css';

function ChatbotSidebar({ onSearch }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await processMessage(message);
      setResponse(result);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Failed to process message');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (response && response.searchParams) {
      onSearch(response.searchParams);
      setResponse(null);
      setMessage('');
    }
  };

  return (
    <div className={`chatbot-sidebar ${isMinimized ? 'chatbot-sidebar--minimized' : ''}`}>
      {/* Sidebar Header */}
      <div className="chatbot-header">
        <h3 className="chatbot-title">🤖 AI Search</h3>
        <button
          type="button"
          className="chatbot-toggle-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isMinimized ? '◀' : '▶'}
        </button>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Message Area */}
          <div className="chatbot-messages">
            {!response && !loading && (
              <div className="chatbot-welcome">
                <p>Describe what you're looking for and I'll help you search!</p>
                <p className="example-text">Example: "Used mountain bike under $500 in SF"</p>
              </div>
            )}

            {response && (
              <div className="chatbot-response">
                <p className="response-message">{response.message}</p>
                <div className="response-params">
                  <h4>Search Parameters:</h4>
                  <div className="param">
                    <label>Query:</label>
                    <span>{response.searchParams.query || 'N/A'}</span>
                  </div>
                  {response.searchParams.location && (
                    <div className="param">
                      <label>Location:</label>
                      <span>{response.searchParams.location}</span>
                    </div>
                  )}
                  {response.searchParams.minPrice !== null && response.searchParams.minPrice !== undefined && (
                    <div className="param">
                      <label>Min Price:</label>
                      <span>${response.searchParams.minPrice}</span>
                    </div>
                  )}
                  {response.searchParams.maxPrice !== null && response.searchParams.maxPrice !== undefined && (
                    <div className="param">
                      <label>Max Price:</label>
                      <span>${response.searchParams.maxPrice}</span>
                    </div>
                  )}
                </div>

                {response.confidence && (
                  <p className="confidence-text">
                    Confidence: {(response.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {loading && (
              <div className="chatbot-loading">
                <div className="spinner"></div>
                <p>Processing your request...</p>
              </div>
            )}

            {error && (
              <div className="chatbot-error">
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form className="chatbot-form" onSubmit={handleSubmit}>
            <textarea
              className="chatbot-input"
              placeholder="What are you looking for?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              rows="3"
            />

            <div className="chatbot-form-actions">
              <button
                type="submit"
                className="chatbot-send-btn"
                disabled={loading || !message.trim()}
              >
                {loading ? 'Processing...' : 'Ask'}
              </button>

              {response && (
                <button
                  type="button"
                  className="chatbot-search-btn"
                  onClick={handleSearch}
                >
                  Search
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default ChatbotSidebar;
