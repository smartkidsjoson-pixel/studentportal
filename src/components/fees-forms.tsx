'use client';

import { useActionState } from 'react';

import { createFeeLedgerAction, recordPaymentAction } from '@/lib/actions';
import type { FeeSummary, StudentDirectoryItem } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function FeeLedgerForm({ students }: { students: StudentDirectoryItem[] }) {
  const [state, formAction, pending] = useActionState(createFeeLedgerAction, initialState);

  return (
    <form action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Create Fee Ledger</h2>
        <p>Assign tuition expectations for a student and session.</p>
      </div>
      <div className="form-grid">
        <div className="wide">
          <label className="label" htmlFor="ledger-student">Student</label>
          <select id="ledger-student" name="student_id" defaultValue="" required>
            <option value="" disabled>Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.full_name} ({student.admission_number})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="session-label">Session</label>
          <input id="session-label" name="session_label" placeholder="2025/2026" required />
        </div>
        <div>
          <label className="label" htmlFor="total-fee">Total Fee</label>
          <input id="total-fee" name="total_fee" type="number" min="0" step="0.01" required />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Create ledger'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}

export function PaymentForm({ ledgers }: { ledgers: FeeSummary[] }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialState);

  return (
    <form action={formAction} className="card">
      <div className="section-header" style={{ marginBottom: '0.9rem' }}>
        <h2>Record Payment</h2>
        <p>Capture payment history and keep balances updated automatically.</p>
      </div>
      <div className="form-grid">
        <div className="wide">
          <label className="label" htmlFor="ledger-id">Fee Ledger</label>
          <select id="ledger-id" name="fee_ledger_id" defaultValue="" required>
            <option value="" disabled>Select ledger</option>
            {ledgers.map((ledger) => (
              <option key={ledger.ledger_id} value={ledger.ledger_id}>
                {ledger.student_name} - {ledger.session_label} ({ledger.admission_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payment-amount">Amount</label>
          <input id="payment-amount" name="amount" type="number" min="0" step="0.01" required />
        </div>
        <div>
          <label className="label" htmlFor="payment-date">Payment Date</label>
          <input id="payment-date" name="payment_date" type="date" required />
        </div>
        <div>
          <label className="label" htmlFor="payment-method">Method</label>
          <select id="payment-method" name="payment_method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="pos">POS</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Record payment'}</button>
        {state?.error ? <span className="muted">{state.error}</span> : null}
        {state?.success ? <span className="muted">{state.success}</span> : null}
      </div>
    </form>
  );
}
