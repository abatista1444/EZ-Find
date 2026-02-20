import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const INITIAL = {
  email: '', password: '', confirmPassword: '',
  firstName: '', lastName: '',
  address: '', city: '', state: '', country: '',
};

export default function RegisterPage() {
  const { register }  = useAuth();
  const navigate      = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setErrors([]);

    if (form.password !== form.confirmPassword) {
      setErrors([{ msg: 'Passwords do not match' }]);
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors(err.errors ?? [{ msg: err.message ?? 'Registration failed' }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">EZFind</h1>
          <p>Create your account</p>
        </div>

        {errors.length > 0 && (
          <div className="auth-errors">
            {errors.map((e, i) => <p key={i}>{e.msg}</p>)}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required />
            </div>
          </div>

          <p className="section-label">Address (optional)</p>

          <div className="form-group">
            <label>Street Address</label>
            <input name="address" value={form.address} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input name="city" value={form.city} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input name="state" value={form.state} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Country</label>
            <input name="country" value={form.country} onChange={handleChange} />
          </div>

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
