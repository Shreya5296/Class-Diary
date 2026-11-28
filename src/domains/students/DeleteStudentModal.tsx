import React, { useState, useEffect } from 'react';
import { Student } from './studentTypes';
import { ClassSession } from '../classes/classTypes';
import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { fetchClasses } from '../classes/classApi';
import { fetchPackages } from '../packages/packageApi';
import { fetchPayments } from '../payments/paymentApi';
import { deleteStudent } from './studentApi';
import { invalidateAppData } from '../../context/AppDataContext';
import { Button } from '../../components/buttons/Button';
import { formatCurrency } from '../../lib/currencyFormat';

export interface DeleteStudentModalProps {
  isOpen: boolean;
  student: Student;
  token?: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const DeleteStudentModal: React.FC<DeleteStudentModalProps> = ({
  isOpen, student, token, onClose, onSuccess,
}) => {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentName = (student.student_name || student.full_name || '').trim();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setNameInput('');
    setError(null);
    Promise.all([
      fetchClasses(student.student_id, token).catch(() => []),
      fetchPackages(student.student_id, token).catch(() => []),
      fetchPayments(student.student_id, undefined, token).catch(() => []),
    ]).then(([cls, pkgs, pays]) => {
      setClasses(cls); setPackages(pkgs); setPayments(pays); setLoading(false);
    });
  }, [isOpen, student.student_id, token]);

  if (!isOpen) return null;

  const upcomingUnmarked = classes.filter((c) => {
    const s = String(c.session_status || c.status || '').toUpperCase(), a = String(c.attendance_status || '').toUpperCase();
    return s === 'SCHEDULED' && a !== 'PRESENT' && a !== 'ATTENDED';
  }).length;
  const pastMarked = classes.filter((c) => {
    const s = String(c.session_status || c.status || '').toUpperCase(), a = String(c.attendance_status || '').toUpperCase();
    return a === 'PRESENT' || a === 'ATTENDED' || s === 'COMPLETED';
  }).length;
  const cancelled = classes.filter((c) => {
    const s = String(c.session_status || c.status || '').toUpperCase(), a = String(c.attendance_status || '').toUpperCase();
    return s === 'CANCELLED' || a === 'CANCELLED';
  }).length;

  const totalPaymentsAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const payCurrency = payments[0]?.currency || 'INR';
  const isNameMatched = nameInput.trim() === studentName;

  const handleDelete = async () => {
    if (!isNameMatched || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteStudent(student.student_id, token);
      invalidateAppData('all');
      onSuccess(`Student ${studentName} and all associated records deleted successfully.`);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to delete student.');
      setIsDeleting(false);
    }
  };

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-labelledby="delete-student-dialog-title">
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="delete-student-dialog-title" style={{ margin: 0, color: '#dc2626', fontSize: '18px', fontWeight: 700 }}>
            Delete Student Record
          </h3>
          <button type="button" onClick={onClose} disabled={isDeleting} style={closeButtonStyle}>✕</button>
        </div>

        {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

        <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--color-text-main)' }}>
          Are you sure you want to delete <strong>{studentName}</strong> ({student.student_id})? This action cannot be undone.
        </p>

        <div style={breakdownBoxStyle}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Items to be permanently removed:</div>
          {loading ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading student records…</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <li>Student Profile: <strong>{studentName}</strong> ({student.student_id})</li>
              <li>
                <strong>{classes.length}</strong> scheduled classes ({upcomingUnmarked} upcoming unmarked / {pastMarked} past marked / {cancelled} cancelled)
              </li>
              <li><strong>{packages.length}</strong> package record{packages.length === 1 ? '' : 's'}</li>
              <li>
                <strong>{payments.length}</strong> payment record{payments.length === 1 ? '' : 's'} ({formatCurrency(totalPaymentsAmount, true, payCurrency)})
              </li>
            </ul>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Type <strong>{studentName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={`Type "${studentName}"`}
            disabled={isDeleting || loading}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={!isNameMatched || isDeleting || loading} isLoading={isDeleting}>
            Delete Student Forever
          </Button>
        </div>
      </div>
    </div>
  );
};

const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const dialogStyle: React.CSSProperties = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' };
const errorBannerStyle: React.CSSProperties = { padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px', marginBottom: '12px' };
const breakdownBoxStyle: React.CSSProperties = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', fontSize: '13px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' };
