import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useTheme } from '../../context/ThemeContext';
import { dashboardAPI } from '../../services/api';
import {
    LayoutDashboard,
    Users,
    Wallet,
    Brain,
    LogOut,
    Menu,
    X,
    GraduationCap,
    ChevronRight,
    Bell,
    Target,
    Trophy,
    Calculator,
    ArrowRightLeft,
    UserPlus,
    CreditCard,
    FileText,
    Kanban,
    HelpCircle,
    Server,
    History,
    Check,
    Settings,
    ShieldAlert,
    Shield,
    Sun,
    Moon,
    ChevronDown,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';

const Layout = ({ children }) => {
    const { user, logout, hasRole } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useWebSocket();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [pendingCounts, setPendingCounts] = useState({
        pending_funding: 0,
        pending_student_requests: 0,
        pending_retention: 0,
    });

    useEffect(() => {
        const fetchPendingCounts = async () => {
            try {
                const response = await dashboardAPI.getPendingCounts();
                setPendingCounts(response.data);
            } catch (error) {
                console.error('Failed to fetch pending counts:', error);
            }
        };

        fetchPendingCounts();
        const interval = setInterval(fetchPendingCounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getNavItems = () => {
        const items = [];

        items.push({ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
        items.push({ name: 'AI Insights', path: '/ai-insights', icon: Brain });
        items.push({ name: 'Leaderboard', path: '/leaderboard', icon: Trophy });

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'subjunior_mentor', 'assistance', 'draw_admin'])) {
            items.push({ name: 'Students', path: '/students', icon: Users });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({ name: 'Student Logs', path: '/student-logs', icon: FileText });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({ name: 'Pipeline', path: '/pipeline', icon: Kanban });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'finance_admin', 'draw_admin'])) {
            items.push({
                name: 'Funding Requests',
                path: '/funding',
                icon: Wallet,
                badge: pendingCounts.pending_funding > 0 ? pendingCounts.pending_funding : null,
            });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({ name: 'Targets', path: '/targets', icon: Target });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'finance_admin', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({ name: 'Commissions', path: '/commissions', icon: Calculator });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'finance_admin'])) {
            items.push({ name: 'Payouts', path: '/payouts', icon: CreditCard });
        }

        items.push({ name: 'Support', path: '/support', icon: HelpCircle });

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({ name: 'Open Pool', path: '/open-pool', icon: UserPlus });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'draw_admin'])) {
            items.push({
                name: 'Requests',
                path: '/student-requests',
                icon: ArrowRightLeft,
                badge: pendingCounts.pending_student_requests > 0 ? pendingCounts.pending_student_requests : null,
            });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head'])) {
            items.push({ name: 'MT5 Accounts', path: '/mt5-accounts', icon: Server });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin'])) {
            items.push({ name: 'Audit Logs', path: '/audit-logs', icon: History });
        }

        if (hasRole(['super_admin', 'academic_head'])) {
            items.push({ name: 'Gamification', path: '/gamification-settings', icon: Settings });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin'])) {
            items.push({ name: 'Personnel', path: '/personnel', icon: Users });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head'])) {
            items.push({ name: 'Counselors', path: '/counselors', icon: GraduationCap });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'draw_admin'])) {
            items.push({
                name: 'Retention',
                path: '/retention',
                icon: ShieldAlert,
                badge: pendingCounts.pending_retention > 0 ? pendingCounts.pending_retention : null,
            });
        }

        if (hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'finance_admin'])) {
            items.push({ name: 'Reports', path: '/reports', icon: FileText });
        }

        // Role Management - Super Admin only
        if (hasRole(['super_admin'])) {
            items.push({ name: 'Role Management', path: '/role-management', icon: Shield });
        }

        return items;
    };

    const navItems = getNavItems();
    const isActive = (path) => location.pathname === path;

    const getRoleBadgeColor = (role) => {
        const colors = {
            super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            broker_admin: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            academic_head: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
            junior_mentor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            senior_mentor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        };
        return colors[role] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    };

    return (
        <div className="min-h-screen bg-background theme-transition">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full bg-card border-r border-border theme-transition
                    ${sidebarCollapsed ? 'w-20' : 'w-64'}
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 transition-all duration-300`}
            >
                {/* Logo & Brand */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                    <Link to="/dashboard" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-primary-foreground" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex flex-col">
                                <span className="font-heading font-semibold text-foreground">Student Tracker</span>
                            </div>
                        )}
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* User Info */}
                <div className={`p-4 border-b border-border ${sidebarCollapsed ? 'px-2' : ''}`}>
                    <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <Avatar className="w-10 h-10 bg-primary/10 border-2 border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        {!sidebarCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{user?.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                <Badge className={`mt-1 text-xs ${getRoleBadgeColor(user?.role)}`}>
                                    {user?.role?.replace('_', ' ')}
                                </Badge>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
                    <nav className="p-3 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                                        ${active
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }
                                        ${sidebarCollapsed ? 'justify-center px-2' : ''}
                                    `}
                                    title={sidebarCollapsed ? item.name : undefined}
                                >
                                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? '' : ''}`} />
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="flex-1 text-sm font-medium">{item.name}</span>
                                            {item.badge && (
                                                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                                                    {item.badge}
                                                </Badge>
                                            )}
                                        </>
                                    )}
                                    {sidebarCollapsed && item.badge && (
                                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </ScrollArea>

                {/* Logout Button */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border bg-card">
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className={`w-full justify-start gap-3 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30
                            ${sidebarCollapsed ? 'justify-center px-2' : ''}
                        `}
                    >
                        <LogOut className="w-5 h-5" />
                        {!sidebarCollapsed && <span>Sign Out</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} transition-all duration-300`}>
                {/* Top Header */}
                <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-md border-b border-border">
                    <div className="h-full flex items-center justify-between px-4 lg:px-6">
                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </Button>

                        {/* Collapse Button (Desktop) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden lg:flex"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        >
                            <ChevronRight className={`w-5 h-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
                        </Button>

                        {/* Right Side Actions */}
                        <div className="flex items-center gap-2">
                            {/* Theme Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleTheme}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid="theme-toggle"
                            >
                                {theme === 'dark' ? (
                                    <Sun className="w-5 h-5" />
                                ) : (
                                    <Moon className="w-5 h-5" />
                                )}
                            </Button>

                            {/* Notifications */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="relative text-muted-foreground hover:text-foreground"
                                        data-testid="notifications-btn"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-80 p-0 bg-card border-border">
                                    <div className="flex items-center justify-between p-4 border-b border-border">
                                        <h4 className="font-semibold text-foreground">Notifications</h4>
                                        {unreadCount > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={markAllAsRead}
                                                className="text-xs text-primary hover:text-primary"
                                            >
                                                Mark all read
                                            </Button>
                                        )}
                                    </div>
                                    <ScrollArea className="h-72">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-muted-foreground">
                                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No notifications</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-border">
                                                {notifications.slice(0, 10).map((notif) => (
                                                    <div
                                                        key={notif.id}
                                                        className={`p-3 hover:bg-muted cursor-pointer transition-colors
                                                            ${!notif.read ? 'bg-primary/5' : ''}`}
                                                        onClick={() => markAsRead(notif.id)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0
                                                                ${!notif.read ? 'bg-primary' : 'bg-transparent'}`}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-sm text-foreground">{notif.title}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                                                                <p className="text-xs text-muted-foreground mt-1">
                                                                    {new Date(notif.timestamp).toLocaleTimeString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>

                            {/* User Menu (Mobile) */}
                            <div className="lg:hidden">
                                <Avatar className="w-8 h-8 bg-primary/10 border border-primary/20">
                                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                        {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
