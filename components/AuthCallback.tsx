import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const { platform } = useParams<{ platform: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get('code');
      
      if (!code) {
        setStatus('error');
        setErrorMsg('No authorization code received from platform.');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback/${platform}`;
        const response = await fetch(`/api/auth/${platform}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, platform, redirectUri })
        });

        const data = await response.json();

        if (response.ok) {
          // Store the connection in localStorage (Legit simulation)
          const connections = JSON.parse(localStorage.getItem('kawayan_social_connections') || '{}');
          connections[platform!] = {
            connected: true,
            connectedAt: new Date().toISOString(),
            accessToken: data.accessToken,
            user: data.user
          };
          localStorage.setItem('kawayan_social_connections', JSON.stringify(connections));
          
          setStatus('success');
          setTimeout(() => navigate('/insights'), 2000);
        } else {
          throw new Error(data.error || 'Failed to exchange code for token');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    };

    exchangeCode();
  }, [platform, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connecting {platform}...</h2>
            <p className="text-gray-400">Please wait while we secure your account connection.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Success!</h2>
            <p className="text-gray-400">Account connected successfully. Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
            <p className="text-red-400 mb-4">{errorMsg}</p>
            <button 
              onClick={() => navigate('/settings')}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Go Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
