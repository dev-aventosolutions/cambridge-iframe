'use client';
import { useEffect, useState } from 'react';
import MainPage from './main';

export default function IframeWrapper() {
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    const allowedOrigins = ['https://alphalogisticspk.com'];

    // window.top ko null check ke saath
    if (window.top && window !== window.top) { // agar iframe ke andar hai
      try {
        const parentOrigin = window.top.location.origin;
        if (!allowedOrigins.includes(parentOrigin)) {
          setAuthorized(false);
        }
      } catch {
        // agar cross-origin error aaye
        setAuthorized(false);
      }
    }
  }, []);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 text-xl font-bold">
        Unauthorized
      </div>
    );
  }

  return <MainPage />;
}
