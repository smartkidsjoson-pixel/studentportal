'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { updateFeeStructureAction, deleteFeeStructureAction } from '@/lib/actions';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { FeeStructureSummary, ClassSummary, AcademicTerm } from '@/lib/types';

const initialState = {} as { error?: string; success?: string };

export function FeeStructureTable({ 
  feeStructures, 
  classes 
}: { 
  feeStructures: FeeStructureSummary[];
  classes: ClassSummary[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    class_id: '',
    academic_year: '',
    term: 'TERM_1' as AcademicTerm,
    expected_amount: '',
  });
  const [updateState, updateAction, updatePending] = useActionState(updateFeeStructureAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteFeeStructureAction, initialState);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleEdit = (structure: FeeStructureSummary) => {
    setEditingId(structure.id);
    setEditData({
      class_id: structure.class_id,
      academic_year: structure.academic_year,
      term: structure.term,
      expected_amount: String(structure.expected_amount),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({
      class_id: '',
      academic_year: '',
      term: 'TERM_1',
      expected_amount: '',
    });
  };

  const handleSaveEdit = async () => {
    const formData = new FormData();
    formData.append('fee_structure_id', editingId!);
    formData.append('class_id', editData.class_id);
    formData.append('academic_year', editData.academic_year);
    formData.append('term', editData.term);
    formData.append('expected_amount', editData.expected_amount);
    await updateAction(formData);
    if (!updateState.error) {
      setEditingId(null);
    }
  };

  const handleConfirmDelete = (structureId: string) => {
    setDeleteConfirm(structureId);
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleExecuteDelete = async (structureId: string) => {
    const formData = new FormData();
    formData.append('fee_structure_id', structureId);
    await deleteAction(formData);
    setDeleteConfirm(null);
  };

  return (
    <Card title="Fee structure registry" description="Manage expected fees by class, year and term.">
      {feeStructures?.length ? (
        <div>
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
                  <th style={{ width: '120px' }}>Actions</th>
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
                    <td>
                      {deleteConfirm === structure.id ? (
                        <>
                          <button
                            onClick={() => handleExecuteDelete(structure.id)}
                            disabled={deletePending}
                            style={{ padding: '0.25rem 0.5rem', marginRight: '0.25rem', background: '#d32f2f' }}
                          >
                            {deletePending ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            disabled={deletePending}
                            style={{ padding: '0.25rem 0.5rem' }}
                            className="secondary"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(structure)}
                            style={{ padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}
                            className="secondary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(structure.id)}
                            style={{ padding: '0.25rem 0.5rem' }}
                            className="secondary"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Modal */}
          {editingId && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}>
                <h3>Edit Fee Structure</h3>
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Class</label>
                  <select
                    value={editData.class_id}
                    onChange={(e) => setEditData(prev => ({ ...prev, class_id: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                  >
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>

                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Academic Year</label>
                  <input
                    type="text"
                    value={editData.academic_year}
                    onChange={(e) => setEditData(prev => ({ ...prev, academic_year: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                  />

                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Term</label>
                  <select
                    value={editData.term}
                    onChange={(e) => setEditData(prev => ({ ...prev, term: e.target.value as any }))}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                  >
                    <option value="TERM_1">TERM 1</option>
                    <option value="TERM_2">TERM 2</option>
                    <option value="TERM_3">TERM 3</option>
                  </select>

                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Expected Amount</label>
                  <input
                    type="number"
                    value={editData.expected_amount}
                    onChange={(e) => setEditData(prev => ({ ...prev, expected_amount: e.target.value }))}
                    min="0"
                    step="0.01"
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                  />
                </div>

                {updateState?.error && <p className="error" style={{ marginBottom: '1rem' }}>{updateState.error}</p>}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleCancelEdit}
                    disabled={updatePending}
                    className="secondary"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updatePending}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {updatePending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {updateState?.success && <p className="success" style={{ marginTop: '0.5rem' }}>{updateState.success}</p>}
          {deleteState?.error && <p className="error" style={{ marginTop: '0.5rem' }}>{deleteState.error}</p>}
          {deleteState?.success && <p className="success" style={{ marginTop: '0.5rem' }}>{deleteState.success}</p>}
        </div>
      ) : (
        <p className="muted">No fee structures defined yet. Create one to begin tracking student balances.</p>
      )}
    </Card>
  );
}
