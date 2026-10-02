import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  User as UserIcon,
  GraduationCap,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  KeyRound,
  IdCard,
  CheckCircle2,
  BriefcaseBusiness,
  Mail,
  RefreshCw,
  LogOut,
  MapPin,
  Navigation,
  ShieldCheck,
  Home
} from 'lucide-react';
import { User, UserRole, AuthUser } from '../types';
import {
  createFirebaseAccount,
  EmailVerificationRequiredError,
  firebaseErrorMessage,
  refreshVerifiedFirebaseUser,
  resendFirebaseEmailVerification,
  signInFirebaseAccount,
  signOutFirebaseAccount,
  validateLecturerPasskey,
  validateStudentPasskey
} from '../lib/firebase';
import { soundManager } from '../lib/sound';
import { useTimeGreeting, getTimeEmoji } from '../lib/timeGreeting';

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
  pendingVerificationEmail: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess, pendingVerificationEmail }) => {
  const [mode, setMode] = useState<'landing' | 'signin' | 'signup' | 'verify'>(() =>
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

  // Sign Up Form State
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState('');
  const [level, setLevel] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [studentPasscode, setStudentPasscode] = useState('');
  const [repPasscode, setRepPasscode] = useState('');
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

  const handleModeChange = (nextMode: 'landing' | 'signin' | 'signup') => {
    soundManager.playClick();
    setMode(nextMode);
    setLoginIdentifier('');
    setLoginPassword('');
    setFullName('');
    setStudentId('');
    setEmail('');
    setDepartment('');
    setFaculty('');
    setLevel('');
    setRole('');
    setStudentPasscode('');
    setRepPasscode('');
    setPassword('');
    setConfirmPassword('');
    setLoginError(null);
    setSignupError(null);
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

    if (!role) {
      soundManager.playError();
      setSignupError('Please choose whether you are registering as a student or lecturer.');
      return;
    }

    if (
      !fullName.trim() ||
      !studentId.trim() ||
      !email.trim() ||
      !department.trim() ||
      !faculty.trim() ||
      !level
    ) {
      soundManager.playError();
      setSignupError('Please complete all required personal, faculty, department, and academic fields.');
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

    if (role === 'student') {
      try {
        const isAuthorized = await validateStudentPasskey(studentPasscode);
        if (!isAuthorized) {
          soundManager.playError();
          setSignupError('Invalid Student Authorization Passkey.');
          return;
        }
      } catch (error) {
        soundManager.playError();
        setSignupError(firebaseErrorMessage(error));
        return;
      }
    }

    // Lecturer check
    if (role === 'lecturer') {
      try {
        const isAuthorized = await validateLecturerPasskey(repPasscode);
        if (!isAuthorized) {
          soundManager.playError();
          setSignupError('Invalid Lecturer Authorization Passkey.');
          return;
        }
      } catch (error) {
        soundManager.playError();
        setSignupError(firebaseErrorMessage(error));
        return;
      }
    }

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      fullName: fullName.trim(),
      studentId: studentId.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      faculty: faculty.trim(),
      level,
      role,
      createdAt: new Date().toISOString()
    };

    try {
      await createFirebaseAccount(newUser, password);
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
                  <img src="/assets/uniuyo-logo.png" alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="landing-brand truncate text-sm font-black tracking-tight text-slate-900 sm:text-base">Uniuyo Pulse</p>
                  <p className="truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">University of Uyo</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
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
            <img src="/assets/uniuyo-logo.png" alt="University of Uyo logo" className="max-h-full max-w-full object-contain" />
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
          {mode === 'signin' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#008751] mb-1">
                  <span>{greeting}</span>
                  <TimeIcon className="w-3.5 h-3.5 text-[#008751]" aria-hidden="true" />
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 font-mono font-medium text-[11px]">{timeString} {timeZoneShort && `(${timeZoneShort})`}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  Welcome to your Portal
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Sign in using the institutional email registered to your account.
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
                      <span>Sign In to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

            </div>
          )}

          {/* ======================= SIGN UP TAB ======================= */}
          {mode === 'signup' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="mb-5">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  Register Academic Account
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Enter your personal and academic information to create an account.
                </p>
              </div>

              {signupError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{signupError}</span>
                </div>
              )}

              <form onSubmit={handleSignupSubmit} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Edidiong Bassey"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {role === 'student' ? 'Matric / Reg Number' : 'Staff / Reg Number'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={role === 'student' ? 'e.g. 21/SC/CO/1090' : 'e.g. FAC/SC/CS/024'}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 uppercase focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Institutional Email</label>
                    <input
                      type="email"
                      required
                      placeholder="name@uniuyo.edu.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="signup-faculty" className="block text-slate-700 font-bold mb-1">Faculty</label>
                    <input
                      id="signup-faculty"
                      type="text"
                      required
                      placeholder="Enter your faculty"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-department" className="block text-slate-700 font-bold mb-1">Department</label>
                    <input
                      id="signup-department"
                      type="text"
                      required
                      placeholder="Enter your department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">Select Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      aria-pressed={role === 'student'}
                      onClick={() => {
                        setRole('student');
                        setLevel('');
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        role === 'student'
                          ? 'border-[#008751] bg-emerald-50/70 ring-2 ring-[#008751]/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className={`w-4 h-4 ${role === 'student' ? 'text-[#008751]' : 'text-slate-400'}`} />
                        <span className="font-extrabold text-xs text-slate-900">Student</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        GPS check-ins, attendance timeline, verification slips.
                      </p>
                    </button>

                    <button
                      type="button"
                      aria-pressed={role === 'lecturer'}
                      onClick={() => {
                        setRole('lecturer');
                        setLevel('');
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        role === 'lecturer'
                          ? 'border-[#A50021] bg-red-50/70 ring-2 ring-[#A50021]/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <BriefcaseBusiness className={`w-4 h-4 ${role === 'lecturer' ? 'text-[#A50021]' : 'text-slate-400'}`} />
                        <span className="font-extrabold text-xs text-slate-900">Lecturer</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Manage courses, open attendance sessions, and review reports.
                      </p>
                    </button>

                  </div>
                </div>

                <div>
                  <label htmlFor="signup-level" className="block text-slate-700 font-bold mb-1">
                    {role === 'lecturer' ? 'Academic Rank' : 'Academic Level'}
                  </label>
                  <select
                    id="signup-level"
                    required
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    disabled={!role}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 focus:bg-white transition-all min-h-[44px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {role ? 'Choose your level or rank' : 'Choose a role first'}
                    </option>
                    {role === 'student' && (
                      <>
                        <option value="100L">100 Level</option>
                        <option value="200L">200 Level</option>
                        <option value="300L">300 Level</option>
                        <option value="400L">400 Level</option>
                      </>
                    )}
                    {role === 'lecturer' && (
                      <>
                        <option value="Lecturer">Lecturer</option>
                        <option value="Senior Lecturer">Senior Lecturer</option>
                        <option value="Professor">Professor</option>
                      </>
                    )}
                  </select>
                </div>

                {role === 'student' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                    <label htmlFor="student-authorization-passkey" className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <KeyRound className="h-3.5 w-3.5 text-[#008751]" />
                      Student Authorization Passkey
                    </label>
                    <input
                      id="student-authorization-passkey"
                      type="password"
                      required
                      placeholder="Enter student authorization code"
                      value={studentPasscode}
                      onChange={(event) => setStudentPasscode(event.target.value)}
                      autoComplete="off"
                      className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#008751] focus:outline-hidden focus:ring-2 focus:ring-[#008751]/20"
                    />
                  </div>
                )}

                {/* Lecturer accounts require staff authorization */}
                {role === 'lecturer' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#008751]" />
                        <span>Lecturer Authorization Passkey</span>
                      </label>
                      <span className="text-[10px] text-[#006B3F] font-extrabold bg-emerald-100 px-2 py-0.5 rounded">
                        Firebase verified
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter lecturer authorization code"
                      value={repPasscode}
                      onChange={(e) => setRepPasscode(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 text-xs"
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
                  className="w-full bg-[#008751] hover:bg-[#006B3F] active:scale-98 text-white font-black py-3 rounded-xl transition-all shadow-md shadow-[#008751]/20 flex items-center justify-center gap-2 cursor-pointer min-h-[46px] mt-2 text-sm"
                >
                  <span>Create Account & Verify Email</span>
                  <ArrowRight className="w-4 h-4" />
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
