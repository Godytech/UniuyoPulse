import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  KeyRound,
  IdCard,
  CheckCircle2,
  Mail,
  RefreshCw,
  LogOut,
  MapPin,
  Navigation,
  ShieldCheck,
  Home,
  Moon,
  Sun
} from 'lucide-react';
import { ThemeMode, User } from '../types';
import {
  createFirebaseAccount,
  createDevAdminAccount,
  EmailVerificationRequiredError,
  firebaseErrorMessage,
  refreshVerifiedFirebaseUser,
  resendFirebaseEmailVerification,
  signInFirebaseAccount,
  signOutFirebaseAccount
} from '../lib/firebase';
import { soundManager } from '../lib/sound';
import { useTimeGreeting, getTimeEmoji } from '../lib/timeGreeting';

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
  pendingVerificationEmail: string | null;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLoginSuccess,
  pendingVerificationEmail,
  themeMode,
  onToggleTheme
}) => {
  const [mode, setMode] = useState<'landing' | 'signin' | 'dev_signin' | 'signup' | 'verify'>(() =>
    pendingVerificationEmail ? 'verify' : 'landing'
  );
  const [verificationEmail, setVerificationEmail] = useState(pendingVerificationEmail ?? '');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [isVerificationBusy, setIsVerificationBusy] = useState(false);

  // Sign In Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginBusy, setIsLoginBusy] = useState(false);
  const loginRequestInProgress = useRef(false);
  const pendingAuthMode = useRef<'signin' | 'dev_signin' | 'signup'>('signin');

  // Sign Up Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accountRole, setAccountRole] = useState<'student' | 'lecturer' | 'dev_admin'>('student');
  const [registrationInvitationCode, setRegistrationInvitationCode] = useState('');
  const [devAuthorizationPasskey, setDevAuthorizationPasskey] = useState('');
  const [devSignupError, setDevSignupError] = useState<string | null>(null);
  const [isDevSignupBusy, setIsDevSignupBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const { greeting, period, timeString, timeZoneShort } = useTimeGreeting();
  const TimeIcon = getTimeEmoji(period);

  useEffect(() => {
    if (pendingVerificationEmail) {
      setVerificationEmail(pendingVerificationEmail);
      setMode('verify');
    }
  }, [pendingVerificationEmail]);

  const handleModeChange = (nextMode: 'landing' | 'signin' | 'dev_signin' | 'signup') => {
    soundManager.playClick();
    setMode(nextMode);
    if (nextMode === 'signin' || nextMode === 'dev_signin' || nextMode === 'signup') {
      pendingAuthMode.current = nextMode;
    }
    setLoginIdentifier('');
    setLoginPassword('');
    setFullName('');
    setEmail('');
    setAccountRole('student');
    setRegistrationInvitationCode('');
    setDevAuthorizationPasskey('');
    setPassword('');
    setConfirmPassword('');
    setLoginError(null);
    setSignupError(null);
    setDevSignupError(null);
    setVerificationError(null);
    setVerificationNotice(null);
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginRequestInProgress.current) return;

    loginRequestInProgress.current = true;
    setIsLoginBusy(true);
    setLoginError(null);

    try {
      if (!loginIdentifier.trim().includes('@')) {
        soundManager.playError();
        setLoginError('Sign in with the institutional email used to create your account.');
        return;
      }

      const user = await signInFirebaseAccount(loginIdentifier, loginPassword);
      if ((pendingAuthMode.current === 'dev_signin') !== (user.role === 'dev_admin')) {
        await signOutFirebaseAccount();
        soundManager.playError();
        setLoginError(pendingAuthMode.current === 'dev_signin'
          ? 'This sign-in path is restricted to Dev Admin accounts.'
          : 'Dev administrators must use the dedicated management-console sign-in path.');
        return;
      }
      soundManager.playSuccess();
      onLoginSuccess(user);
    } catch (error) {
      if (error instanceof EmailVerificationRequiredError) {
        soundManager.playClick();
        setVerificationEmail(loginIdentifier.trim().toLowerCase());
        setVerificationError(null);
        setVerificationNotice(null);
        setMode('verify');
        return;
      }
      soundManager.playError();
      setLoginError(firebaseErrorMessage(error));
    } finally {
      loginRequestInProgress.current = false;
      setIsLoginBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setIsVerificationBusy(true);
    setVerificationError(null);
    setVerificationNotice(null);
    try {
      await resendFirebaseEmailVerification(verificationEmail);
      setVerificationNotice(`A new verification link has been sent to ${verificationEmail}.`);
    } catch (error) {
      setVerificationError(firebaseErrorMessage(error));
    } finally {
      setIsVerificationBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsVerificationBusy(true);
    setVerificationError(null);
    setVerificationNotice(null);
    try {
      const user = await refreshVerifiedFirebaseUser();
      if (!user) {
        setVerificationNotice('Firebase has not marked this email as verified yet. Open the link in your inbox, then try again.');
        return;
      }
      if ((pendingAuthMode.current === 'dev_signin') !== (user.role === 'dev_admin')) {
        await signOutFirebaseAccount();
        const expectedMode = pendingAuthMode.current === 'dev_signin' ? 'dev_signin' : 'signin';
        setMode(expectedMode);
        setLoginError(expectedMode === 'dev_signin'
          ? 'This sign-in path is restricted to Dev Admin accounts.'
          : 'Dev administrators must use the dedicated management-console sign-in path.');
        return;
      }
      soundManager.playSuccess();
      onLoginSuccess(user);
    } catch (error) {
      setVerificationError(firebaseErrorMessage(error));
    } finally {
      setIsVerificationBusy(false);
    }
  };

  const handleExitVerification = async () => {
    setIsVerificationBusy(true);
    setVerificationError(null);
    try {
      await signOutFirebaseAccount();
      setVerificationEmail('');
      setMode('landing');
      setVerificationNotice(null);
    } catch (error) {
      setVerificationError(firebaseErrorMessage(error));
    } finally {
      setIsVerificationBusy(false);
    }
  };

  // Handle Sign Up Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!fullName.trim() || !email.trim()) {
      soundManager.playError();
      setSignupError('Please complete your name and institutional email.');
      return;
    }

    if (password.length < 6) {
      soundManager.playError();
      setSignupError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      soundManager.playError();
      setSignupError('Passwords do not match.');
      return;
    }

    if (accountRole === 'dev_admin') {
      await handleDevSignupSubmit(e);
      return;
    }
    if (!registrationInvitationCode.trim()) {
      soundManager.playError();
      setSignupError('Enter the single-use invitation code issued to your email.');
      return;
    }

    const newUser = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase()
    };

    try {
      await createFirebaseAccount(newUser, password, registrationInvitationCode, accountRole);
      soundManager.playSuccess();
      setVerificationEmail(newUser.email);
      setVerificationError(null);
      setVerificationNotice(`A verification link has been sent to ${newUser.email}.`);
      setMode('verify');
    } catch (error) {
      soundManager.playError();
      setSignupError(firebaseErrorMessage(error));
    }
  };

  const handleDevSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevSignupError(null);
    if (!fullName.trim() || !email.trim() || !devAuthorizationPasskey.trim()) {
      soundManager.playError();
      setDevSignupError('Enter your name, email, and Dev Admin authorization passkey.');
      return;
    }
    if (password.length < 6) {
      soundManager.playError();
      setDevSignupError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      soundManager.playError();
      setDevSignupError('Passwords do not match.');
      return;
    }

    setIsDevSignupBusy(true);
    try {
      await createDevAdminAccount({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase()
      }, password, devAuthorizationPasskey);
      soundManager.playSuccess();
      setVerificationEmail(email.trim().toLowerCase());
      setVerificationError(null);
      setVerificationNotice(`A verification link has been sent to ${email.trim().toLowerCase()}.`);
      setMode('verify');
    } catch (error) {
      soundManager.playError();
      setDevSignupError(firebaseErrorMessage(error));
    } finally {
      setIsDevSignupBusy(false);
    }
  };

  return (
    <div className={`auth-page min-h-screen ${mode === 'landing' ? 'auth-page-landing bg-white' : 'bg-slate-50'} flex flex-col justify-start sm:justify-center items-center px-4 py-4 sm:px-6 sm:py-12 relative overflow-y-auto`}>
      {/* Decorative background grid and blurs */}
      {mode !== 'landing' && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(#d1fae5_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/50 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-200/40 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main Container */}
      <div className={`w-full ${mode === 'landing' ? 'max-w-none' : 'max-w-lg'} z-10`}>
        {mode === 'landing' ? (
          <div className="landing-page flex min-h-[calc(100dvh-2rem)] flex-col sm:min-h-[calc(100vh-3rem)]">
            <header className="flex items-center justify-between gap-3 py-1 sm:py-2">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="landing-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white p-1.5 shadow-sm sm:h-11 sm:w-11">
                  <img src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="landing-brand truncate text-sm font-black tracking-tight text-slate-900 sm:text-base">Uniuyo Pulse</p>
                  <p className="truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">University of Uyo</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="landing-theme-toggle inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 sm:h-10 sm:w-10 sm:rounded-xl"
                  aria-label={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} theme`}
                  title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} theme`}
                >
                  {themeMode === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('signin')}
                  className="landing-login rounded-lg px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-[#006B3F] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('signup')}
                  className="hidden rounded-xl bg-[#008751] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#006B3F] sm:inline-flex"
                >
                  Create Account
                </button>
              </div>
            </header>

            <main className="grid flex-1 content-center items-center gap-9 py-10 sm:gap-12 sm:py-14 md:grid-cols-2 md:gap-16 md:py-20">
              <section
                className="mx-auto w-full max-w-none md:mx-0"
              >
                <div className="landing-eyebrow mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#006B3F] sm:mb-6 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]">
                  <span className="h-2 w-2 rounded-full bg-[#008751]" />
                  <span>University of Uyo · Digital Attendance</span>
                </div>
                <h1 className="landing-title text-[2.3rem] font-black leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl sm:leading-[1.08] sm:tracking-tight lg:text-6xl">
                  Uniuyo Pulse
                  <span className="landing-accent mt-2 block text-[#008751] sm:mt-2">Smart Attendance. Simplified.</span>
                </h1>
                <p className="landing-copy mt-4 max-w-lg text-[15px] leading-6 text-slate-600 sm:mt-6 sm:text-lg sm:leading-7">
                  A secure, location-verified attendance platform for University of Uyo students and lecturers.
                </p>
                <p className="landing-tagline mt-4 text-sm font-extrabold tracking-wide text-slate-800 sm:mt-5">
                  Attend. <span className="landing-accent text-[#008751]">Verify.</span> Track.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeChange('signin')}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#008751] px-6 text-sm font-extrabold text-white shadow-md shadow-[#008751]/15 transition-all hover:-translate-y-0.5 hover:bg-[#006B3F] sm:w-auto"
                  >
                    Login
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('signup')}
                    className="landing-secondary-action inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-extrabold text-slate-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 sm:w-auto"
                  >
                    Create Account
                  </button>
                </div>
              </section>

              <section
                aria-label="Location-based attendance verification illustration"
                className="relative mx-auto w-full max-w-none"
              >
                <div className="landing-illustration relative aspect-[1.18] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] sm:aspect-[1.08] sm:rounded-[2rem]">
                  <div className="landing-map-grid absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:36px_36px]" />
                  <div className="landing-map-road absolute -left-10 top-1/2 h-20 w-[120%] -rotate-[24deg] border-y border-slate-200 bg-white/70" />
                  <div className="landing-geofence-outer absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-emerald-300 bg-emerald-100/25" />
                  <div className="landing-geofence-inner absolute left-1/2 top-1/2 h-[54%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/80" />
                  <div className="landing-geofence-center absolute left-1/2 top-1/2 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/80 bg-emerald-100/35" />
                  <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    <span className="landing-location-pin flex h-12 w-12 items-center justify-center rounded-2xl bg-[#008751] text-white shadow-lg shadow-[#008751]/25 ring-4 ring-white">
                      <MapPin className="h-6 w-6" />
                    </span>
                    <span className="landing-location-label mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm">
                      Class location
                    </span>
                  </div>
                  <div className="landing-user-pin absolute right-[21%] top-[29%] z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-white shadow-md">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div className="landing-verification-card absolute bottom-3 left-3 right-3 rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg shadow-slate-900/5 backdrop-blur sm:bottom-5 sm:left-5 sm:right-5 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="landing-verification-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#008751] sm:h-10 sm:w-10 sm:rounded-xl">
                        <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="landing-verification-title text-xs font-extrabold text-slate-900 sm:text-sm">Location verification</p>
                        <p className="landing-verification-copy mt-0.5 text-[10px] leading-4 text-slate-500 sm:text-xs sm:leading-normal">Attendance is checked against the class geofence.</p>
                      </div>
                      <span className="ml-auto hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[#008751] sm:block" />
                    </div>
                  </div>
                </div>
                <p className="landing-caption mt-3 text-center text-[11px] font-medium text-slate-500 sm:mt-4 sm:text-xs">
                  Simple access for students and lecturers
                </p>
              </section>
            </main>

            <footer className="landing-footer border-t border-slate-100 py-4 text-center text-[11px] font-medium text-slate-500 sm:py-5 sm:text-xs">
              Secure digital attendance for the University of Uyo
            </footer>
          </div>
        ) : (
          <>
        {/* Uniuyo Pulse Header Brand */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-[#CDEAD7] shadow-lg shadow-[#008751]/20 mb-3.5 p-2">
            <img src={`${import.meta.env.BASE_URL}assets/uniuyo-logo.png`} alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Uniuyo Pulse
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Smart Attendance. Real-Time Presence.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-[#E8F5EF] border border-[#CDEAD7] text-[11px] font-semibold text-[#006B3F]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span>University of Uyo attendance verification platform</span>
          </div>
        </div>

        {/* Tab Toggle: Sign In vs Sign Up */}
        <div className="bg-slate-200/80 p-1 rounded-xl flex mb-6 shadow-inner gap-1">
          <button
            type="button"
            onClick={() => handleModeChange('landing')}
            className="flex-1 min-w-0 py-2.5 text-[11px] sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-slate-600 hover:text-[#006B3F] hover:bg-emerald-50"
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('signin')}
            className={`flex-1 min-w-0 py-2.5 text-[11px] sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              mode === 'signin'
                ? 'bg-white text-[#008751] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('signup')}
            className={`flex-1 min-w-0 py-2.5 text-[11px] sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              mode === 'signup'
                ? 'bg-white text-[#008751] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Card Box */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50">
          {/* ======================= SIGN IN TAB ======================= */}
          {(mode === 'signin' || mode === 'dev_signin') && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#008751] mb-1">
                  <span>{greeting}</span>
                  <TimeIcon className="w-3.5 h-3.5 text-[#008751]" aria-hidden="true" />
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 font-mono font-medium text-[11px]">{timeString} {timeZoneShort && `(${timeZoneShort})`}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  {mode === 'dev_signin' ? 'Dev Management Console' : 'Welcome to your Portal'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {mode === 'dev_signin'
                    ? 'Sign in with the email and password for your Dev Admin account.'
                    : 'Sign in using the institutional email registered to your account.'}
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Institutional Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="name@uniuyo.edu.ng"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      autoComplete="username"
                      disabled={isLoginBusy}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-700 font-bold">Password</label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isLoginBusy}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      disabled={isLoginBusy}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoginBusy}
                  aria-busy={isLoginBusy}
                  className="w-full bg-[#008751] hover:bg-[#006B3F] active:scale-98 disabled:cursor-wait disabled:opacity-80 text-white font-black py-3 rounded-xl transition-all shadow-md shadow-[#008751]/20 flex items-center justify-center gap-2 cursor-pointer min-h-[46px] mt-2 text-sm"
                >
                  {isLoginBusy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'dev_signin' ? 'Sign in to Dev Console' : 'Sign In to Portal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {mode === 'dev_signin' && (
                <p className="mt-5 text-center text-xs text-slate-500">
                  Create Account to register as Dev Admin.
                  <button
                    type="button"
                    onClick={() => {
                      handleModeChange('signup');
                      setAccountRole('dev_admin');
                    }}
                    className="font-bold text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                  >
                    Create Account
                  </button>
                </p>
              )}
            </div>
          )}

          {/* ======================= SIGN UP TAB ======================= */}
          {mode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="mb-5">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  {accountRole === 'dev_admin' ? 'Register Dev Admin Account' : 'Register Academic Account'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {accountRole === 'dev_admin'
                    ? 'Use the Firebase-managed Dev Admin authorization passkey.'
                    : 'Use the single-use invitation issued to your institutional email.'}
                </p>
              </div>

              {(accountRole === 'dev_admin' ? devSignupError : signupError) && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{accountRole === 'dev_admin' ? devSignupError : signupError}</span>
                </div>
              )}
              <form
                onSubmit={accountRole === 'dev_admin' ? handleDevSignupSubmit : handleSignupSubmit}
                className="space-y-4 text-xs sm:text-sm"
              >
                <div>
                  <label htmlFor="signup-role" className="mb-1 block font-bold text-slate-700">Account role</label>
                  <select
                    id="signup-role"
                    value={accountRole}
                    onChange={(event) => {
                      const role = event.target.value;
                      if (role === 'student' || role === 'lecturer' || role === 'dev_admin') {
                        setAccountRole(role);
                        setSignupError(null);
                        setDevSignupError(null);
                        setRegistrationInvitationCode('');
                        setDevAuthorizationPasskey('');
                      }
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-900 focus:border-[#008751] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#008751]/20"
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="dev_admin">Dev Admin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="signup-full-name" className="block text-slate-700 font-bold mb-1">Full Legal Name</label>
                  <input
                    id="signup-full-name"
                    type="text"
                    required
                    placeholder="e.g. Edidiong Bassey"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-slate-700 font-bold mb-1">Institutional Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="name@uniuyo.edu.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                  />
                </div>

                {accountRole !== 'dev_admin' && <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                  <label htmlFor="registration-invitation-code" className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <KeyRound className="h-3.5 w-3.5 text-[#008751]" />
                    Single-use invitation code
                  </label>
                  <input
                    id="registration-invitation-code"
                    type="password"
                    required
                    placeholder="Enter the code issued to your email"
                    value={registrationInvitationCode}
                    onChange={(event) => setRegistrationInvitationCode(event.target.value)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008751] focus:outline-hidden focus:ring-2 focus:ring-[#008751]/20"
                  />
                </div>}

                {accountRole === 'dev_admin' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3">
                    <label htmlFor="dev-signup-authorization" className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <KeyRound className="h-3.5 w-3.5 text-indigo-700" />
                      Dev Admin authorization passkey
                    </label>
                    <input
                      id="dev-signup-authorization"
                      type="password"
                      required
                      maxLength={256}
                      minLength={12}
                      value={devAuthorizationPasskey}
                      onChange={(event) => setDevAuthorizationPasskey(event.target.value)}
                      autoComplete="off"
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-700/20"
                    />
                  </div>
                )}

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        required
                        placeholder="Min 6 chars"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-slate-900 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Confirm Password</label>
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white min-h-[44px]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={accountRole === 'dev_admin' && isDevSignupBusy}
                  aria-busy={accountRole === 'dev_admin' && isDevSignupBusy}
                  className="w-full bg-[#008751] hover:bg-[#006B3F] active:scale-98 disabled:cursor-wait disabled:opacity-80 text-white font-black py-3 rounded-xl transition-all shadow-md shadow-[#008751]/20 flex items-center justify-center gap-2 cursor-pointer min-h-[46px] mt-2 text-sm"
                >
                  {accountRole === 'dev_admin' && isDevSignupBusy
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Verifying passkey…</span></>
                    : <><span>{accountRole === 'dev_admin' ? 'Verify Passkey & Create Dev Admin Account' : 'Create Account & Verify Email'}</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>
          )}

          {mode === 'verify' && (
            <section aria-labelledby="verify-email-title">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#008751]">
                  <Mail className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 id="verify-email-title" className="text-xl font-black text-slate-900">
                  Verify your email address
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We sent a verification link to <strong className="break-all text-slate-800">{verificationEmail}</strong>.
                  Open that email and follow its link before continuing. Check your spam folder if it is missing.
                </p>
              </div>

              {verificationError && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{verificationError}</span>
                </div>
              )}

              {verificationNotice && (
                <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{verificationNotice}</span>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={isVerificationBusy}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#008751] px-4 py-3 text-sm font-black text-white shadow-md shadow-[#008751]/20 transition-colors hover:bg-[#006B3F] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isVerificationBusy ? 'animate-spin' : ''}`} />
                  I’ve verified my email
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isVerificationBusy}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                  Resend verification email
                </button>
                <button
                  type="button"
                  onClick={handleExitVerification}
                  disabled={isVerificationBusy}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Use a different account
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400 font-medium">
          <p>Uniuyo Pulse Geofence Attendance · University of Uyo</p>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
