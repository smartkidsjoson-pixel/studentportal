import Link from 'next/link';

import { getFeeStatementData } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';

export default async function FeeStatementPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const data = await getFeeStatementData(studentId);

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link href="/reports">Back to reports</Link>
      </div>
      <h1>Fee Statement</h1>
      <p><strong>Name:</strong> {data.student.full_name}</p>
      <p><strong>Admission Number:</strong> {data.student.admission_number}</p>
      <p><strong>Class:</strong> {data.student.class_name ?? 'Unassigned'}</p>
      <h2>Fee Balances</h2>
      <table>
        <thead>
          <tr><th>Session</th><th>Total Fee</th><th>Paid</th><th>Balance</th></tr>
        </thead>
        <tbody>
          {data.ledgers.map((ledger) => (
            <tr key={ledger.ledger_id}>
              <td>{ledger.session_label}</td>
              <td>{formatCurrency(ledger.total_fee)}</td>
              <td>{formatCurrency(ledger.amount_paid)}</td>
              <td>{formatCurrency(ledger.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: '1.5rem' }}>Payment History</h2>
      <table>
        <thead>
          <tr><th>Date</th><th>Session</th><th>Method</th><th>Recorded By</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {data.payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.payment_date}</td>
              <td>{payment.session_label}</td>
              <td>{payment.payment_method}</td>
              <td>{payment.recorded_by_name ?? 'N/A'}</td>
              <td>{formatCurrency(payment.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
