import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { gamificationAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
    Loader2,
    Settings,
    Trophy,
    Star,
    Flame,
    DollarSign,
    Users,
    Save,
    RefreshCw,
    Info,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const GamificationSettingsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [editedValues, setEditedValues] = useState({});

    const canManage = hasRole(['super_admin', 'academic_head']);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await gamificationAPI.getSettings();
            setSettings(response.data);
            // Initialize edited values
            const values = {};
            response.data.forEach(s => {
                values[s.setting_key] = s.setting_value;
            });
            setEditedValues(values);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch gamification settings',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canManage) {
            fetchSettings();
        }
    }, []);

    const handleSave = async (settingKey) => {
        const newValue = editedValues[settingKey];
        if (newValue === undefined || newValue === null) return;
        
        setSaving(prev => ({ ...prev, [settingKey]: true }));
        try {
            await gamificationAPI.updateSetting(settingKey, Number(newValue));
            toast({
                title: 'Success',
                description: 'Setting updated successfully',
            });
            fetchSettings();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update setting',
                variant: 'destructive',
            });
        } finally {
            setSaving(prev => ({ ...prev, [settingKey]: false }));
        }
    };

    const getSettingIcon = (key) => {
        if (key.includes('points_per_100')) return DollarSign;
        if (key.includes('points_per_student') || key.includes('student')) return Users;
        if (key.includes('streak')) return Flame;
        return Star;
    };

    const getSettingColor = (key) => {
        if (key.includes('points_per_100')) return 'text-green-500 bg-green-500/10';
        if (key.includes('points_per_student') || key.includes('student')) return 'text-blue-500 bg-blue-500/10';
        if (key.includes('streak')) return 'text-orange-500 bg-orange-500/10';
        return 'text-primary bg-primary/10';
    };

    const formatSettingName = (key) => {
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="gamification-settings-page">
                <Settings className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to manage gamification settings.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="gamification-settings-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Gamification Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure points, streaks, and rewards
                    </p>
                </div>
                <Button
                    onClick={fetchSettings}
                    variant="outline"
                    className="border-border gap-2"
                    data-testid="refresh-btn"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-foreground font-medium">How Points Work</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Mentors earn points based on their students' deposits, the number of active students, 
                                and consecutive weekly activity streaks. Points determine leaderboard rankings and unlock badges.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Settings Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {settings.map((setting) => {
                        const Icon = getSettingIcon(setting.setting_key);
                        const colorClass = getSettingColor(setting.setting_key);
                        const isChanged = editedValues[setting.setting_key] !== setting.setting_value;
                        
                        return (
                            <Card key={setting.id} className="bg-card border-border">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-medium text-foreground">
                                                {formatSettingName(setting.setting_key)}
                                            </CardTitle>
                                            <CardDescription className="text-muted-foreground text-sm">
                                                {setting.description}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <Label className="text-muted-foreground text-xs uppercase mb-1 block">
                                                Value
                                            </Label>
                                            <Input
                                                type="number"
                                                value={editedValues[setting.setting_key] ?? ''}
                                                onChange={(e) => setEditedValues(prev => ({
                                                    ...prev,
                                                    [setting.setting_key]: e.target.value
                                                }))}
                                                className="bg-background border-border text-foreground"
                                                data-testid={`input-${setting.setting_key}`}
                                            />
                                        </div>
                                        <div className="pt-5">
                                            <Button
                                                onClick={() => handleSave(setting.setting_key)}
                                                disabled={saving[setting.setting_key] || !isChanged}
                                                className={`${isChanged ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground-subtle text-muted-foreground'}`}
                                                data-testid={`save-${setting.setting_key}`}
                                            >
                                                {saving[setting.setting_key] ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    {isChanged && (
                                        <p className="text-xs text-primary mt-2">
                                            Unsaved changes (was: {setting.setting_value})
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Badge Thresholds Info */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="font-heading text-xl flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-primary" />
                        Badge Thresholds
                    </CardTitle>
                    <CardDescription>
                        Badges are automatically awarded based on these achievement levels
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Deposit Badges */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                Deposit Badges
                            </h4>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-yellow-500/20 text-yellow-500">Gold Depositor</Badge>
                                    <span className="text-muted-foreground">$100,000+</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-gray-300/20 text-gray-300">Silver Depositor</Badge>
                                    <span className="text-muted-foreground">$50,000+</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-amber-600/20 text-amber-600">Bronze Depositor</Badge>
                                    <span className="text-muted-foreground">$25,000+</span>
                                </div>
                            </div>
                        </div>

                        {/* Mentor Badges */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                Mentor Badges
                            </h4>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-primary/20 text-primary">Elite Mentor</Badge>
                                    <span className="text-muted-foreground">50+ students</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-blue-500/20 text-blue-500">Pro Mentor</Badge>
                                    <span className="text-muted-foreground">20+ students</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-green-500/20 text-green-500">Rising Star</Badge>
                                    <span className="text-muted-foreground">10+ students</span>
                                </div>
                            </div>
                        </div>

                        {/* Streak Badges */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Flame className="w-4 h-4 text-orange-500" />
                                Streak Badges
                            </h4>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-red-500/20 text-red-500">Streak Master</Badge>
                                    <span className="text-muted-foreground">12+ weeks</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-orange-500/20 text-orange-500">Streak Champion</Badge>
                                    <span className="text-muted-foreground">8+ weeks</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <Badge className="bg-yellow-500/20 text-yellow-500">Streak Starter</Badge>
                                    <span className="text-muted-foreground">4+ weeks</span>
                                </div>
                            </div>
                        </div>

                        {/* Special Badges */}
                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Star className="w-4 h-4 text-purple-500" />
                                Special Badges
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <Badge className="bg-purple-500/20 text-purple-500">First Mover</Badge>
                                    <span className="text-muted-foreground">First deposit of the month</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Badge className="bg-pink-500/20 text-pink-500">High Roller</Badge>
                                    <span className="text-muted-foreground">Any deposit $10,000+</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default GamificationSettingsPage;
