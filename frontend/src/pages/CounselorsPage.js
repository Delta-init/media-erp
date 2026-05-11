import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { counselorsAPI, studentsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../components/ui/dialog';
import {
    Loader2,
    GraduationCap,
    UserPlus,
    UserMinus,
    RefreshCw,
    Search,
    Users,
    CheckCircle,
    XCircle,
    Info,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const CounselorsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [counselors, setCounselors] = useState([]);
    const [students, setStudents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCounselor, setSelectedCounselor] = useState('');
    
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [studentToAssign, setStudentToAssign] = useState(null);
    const [assignForm, setAssignForm] = useState({
        counselor_id: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);

    const canManage = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [counselorsRes, summaryRes, studentsRes] = await Promise.all([
                counselorsAPI.getAll(),
                counselorsAPI.getSummary(),
                studentsAPI.getAll(),
            ]);
            setCounselors(counselorsRes.data);
            setSummary(summaryRes.data);
            setStudents(studentsRes.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canManage) {
            fetchData();
        }
    }, []);

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            s.student_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCounselor = !selectedCounselor || 
                                (selectedCounselor === 'unassigned' ? !s.academic_counselor_id : s.academic_counselor_id === selectedCounselor);
        return matchesSearch && matchesCounselor;
    });

    const openAssignDialog = (student) => {
        setStudentToAssign(student);
        setAssignForm({
            counselor_id: student.academic_counselor_id || '',
            notes: student.counselor_notes || '',
        });
        setAssignDialogOpen(true);
    };

    const handleAssign = async () => {
        if (!studentToAssign || !assignForm.counselor_id) {
            toast({
                title: 'Error',
                description: 'Please select a counselor',
                variant: 'destructive',
            });
            return;
        }
        
        setSaving(true);
        try {
            await counselorsAPI.assign({
                student_id: studentToAssign.id,
                counselor_id: assignForm.counselor_id,
                notes: assignForm.notes || undefined,
            });
            toast({ title: 'Success', description: 'Counselor assigned successfully' });
            setAssignDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to assign counselor',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleUnassign = async (studentId) => {
        try {
            await counselorsAPI.unassign(studentId);
            toast({ title: 'Success', description: 'Counselor unassigned successfully' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to unassign counselor',
                variant: 'destructive',
            });
        }
    };

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="counselors-page">
                <GraduationCap className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to manage counselors.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="counselors-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Academic Counselors</h1>
                    <p className="text-muted-foreground mt-1">
                        Assign counselors to students for academic guidance
                    </p>
                </div>
                <Button
                    onClick={fetchData}
                    variant="outline"
                    className="border-border gap-2"
                    data-testid="refresh-btn"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.total_students}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Total Students</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.assigned_students}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Assigned</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <XCircle className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.unassigned_students}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Unassigned</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.assignment_rate}%</p>
                                    <p className="text-xs text-muted-foreground uppercase">Coverage</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Counselors List */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        Available Counselors
                    </CardTitle>
                    <CardDescription>
                        Staff members who can be assigned as academic counselors
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {counselors.map(counselor => (
                            <div
                                key={counselor.id}
                                className="p-4 bg-background rounded-lg border border-border"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-primary font-medium">
                                            {counselor.full_name.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-foreground font-medium">{counselor.full_name}</p>
                                        <p className="text-xs text-muted-foreground">{counselor.role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                    <span className="text-sm text-muted-foreground">
                                        {counselor.assigned_students_count} students
                                    </span>
                                    <Badge className={counselor.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                        {counselor.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search students by name or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-background border-border text-foreground"
                            />
                        </div>
                        <Select value={selectedCounselor || "all"} onValueChange={(v) => setSelectedCounselor(v === "all" ? "" : v)}>
                            <SelectTrigger className="w-full sm:w-64 bg-background border-border text-foreground">
                                <SelectValue placeholder="Filter by counselor" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="all">All Students</SelectItem>
                                <SelectItem value="unassigned">Unassigned Only</SelectItem>
                                {counselors.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Students Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-20">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No students found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Primary Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Counselor</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStudents.map((student) => (
                                        <TableRow key={student.id} className="border-border">
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground font-medium">{student.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{student.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {student.primary_mentor_name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {student.academic_counselor_name ? (
                                                    <Badge className="bg-primary/20 text-primary border-0">
                                                        {student.academic_counselor_name}
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-orange-500/20 text-orange-400 border-0">
                                                        Unassigned
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={student.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}>
                                                    {student.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openAssignDialog(student)}
                                                        className="text-muted-foreground hover:text-primary"
                                                        data-testid={`assign-${student.id}`}
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </Button>
                                                    {student.academic_counselor_id && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleUnassign(student.id)}
                                                            className="text-muted-foreground hover:text-red-400"
                                                            data-testid={`unassign-${student.id}`}
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Assign Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Assign Counselor</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Assign an academic counselor to {studentToAssign?.full_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-3 bg-background rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground">Student</p>
                            <p className="text-foreground font-medium">{studentToAssign?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{studentToAssign?.student_code}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Select Counselor</Label>
                            <Select
                                value={assignForm.counselor_id}
                                onValueChange={(v) => setAssignForm({...assignForm, counselor_id: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Choose a counselor" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {counselors.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.full_name} ({c.assigned_students_count} students)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Notes (Optional)</Label>
                            <Textarea
                                value={assignForm.notes}
                                onChange={(e) => setAssignForm({...assignForm, notes: e.target.value})}
                                className="bg-background border-border text-foreground min-h-[80px]"
                                placeholder="Any specific notes about this assignment..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssign}
                            disabled={saving || !assignForm.counselor_id}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Counselor'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CounselorsPage;
