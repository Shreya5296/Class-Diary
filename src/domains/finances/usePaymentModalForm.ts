import { useState, useEffect } from 'react';
import { Package } from '../packages/packageTypes';
import { toInputDateFormat } from '../../lib/dateFormat';
import { PaymentFormValues, resolveStudentPackageCurrency } from './paymentFormValidation';
import {
  generatePaymentIdempotencyKey,
  getPendingPayment,
  getPendingPaymentForStudent,
  subscribePendingPayments,
  PendingPayment,
} from './paymentIdempotency';

export function usePaymentModalForm(isOpen: boolean, packages: Package[], adminId?: string) {
  const [values, setValues] = useState<PaymentFormValues>({
    student_id: '', payment_date: toInputDateFormat(), amount: '', currency: 'INR', in_inr: '',
  });
  const [idempKey, setIdempKey] = useState<string>(() => generatePaymentIdempotencyKey());
  const [currentPending, setCurrentPending] = useState<PendingPayment | null>(null);

  const syncStateFromStorage = () => {
    if (!isOpen) return;
    if (values.student_id) {
      const pendingForStudent = getPendingPaymentForStudent(values.student_id, adminId);
      if (pendingForStudent) {
        setValues({
          student_id: pendingForStudent.student_id, payment_date: pendingForStudent.payment_date,
          amount: String(pendingForStudent.amount), currency: pendingForStudent.currency,
          in_inr: pendingForStudent.in_inr ? String(pendingForStudent.in_inr) : '',
        });
        setIdempKey(pendingForStudent.idempotency_key);
        setCurrentPending(pendingForStudent);
        return;
      }
    }
    const anyPending = getPendingPayment(adminId);
    if (anyPending && !values.student_id) {
      setValues({
        student_id: anyPending.student_id, payment_date: anyPending.payment_date,
        amount: String(anyPending.amount), currency: anyPending.currency,
        in_inr: anyPending.in_inr ? String(anyPending.in_inr) : '',
      });
      setIdempKey(anyPending.idempotency_key);
      setCurrentPending(anyPending);
    } else if (!anyPending && currentPending) {
      setCurrentPending(null);
      setIdempKey(generatePaymentIdempotencyKey());
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    syncStateFromStorage();
    return subscribePendingPayments(() => syncStateFromStorage());
  }, [isOpen, adminId]);

  const handleStudentChange = (stuId: string) => {
    const studentPending = getPendingPaymentForStudent(stuId, adminId);
    if (studentPending) {
      setValues({
        student_id: studentPending.student_id, payment_date: studentPending.payment_date,
        amount: String(studentPending.amount), currency: studentPending.currency,
        in_inr: studentPending.in_inr ? String(studentPending.in_inr) : '',
      });
      setIdempKey(studentPending.idempotency_key);
      setCurrentPending(studentPending);
    } else {
      const cur = resolveStudentPackageCurrency(stuId, packages);
      setValues((prev) => ({ ...prev, student_id: stuId, currency: cur, in_inr: cur === 'INR' ? '' : prev.in_inr }));
      if (currentPending) {
        setIdempKey(generatePaymentIdempotencyKey());
        setCurrentPending(null);
      }
    }
  };

  const handleDismissPending = () => {
    setCurrentPending(null);
    setIdempKey(generatePaymentIdempotencyKey());
    setValues({ student_id: '', payment_date: toInputDateFormat(), amount: '', currency: 'INR', in_inr: '' });
  };

  return {
    values, setValues, idempKey, currentPending, setCurrentPending,
    handleStudentChange, handleDismissPending,
  };
}
