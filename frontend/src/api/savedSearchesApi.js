const API_BASE = '/api/saved-searches';

export async function fetchSavedSearches() {
  const response = await fetch(API_BASE, {
    method: 'GET',
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load saved searches');
  }

  return data.searches || [];
}

export async function createSavedSearch(payload) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to save search');
    error.status = response.status;
    throw error;
  }

  return data.savedSearch;
}

export async function updateSavedSearch(searchId, payload) {
  const response = await fetch(`${API_BASE}/${searchId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to update search');
    error.status = response.status;
    throw error;
  }

  return true;
}

export async function removeSavedSearch(searchId) {
  const response = await fetch(`${API_BASE}/${searchId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to remove search');
    error.status = response.status;
    throw error;
  }

  return true;
}
