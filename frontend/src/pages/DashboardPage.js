import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI, studentsAPI, fundingAPI, commissionsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    DollarSign,
    FileText,
    TrendingUp,
    TrendingDown,
    Wallet,
    Target,
    Award,
    Clock,
    ChevronRight,
    Loader2,
    Sparkles,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    PieChart,
    BarChart3,
    CircleDollarSign,
    GraduationCap,
    Star,
    Flame,
    Trophy,
    Banknote,
    Percent,
    CalendarDays,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Legend,
    Area,
    AreaChart,
} from 'recharts';

const DashboardPage = () => {
    const { user, hasRole } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        netDeposits: 0,
        pendingRequests: 0,
        myStudents: 0,
        myNetDeposits: 0,
        projectedCommission: 0,
    });
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [transactionTrends, setTransactionTrends] = useState([]);
    const [statusDistribution, setStatusDistribution] = useState([]);
    const [myCommission, setMyCommission] = useState(null);

    const isAdmin = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);
    const isMentor = hasRole(['junior_mentor', 'senior_mentor']);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                
                const dashboardResponse = await dashboardAPI.getStats();
                const dashData = dashboardResponse.data;
                
                const studentsResponse = await studentsAPI.getAll({});
                const students = studentsResponse.data;
                
                const fundingResponse = await fundingAPI.getAll({});
                const transactions = fundingResponse.data;
                
                const totalStudents = students.length;
                const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
                const netDeposits = students.reduce((sum, s) => sum + (s.net_deposit_usd || 0), 0);
                const pendingRequests = transactions.filter(t => t.status === 'PENDING').length;
                
                let myStudents = 0;
                let myNetDeposits = 0;
                if (isMentor && user) {
                    const mentorStudents = students.filter(s => s.primary_mentor_id === user.id);
                    myStudents = mentorStudents.length;
                    myNetDeposits = mentorStudents.reduce((sum, s) => sum + (s.net_deposit_usd || 0), 0);
                }
                
                setStats({
                    totalStudents,
                    activeStudents,
                    netDeposits,
                    pendingRequests,
                    myStudents,
                    myNetDeposits,
                    projectedCommission: myNetDeposits * 0.04 * 0.75,
                    ...dashData,
                });
                
                setRecentTransactions(transactions.slice(0, 5));
                
                const trends = generateTrends(transactions);
                setTransactionTrends(trends);
                
                const approved = transactions.filter(t => t.status === 'APPROVED').length;
                const pending = transactions.filter(t => t.status === 'PENDING').length;
                const rejected = transactions.filter(t => t.status === 'REJECTED').length;
                const total = approved + pending + rejected || 1;
                
                setStatusDistribution([
                    { name: 'Approved', value: approved, percentage: Math.round((approved / total) * 100), color: '#10B981' },
                    { name: 'Pending', value: pending, percentage: Math.round((pending / total) * 100), color: '#F59E0B' },
                    { name: 'Rejected', value: rejected, percentage: Math.round((rejected / total) * 100), color: '#EF4444' },
                ]);
                
                // Fetch mentor's commission data
                if (isMentor && user) {
                    try {
                        const commissionResponse = await commissionsAPI.getAll({});
                        const allCommissions = commissionResponse.data;
                        // Find current user's commission for current quarter
                        const myCommissionData = allCommissions.find(c => c.mentor_id === user.id);
                        if (myCommissionData) {
                            setMyCommission(myCommissionData);
                        }
                    } catch (err) {
                        console.error('Failed to fetch commission data:', err);
                    }
                }
                
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, isMentor]);

    const generateTrends = (transactions) => {
        const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
        
        return months.map((month, index) => {
            const baseDeposits = transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'APPROVED').length * 1000;
            const baseWithdrawals = transactions.filter(t => t.type === 'WITHDRAWAL' && t.status === 'APPROVED').length * 500;
            const variation = (index + 1) * 5000;
            
            return {
                month,
                deposits: Math.max(0, baseDeposits + variation + Math.random() * 10000),
                withdrawals: Math.max(0, baseWithdrawals + (index * 500)),
            };
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const getCurrentDate = () => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="mt-4 text-muted-foreground animate-pulse">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
            {/* Welcome Header with Animated Graphics */}
            <div className="header-gradient rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute bottom-10 right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                    
                    {/* Floating Icons */}
                    <div className="absolute top-8 right-32 animate-bounce" style={{ animationDuration: '3s' }}>
                        <Star className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="absolute bottom-12 left-1/4 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
                        <Sparkles className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="absolute top-1/3 right-1/4 animate-bounce" style={{ animationDuration: '2s', animationDelay: '1s' }}>
                        <Zap className="w-4 h-4 text-white/25" />
                    </div>
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
                                <GraduationCap className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="font-heading text-2xl lg:text-3xl font-bold">
                                    Welcome back, {user?.full_name?.split(' ')[0]}!
                                </h1>
                                <p className="text-white/70 text-sm">{getCurrentDate()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm hover:bg-white/30 transition-all">
                                <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
                                {user?.role?.replace('_', ' ')}
                            </Badge>
                            <Badge className="bg-white/10 text-white/80 border-0">
                                <Activity className="w-3 h-3 mr-1" />
                                Online
                            </Badge>
                        </div>
                    </div>
                    {isMentor && (
                        <div className="flex gap-3">
                            <Button
                                onClick={() => navigate('/students')}
                                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm group transition-all"
                            >
                                <Users className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                Add Student
                            </Button>
                            <Button
                                onClick={() => navigate('/funding')}
                                className="bg-white text-indigo-600 hover:bg-white/90 group transition-all hover:shadow-lg"
                            >
                                <DollarSign className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                                New Deposit
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Cards with Animated Icons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Students */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all duration-300 group hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {isMentor ? 'My Students' : 'Total Students'}
                                </p>
                                <p className="text-3xl font-bold text-foreground mt-2">
                                    {isMentor ? stats.myStudents : stats.totalStudents}
                                </p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 animate-bounce" style={{ animationDuration: '2s' }} />
                                    {stats.activeStudents} active
                                </p>
                            </div>
                            <div className="stat-card-blue w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400 group-hover:animate-pulse" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Net Deposits */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all duration-300 group hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {isMentor ? 'My Net Deposits' : 'Net Deposits'}
                                </p>
                                <p className="text-3xl font-bold text-foreground mt-2">
                                    {formatCurrency(isMentor ? stats.myNetDeposits : stats.netDeposits)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <CircleDollarSign className="w-3 h-3" />
                                    All students
                                </p>
                            </div>
                            <div className="stat-card-green w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <DollarSign className="w-7 h-7 text-emerald-600 dark:text-emerald-400 group-hover:animate-bounce" style={{ animationDuration: '1s' }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Requests */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all duration-300 group hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">Pending Requests</p>
                                <p className="text-3xl font-bold text-foreground mt-2">{stats.pendingRequests}</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                                    Needs review
                                </p>
                            </div>
                            <div className="stat-card-orange w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <FileText className="w-7 h-7 text-amber-600 dark:text-amber-400 group-hover:animate-pulse" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Commission / Target */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all duration-300 group hover:-translate-y-1">
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {isMentor ? 'Projected Commission' : 'Active Mentors'}
                                </p>
                                <p className="text-3xl font-bold text-foreground mt-2">
                                    {isMentor ? formatCurrency(stats.projectedCommission) : stats.activeMentors || 0}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-orange-500 animate-pulse" />
                                    {isMentor ? 'Based on deposits' : 'Total in system'}
                                </p>
                            </div>
                            <div className="stat-card-purple w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                {isMentor ? (
                                    <Award className="w-7 h-7 text-purple-600 dark:text-purple-400 group-hover:animate-bounce" style={{ animationDuration: '1s' }} />
                                ) : (
                                    <Target className="w-7 h-7 text-purple-600 dark:text-purple-400 group-hover:animate-spin" style={{ animationDuration: '3s' }} />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <Trophy className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-2xl font-bold">#1</p>
                    <p className="text-white/80 text-sm">Leaderboard</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <TrendingUp className="w-8 h-8 mb-2 group-hover:scale-110 group-hover:animate-bounce transition-transform" style={{ animationDuration: '1s' }} />
                    <p className="text-2xl font-bold">+24%</p>
                    <p className="text-white/80 text-sm">Growth</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 text-white relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <Flame className="w-8 h-8 mb-2 group-hover:scale-110 group-hover:animate-pulse transition-transform" />
                    <p className="text-2xl font-bold">7</p>
                    <p className="text-white/80 text-sm">Day Streak</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-4 text-white relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <Star className="w-8 h-8 mb-2 group-hover:scale-110 group-hover:animate-spin transition-transform" style={{ animationDuration: '2s' }} />
                    <p className="text-2xl font-bold">4.8</p>
                    <p className="text-white/80 text-sm">Rating</p>
                </div>
            </div>

            {/* Commission Summary Card - For Mentors Only */}
            {isMentor && myCommission && (
                <Card className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border-purple-500/20 shadow-soft hover:shadow-card-hover transition-all duration-300">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="font-heading text-lg flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Banknote className="w-4 h-4 text-purple-500 animate-pulse" />
                                </div>
                                My Commission Summary
                            </CardTitle>
                            <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-0">
                                <CalendarDays className="w-3 h-3 mr-1" />
                                {myCommission.quarter}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {/* Net Deposit */}
                            <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Net Deposits</p>
                                <p className="text-2xl font-bold text-foreground">{formatCurrency(myCommission.net_deposit_usd || 0)}</p>
                                <p className="text-xs text-muted-foreground mt-1">This quarter</p>
                            </div>
                            
                            {/* Gross Commission */}
                            <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Gross Commission</p>
                                <p className="text-2xl font-bold text-foreground">{formatCurrency(myCommission.gross_commission_usd || 0)}</p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Percent className="w-3 h-3" /> 4% of deposits
                                </p>
                            </div>
                            
                            {/* Releasable */}
                            <div className="bg-emerald-500/10 backdrop-blur rounded-xl p-4 border border-emerald-500/20">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Releasable (75%)</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(myCommission.commission_release_usd || 0)}</p>
                                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> End of quarter
                                </p>
                            </div>
                            
                            {/* Buffer */}
                            <div className="bg-amber-500/10 backdrop-blur rounded-xl p-4 border border-amber-500/20">
                                <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Buffer (25%)</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(myCommission.commission_buffer_usd || 0)}</p>
                                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Carries forward
                                </p>
                            </div>
                            
                            {/* Status */}
                            <div className="bg-card/50 backdrop-blur rounded-xl p-4 border border-border flex flex-col justify-between">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                                <div>
                                    <Badge className={`text-xs ${
                                        myCommission.overall_status === 'released' 
                                            ? 'bg-emerald-500/20 text-emerald-600' 
                                            : 'bg-amber-500/20 text-amber-600'
                                    }`}>
                                        {myCommission.overall_status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending'}
                                    </Badge>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="mt-2 text-xs text-primary hover:text-primary/80 p-0 h-auto"
                                    onClick={() => navigate('/commissions')}
                                >
                                    View Details <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>
                        
                        {/* Buffer carried in info */}
                        {myCommission.buffer_carried_in_usd > 0 && (
                            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    <span>
                                        <strong>{formatCurrency(myCommission.buffer_carried_in_usd)}</strong> buffer carried in from previous quarter
                                    </span>
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transaction Trends Chart */}
                <Card className="lg:col-span-2 bg-card border-border shadow-soft hover:shadow-card-hover transition-all">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="font-heading text-lg flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-primary animate-pulse" />
                                </div>
                                Transaction Trends
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">Last 6 Months</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={transactionTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis 
                                        dataKey="month" 
                                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                    />
                                    <YAxis 
                                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        }}
                                        formatter={(value) => [formatCurrency(value), '']}
                                    />
                                    <Legend />
                                    <Area 
                                        type="monotone"
                                        dataKey="deposits" 
                                        name="Deposits" 
                                        stroke="#10B981"
                                        strokeWidth={2}
                                        fill="url(#depositGradient)"
                                    />
                                    <Area 
                                        type="monotone"
                                        dataKey="withdrawals" 
                                        name="Withdrawals" 
                                        stroke="#EF4444"
                                        strokeWidth={2}
                                        fill="url(#withdrawalGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Distribution Chart */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all">
                    <CardHeader className="pb-2">
                        <CardTitle className="font-heading text-lg flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <PieChart className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '10s' }} />
                            </div>
                            Status Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex flex-col items-center justify-center">
                            <ResponsiveContainer width="100%" height="80%">
                                <RechartsPieChart>
                                    <Pie
                                        data={statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        animationBegin={0}
                                        animationDuration={1500}
                                    >
                                        {statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '12px',
                                        }}
                                    />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="flex items-center gap-4 mt-2">
                                {statusDistribution.map((item) => (
                                    <div key={item.name} className="flex items-center gap-2 group cursor-pointer">
                                        <div 
                                            className="w-3 h-3 rounded-full group-hover:scale-125 transition-transform"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                            {item.name} {item.percentage}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="font-heading text-lg flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Wallet className="w-4 h-4 text-primary" />
                                </div>
                                Recent Transactions
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/funding')}
                                className="text-primary hover:text-primary group"
                            >
                                View All
                                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {recentTransactions.length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground">
                                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50 animate-pulse" />
                                    <p>No recent transactions</p>
                                </div>
                            ) : (
                                recentTransactions.map((txn, index) => (
                                    <div 
                                        key={txn.id} 
                                        className="p-4 hover:bg-muted/50 transition-all cursor-pointer group"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                                                ${txn.type === 'DEPOSIT' 
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                                                    : 'bg-red-100 dark:bg-red-900/30'
                                                }`}
                                            >
                                                {txn.type === 'DEPOSIT' ? (
                                                    <ArrowUpRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                                ) : (
                                                    <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-foreground truncate">
                                                    {txn.student_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {txn.student_code}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-semibold ${
                                                    txn.type === 'DEPOSIT' 
                                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    {txn.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(txn.amount_usd)}
                                                </p>
                                                <Badge className={`text-xs ${
                                                    txn.status === 'APPROVED' 
                                                        ? 'badge-success'
                                                        : txn.status === 'PENDING'
                                                        ? 'badge-warning'
                                                        : 'badge-error'
                                                }`}>
                                                    {txn.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-card border-border shadow-soft hover:shadow-card-hover transition-all">
                    <CardHeader className="pb-3">
                        <CardTitle className="font-heading text-lg flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-primary animate-pulse" />
                            </div>
                            Quick Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-auto py-6 flex flex-col items-center gap-3 group hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => navigate('/students')}
                            >
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="font-medium">Students</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-auto py-6 flex flex-col items-center gap-3 group hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => navigate('/funding')}
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <span className="font-medium">Funding</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-auto py-6 flex flex-col items-center gap-3 group hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => navigate('/commissions')}
                            >
                                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <span className="font-medium">Commissions</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-auto py-6 flex flex-col items-center gap-3 group hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => navigate('/leaderboard')}
                            >
                                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="font-medium">Leaderboard</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;
