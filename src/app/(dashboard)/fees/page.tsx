import { Card } from '@/components/ui/card';
import { FeeStructureForm } from '@/components/fees/fee-structure-form';
import { FeeStructureTable } from '@/components/fees/fee-structure-table';
import { requireOwner } from '@/lib/auth';
import { getClasses, getFeeStructures } from '@/lib/data';
import type { FeeStructureSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  await requireOwner();
  const [classes, feeStructures] = await Promise.all([
    getClasses(),
    getFeeStructures(),
  ]);

  return (
    <div className="grid">
      <div id="fee-structures">
        <FeeStructureTable feeStructures={feeStructures} classes={classes} />
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
