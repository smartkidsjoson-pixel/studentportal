'use client';

import { useRef, useState } from 'react';
import { deleteTeacherAction } from '@/lib/actions';
import type { TeacherProfile } from '@/lib/types';

export function TeacherDeleteConfirm({ teacher }: { teacher: TeacherProfile }) {
  const formRef = useRef<HTMLFormElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (modalRef.current) {
      modalRef.current.close();
    }
  };

  const handleCancel = () => {
    if (modalRef.current) {
      modalRef.current.close();
    }
  };

  const openModal = () => {
    if (modalRef.current) {
      setError(null);
      modalRef.current.showModal();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      await deleteTeacherAction(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete teacher');
      setIsPending(false);
    }
  };

  return (
    <>
      <button 
        onClick={openModal} 
        className="secondary" 
        style={{ color: '#e53e3e' }}
      >
        Delete
      </button>

      <dialog ref={modalRef} style={{ 
        padding: '2rem',
        borderRadius: '0.5rem',
        border: 'none',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '90%'
      }}>
        <form ref={formRef} onSubmit={handleSubmit} method="POST">
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#e53e3e' }}>
              Permanently delete teacher?
            </h3>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Are you sure you want to permanently delete <strong>{teacher.full_name}</strong>?
            </p>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              marginBottom: '1rem',
              color: '#666',
              fontSize: '0.9rem'
            }}>
              <li>✓ All class assignments will be removed</li>
              <li>✓ The teacher account will be deleted from the system</li>
              <li>✓ Student records and fees will be preserved</li>
              <li>✗ This action cannot be undone</li>
            </ul>
          </div>

          <input type="hidden" name="teacher_id" value={teacher.id} />

          <div style={{ 
            display: 'flex', 
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button 
              type="button"
              onClick={handleCancel}
              className="secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isPending}
              style={{ 
                backgroundColor: '#e53e3e',
                color: 'white'
              }}
            >
              {isPending ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>

          {error && (
            <div style={{ 
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fed7d7',
              borderRadius: '0.25rem',
              color: '#c53030'
            }}>
              {error}
            </div>
          )}
        </form>
      </dialog>
    </>
  );
}
