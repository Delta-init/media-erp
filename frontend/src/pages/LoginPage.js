import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, GraduationCap, Eye, EyeOff, Sun, Moon, Sparkles, Mail, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../services/api';

const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login, error, setError } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    
    // OTP Flow States
    const [otpStep, setOtpStep] = useState(false); // false = form, true = OTP verification
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpError, setOtpError] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const otpInputRefs = useRef([]);
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
    });
    
    // Check for invitation token in URL
    const invitationToken = searchParams.get('token');
    
    useEffect(() => {
        // If there's an invitation token, switch to register mode
        if (invitationToken) {
            setIsLogin(false);
        }
    }, [invitationToken]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError && setError(null);
        
        try {
            if (isLogin) {
                await login(formData.email, formData.password);
                navigate('/dashboard');
            } else {
                // Step 1: Request OTP
                const registerData = {
                    full_name: formData.full_name,
                    email: formData.email,
                    password: formData.password,
                };
                if (invitationToken) {
                    registerData.invitation_token = invitationToken;
                }
                
                await api.post('/auth/register/request-otp', registerData);
                setOtpStep(true);
                setOtp(['', '', '', '', '', '']);
                setOtpError('');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.data?.detail) {
                setError && setError(err.response.data.detail);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const otpValue = otp.join('');
        if (otpValue.length !== 6) {
            setOtpError('Please enter the complete 6-digit code');
            return;
        }

        setLoading(true);
        setOtpError('');

        try {
            const response = await api.post('/auth/register/verify-otp', {
                email: formData.email,
                otp: otpValue
            });

            // Store token and user
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Check if user got pending role
            if (response.data.user.role === 'pending') {
                setRegistrationSuccess(true);
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error(err);
            setOtpError(err.response?.data?.detail || 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setResendLoading(true);
        setOtpError('');

        try {
            const response = await api.post('/auth/register/resend-otp', {
                email: formData.email
            });
            setOtp(['', '', '', '', '', '']);
            setOtpError(''); 
            // Show success briefly
            setOtpError(response.data.message);
            setTimeout(() => setOtpError(''), 3000);
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.detail || 'Failed to resend code';
            setOtpError(detail);
            // If rate limited, set cooldown
            if (err.response?.status === 429) {
                setResendCooldown(300); // 5 minutes
            }
        } finally {
            setResendLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        // Handle backspace
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
        // Handle Enter
        if (e.key === 'Enter' && otp.join('').length === 6) {
            handleVerifyOTP();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        if (/^\d+$/.test(pastedData)) {
            const newOtp = [...otp];
            pastedData.split('').forEach((char, i) => {
                if (i < 6) newOtp[i] = char;
            });
            setOtp(newOtp);
            // Focus last filled or next empty
            const lastIndex = Math.min(pastedData.length, 5);
            otpInputRefs.current[lastIndex]?.focus();
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleBackToForm = () => {
        setOtpStep(false);
        setOtp(['', '', '', '', '', '']);
        setOtpError('');
    };
    
    // Show success message after registration
    if (registrationSuccess) {
        return (
            <div className="min-h-screen flex bg-background theme-transition">
                <div className="w-full flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-md text-center animate-fade-in">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
                            Registration Successful!
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Your email has been verified and your account is now <strong>pending approval</strong>. 
                            An administrator will review and assign your role shortly.
                        </p>
                        <p className="text-sm text-muted-foreground mb-8">
                            You'll receive a notification once your account is activated.
                        </p>
                        <Button
                            onClick={() => {
                                setRegistrationSuccess(false);
                                setIsLogin(true);
                                setOtpStep(false);
                            }}
                            className="w-full h-12 rounded-xl"
                            data-testid="back-to-login-btn"
                        >
                            Back to Sign In
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // OTP Verification Step
    if (otpStep) {
        return (
            <div className="min-h-screen flex bg-background theme-transition">
                <div className="w-full lg:w-1/2 flex flex-col p-6 lg:p-12">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <h1 className="font-heading text-xl font-semibold text-foreground">Student Tracker</h1>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </Button>
                    </div>

                    {/* OTP Form */}
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-full max-w-md animate-fade-in">
                            <button 
                                onClick={handleBackToForm}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Mail className="w-8 h-8 text-primary" />
                                </div>
                                <h2 className="font-heading text-2xl font-bold text-foreground mb-2">
                                    Verify your email
                                </h2>
                                <p className="text-muted-foreground">
                                    We've sent a 6-digit code to<br />
                                    <span className="font-medium text-foreground">{formData.email}</span>
                                </p>
                            </div>

                            {/* OTP Input */}
                            <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={el => otpInputRefs.current[index] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground"
                                        data-testid={`otp-input-${index}`}
                                    />
                                ))}
                            </div>

                            {/* Error/Success Message */}
                            {otpError && (
                                <div className={`mb-6 p-3 rounded-xl text-center text-sm ${
                                    otpError.includes('resent') || otpError.includes('remaining')
                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                }`}>
                                    {otpError}
                                </div>
                            )}

                            {/* Verify Button */}
                            <Button
                                onClick={handleVerifyOTP}
                                disabled={loading || otp.join('').length !== 6}
                                className="w-full h-12 rounded-xl mb-4"
                                data-testid="verify-otp-btn"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Verify & Create Account'
                                )}
                            </Button>

                            {/* Resend */}
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-2">
                                    Didn't receive the code?
                                </p>
                                <Button
                                    variant="ghost"
                                    onClick={handleResendOTP}
                                    disabled={resendLoading || resendCooldown > 0}
                                    className="text-primary hover:text-primary/80"
                                    data-testid="resend-otp-btn"
                                >
                                    {resendLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    {resendCooldown > 0 
                                        ? `Resend in ${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, '0')}`
                                        : 'Resend Code'
                                    }
                                </Button>
                            </div>

                            {/* Timer info */}
                            <p className="text-center text-xs text-muted-foreground mt-6">
                                Code expires in 10 minutes
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Decorative */}
                <div className="hidden lg:flex lg:w-1/2 header-gradient items-center justify-center p-12 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                    <div className="relative z-10 text-center text-white max-w-lg">
                        <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Mail className="w-14 h-14" />
                        </div>
                        <h2 className="font-heading text-3xl font-bold mb-4">
                            Almost there!
                        </h2>
                        <p className="text-white/80 text-lg">
                            Check your email for the verification code to complete your registration.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-background theme-transition">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col p-6 lg:p-12">
                {/* Top Bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="font-heading text-xl font-semibold text-foreground">Student Tracker</h1>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </Button>
                </div>

                {/* Form Container */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md animate-fade-in">
                        {/* Heading */}
                        <div className="text-center mb-8">
                            <h2 className="font-heading text-3xl font-bold text-foreground mb-2">
                                {isLogin ? 'Welcome back' : 'Create account'}
                            </h2>
                            <p className="text-muted-foreground">
                                {isLogin 
                                    ? 'Enter your credentials to access your account' 
                                    : invitationToken 
                                        ? 'Complete your registration to join the team'
                                        : 'Register to request access to the platform'}
                            </p>
                            {invitationToken && (
                                <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center justify-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        You've been invited! Complete registration below.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <div className="space-y-2">
                                    <Label className="text-foreground font-medium">Full Name</Label>
                                    <Input
                                        type="text"
                                        name="full_name"
                                        placeholder="John Doe"
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        required={!isLogin}
                                        className="h-12 rounded-xl bg-card border-border focus:border-primary"
                                        data-testid="register-fullname-input"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Email</Label>
                                <Input
                                    type="email"
                                    name="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="h-12 rounded-xl bg-card border-border focus:border-primary"
                                    data-testid="login-email-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground font-medium">Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="h-12 rounded-xl bg-card border-border focus:border-primary pr-12"
                                        data-testid="login-password-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {!isLogin && !invitationToken && (
                                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        Note: Your account will require admin approval before you can access the system.
                                    </p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25"
                                data-testid="login-submit-btn"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    isLogin ? 'Sign In' : 'Continue'
                                )}
                            </Button>
                        </form>

                        {/* Toggle Auth Mode */}
                        <p className="text-center mt-6 text-muted-foreground">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary hover:underline font-medium"
                                data-testid="toggle-auth-mode"
                            >
                                {isLogin ? 'Sign Up' : 'Sign In'}
                            </button>
                        </p>

                        {/* Demo Credentials */}
                        <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
                            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Demo Credentials
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Admin</p>
                                    <p className="text-foreground font-mono text-xs">admin@test.com</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Mentor</p>
                                    <p className="text-foreground font-mono text-xs">mentor@test.com</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Password: password</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Decorative */}
            <div className="hidden lg:flex lg:w-1/2 header-gradient items-center justify-center p-12 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>
                
                {/* Content */}
                <div className="relative z-10 text-center text-white max-w-lg">
                    <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <GraduationCap className="w-14 h-14" />
                    </div>
                    <h2 className="font-heading text-4xl font-bold mb-4">
                        Student Tracker
                    </h2>
                    <p className="text-white/80 text-lg mb-8">
                        Manage students, track deposits, calculate commissions, and grow your mentoring business.
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                            <p className="text-3xl font-bold">117</p>
                            <p className="text-sm text-white/70">Students</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                            <p className="text-3xl font-bold">$56K</p>
                            <p className="text-sm text-white/70">Deposits</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                            <p className="text-3xl font-bold">24</p>
                            <p className="text-sm text-white/70">Mentors</p>
                        </div>
                    </div>
                </div>
                
                {/* Floating Elements */}
                <div className="absolute top-20 left-20 w-20 h-20 rounded-full bg-white/10 animate-pulse-soft" />
                <div className="absolute bottom-32 right-20 w-32 h-32 rounded-full bg-white/5 animate-pulse-soft" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 right-40 w-16 h-16 rounded-full bg-white/10 animate-pulse-soft" style={{ animationDelay: '0.5s' }} />
            </div>
        </div>
    );
};

export default LoginPage;
