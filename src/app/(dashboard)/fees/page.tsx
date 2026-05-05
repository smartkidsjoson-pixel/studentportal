import { FeeLedgerForm, PaymentForm } from '@/components/fees-forms';
import { StatusPill } from '@/components/ui/status-pill';
import { getFeeSummaries, getStudents } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';

export default async function FeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [feeSummaries, students] = await Promise.all([
    getFeeSummaries(params.status),
    getStudents(),
  ]);

  return (
    <div className="grid">
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Fee Management</h2>
          <p>Monitor payments, arrears, and student balances with simple operational filters.</p>
        </div>
        <form action="/fees" className="inline-filters" style={{ gridTemplateColumns: '1fr auto' }}>
          <select name="status" defaultValue={params.status ?? ''}>
            <option value="">All payment states</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <button type="submit">Apply Filter</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No.</th>
                <th>Class</th>
                <th>Session</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {feeSummaries.map((item) => (
                <tr key={item.ledger_id}>
                  <td>{item.student_name}</td>
                  <td>{item.admission_number}</td>
                  <td>{item.class_name ?? 'Unassigned'}</td>
                  <td>{item.session_label}</td>
                  <td>{formatCurrency(item.total_fee)}</td>
                  <td>{formatCurrency(item.amount_paid)}</td>
                  <td>{formatCurrency(item.balance)}</td>
                  <td><StatusPill value={item.fee_state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="layout-two">
        <FeeLedgerForm students={students} />
        <PaymentForm ledgers={feeSummaries} />
      </div>
    </div>
  );
}
