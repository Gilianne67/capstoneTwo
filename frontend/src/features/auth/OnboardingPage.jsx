import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OnboardingForm from "../public-landing/pages/OnboardingForm";
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api';

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: contextToken, updateUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Capture registered email passed from AuthPage navigation state
  const registeredEmail = location.state?.registeredEmail || '';

  const handleOnboardingSubmit = async (formData) => {
    setIsSubmitting(true);
    
    // Check multiple potential storage keys for the token
    const token = contextToken || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('accessToken') || 
                  localStorage.getItem('authToken') ||
                  sessionStorage.getItem('token');
                  
    const cleanToken = token ? token.replace(/^"|"$/g, '').replace('Bearer ', '').trim() : null;

    if (!cleanToken) {
      console.warn("⚠️ No authentication token found in storage or context. Request will proceed unauthenticated.");
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cleanToken && { 'Authorization': `Bearer ${cleanToken}` })
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          email: registeredEmail 
        })
      });

      const contentType = response.headers.get('content-type');
      let data = {};
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.message || 'Onboarding submission failed.');
      }

      if (typeof updateUser === 'function' && data.user) {
        updateUser(data.user);
      }

      const finalEmail = registeredEmail || data.user?.email || formData.guardianEmail || '';
      const isMinorAccount = formData.isMinor || formData.age < 18 || data.user?.status === 'pending_consent';

      if (isMinorAccount) {
        // Updated to /consent/verify to match the App.jsx route configuration for ParentConsentPage (View 1: Waiting Screen)
        navigate(`/consent/verify?email=${encodeURIComponent(finalEmail)}`, { replace: true });
      } else {
        navigate(`/verify-holding?email=${encodeURIComponent(finalEmail)}`, { replace: true });
      }
    } catch (err) {
      console.error('Onboarding Submission Error:', err);
      alert(err.message || 'We could not process your onboarding request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingForm 
      onSubmit={handleOnboardingSubmit} 
      isSubmitting={isSubmitting} 
      registeredEmail={registeredEmail} 
    />
  );
}

export default OnboardingPage;