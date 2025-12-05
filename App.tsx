import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppView, UserProfile, UserRole, EventData } from './types';
import Button from './components/Button';
import { createEvent, getEvents, subscribeToEvents, updateEventColor, updateEventRandom, joinEvent, deleteEvent, cleanupOldEvents } from './services/storageService';
import { generatePartyPalette } from './services/geminiService';
import { Loader2, Lightbulb, Search, LogOut, Sparkles, Lock, Maximize, Minimize, Zap, QrCode, X, Share2, ScanLine, CheckCircle2, Image as ImageIcon, Trash2, Calendar, Clock, AlertTriangle, Eye, Send, LogIn } from 'lucide-react';

// --- CONFIGURAÇÃO DE IMAGEM ---
const BACKGROUND_IMAGE_URL = "https://i.ibb.co/vxG023B9/Create-a-video-202511252247.png";
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1459749411177-3a29329579d6?q=80&w=2070&auto=format&fit=crop";

// --- CONFIGURAÇÃO DE AUTENTICAÇÃO ---
// 1. Google: Obtenha em console.cloud.google.com
const GOOGLE_CLIENT_ID = "INSIRA_SEU_CLIENT_ID_AQUI.apps.googleusercontent.com"; 

// 2. Facebook: Obtenha em developers.facebook.com
const FACEBOOK_APP_ID = "INSIRA_SEU_APP_ID_AQUI";

// --- Types for External Library ---
declare global {
  interface Window {
    Html5QrcodeScanner: any;
    Html5Qrcode: any;
    webkitAudioContext: typeof AudioContext;
    google: any;
    FB: any;
    fbAsyncInit: any;
  }
}

// --- Helper Functions ---

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((e) => console.log("Fullscreen blocked:", e));
  } else {
    document.exitFullscreen().catch((e) => console.log("Exit fullscreen blocked:", e));
  }
};

