import React, { useState } from 'react';
import { Button } from '../../components/buttons/Button';
import { formatCurrency } from '../../lib/currencyFormat';
import { ErrorPersistenceClass } from './paymentIdempotency';
import { formatPaymentAge } from './paymentAge';

export interface UnverifiedPaymentNoticeProps {
  amount: number;
  currency: string;
  studentName: string;
  persistenceClass?: ErrorPersistenceClass;
  dispatchedAt?: number;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export const UnverifiedPaymentNotice: React.FC<UnverifiedPaymentNoticeProps> = ({
  amount, currency, studentName, persistenceClass = 'AMBIGUOUS_OUTCOME',
  dispatchedAt, onRetry, onDismiss, isRetrying = false,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const formatted = formatCurrency(amount, true, currency);
  const isAlreadyPersisted = persistenceClass === 'ALREADY_PERSISTED';
  const ageInfo = formatPaymentAge(dispatchedAt || Date.now());

  return (
    <div style={containerStyle} role="alert" aria-live="assertive">
      <div style={titleStyle}>
        {isAlreadyPersisted ? '✓ Payment Recorded in Sheet (Completion Interrupted)' : '⚠️ Ambiguous Payment Status (Network Timeout)'}
      </div>
      <p style={descStyle}>
        {isAlreadyPersisted ? (
          <>A payment of <strong>{formatted}</strong> for <strong>{studentName}</strong> was already inserted into Google Sheets. Durable completion persistence failed (<code>DURABLE_PERSIST_FAILED</code>). <strong>Do not re-dispatch.</strong></>
        ) : (
          <>A payment of <strong>{formatted}</strong> for <strong>{studentName}</strong> was dispatched {ageInfo.formatted}, but server confirmation was not received. It <strong>may or may not</strong> be recorded in Google Sheets.</>
        )}
      </p>
      {ageInfo.isOld && !isAlreadyPersisted && (
        <div style={oldAgeNoticeStyle}>
          ⚠️ This attempt was dispatched <strong>{ageInfo.formatted}</strong>. Server-side outcome remains unconfirmed. Before re-dispatching, inspect Google Sheets manually, as server intent may have expired or been evicted.
        </div>
      )}
      <div style={isAlreadyPersisted ? noticeSuccessStyle : noticeDetailStyle}>
        {isAlreadyPersisted ? (
          <>This transaction is already committed to Google Sheets. Re-submitting or re-dispatching will append a duplicate row. Clear this alert once verified.</>
        ) : (
          <><strong>Re-dispatch is a write operation, not a verification query.</strong> If backend intent was lost, re-dispatching will append a duplicate row. <strong>Dismissal only removes local tracking</strong>; it does not cancel or reverse any server transaction.</>
        )}
      </div>
      {!isAlreadyPersisted && (
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ cursor: 'pointer', marginTop: '2px' }}
          />
          <span>
            I have checked the Google Sheet payment ledger, understand that dismissal only removes local browser tracking and does not cancel server transactions, and accept duplicate risks.
          </span>
        </label>
      )}
      <div style={btnRowStyle}>
        {isAlreadyPersisted ? (
          <Button variant="primary" size="sm" type="button" onClick={onDismiss}>
            Acknowledge &amp; Clear Alert
          </Button>
        ) : (
          <>
            <Button variant="primary" size="sm" type="button" onClick={onRetry} isLoading={isRetrying}>
              Re-dispatch Original Request (Same Key)
            </Button>
            <Button variant="danger" size="sm" type="button" onClick={onDismiss} disabled={!acknowledged || isRetrying}>
              Dismiss Local Alert (Tracking Only)
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  padding: '12px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a',
  borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '8px',
};
const titleStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#b45309' };
const descStyle: React.CSSProperties = { margin: 0, fontSize: 'var(--font-size-xs)', color: '#78350f', lineHeight: 1.4 };
const oldAgeNoticeStyle: React.CSSProperties = {
  fontSize: '11px', color: '#7c2d12', backgroundColor: '#ffedd5', padding: '6px 8px', borderRadius: 'var(--radius-sm)', lineHeight: 1.4, border: '1px solid #fed7aa',
};
const noticeDetailStyle: React.CSSProperties = {
  fontSize: '11px', color: '#92400e', backgroundColor: '#fef3c7', padding: '6px 8px', borderRadius: 'var(--radius-sm)', lineHeight: 1.4,
};
const noticeSuccessStyle: React.CSSProperties = {
  fontSize: '11px', color: '#065f46', backgroundColor: '#ecfdf5', padding: '6px 8px', borderRadius: 'var(--radius-sm)', lineHeight: 1.4, border: '1px solid #a7f3d0',
};
const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#92400e', cursor: 'pointer', marginTop: '4px',
};
const btnRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' };
