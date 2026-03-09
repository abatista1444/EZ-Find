const API_BASE = '/api/saved-items';

export async function fetchSavedItems() {
  const response = await fetch(API_BASE, {
    method: 'GET',
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to load saved items');
  }

  return data.items || [];
}

export async function createSavedItem(payload) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to save item');
    error.status = response.status;
    throw error;
  }

  return data.savedItem;
}

export async function removeSavedItem(externalItemId) {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(externalItemId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to remove item');
    error.status = response.status;
    throw error;
  }

  return true;
}