const getEventUrl = (id: string) => {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?eventId=${id}`;
};

const playScanSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.error("Audio feedback failed", e);
  }
};

// --- Sub-Components ---

const Header = ({ title, onBack }: { title: string; onBack?: () => void }) => {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-2 select-none">
          <Lightbulb className="w-5 h-5 text-pink-500" />
          {title}
        </h1>
      </div>

      <button 
        onClick={toggleFullscreen}
        className="p-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-full text-white backdrop-blur-md pointer-events-auto transition-all"
        title={isFullscreen ? "Sair da Tela Cheia" : "Entrar em Tela Cheia"}
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>
    </div>
  );
};

const SocialLoginButtons = ({ 
  onLogin 
}: { 
  onLogin: (provider: 'google' | 'facebook', userData?: any) => void 
}) => {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingFacebook, setIsLoadingFacebook] = useState(false);

  const handleGoogleClick = () => {
    setIsLoadingGoogle(true);
    
    // Verifica se o script do Google carregou
    if (typeof window.google === 'undefined') {
      alert("Erro: Serviço do Google não carregado. Verifique sua conexão.");
      setIsLoadingGoogle(false);
      return;
    }

    // Inicializa o cliente OAuth
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: async (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          try {
            // Usa o token para buscar dados do usuário
            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            const userData = await userInfoResponse.json();
            
            // Sucesso!
            onLogin('google', {
              name: userData.name,
              email: userData.email,
              picture: userData.picture,
              id: userData.email // Use email as distinct ID for admin separation
            });
          } catch (error) {
            console.error("Erro ao buscar dados do usuário:", error);
            alert("Falha ao obter dados do Google.");
          }
        }
        setIsLoadingGoogle(false);
      },
      error_callback: (err: any) => {
        console.error("Google Auth Error:", err);
        setIsLoadingGoogle(false);
        if (GOOGLE_CLIENT_ID.includes('INSIRA_SEU')) {
            // Mock Login for demo/testing if no key provided
            const mockUser = { name: 'Admin Google Teste', email: 'admin_google@test.com', id: 'admin_google@test.com' };
            onLogin('google', mockUser);
        }
      }
    });

    client.requestAccessToken();
  };

  const handleFacebookClick = () => {
    setIsLoadingFacebook(true);

    if (typeof window.FB === 'undefined') {
      alert("Facebook SDK não carregado.");
      setIsLoadingFacebook(false);
      return;
    }

    window.FB.login((response: any) => {
      if (response.authResponse) {
        window.FB.api('/me', { fields: 'name, email' }, (userInfo: any) => {
          onLogin('facebook', {
            name: userInfo.name,
            email: userInfo.email,
            id: userInfo.email || userInfo.id
          });
          setIsLoadingFacebook(false);
        });
      } else {
        console.log('User cancelled login or did not fully authorize.');
        setIsLoadingFacebook(false);
        if (FACEBOOK_APP_ID.includes('INSIRA_SEU')) {
            // Mock Login for demo/testing if no key provided
            const mockUser = { name: 'Admin FB Teste', email: 'admin_fb@test.com', id: 'admin_fb@test.com' };
            onLogin('facebook', mockUser);
        }
      }
    }, { scope: 'public_profile,email' });
  };

  return (
    <div className="space-y-3 w-full">
      <Button 
        variant="google" 
        fullWidth 
        onClick={handleGoogleClick}
        isLoading={isLoadingGoogle}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
        Continuar com Google
      </Button>
      <Button 
        variant="facebook" 
        fullWidth 
        onClick={handleFacebookClick}
        isLoading={isLoadingFacebook}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.954 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Continuar com Facebook
      </Button>
    </div>
  );
};

// --- Background Components ---

const CrowdFlashlights = () => {
  const lights = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 70 + 30}%`, 
      delay: `${Math.random() * 3}s`,
      duration: `${1 + Math.random() * 2}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {lights.map(light => (
        <div
          key={light.id}
          className="absolute bg-red-500 rounded-full animate-twinkle opacity-0"
          style={{
            left: light.left,
            top: light.top,
            width: Math.random() > 0.8 ? '4px' : '2px',
            height: Math.random() > 0.8 ? '4px' : '2px',
            animationDelay: light.delay,
            animationDuration: light.duration
          }}
        />
      ))}
    </div>
  );
};

const AppBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    <img
      src={BACKGROUND_IMAGE_URL}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (target.src !== FALLBACK_IMAGE_URL) {
          target.src = FALLBACK_IMAGE_URL;
        }
      }}
      alt="Concert Crowd"
      className="w-full h-full object-cover opacity-100 animate-drift"
    />
    <CrowdFlashlights />
    <div className="absolute inset-0 bg-black/5"></div>
    <div className="absolute inset-0 bg-red-500/5 mix-blend-overlay"></div>
    <div className="absolute inset-0 bg-red-500/5 animate-pulse-slow mix-blend-screen"></div>
  </div>
);

// --- View Components ---

const QRScannerModal = ({ onClose, onScan }: { onClose: () => void; onScan: (text: string) => void }) => {
  const [scanSuccess, setScanSuccess] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const scannerIdRef = useRef(`reader-${Math.random().toString(36).substr(2, 9)}`);
  const scannerRef = useRef<any>(null);

  const waitForLibrary = async (retries = 20, interval = 200): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      if (window.Html5Qrcode) return true;
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  };

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      const libLoaded = await waitForLibrary();
      if (!isMounted) return;

      if (!libLoaded) {
        setInitError("Erro: Biblioteca do scanner não carregou. Verifique sua internet.");
        return;
      }

      const elementId = scannerIdRef.current;
      const element = document.getElementById(elementId);
      if (!element) return;

      try {
        if (!window.Html5Qrcode) return;

        const devices = await window.Html5Qrcode.getCameras().catch((err: any) => {
          throw { name: 'PermissionError', message: err };
        });

        if (!isMounted) return;

        if (devices && devices.length) {
          if (!scannerRef.current) {
             scannerRef.current = new window.Html5Qrcode(elementId);
          }
          
          const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          };
          
          await scannerRef.current.start(
            { facingMode: "environment" }, 
            config,
            (decodedText: string) => {
              if (!isMounted || scanSuccess) return;
              
              playScanSound();
              setScanSuccess(true);
              
              setTimeout(() => {
                if (scannerRef.current && scannerRef.current.isScanning) {
                   scannerRef.current.stop().then(() => {
                     scannerRef.current.clear();
                     onScan(decodedText);
                   }).catch(() => {
                     onScan(decodedText);
                   });
                } else {
                   onScan(decodedText);
                }
              }, 600);
            },
            () => {} 
          );
        } else {
          setInitError("Nenhuma câmera encontrada.");
        }
      } catch (err: any) {
        console.error("Scanner error:", err);
        if (isMounted) {
          let msg = "Erro ao acessar câmera.";
          const errStr = err?.toString() || '';
          
          if (errStr.includes('Permission') || err?.name === 'NotAllowedError') {
             msg = "Permissão negada. Autorize o acesso à câmera no navegador.";
          } else if (errStr.includes('secure context') || err?.name === 'NotSupportedError') {
             msg = "Acesso à câmera bloqueado. O navegador exige HTTPS ou Localhost.";
          }
          setInitError(msg);
        }
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        try { scannerRef.current.clear(); } catch(e) {}
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white text-gray-900 p-4 rounded-2xl max-w-sm w-full relative shadow-2xl flex flex-col items-center">
        <button onClick={onClose} className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full transition-colors z-10">
          <X className="w-6 h-6 text-gray-600" />
        </button>
        <h3 className="text-lg font-bold mb-4 text-center">Escanear QR do Evento</h3>
        
        {initError && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center mb-4 w-full border border-red-200">
            {initError}
          </div>
        )}

        <div 
          id={scannerIdRef.current} 
          className={`w-full bg-black rounded-lg overflow-hidden relative transition-all duration-300 ${scanSuccess ? 'border-4 border-green-500 animate-success-pulse' : 'border border-gray-200'}`}
          style={{ minHeight: '300px' }} 
        >
          {!scanSuccess && !initError && (
            <div className="animate-scan-laser pointer-events-none"></div>
          )}

          {scanSuccess && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-green-500/20">
               <div className="bg-white rounded-full p-4 shadow-lg animate-bounce">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
               </div>
            </div>
          )}
          
          {!scanSuccess && !initError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
               <div className="text-white text-xs text-center">
                 <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin mx-auto mb-2"></div>
                 Iniciando Câmera...
               </div>
            </div>
          )}
        </div>
        
        <p className={`text-xs mt-4 text-center transition-colors font-medium ${scanSuccess ? 'text-green-600' : 'text-gray-500'}`}>
          {scanSuccess ? "QR Code Detectado!" : "Aponte a câmera para qualquer QR Code"}
        </p>
      </div>
    </div>
  );
};

const ConfirmModal = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-red-500">
          <AlertTriangle className="w-8 h-8" />
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
        <p className="text-gray-300">{message}</p>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onCancel} className="bg-gray-800">
            Cancelar
          </Button>
          <Button 
            fullWidth 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white shadow-red-500/20"
          >
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
};

const WelcomeView = ({ 
  onLogin, 
  onAdminAccess,
  onEventDetected
}: { 
  onLogin: (role: UserRole, provider: 'google' | 'facebook' | 'guest', userData?: any) => void;
  onAdminAccess: () => void;
  onEventDetected: (eventId: string) => void;
}) => {
  const [showScanner, setShowScanner] = useState(false);

  const handleLoginAction = (provider: 'google' | 'facebook' | 'guest', userData?: any) => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    onLogin(UserRole.USER, provider, userData);
  };

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    try {
      let eventId = decodedText;
      if (decodedText.includes('eventId=')) {
         const match = decodedText.match(/eventId=([^&]+)/);
         if (match) {
            eventId = match[1];
         }
      } 
      if (eventId) {
        onEventDetected(eventId);
      } else {
        alert("QR Code vazio.");
      }
    } catch (e) {
      alert("Erro ao processar QR Code.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-2 bg-black/40 border border-white/10 text-white rounded-full hover:bg-black/60 z-30 backdrop-blur-md transition-colors"
      >
        <Maximize className="w-5 h-5" />
      </button>

      <div className="z-20 w-full max-w-md bg-black/60 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl relative animate-fade-in-up">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 tracking-tighter drop-shadow-sm filter brightness-125">
            COLOR VIBE
          </h1>
          <p className="text-gray-200 font-medium text-shadow">Sincronize sua tela. Ilumine o estádio.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <Button 
              className="bg-gray-800/80 hover:bg-gray-700 text-white border border-white/10 backdrop-blur-sm"
              fullWidth
              onClick={() => setShowScanner(true)}
            >
              <ScanLine className="w-5 h-5 mr-2" />
              Ler QR Code do Evento
            </Button>

            <Button 
              fullWidth 
              onClick={() => handleLoginAction('guest')}
              className="mt-4 !bg-none !bg-[#00ff1e] hover:!bg-[#00cc18] text-gray-900 font-bold shadow-lg shadow-[#00ff1e]/30 border-none"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Entrar
            </Button>
          </div>

          <div className="pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-gray-400 mb-3">Você é um organizador?</p>
            <Button 
              variant="outline" 
              fullWidth 
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
                onAdminAccess();
              }}
              className="border-gray-500/50 text-gray-300 hover:text-white hover:border-white bg-black/30 hover:bg-black/50 backdrop-blur-md"
            >
              <Lock className="w-4 h-4" />
              Entrar como Admin
            </Button>
          </div>
        </div>
      </div>

      {showScanner && (
        <QRScannerModal 
          onClose={() => setShowScanner(false)} 
          onScan={handleScanSuccess} 
        />
      )}
    </div>
  );
};

interface EventSelectionViewProps {
  events: EventData[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectEvent: (id: string) => void;
  onNavigate: (view: AppView) => void;
}

const EventSelectionView = ({ events, searchTerm, onSearchChange, onSelectEvent, onNavigate }: EventSelectionViewProps) => {
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => {
      // 1. Check Search
      const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Check Expiration
      // If event has date and duration, check if it's over
      if (e.startDateTime && e.durationHours) {
        const start = new Date(e.startDateTime);
        const end = new Date(start.getTime() + (e.durationHours * 60 * 60 * 1000));
        // If now is greater than end time, event is expired
        if (now > end) return false; 
      }
      return true;
    });
  }, [events, searchTerm]);

  return (
    <div className="min-h-screen text-white flex flex-col relative z-10">
      <Header title="Escolha Sua Festa" onBack={() => onNavigate(AppView.WELCOME)} />
      <div className="flex-1 p-6 pt-24 max-w-md mx-auto w-full flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar evento..." 
            className="w-full bg-black/60 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all backdrop-blur-xl"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="space-y-2 flex-1">
          <label className="text-sm font-medium text-gray-300 ml-1 drop-shadow-md">Eventos Disponíveis</label>
          <div className="bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden overflow-y-auto max-h-[60vh] shadow-2xl">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>Nenhum evento ativo encontrado.</p>
              </div>
            ) : (
              filteredEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                  className="w-full text-left p-4 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center justify-between group transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium group-hover:text-pink-300 transition-colors text-lg">{event.name}</span>
                    {event.startDateTime && (
                       <span className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.startDateTime).toLocaleDateString()} 
                          <span className="mx-1">•</span> 
                          <Clock className="w-3 h-3" />
                          {new Date(event.startDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {event.durationHours ? ` (${event.durationHours}h)` : ''}
                       </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Entrar</span>
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: event.color, boxShadow: `0 0 10px ${event.color}` }}></div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminLoginView = ({ onLogin, onBack }: { onLogin: (role: UserRole, provider: 'google' | 'facebook', userData?: any) => void; onBack: () => void }) => {
  const handleLoginAction = (provider: 'google' | 'facebook', userData?: any) => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    onLogin(UserRole.ADMIN, provider, userData);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative z-10">
       <Header title="Acesso Admin" onBack={onBack} />
       <div className="w-full max-w-md bg-black/60 p-8 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center drop-shadow-lg">Login do Organizador</h2>
          <SocialLoginButtons onLogin={handleLoginAction} />
       </div>
    </div>
  );
};

interface AdminDashboardViewProps {
  events: EventData[];
  selectedEventId: string | null;
  setSelectedEventId: (id: string) => void;
  newEventName: string;
  onNewEventNameChange: (name: string) => void;
  newEventDate: string;
  onNewEventDateChange: (date: string) => void;
  newEventDuration: string;
  onNewEventDurationChange: (duration: string) => void;
  onCreateEvent: () => void;
  isGenerating: boolean;
  generatedPalette: string[];
  onGeneratePalette: () => void;
  
  // New props for Preview/Publish workflow
  previewColor: string;
  onPreviewColorChange: (color: string) => void;
  isRandomActive: boolean;
  onToggleRandom: (active: boolean) => void;
  
  onPublish: () => void;
  onPreview: () => void;
  
  onLogout: () => void;
  onDeleteEvent: (id: string) => void;
}

const QRModal = ({ url, eventName, onClose }: { url: string; eventName: string; onClose: () => void }) => {
  const [isSharingImg, setIsSharingImg] = useState(false);

  const handleShareImage = async () => {
    setIsSharingImg(true);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const file = new File([blob], `QRCode-${eventName.replace(/\s+/g, '_')}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `QR Code - ${eventName}`,
          text: `Acesse o evento ${eventName}`
        });
      } else {
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `QRCode-${eventName}.png`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      }
    } catch (e) {
      console.error("Share failed", e);
      alert("Não foi possível compartilhar a imagem. Tente novamente.");
    } finally {
      setIsSharingImg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white text-gray-900 p-6 rounded-2xl max-w-sm w-full relative shadow-2xl flex flex-col items-center">
        <button onClick={onClose} className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-xl font-bold mb-2 text-center text-gray-800">Convide para a Festa!</h3>
        <p className="text-sm text-gray-500 mb-4 text-center">Escaneie para entrar em <br/><span className="font-bold text-pink-600">{eventName}</span></p>
        <div className="bg-white p-2 rounded-xl border-2 border-gray-100 shadow-inner">
           <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`} 
            alt="Event QR Code" 
            className="w-64 h-64 object-contain"
          />
        </div>
        <div className="mt-6 w-full flex flex-col gap-2">
           <Button variant="secondary" fullWidth onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Color Vibe - ${eventName}`,
                  text: 'Venha iluminar a festa comigo!',
                  url: url
                }).catch(console.error);
              } else {
                 navigator.clipboard.writeText(url);
                 alert('Link copiado para a área de transferência!');
              }
           }}>
             <Share2 className="w-4 h-4 mr-2" />
             Compartilhar Link
           </Button>
           <Button 
            variant="outline" 
            fullWidth 
            className="border-gray-300 text-gray-600 hover:bg-gray-50"
            onClick={handleShareImage}
            isLoading={isSharingImg}
           >
             <ImageIcon className="w-4 h-4 mr-2" />
             Compartilhar Imagem QR
           </Button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboardView = ({
  events,
  selectedEventId,
  setSelectedEventId,
  newEventName,
  onNewEventNameChange,
  newEventDate,
  onNewEventDateChange,
  newEventDuration,
  onNewEventDurationChange,
  onCreateEvent,
  isGenerating,
  generatedPalette,
  onGeneratePalette,
  
  previewColor,
  onPreviewColorChange,
  isRandomActive,
  onToggleRandom,
  
  onPublish,
  onPreview,
  
  onLogout,
  onDeleteEvent
}: AdminDashboardViewProps) => {
  const currentEvent = events.find(e => e.id === selectedEventId);
  const [showQr, setShowQr] = useState(false);

  const isFormValid = newEventName.trim() && newEventDate && newEventDuration;

  return (
    <div className="min-h-screen text-white flex flex-col relative z-10">
      <Header 
        title="Painel Admin" 
        onBack={onLogout} 
      />

      <div className="pt-20 p-6 max-w-lg mx-auto w-full space-y-8 pb-32">
        
        {/* Create Event Section */}
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Criar Evento
          </h3>
          
          <form 
            className="flex flex-col gap-3" 
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              if (isFormValid) onCreateEvent();
            }}
          >
            <input type="text" name="dummy_user" style={{display: 'none'}} tabIndex={-1} />
            <input type="password" name="dummy_pass" style={{display: 'none'}} tabIndex={-1} />
            <input type="text" name="dummy_address" style={{display: 'none'}} tabIndex={-1} />

            <input 
              type="search" 
              required
              id="lp_evt_name_input"
              name="lp_evt_name_input_random"
              autoComplete="off"
              data-lpignore="true"
              placeholder="Nome do evento" 
              className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500 outline-none placeholder-gray-500"
              value={newEventName}
              onChange={(e) => onNewEventNameChange(e.target.value)}
            />
            
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </div>
                <input 
                  type="datetime-local"
                  required 
                  id="lp_evt_date_input"
                  name="lp_evt_date_input_random"
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-full bg-black/50 border border-white/20 rounded-lg pl-9 pr-2 py-2 text-white focus:ring-2 focus:ring-pink-500 outline-none placeholder-gray-500 text-xs sm:text-sm"
                  value={newEventDate}
                  onChange={(e) => onNewEventDateChange(e.target.value)}
                />
              </div>

              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Clock className="w-4 h-4" />
                </div>
                <input 
                  type="number" 
                  min="1"
                  required
                  id="lp_evt_dur_input"
                  name="lp_evt_dur_input_random"
                  autoComplete="off"
                  data-lpignore="true"
                  placeholder="Duração (h)" 
                  className="w-full bg-black/50 border border-white/20 rounded-lg pl-9 pr-2 py-2 text-white focus:ring-2 focus:ring-pink-500 outline-none placeholder-gray-500 text-xs sm:text-sm"
                  value={newEventDuration}
                  onChange={(e) => onNewEventDurationChange(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={!isFormValid} className="mt-2">
              Criar
            </Button>
            <p className="text-[10px] text-gray-500 text-center">Eventos são excluídos automaticamente 30 dias após o fim.</p>
          </form>
        </div>

        {/* Event Controller */}
        {selectedEventId && currentEvent ? (
           <div className="bg-black/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>

              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white drop-shadow">{currentEvent.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-xs text-gray-300">Ao Vivo</p>
                  </div>
                  {currentEvent.startDateTime && (
                     <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(currentEvent.startDateTime).toLocaleDateString()} 
                        {currentEvent.durationHours ? ` • ${currentEvent.durationHours}h` : ''}
                     </p>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                  {/* Current Active Color (Small Indicator) */}
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    Ao Vivo
                    <div 
                      className="w-4 h-4 rounded-full border border-white/10" 
                      style={{ backgroundColor: currentEvent.color }}
                    />
                  </div>
                  
                  {/* Preview Color (Big Indicator) */}
                  <div 
                    className="w-12 h-12 rounded-full border-4 border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors duration-300 relative group cursor-pointer" 
                    style={{ backgroundColor: previewColor }}
                    onClick={onPreview}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4 text-white drop-shadow-md" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls Header: AI & QR & Delete */}
              <div className="flex justify-between items-center flex-wrap gap-2">
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setShowQr(true)}
                      className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors text-white border border-white/5"
                      title="Gerar QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                      QR
                    </button>
                    <button 
                      onClick={() => onDeleteEvent(currentEvent.id)}
                      className="flex items-center gap-2 text-sm bg-red-500/20 hover:bg-red-500/40 px-3 py-2 rounded-lg transition-colors text-red-200 border border-red-500/30"
                      title="Excluir Evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>

                 <div className="flex items-center gap-2">
                     <button 
                      onClick={() => onToggleRandom(!isRandomActive)}
                      className={`flex items-center gap-1 text-xs px-4 py-2 rounded-full border transition-all ${isRandomActive ? 'bg-pink-600 border-pink-500 text-white animate-pulse shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'border-gray-500 text-gray-300 hover:border-white hover:text-white bg-black/20'}`}
                    >
                      <Zap className="w-3 h-3" />
                      {isRandomActive ? 'Modo Disco ON' : 'Modo Disco'}
                    </button>
                 </div>
              </div>

              {/* AI Palette Generator */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-300">Sugestões IA (Gemini)</label>
                  <button 
                    onClick={onGeneratePalette}
                    disabled={isGenerating}
                    className="text-xs flex items-center gap-1 text-purple-300 hover:text-purple-200 disabled:opacity-50 transition-colors"
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Gerar Cores
                  </button>
                </div>
                <div className="flex gap-2 justify-between">
                  {generatedPalette.map((color, idx) => (
                    <button 
                      key={idx}
                      className="w-10 h-10 rounded-lg hover:scale-110 transition-transform border border-white/20 shadow-lg"
                      style={{ backgroundColor: color }}
                      onClick={() => onPreviewColorChange(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Manual Color Picker */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Seletor de Cor (Visualização)</label>
                <div className="grid grid-cols-5 gap-3">
                  {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4'].map(c => (
                    <button
                      key={c}
                      className="aspect-square rounded-full hover:scale-110 transition-transform border-2 border-transparent hover:border-white/50 shadow-lg"
                      style={{ backgroundColor: c }}
                      onClick={() => onPreviewColorChange(c)}
                    />
                  ))}
                </div>
                <input 
                  type="color" 
                  className="w-full h-12 rounded-lg cursor-pointer bg-transparent mt-2"
                  value={previewColor}
                  onChange={(e) => onPreviewColorChange(e.target.value)}
                />
              </div>

              {/* ACTION BUTTONS: PREVIEW & PUBLISH */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={onPreview}
                  className="border-blue-400 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Visualizar
                </Button>
                <Button 
                  fullWidth 
                  onClick={onPublish}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/30"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Publicar Agora
                </Button>
              </div>

              {showQr && (
                <QRModal 
                  url={getEventUrl(currentEvent.id)} 
                  eventName={currentEvent.name} 
                  onClose={() => setShowQr(false)} 
                />
              )}
           </div>
        ) : (
          <div className="text-center py-10 text-gray-400 bg-black/40 rounded-2xl border-2 border-dashed border-white/10 backdrop-blur-sm">
            Selecione ou crie um evento para controlar.
          </div>
        )}
        
        {/* Event List */}
        <div className="space-y-2">
           <h4 className="text-sm font-medium text-gray-300 drop-shadow">Seus Eventos</h4>
           <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
             {events.map(ev => (
               <div key={ev.id} className="relative group">
                 <button 
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full p-3 pr-8 rounded-lg text-sm text-left border transition-all ${selectedEventId === ev.id ? 'bg-purple-600/30 border-purple-500 text-purple-100 backdrop-blur-md' : 'bg-black/40 border-white/10 text-gray-400 hover:bg-black/60 hover:text-white backdrop-blur-sm'}`}
                 >
                   <div className="font-medium truncate">{ev.name}</div>
                   {ev.startDateTime && <div className="text-[10px] opacity-70">{new Date(ev.startDateTime).toLocaleDateString()}</div>}
                 </button>
                 <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(ev.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Excluir Evento"
                 >
                    <Trash2 className="w-4 h-4" />
                 </button>
               </div>
             ))}
             {events.length === 0 && (
                <p className="text-xs text-gray-500 col-span-2 text-center py-2">Você ainda não criou nenhum evento.</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

const LightScreenView = ({ 
  activeColor, 
  isRandom, 
  onLeave,
  eventName,
  eventId,
  isPreview = false,
  onPublish
}: { 
  activeColor: string; 
  isRandom: boolean; 
  onLeave: () => void;
  eventName: string;
  eventId: string;
  isPreview?: boolean;
  onPublish?: () => void;
}) => {
  // Alterado para 'isOffCycle' para indicar o ciclo de "apagado" (Preto)
  const [isOffCycle, setIsOffCycle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [randomColor, setRandomColor] = useState('#000000');
  const [showQr, setShowQr] = useState(false);

  // STROBE LIGHT EFFECT: Agora removido o setInterval JavaScript e usando apenas CSS para strobe "seco" e rápido (melhor performance mobile)
  // No JavaScript, apenas mantemos o random color switching.
  
  useEffect(() => {
    if (!isRandom) return;
    const colors = ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000', '#7B00FF', '#FF1493', '#39FF14', '#00C2BA', '#FF4500'];
    const interval = setInterval(() => {
       setRandomColor(colors[Math.floor(Math.random() * colors.length)]);
    }, 100); 
    return () => clearInterval(interval);
  }, [isRandom]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Only auto-enter fullscreen if NOT in preview mode (admins might want to just check quickly)
    if (!isPreview) {
      const enterFullscreen = async () => {
        try {
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
        } catch (err) {}
      };
      enterFullscreen();
    }
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPreview]);

  const isBlack = activeColor === '#000000' || activeColor.toLowerCase() === '#000';
  
  // Base color logic
  const baseColor = isRandom ? randomColor : activeColor;

  return (
    <div 
      className="fixed inset-0 w-full h-full z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ 
        backgroundColor: baseColor,
        transition: isRandom ? 'background-color 0.1s linear' : 'background-color 0.2s ease'
      }}
    >
      {/* CSS STROBE OVERLAY: Only active if NOT random and NOT black */}
      {!isRandom && !isBlack && (
        <div className="absolute inset-0 strobe-overlay pointer-events-none z-40"></div>
      )}

      {/* PREVIEW BANNER - MOVED TO BOTTOM */}
      {isPreview && (
        <div className="absolute bottom-0 left-0 right-0 bg-yellow-500/80 text-black font-bold text-center py-2 z-[60]">
          MODO VISUALIZAÇÃO (ADMIN)
        </div>
      )}

      {/* UI Control Overlay */}
      <div className="absolute top-4 right-4 flex gap-3 z-50">
        {isPreview && onPublish && (
          <button 
            onClick={onPublish}
            className="bg-green-600 hover:bg-green-500 p-2 px-4 rounded-full text-white backdrop-blur-md shadow-lg transition-all font-bold flex items-center gap-2"
            title="Publicar Cor Agora"
          >
            <Send className="w-4 h-4" />
            Publicar
          </button>
        )}

        <button 
          onClick={() => setShowQr(true)}
          className="bg-black/30 opacity-50 hover:opacity-100 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/50 transition-all"
          title="Convidar Amigos"
        >
          <QrCode className="w-6 h-6" />
        </button>

         <button 
          onClick={toggleFullscreen}
          className="bg-black/30 opacity-50 hover:opacity-100 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/50 transition-all"
          title="Alternar Tela Cheia"
        >
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
        </button>

        <button 
          onClick={onLeave}
          className="bg-black/30 opacity-50 hover:opacity-100 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/50 transition-all"
          title={isPreview ? "Voltar ao Painel" : "Sair da Festa"}
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
      
      {isBlack && !isRandom && (
        <div className="text-white/50 text-center p-8 animate-pulse select-none bg-black/40 rounded-3xl backdrop-blur-md relative z-50">
          <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold">{isPreview ? "Cor: Preto (Desligado)" : "Aguardando o DJ de Luz..."}</h2>
          <p className="text-sm mt-2">Aumente o brilho da tela para 100%</p>
           {!isFullscreen && (
             <button onClick={toggleFullscreen} className="mt-8 px-4 py-2 bg-white/10 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors pointer-events-auto border border-white/5">
               Ativar Tela Cheia
             </button>
          )}
        </div>
      )}

      {showQr && (
        <QRModal 
          url={getEventUrl(eventId)} 
          eventName={eventName} 
          onClose={() => setShowQr(false)} 
        />
      )}
    </div>
  );
};

// --- Main App Component ---

function App() {
  const [view, setView] = useState<AppView>(AppView.WELCOME);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // Real active state (for user)
  const [activeColor, setActiveColor] = useState<string>('#000000');
  const [activeIsRandom, setActiveIsRandom] = useState<boolean>(false);
  
  // Admin Preview State (Local)
  const [adminPreviewColor, setAdminPreviewColor] = useState<string>('#000000');
  const [adminPreviewIsRandom, setAdminPreviewIsRandom] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDuration, setNewEventDuration] = useState('');
  
  const [generatedPalette, setGeneratedPalette] = useState<string[]>(['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  // Load Facebook SDK
  useEffect(() => {
    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : FACEBOOK_APP_ID,
        cookie     : true,
        xfbml      : true,
        version    : 'v18.0'
      });
    };
    (function(d, s, id){
       var js, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement(s); js.id = id;
       // Cast to any because TS might complain about 'src' on generic Element
       (js as HTMLScriptElement).src = "https://connect.facebook.net/en_US/sdk.js";
       if (fjs && fjs.parentNode) {
           fjs.parentNode.insertBefore(js, fjs);
       }
     }(document, 'script', 'facebook-jssdk'));
  }, []);

  useEffect(() => {
    cleanupOldEvents();
    const params = new URLSearchParams(window.location.search);
    const evtId = params.get('eventId');
    if (evtId) {
      setPendingEventId(evtId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setEvents(getEvents());
    
    const unsubscribe = subscribeToEvents(() => {
      const updatedEvents = getEvents();
      setEvents(updatedEvents);
      
      if (selectedEventId) {
        const current = updatedEvents.find(e => e.id === selectedEventId);
        if (current) {
          // Sync live state
          setActiveColor(current.color);
          setActiveIsRandom(current.isRandom || false);
        } else {
          if (view === AppView.LIGHT_SCREEN) {
             alert("Este evento foi encerrado ou excluído.");
             setView(AppView.EVENT_SELECTION);
             setSelectedEventId(null);
          }
        }
      }
    });
    return unsubscribe;
  }, [selectedEventId, view]);

  const handleLogin = (role: UserRole, provider: 'google' | 'facebook' | 'guest', userData?: any) => {
    setUser({
      // Use the provider's ID if available to identify the admin account, otherwise generate random
      id: userData?.id || 'user_' + Math.random().toString(36),
      name: userData?.name || (role === UserRole.ADMIN ? 'Administrador' : 'Festeiro'),
      email: userData?.email || 'test@example.com',
      role,
      provider
    });

    if (role === UserRole.ADMIN) {
      setView(AppView.ADMIN_DASHBOARD);
    } else {
      if (pendingEventId) {
        let displayName = "Evento QR Code";
        if (pendingEventId.startsWith('http')) {
           displayName = "Evento Web";
        } else if (pendingEventId.length > 20) {
           displayName = `Evento ${pendingEventId.slice(0,6)}...`;
        } else {
           displayName = `Evento ${pendingEventId}`;
        }
        const targetEvent = joinEvent(pendingEventId, displayName);
        handleSelectEvent(targetEvent.id);
        return;
      }
      setView(AppView.EVENT_SELECTION);
    }
  };

  const handleSelectEvent = (eventId: string) => {
    const ev = getEvents().find(e => e.id === eventId);
    if (ev) {
      setSelectedEventId(eventId);
      setActiveColor(ev.color);
      setActiveIsRandom(ev.isRandom || false);
      setView(AppView.LIGHT_SCREEN);
    } else {
      alert("Evento não encontrado.");
    }
  };

  // Admin select event logic (initialize preview state)
  const handleAdminSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      setAdminPreviewColor(ev.color);
      setAdminPreviewIsRandom(ev.isRandom || false);
    }
  };

  const handleCreateEvent = () => {
    if (!newEventName.trim() || !newEventDate || !newEventDuration) {
      alert("Por favor, preencha o nome, a data e a duração do evento.");
      return;
    }
    const duration = newEventDuration ? parseFloat(newEventDuration) : undefined;
    // Pass the user ID as adminId to claim ownership
    const newEvent = createEvent(newEventName, newEventDate, duration, user?.id);
    setNewEventName('');
    setNewEventDate('');
    setNewEventDuration('');
    handleAdminSelectEvent(newEvent.id);
  };

  const handleDeleteEvent = (id: string) => {
    const ev = events.find(e => e.id === id);
    if (ev) {
      setEventToDelete(id);
    }
  };

  const executeDelete = () => {
    if (eventToDelete) {
       deleteEvent(eventToDelete);
       setEvents(prev => prev.filter(e => e.id !== eventToDelete));
       if (selectedEventId === eventToDelete) {
         setSelectedEventId(null);
       }
       setEventToDelete(null);
    }
  };

  // Updates ONLY the local preview state
  const handlePreviewColorChange = (color: string) => {
    setAdminPreviewColor(color);
  };

  const handleToggleRandomPreview = (isRandom: boolean) => {
    setAdminPreviewIsRandom(isRandom);
  };

  // Pushes the local state to storage (Live)
  const handlePublishColor = () => {
    if (selectedEventId) {
      updateEventColor(selectedEventId, adminPreviewColor);
      updateEventRandom(selectedEventId, adminPreviewIsRandom);
      alert("Configuração publicada ao vivo!");
    }
  };

  const handleGeneratePalette = async () => {
    const currentEvent = events.find(e => e.id === selectedEventId);
    if (!currentEvent) return;
    setIsGenerating(true);
    try {
      const colors = await generatePartyPalette(currentEvent.name);
      setGeneratedPalette(colors);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView(AppView.WELCOME);
  };

  // Filter events for Admin Dashboard: Only show events created by this admin
  const adminEvents = events.filter(e => e.adminId === user?.id);

  return (
    <>
      <AppBackground />
      <ConfirmModal 
        isOpen={!!eventToDelete}
        title="Excluir Evento"
        message={`Tem certeza que deseja excluir o evento "${events.find(e => e.id === eventToDelete)?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={executeDelete}
        onCancel={() => setEventToDelete(null)}
      />

      <div className="relative z-10 w-full min-h-screen">
        {(() => {
          switch (view) {
            case AppView.WELCOME:
              return (
                <WelcomeView 
                  onLogin={handleLogin} 
                  onAdminAccess={() => setView(AppView.ADMIN_LOGIN)} 
                  onEventDetected={setPendingEventId}
                />
              );
            case AppView.EVENT_SELECTION:
              // Users see ALL active events (no filtering by adminId)
              return (
                <EventSelectionView 
                  events={events}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onSelectEvent={handleSelectEvent}
                  onNavigate={setView}
                />
              );
            case AppView.ADMIN_LOGIN:
              return (
                <AdminLoginView 
                  onLogin={handleLogin} 
                  onBack={() => setView(AppView.WELCOME)} 
                />
              );
            case AppView.ADMIN_DASHBOARD:
              return (
                <AdminDashboardView 
                  events={adminEvents} // Only pass events owned by this admin
                  selectedEventId={selectedEventId}
                  setSelectedEventId={handleAdminSelectEvent}
                  newEventName={newEventName}
                  onNewEventNameChange={setNewEventName}
                  newEventDate={newEventDate}
                  onNewEventDateChange={setNewEventDate}
                  newEventDuration={newEventDuration}
                  onNewEventDurationChange={setNewEventDuration}
                  onCreateEvent={handleCreateEvent}
                  isGenerating={isGenerating}
                  generatedPalette={generatedPalette}
                  onGeneratePalette={handleGeneratePalette}
                  
                  // Preview Props
                  previewColor={adminPreviewColor}
                  onPreviewColorChange={handlePreviewColorChange}
                  isRandomActive={adminPreviewIsRandom}
                  onToggleRandom={handleToggleRandomPreview}
                  onPublish={handlePublishColor}
                  onPreview={() => setView(AppView.ADMIN_PREVIEW)}
                  
                  onLogout={handleLogout}
                  onDeleteEvent={handleDeleteEvent}
                />
              );
            case AppView.ADMIN_PREVIEW:
               const previewEvent = events.find(e => e.id === selectedEventId);
               return (
                 <LightScreenView 
                   activeColor={adminPreviewColor}
                   isRandom={adminPreviewIsRandom}
                   onLeave={() => setView(AppView.ADMIN_DASHBOARD)}
                   eventId={selectedEventId || ''}
                   eventName={previewEvent?.name || 'Visualização'}
                   isPreview={true}
                   onPublish={handlePublishColor}
                 />
               );
            case AppView.LIGHT_SCREEN:
              const currentEvent = events.find(e => e.id === selectedEventId);
              return (
                <LightScreenView 
                  activeColor={activeColor} 
                  isRandom={activeIsRandom}
                  onLeave={() => setView(AppView.EVENT_SELECTION)} 
                  eventId={selectedEventId || ''}
                  eventName={currentEvent?.name || 'Festa'}
                />
              );
            default:
              return (
                <WelcomeView 
                  onLogin={handleLogin} 
                  onAdminAccess={() => setView(AppView.ADMIN_LOGIN)}
                  onEventDetected={setPendingEventId}
                />
              );
          }
        })()}
      </div>
    </>
  );
}

export default App;