import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
    DialogFooter,
    DialogDescription,
} from '../components/ui/dialog';
import {
    Users,
    UserPlus,
    Loader2,
    MapPin,
    Mail,
    Phone,
    RefreshCw,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const OpenPoolPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claimDialogOpen, setClaimDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [claiming, setClaiming] = useState(false);

    const fetchOpenPool = async () => {
        try {
            setLoading(true);
            const response = await studentsAPI.getOpenPool();
            setStudents(response.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch open pool students',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOpenPool();
    }, []);

    const handleClaimClick = (student) => {
        setSelectedStudent(student);
        setClaimDialogOpen(true);
    };

    const handleClaim = async () => {
        if (!selectedStudent) return;
        
        setClaiming(true);
        try {
            await studentsAPI.claim(selectedStudent.id);
            toast({
                title: 'Success',
                description: `You have claimed ${selectedStudent.full_name}!`,
            });
            setClaimDialogOpen(false);
            setSelectedStudent(null);
            fetchOpenPool();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to claim student',
                variant: 'destructive',
            });
        } finally {
            setClaiming(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const isMentor = ['junior_mentor', 'senior_mentor', 'subjunior_mentor'].includes(user?.role);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Open Pool</h1>
                    <p className="text-slate-400 mt-1">
                        Unassigned students available for claiming
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchOpenPool}
                    className="border-primary/30 hover:bg-primary/10"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Card */}
            <Card className="bg-obsidian-light border-slate-800">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                            <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Available Students</p>
                            <p className="text-2xl font-bold text-white">{students.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Students Table */}
            <Card className="bg-obsidian-light border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">Available Students</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gold" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">No students in open pool</p>
                            <p className="text-slate-500 text-sm mt-1">
                                All students are currently assigned to mentors
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-800">
                                        <TableHead className="text-slate-400">Student</TableHead>
                                        <TableHead className="text-slate-400">Contact</TableHead>
                                        <TableHead className="text-slate-400">Country</TableHead>
                                        <TableHead className="text-slate-400">Level</TableHead>
                                        <TableHead className="text-slate-400">Net Deposit</TableHead>
                                        <TableHead className="text-slate-400">Added</TableHead>
                                        {isMentor && (
                                            <TableHead className="text-slate-400 text-right">Action</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow key={student.id} className="border-slate-800">
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-white">{student.full_name}</p>
                                                    <p className="text-xs text-slate-500">{student.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                                                        <Mail className="h-3 w-3" />
                                                        {student.email}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                                                        <Phone className="h-3 w-3" />
                                                        {student.phone}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-slate-300">
                                                    <MapPin className="h-3 w-3" />
                                                    {student.country}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-slate-600 text-slate-300">
                                                    {student.student_level.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-300">
                                                {formatCurrency(student.net_deposit_usd || 0)}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">
                                                {formatDate(student.created_date)}
                                            </TableCell>
                                            {isMentor && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleClaimClick(student)}
                                                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                                        data-testid={`claim-btn-${student.id}`}
                                                    >
                                                        <UserPlus className="h-4 w-4 mr-1" />
                                                        Claim
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Claim Confirmation Dialog */}
            <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                <DialogContent className="bg-obsidian-light border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-white">Claim Student</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Are you sure you want to claim this student?
                        </DialogDescription>
                    </DialogHeader>
                    {selectedStudent && (
                        <div className="py-2">
                            <div className="bg-obsidian p-3 rounded-lg space-y-1">
                                <p className="text-white font-medium">{selectedStudent.full_name}</p>
                                <p className="text-slate-400 text-sm">{selectedStudent.email}</p>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                                        {selectedStudent.student_level.replace('_', ' ')}
                                    </Badge>
                                    <span className="text-primary font-medium">
                                        {formatCurrency(selectedStudent.net_deposit_usd || 0)}
                                    </span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm mt-2">
                                This student will be assigned to you as their primary mentor.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setClaimDialogOpen(false)}
                            className="border-slate-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClaim}
                            disabled={claiming}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            data-testid="confirm-claim-btn"
                        >
                            {claiming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Confirm Claim
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OpenPoolPage;
