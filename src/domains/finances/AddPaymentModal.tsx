import React, { useState, useEffect } from 'react';
import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { Student } from '../students/studentTypes';
import { fetchStudents } from '../students/studentApi';
import { recordPayment } from '../payments/paymentApi';
import { formatCurrency } from '../../lib/currencyFormat';
import { Button } from '../../components/buttons/Button';
import { PaymentFormErrors, validatePaymentForm } from './paymentFormValidation';
import { PaymentFormFields } from './PaymentFormFields';
import { checkOverpayment } from './overpaymentCheck';
import { savePendingPayment, removePendingPayment, classifyPaymentError, PendingPayment } from './paymentIdempotency';
import { getAdminScope } from './paymentAdminScope';
import { useAuth } from '../../auth/AuthProvider';
import { invalidateAppData } from '../../context/AppDataContext';
import { UnverifiedPaymentNotice } from './UnverifiedPaymentNotice';
import { usePaymentModalForm } from './usePaymentModalForm';
import { backdropStyle, dialogStyle, headerStyle, closeButtonStyle, serverErrorStyle, actionRowStyle } from './paymentModalStyles';

export interface AddPaymentModalProps {
  isOpen: boolean;
  token?: string | null;
  packages: Package[];
  payments?: Payment[];
  onClose: () => void;
  onSuccess: (message: string) => Promise<void>;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen, token, packages, payments = [], onClose, onSuccess,
}) => {
  const { user } = useAuth();
  const adminId = getAdminScope(user?.email);
  const [students, setStudents] = useState<Student[]>([]);
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [overpaymentWarning, setOverpaymentWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    values, setValues, idempKey, currentPending, setCurrentPending,
    handleStudentChange, handleDismissPending,
  } = usePaymentModalForm(isOpen, packages, adminId);

  useEffect(() => {
    if (isOpen) fetchStudents({}, token).then((data) => setStudents(data)).catch(() => {});
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleExecuteSubmit = async (confirmedOverpay = false) => {
    setServerError(null);
    const { isValid, errors: valErrors } = validatePaymentForm(values);
    if (!isValid) { setErrors(valErrors); return; }

    const numAmount = Number(values.amount);
    if (!confirmedOverpay && values.student_id && numAmount > 0) {
      const overpay = checkOverpayment(numAmount, values.currency, values.student_id, packages, payments);
      if (overpay.isOverpayment) { setOverpaymentWarning(overpay.warningMessage); return; }
    }
    setOverpaymentWarning(null);

    const selStudent = students.find((s) => s.student_id === values.student_id);
    const studentName = selStudent ? selStudent.student_name : values.student_id;
    const isForeign = values.currency.toUpperCase() !== 'INR';
    const numInInr = isForeign ? Number(values.in_inr) : numAmount;

    setIsSubmitting(true);
    try {
      await recordPayment({
        student_id: values.student_id, student_name: studentName,
        amount: numAmount, currency: values.currency.toUpperCase(),
        in_inr: numInInr, payment_date: values.payment_date,
        payment_method: 'RECORDED', idempotency_key: idempKey,
      }, token);
      invalidateAppData('all');
      removePendingPayment(idempKey, adminId);
      setCurrentPending(null);
      const formattedAmt = formatCurrency(numAmount, true, values.currency.toUpperCase());
      await onSuccess(`Payment of ${formattedAmt} for ${studentName} recorded successfully.`);
    } catch (err: unknown) {
      const pClass = classifyPaymentError(err);
      if (pClass !== 'DEFINITELY_NOT_PERSISTED') {
        const pendingObj: PendingPayment = {
          idempotency_key: idempKey, student_id: values.student_id, student_name: studentName,
          amount: numAmount, currency: values.currency.toUpperCase(), in_inr: numInInr,
          payment_date: values.payment_date, dispatched_at: currentPending?.dispatched_at || Date.now(),
          persistence_class: pClass, last_error: (err as Error).message, admin_id: adminId,
        };
        savePendingPayment(pendingObj, adminId);
        setCurrentPending(pendingObj);
      }
      setServerError((err as Error).message || 'Payment submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDismiss = () => {
    removePendingPayment(idempKey, adminId);
    handleDismissPending();
    setServerError(null);
  };

  const isFrozen = Boolean(currentPending);
  const selStudentName = students.find((s) => s.student_id === values.student_id)?.student_name || values.student_id;

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-labelledby="add-payment-title">
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h3 id="add-payment-title" style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>Record Student Payment</h3>
          <button type="button" onClick={onClose} disabled={isSubmitting} style={closeButtonStyle} aria-label="Close">✕</button>
        </div>
        {isFrozen && currentPending && (
          <UnverifiedPaymentNotice
            amount={Number(values.amount) || 0} currency={values.currency} studentName={selStudentName}
            persistenceClass={currentPending.persistence_class} dispatchedAt={currentPending.dispatched_at}
            onRetry={() => handleExecuteSubmit(true)} onDismiss={onDismiss} isRetrying={isSubmitting}
          />
        )}
        {serverError && !isFrozen && <div style={serverErrorStyle}>⚠️ {serverError}</div>}
        {overpaymentWarning && !isFrozen && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#92400e', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ fontWeight: 600 }}>⚠️ {overpaymentWarning}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button size="sm" variant="primary" type="button" onClick={() => handleExecuteSubmit(true)} disabled={isSubmitting}>Confirm</Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => setOverpaymentWarning(null)} disabled={isSubmitting}>Go back</Button>
            </div>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleExecuteSubmit(false); }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <PaymentFormFields
            values={values} errors={errors} students={students}
            onStudentChange={(id) => { handleStudentChange(id); setOverpaymentWarning(null); setErrors((p) => ({ ...p, student_id: undefined })); }}
            onValuesChange={(vals) => { setValues(vals); setOverpaymentWarning(null); }} disabled={isSubmitting || isFrozen}
          />
          {!isFrozen && (
            <div style={actionRowStyle}>
              <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>Save Payment</Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
