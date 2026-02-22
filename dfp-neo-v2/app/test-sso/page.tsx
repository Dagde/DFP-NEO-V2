'use client';

import { useEffect } from 'react';

export default function TestSSOPage() {
  useEffect(() => {
    console.log('[TEST SSO] Page loaded');
    console.log('[TEST SSO] Full URL:', window.location.href);
    console.log('[TEST SSO] Search params:', window.location.search);
    
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const username = urlParams.get('username');
    
    console.log('[TEST SSO] userId:', userId);
    console.log('[TEST SSO] username:', username);
    
    document.body.innerHTML = `
      <h1>SSO Test Page</h1>
      <h2>Full URL: ${window.location.href}</h2>
      <h2>Search Params: ${window.location.search}</h2>
      <h3>userId: ${userId || 'NOT FOUND'}</h3>
      <h3>username: ${username || 'NOT FOUND'}</h3>
      <p>If you see userId and username above, SSO is working!</p>
    `;
  }, []);

  return <div>Loading...</div>;
}