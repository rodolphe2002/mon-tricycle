"use client";
// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastRoute, setLastRoute] = useState(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const rawDriver = localStorage.getItem('tri_user_driver');
      const driverUser = rawDriver ? JSON.parse(rawDriver) : null;
      const knownDriver = localStorage.getItem('tri_known_driver') === '1';
      if (knownDriver || driverUser?.role === 'driver') {
        router.replace('/login-conducteur');
        return;
      }
      // If client already authenticated, skip home and go to pre-commande
      const tokenClient = localStorage.getItem('tri_token_client');
      const rawClient = localStorage.getItem('tri_user_client');
      const clientUser = rawClient ? JSON.parse(rawClient) : null;
      if (tokenClient && clientUser?.role === 'client') {
        router.replace('/pre-commande');
        return;
      }
      // Load last route to allow resume
      const lr = localStorage.getItem('tri_last_route');
      if (lr) {
        try { const obj = JSON.parse(lr); if (obj?.href) setLastRoute(obj.href); } catch {}
      }
    } catch {}
    setIsLoaded(true);
  }, [router]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Elements d'arrière-plan animés */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-soft-light opacity-20 animate-pulse-slow"></div>
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-amber-500 rounded-full mix-blend-soft-light opacity-15 animate-float"></div>
          <div className="absolute top-10 right-20 w-40 h-40 bg-orange-600 rounded-full mix-blend-soft-light opacity-10 animate-spin-slow"></div>
        </div>

        <main className="z-10 w-full max-w-md flex flex-col items-center justify-center">
          {/* Header avec logo animé */}
          <header className={`transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex justify-center mb-2">
              <svg 
                className="w-20 h-20 drop-shadow-lg" 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="25" cy="75" r="8" fill="white" className="animate-roll" />
                <circle cx="65" cy="75" r="8" fill="white" className="animate-roll" />
                <path d="M30 50L60 35C65 32 70 35 70 40V60C70 65 65 68 60 65L40 55" stroke="white" strokeWidth="4" className="animate-draw" />
                <circle cx="40" cy="40" r="10" fill="none" stroke="white" strokeWidth="4" className="animate-pulse" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-center text-white mb-1 font-inter tracking-tight">Tricycle</h1>
            <p className="text-lg text-center text-white/90 font-light mb-10 font-inter">Votre tricycle, en quelques minutes.</p>
          </header>

          {/* Illustration hero avec animation */}
          <div className={`relative w-full h-64 mb-10 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg 
                className="w-full h-full" 
                viewBox="0 0 400 300" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Route */}
                <path d="M0 220H400" stroke="url(#roadGradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray="1 20" className="animate-road" />
                
                {/* Tricycle stylisé */}
                <g className="animate-bounce-slight">
                  <circle cx="150" cy="200" r="20" fill="white" stroke="#FF8C00" strokeWidth="3" />
                  <circle cx="250" cy="200" r="20" fill="white" stroke="#FF8C00" strokeWidth="3" />
                  <circle cx="100" cy="200" r="15" fill="white" stroke="#FF8C00" strokeWidth="3" />
                  
                  <path d="M120 180L160 150C170 145 180 150 180 160V180C180 190 170 195 160 190L140 180" stroke="white" strokeWidth="6" strokeLinecap="round" />
                  
                  <rect x="160" y="160" width="40" height="20" rx="5" fill="white" stroke="#FF8C00" strokeWidth="2" />
                  
                  <circle cx="100" cy="200" r="5" fill="#FF8C00" />
                  <circle cx="150" cy="200" r="5" fill="#FF8C00" />
                  <circle cx="250" cy="200" r="5" fill="#FF8C00" />
                </g>
                
                {/* Dégradé pour la route */}
                <defs>
                  <linearGradient id="roadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Boutons CTA avec animations */}
          <div className={`w-full space-y-4 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {lastRoute && (
              <button onClick={() => router.push(lastRoute)} className="w-full bg-black/20 border-2 border-white/30 text-white py-5 px-6 rounded-[50px] text-lg font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                Continuer où j'en étais
              </button>
            )}
            <button onClick={() => router.push('/signup')} className="w-full bg-white text-orange-600 py-5 px-6 rounded-[50px] text-lg font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group">
              <span>Créer un compte</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            
            <button onClick={() => router.push('/login')} className="w-full bg-transparent border-2 border-white text-white py-5 px-6 rounded-[50px] text-lg font-medium shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-white/10">
              Se connecter
            </button>
          </div>

          {/* Footer avec lien */}
          <footer className={`mt-8 transition-all duration-1000 delay-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-center text-white/80 text-sm font-light">
              En continuant, vous acceptez nos{' '}
              <a href="#" className="underline hover:text-white transition-colors font-medium">
                Conditions & Politique de confidentialité
              </a>
            </p>
          </footer>
        </main>
      </div>

      <style jsx global>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        
        @keyframes roll {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.05); opacity: 0.3; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes road {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -40; }
        }
        
        @keyframes bounce-slight {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        .animate-draw {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: draw 2s ease-in-out forwards;
        }
        
        .animate-roll {
          animation: roll 5s linear infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        
        .animate-road {
          animation: road 1s linear infinite;
        }
        
        .animate-bounce-slight {
          animation: bounce-slight 3s ease-in-out infinite;
        }
        
        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </>
  );
}