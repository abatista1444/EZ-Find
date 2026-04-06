const API_BASE = '/api/auth';

export async function updateProfile(data) {
  const response = await fetch(`${API_BASE}/profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw result;
  return result;
}

export async function changePassword(currentPassword, newPassword) {
  const response = await fetch(`${API_BASE}/password`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const result = await response.json();
  if (!response.ok) throw result;
  return result;
}

export async function changeEmail(newEmail, password) {
  const response = await fetch(`${API_BASE}/email`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newEmail, password }),
  });
  const result = await response.json();
  if (!response.ok) throw result;
  return result;
}
