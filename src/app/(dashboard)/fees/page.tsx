import { Card } from '@/components/ui/card';
import { FeeStructureForm } from '@/components/fees/fee-structure-form';
import { requireOwner } from '@/lib/auth';
import { getClasses, getFeeDashboardStats, getFeeStructures } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import type { FeeStructureSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  await requireOwner();
  const [classes, feeStructures, feeStats] = await Promise.all([
    getClasses(),
    getFeeStructures(),
    getFeeDashboardStats(),
  ]);

  return (
    <div className="grid">
      <div className="grid stats">
        <div id="balances">
          <Card title="Total expected fees">
            <div className="stat-value">{formatCurrency(feeStats?.totalExpected ?? 0)}</div>
            <p className="muted">Planned fee revenue for active student fee accounts.</p>
          </Card>
        </div>

        <div id="payments">
          <Card title="Total collected">
            <div className="stat-value">{formatCurrency(feeStats?.totalCollected ?? 0)}</div>
            <p className="muted">Payments received from students so far.</p>
          </Card>
        </div>

        <div>
          <Card title="Total outstanding">
            <div className="stat-value">{formatCurrency(feeStats?.totalOutstanding ?? 0)}</div>
            <p className="muted">All unpaid balances across fee accounts.</p>
          </Card>
        </div>

        <div>
          <Card title="Students with balances">
            <div className="stat-value">{feeStats?.studentsWithBalance ?? 0}</div>
            <p className="muted">Students who still have amounts to pay.</p>
          </Card>
        </div>
      </div>

      <div id="fee-structures">
        <Card title="Fee structure registry" description="View expected fees by class, year and term.">
          {feeStructures?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Year</th>
                    <th>Term</th>
                    <th>Expected</th>
                    <th>Accounts</th>
                    <th>Collected</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(feeStructures ?? []).map((structure: FeeStructureSummary) => (
                    <tr key={structure.id}>
                      <td>{structure.class_name}</td>
                      <td>{structure.academic_year}</td>
                      <td>{structure.term.replace('_', ' ')}</td>
                      <td>{formatCurrency(Number(structure.expected_amount ?? 0))}</td>
                      <td>{structure.account_count}</td>
                      <td>{formatCurrency(Number(structure.total_collected ?? 0))}</td>
                      <td>{formatCurrency(Number(structure.total_outstanding ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No fee structures defined yet. Create one to begin tracking student balances.</p>
          )}
        </Card>
      </div>

      <FeeStructureForm classes={classes} />

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>Payment workflow</h2>
          <p>Fee structures are created here. To record payments, open a student profile from the Students directory and use the fee section.</p>
        </div>
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <a href="/students" className="secondary">Student directory</a>
          <a href="/students" className="secondary">Record payments</a>
        </div>
      </div>
    </div>
  );
}
