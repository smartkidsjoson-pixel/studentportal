'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';

import {
  deleteFeePaymentAction,
  recordFeePaymentAction,
  updateFeePaymentAction,
} from '@/lib/actions';
import type {
  FeePaymentHistoryItem,
  StudentFeeAccountSummary,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const initialState = {} as { error?: string; success?: string };

function feeAccountLabel(account: StudentFeeAccountSummary) {
  const termLabel = account.term ? account.term.replace('_', ' ') : 'Unknown term';
  return `${account.academic_year ?? 'Year unknown'} • ${termLabel} • ${account.class_name ?? 'Class'}`;
}

export function StudentFeeSection({
  studentId,
  accounts,
  payments,
}: {
  studentId: string;
  accounts: StudentFeeAccountSummary[];
  payments: FeePaymentHistoryItem[];
}) {
  const router = useRouter();
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [recordState, recordAction, recordPending] = useActionState(recordFeePaymentAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateFeePaymentAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteFeePaymentAction, initialState);
  const recordFormRef = useRef<HTMLFormElement>(null);

  const selectedEditPayment = useMemo(
    () => payments.find((payment) => payment.id === editingPaymentId) ?? null,
    [editingPaymentId, payments],
  );

  useEffect(() => {
    console.log('StudentFeeSection loaded with data:', { studentId, accounts, payments });
    console.log('Accounts count:', accounts.length);
    accounts.forEach((acc, idx) => {
      console.log(`Account ${idx}:`, {
        id: acc.id,
        expected_amount: acc.expected_amount,
        total_paid: acc.total_paid,
        balance: acc.balance,
        academic_year: acc.academic_year,
        term: acc.term,
      });
    });
  }, [studentId, accounts, payments]);

  useEffect(() => {
    if (recordState.success) {
      recordFormRef.current?.reset();
      setShowRecordForm(false);
      router.refresh(); // Ensure UI updates immediately
    }
    if (recordState.error) {
      console.error('Payment recording error:', recordState.error);
    }
  }, [recordState.success, recordState.error, router]);

  useEffect(() => {
    if (updateState.success) {
      setEditingPaymentId(null);
      router.refresh(); // Ensure UI updates immediately after payment update
    }
  }, [updateState.success, router]);

  useEffect(() => {
    if (deleteState.success) {
      router.refresh(); // Ensure UI updates immediately after payment deletion
    }
  }, [deleteState.success, router]);

  const termStats = useMemo(() => {
    // Group accounts and payments by term
    const termGroups: Record<string, {
      accounts: StudentFeeAccountSummary[];
      payments: FeePaymentHistoryItem[];
      expected: number;
      collected: number;
      balance: number;
    }> = {};

    // Initialize with accounts
    accounts.forEach(account => {
      const termKey = `${account.academic_year}-${account.term}`;
      if (!termGroups[termKey]) {
        termGroups[termKey] = {
          accounts: [],
          payments: [],
          expected: 0,
          collected: 0,
          balance: 0,
        };
      }
      termGroups[termKey].accounts.push(account);
      termGroups[termKey].expected += Number(account.expected_amount ?? 0);
    });

    // Add payments to terms
    payments.forEach(payment => {
      const account = accounts.find(a => a.id === payment.student_fee_account_id);
      if (account) {
        const termKey = `${account.academic_year}-${account.term}`;
        if (termGroups[termKey]) {
          termGroups[termKey].payments.push(payment);
          termGroups[termKey].collected += Number(payment.amount ?? 0);
        }
      }
    });

    // Calculate balances
    Object.values(termGroups).forEach(group => {
      group.balance = group.expected - group.collected;
    });

    return termGroups;
  }, [accounts, payments]);

  const overallTotals = useMemo(() => {
    const totalExpected = Object.values(termStats).reduce((sum, term) => sum + term.expected, 0);
    const totalCollected = Object.values(termStats).reduce((sum, term) => sum + term.collected, 0);
    const totalBalance = totalExpected - totalCollected;
    return { expected: totalExpected, collected: totalCollected, balance: totalBalance };
  }, [termStats]);

  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2>Fees</h2>
        <p>Review the student fee account, payment status and record new payments.</p>
      </div>

      {/* Overall Summary */}
      <div className="grid stats" style={{ marginBottom: '1rem' }}>
        <div className="card small-card">
          <h3>Total Expected</h3>
          <div className="stat-value">{formatCurrency(overallTotals.expected)}</div>
          <p className="muted">Across all terms</p>
        </div>
        <div className="card small-card">
          <h3>Total Collected</h3>
          <div className="stat-value">{formatCurrency(overallTotals.collected)}</div>
          <p className="muted">Across all terms</p>
        </div>
        <div className="card small-card">
          <h3>Total Balance</h3>
          <div className="stat-value">{formatCurrency(overallTotals.balance)}</div>
          <p className="muted">Remaining across all terms</p>
        </div>
      </div>

      {/* Term-wise breakdown */}
      <div style={{ marginBottom: '1rem' }}>
        <h3>Term Breakdown</h3>
        {Object.entries(termStats).map(([termKey, termData]) => (
          <div key={termKey} className="card" style={{ marginBottom: '0.5rem', padding: '1rem' }}>
            <div className="grid stats">
              <div className="card small-card">
                <h4>{termKey.replace('-', ' • ')}</h4>
                <div className="stat-value">{formatCurrency(termData.expected)}</div>
                <p className="muted">Expected</p>
              </div>
              <div className="card small-card">
                <h4>&nbsp;</h4>
                <div className="stat-value">{formatCurrency(termData.collected)}</div>
                <p className="muted">Collected</p>
              </div>
              <div className="card small-card">
                <h4>&nbsp;</h4>
                <div className="stat-value">{formatCurrency(termData.balance)}</div>
                <p className="muted">Balance</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="secondary" onClick={() => setShowRecordForm((value) => !value)}>
          {showRecordForm ? 'Hide payment form' : 'Record payment'}
        </button>
      </div>

      {showRecordForm ? (
        accounts.length ? (
          <form ref={recordFormRef} action={recordAction} className="card" style={{ padding: '1rem' }}>
            <input type="hidden" name="student_id" value={studentId} />
            <div className="form-grid">
              <div>
                <label className="label" htmlFor="fee-account">Fee account</label>
                <select id="fee-account" name="student_fee_account_id" defaultValue={accounts[0]?.id ?? ''} required>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {feeAccountLabel(account)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="payment-amount">Amount</label>
                <input id="payment-amount" name="amount" type="number" min="1" step="0.01" required />
              </div>
              <div>
                <label className="label" htmlFor="receipt-number">Receipt number</label>
                <input id="receipt-number" name="receipt_number" required />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" disabled={recordPending}>{recordPending ? 'Saving...' : 'Save payment'}</button>
              {recordState.error ? (
                <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                  ❌ {recordState.error}
                </span>
              ) : null}
              {recordState.success ? <span style={{ color: '#388e3c', fontWeight: 'bold' }}>✓ {recordState.success}</span> : null}
            </div>
          </form>
        ) : (
          <div className="card" style={{ padding: '1rem' }}>
            <p className="muted">A fee account must exist before a payment can be recorded.</p>
          </div>
        )
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Term</th>
              <th>Class</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length ? (
              payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td>{formatCurrency(Number(payment.amount))}</td>
                  <td>{payment.receipt_number}</td>
                  <td>{`${payment.academic_year} ${payment.term.replace('_', ' ')}`}</td>
                  <td>{payment.class_name ?? 'Unknown'}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => setEditingPaymentId(payment.id)}>
                      Edit
                    </button>
                    <form action={deleteAction} style={{ display: 'inline-block', marginLeft: '0.5rem' }}>
                      <input type="hidden" name="payment_id" value={payment.id} />
                      <input type="hidden" name="student_id" value={studentId} />
                      <button type="submit" className="danger" disabled={deletePending}>
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="muted">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPaymentId && selectedEditPayment ? (
        <form action={updateAction} className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
          <input type="hidden" name="payment_id" value={selectedEditPayment.id} />
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="student_fee_account_id" value={selectedEditPayment.student_fee_account_id} />
          <div className="form-grid">
            <div>
              <label className="label" htmlFor="edit-payment-amount">Amount</label>
              <input
                id="edit-payment-amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                defaultValue={selectedEditPayment.amount}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-receipt-number">Receipt number</label>
              <input
                id="edit-receipt-number"
                name="receipt_number"
                defaultValue={selectedEditPayment.receipt_number}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={updatePending}>{updatePending ? 'Saving...' : 'Update payment'}</button>
            <button type="button" className="secondary" onClick={() => setEditingPaymentId(null)}>
              Cancel
            </button>
            {updateState.error ? <span className="muted">{updateState.error}</span> : null}
            {updateState.success ? <span className="muted">{updateState.success}</span> : null}
          </div>
        </form>
      ) : null}

      {deleteState.error ? <p className="muted" style={{ marginTop: '1rem' }}>{deleteState.error}</p> : null}
      {deleteState.success ? <p className="muted" style={{ marginTop: '1rem' }}>{deleteState.success}</p> : null}
    </div>
  );
}
