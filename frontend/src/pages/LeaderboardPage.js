import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaderboardAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
    Trophy,
    Medal,
    Award,
    Star,
    TrendingUp,
    Users,
    Flame,
    Loader2,
    Crown,
    Send,
    Sparkles,
    Zap,
    Target,
    ChevronRight,
    ArrowUp,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const LeaderboardPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendingNotifications, setSendingNotifications] = useState(false);

    const canSendNotifications = hasRole(['super_admin', 'academic_head']);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await leaderboardAPI.getAll();
            setLeaderboard(response.data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch leaderboard', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const sendMonthlyNotifications = async () => {
        setSendingNotifications(true);
        try {
            const response = await leaderboardAPI.sendMonthlyNotifications();
            toast({
                title: 'Notifications Sent!',
                description: `Successfully sent monthly leaderboard emails to ${response.data.sent} mentors`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to send notifications',
                variant: 'destructive',
            });
        } finally {
            setSendingNotifications(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getBadgeInfo = (badge) => {
        const badges = {
            GOLD_DEPOSITOR: { label: 'Gold', icon: Trophy, color: 'from-yellow-400 to-amber-500' },
            SILVER_DEPOSITOR: { label: 'Silver', icon: Medal, color: 'from-gray-300 to-gray-400' },
            BRONZE_DEPOSITOR: { label: 'Bronze', icon: Award, color: 'from-amber-500 to-orange-600' },
            MENTOR_ELITE: { label: 'Elite', icon: Star, color: 'from-purple-400 to-indigo-500' },
            MENTOR_PRO: { label: 'Pro', icon: Star, color: 'from-blue-400 to-cyan-500' },
            MENTOR_RISING: { label: 'Rising', icon: Star, color: 'from-emerald-400 to-green-500' },
            STREAK_MASTER: { label: 'Streak', icon: Flame, color: 'from-red-400 to-orange-500' },
            STREAK_CHAMPION: { label: 'Champion', icon: Flame, color: 'from-orange-400 to-yellow-500' },
            STREAK_STARTER: { label: 'Starter', icon: Flame, color: 'from-yellow-400 to-lime-500' },
            FIRST_MOVER: { label: 'First', icon: TrendingUp, color: 'from-violet-400 to-purple-500' },
            HIGH_ROLLER: { label: 'High Roller', icon: Zap, color: 'from-pink-400 to-rose-500' },
        };
        return badges[badge] || { label: badge, icon: Award, color: 'from-gray-400 to-gray-500' };
    };

    const topThree = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);
    const currentUserEntry = leaderboard.find(e => e.mentor_id === user?.id);

    return (
        <div className="space-y-8 animate-fade-in" data-testid="leaderboard-page">
            {/* Hero Header with Animated Graphics */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 right-10 w-60 h-60 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                    
                    {/* Floating Icons */}
                    <div className="absolute top-8 right-20 animate-bounce" style={{ animationDuration: '3s' }}>
                        <Trophy className="w-8 h-8 text-yellow-300/40" />
                    </div>
                    <div className="absolute bottom-12 left-20 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
                        <Star className="w-6 h-6 text-white/30" />
                    </div>
                    <div className="absolute top-1/3 right-1/3 animate-bounce" style={{ animationDuration: '2s', animationDelay: '1s' }}>
                        <Sparkles className="w-5 h-5 text-white/25" />
                    </div>
                    <div className="absolute bottom-1/3 left-1/4 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}>
                        <Crown className="w-7 h-7 text-yellow-300/30" />
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
                                <Trophy className="w-9 h-9 text-yellow-300" />
                            </div>
                            <div>
                                <h1 className="font-heading text-3xl lg:text-4xl font-bold">Leaderboard</h1>
                                <p className="text-white/70 mt-1">Top performing mentors this month</p>
                            </div>
                        </div>
                        {canSendNotifications && (
                            <Button
                                onClick={sendMonthlyNotifications}
                                disabled={sendingNotifications || leaderboard.length === 0}
                                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm gap-2 group"
                                data-testid="send-notifications-btn"
                            >
                                {sendingNotifications ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                )}
                                Send Monthly Emails
                            </Button>
                        )}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center group hover:bg-white/20 transition-all">
                            <Users className="w-6 h-6 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-2xl font-bold">{leaderboard.length}</p>
                            <p className="text-white/70 text-sm">Mentors</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center group hover:bg-white/20 transition-all">
                            <Target className="w-6 h-6 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                            <p className="text-2xl font-bold">
                                {leaderboard.reduce((sum, e) => sum + (e.total_points || 0), 0).toLocaleString()}
                            </p>
                            <p className="text-white/70 text-sm">Total Points</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center group hover:bg-white/20 transition-all">
                            <Flame className="w-6 h-6 mx-auto mb-2 text-orange-300 group-hover:scale-110 group-hover:animate-pulse transition-transform" />
                            <p className="text-2xl font-bold">
                                {Math.max(...leaderboard.map(e => e.current_streak_weeks || 0), 0)}
                            </p>
                            <p className="text-white/70 text-sm">Best Streak</p>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                        <p className="mt-4 text-muted-foreground animate-pulse">Loading champions...</p>
                    </div>
                </div>
            ) : leaderboard.length === 0 ? (
                <Card className="bg-card border-border shadow-soft">
                    <CardContent className="p-12 text-center">
                        <Trophy className="w-20 h-20 text-muted-foreground mx-auto mb-4 opacity-30" />
                        <p className="text-xl text-muted-foreground">No leaderboard data yet</p>
                        <p className="text-sm text-muted-foreground mt-2">Start tracking deposits to see rankings!</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Top 3 Podium with Enhanced Design */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Second Place */}
                        {topThree[1] && (
                            <Card className="bg-card border-border shadow-soft order-2 md:order-1 md:mt-8 group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                                <CardContent className="p-6 text-center relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                            <Medal className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="absolute top-4 right-4 text-4xl font-bold text-muted-foreground/20">2</div>
                                        <Avatar className="w-20 h-20 mx-auto mb-3 border-4 border-gray-300 shadow-lg group-hover:scale-105 transition-transform">
                                            <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-foreground text-2xl font-bold">
                                                {topThree[1].mentor_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <h3 className="font-heading text-xl text-foreground mb-1">{topThree[1].mentor_name}</h3>
                                        <p className="text-4xl font-bold text-gray-500 dark:text-gray-400 mb-1">
                                            {topThree[1].total_points}
                                        </p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">points</p>
                                        <div className="mt-3 p-2 rounded-lg bg-muted">
                                            <p className="text-primary font-mono font-semibold">{formatCurrency(topThree[1].total_net_deposit_usd)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* First Place - Champion */}
                        {topThree[0] && (
                            <Card className="bg-card border-2 border-yellow-400/50 dark:border-yellow-500/30 order-1 md:order-2 group hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                <CardContent className="p-8 text-center relative z-10">
                                    {/* Crown Badge */}
                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
                                            <Crown className="w-7 h-7 text-white" />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6">
                                        <div className="absolute top-8 right-4 text-6xl font-bold text-yellow-400/20">1</div>
                                        <Avatar className="w-28 h-28 mx-auto mb-4 border-4 border-yellow-400 shadow-xl group-hover:scale-105 transition-transform ring-4 ring-yellow-400/30">
                                            <AvatarFallback className="bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900 dark:to-amber-800 text-foreground text-4xl font-bold">
                                                {topThree[0].mentor_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <h3 className="font-heading text-2xl text-foreground mb-2">{topThree[0].mentor_name}</h3>
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
                                            <p className="text-5xl font-bold text-yellow-500 dark:text-yellow-400">
                                                {topThree[0].total_points}
                                            </p>
                                            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
                                        </div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">points</p>
                                        <div className="p-3 rounded-xl bg-muted">
                                            <p className="text-primary font-mono text-lg font-bold">{formatCurrency(topThree[0].total_net_deposit_usd)}</p>
                                        </div>
                                        
                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                                            {topThree[0].badges?.slice(0, 3).map((badge) => {
                                                const info = getBadgeInfo(badge);
                                                const Icon = info.icon;
                                                return (
                                                    <div 
                                                        key={badge} 
                                                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer`}
                                                        title={info.label}
                                                    >
                                                        <Icon className="w-5 h-5 text-white" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Third Place */}
                        {topThree[2] && (
                            <Card className="bg-card border-border shadow-soft order-3 md:mt-12 group hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                                <CardContent className="p-6 text-center relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                            <Medal className="w-7 h-7 text-white" />
                                        </div>
                                        <div className="absolute top-4 right-4 text-4xl font-bold text-amber-500/20">3</div>
                                        <Avatar className="w-16 h-16 mx-auto mb-3 border-4 border-amber-500 shadow-lg group-hover:scale-105 transition-transform">
                                            <AvatarFallback className="bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900 dark:to-orange-800 text-foreground text-xl font-bold">
                                                {topThree[2].mentor_name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <h3 className="font-heading text-lg text-foreground mb-1">{topThree[2].mentor_name}</h3>
                                        <p className="text-3xl font-bold text-amber-600 dark:text-amber-500 mb-1">
                                            {topThree[2].total_points}
                                        </p>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">points</p>
                                        <div className="mt-3 p-2 rounded-lg bg-muted">
                                            <p className="text-primary font-mono font-semibold">{formatCurrency(topThree[2].total_net_deposit_usd)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Current User Highlight (if not in top 3) */}
                    {currentUserEntry && currentUserEntry.rank > 3 && (
                        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30 shadow-soft">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
                                        <span className="text-xl font-bold text-white">#{currentUserEntry.rank}</span>
                                    </div>
                                    <Avatar className="w-14 h-14 border-2 border-primary shadow-md">
                                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                                            {currentUserEntry.mentor_name?.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="text-foreground font-semibold text-lg">{currentUserEntry.mentor_name}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <ArrowUp className="w-4 h-4 text-emerald-500" />
                                            Your current position
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-bold text-primary">{currentUserEntry.total_points}</p>
                                        <p className="text-xs text-muted-foreground">points</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Rest of Leaderboard */}
                    {rest.length > 0 && (
                        <Card className="bg-card border-border shadow-soft">
                            <CardHeader className="border-b border-border pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <CardTitle className="font-heading text-xl text-foreground">All Rankings</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {rest.map((entry, index) => (
                                        <div 
                                            key={entry.mentor_id} 
                                            className={`p-4 flex items-center gap-4 hover:bg-muted/50 transition-all group cursor-pointer ${
                                                entry.mentor_id === user?.id ? 'bg-primary/5' : ''
                                            }`}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <span className="text-lg font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                                    #{entry.rank}
                                                </span>
                                            </div>
                                            <Avatar className="w-12 h-12 border-2 border-border group-hover:border-primary/50 transition-colors">
                                                <AvatarFallback className="bg-muted text-foreground font-semibold">
                                                    {entry.mentor_name?.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-foreground font-medium truncate">
                                                    {entry.mentor_name}
                                                    {entry.mentor_id === user?.id && (
                                                        <Badge className="ml-2 bg-primary/10 text-primary border-0 text-xs">You</Badge>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3 h-3" />
                                                        {entry.unique_depositing_students} students
                                                    </span>
                                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                        <TrendingUp className="w-3 h-3" />
                                                        {formatCurrency(entry.total_net_deposit_usd)}
                                                    </span>
                                                    {entry.current_streak_weeks > 0 && (
                                                        <span className="flex items-center gap-1 text-orange-500">
                                                            <Flame className="w-3 h-3 animate-pulse" />
                                                            {entry.current_streak_weeks}w streak
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-primary">{entry.total_points}</p>
                                                <p className="text-xs text-muted-foreground">points</p>
                                            </div>
                                            <div className="hidden sm:flex gap-2">
                                                {entry.badges?.slice(0, 2).map((badge) => {
                                                    const info = getBadgeInfo(badge);
                                                    const Icon = info.icon;
                                                    return (
                                                        <div 
                                                            key={badge} 
                                                            className={`w-9 h-9 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center shadow-sm hover:scale-110 transition-transform`}
                                                            title={info.label}
                                                        >
                                                            <Icon className="w-4 h-4 text-white" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Points Breakdown Legend */}
                    <Card className="bg-card border-border shadow-soft">
                        <CardHeader className="border-b border-border pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                                </div>
                                <CardTitle className="font-heading text-lg text-foreground">How Points are Calculated</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 group hover:shadow-md transition-all">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                        <TrendingUp className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-bold text-lg">5 pts</p>
                                        <p className="text-sm text-muted-foreground">per $100 deposits</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 group hover:shadow-md transition-all">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                        <Users className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-bold text-lg">10 pts</p>
                                        <p className="text-sm text-muted-foreground">per $500+ student</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 group hover:shadow-md transition-all">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                        <Flame className="w-7 h-7 text-white animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-foreground font-bold text-lg">20 pts</p>
                                        <p className="text-sm text-muted-foreground">per week streak</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};

export default LeaderboardPage;
