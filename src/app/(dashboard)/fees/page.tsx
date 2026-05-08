import { Card } from '@/components/ui/card';
import { FeeStructureForm } from '@/components/fees/fee-structure-form';
import { requireOwner } from '@/lib/auth';
import { getClasses, getFeeDashboardStats, getFeeStructures } from '@/lib/data';
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
        <Card title="Total expected fees">
          <div className="stat-value">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(feeStats?.totalExpected ?? 0)}</div>
          <p className="muted">Planned fee revenue for active student fee accounts.</p>
        </Card>
        <Card title="Total collected">
          <div className="stat-value">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(feeStats?.totalCollected ?? 0)}</div>
          <p className="muted">Payments received from students so far.</p>
        </Card>
        <Card title="Total outstanding">
          <div className="stat-value">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(feeStats?.totalOutstanding ?? 0)}</div>
          <p className="muted">All unpaid balances across fee accounts.</p>
        </Card>
        <Card title="Students with balances">
          <div className="stat-value">{feeStats?.studentsWithBalance ?? 0}</div>
          <p className="muted">Students who still have amounts to pay.</p>
        </Card>
      </div>

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
                    <td>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(structure.expected_amount)}</td>
                    <td>{structure.account_count}</td>
                    <td>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(structure.total_collected)}</td>
                    <td>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(structure.total_outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No fee structures defined yet. Create one to begin tracking student balances.</p>
        )}
      </Card>

      <FeeStructureForm classes={classes} />
    </div>
  );
}
