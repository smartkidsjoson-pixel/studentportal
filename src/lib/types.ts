export type UserRole = 'OWNER' | 'TEACHER';
export type StudentStatus = 'active' | 'transferred' | 'graduated';
export type AcademicTerm = 'TERM_1' | 'TERM_2' | 'TERM_3';
export type FeeState = 'paid' | 'partial' | 'unpaid';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
};

export type ClassSummary = {
  id: string;
  name: string;
  section: string | null;
  level_order: number;
  teacher_count?: number;
  student_count?: number;
};

export type StudentDirectoryItem = {
  id: string;
  full_name: string;
  admission_number: string;
  parent_contact: string | null;
  status: StudentStatus;
  class_name: string | null;
  class_id: string | null;
};

export type DashboardStats = {
  totalStudents: number;
  totalFeesCollected: number;
  outstandingFees: number;
  topStudents: Array<{ studentId: string; fullName: string; averageScore: number; className: string | null }>;
  classDistribution: Array<{ className: string; studentCount: number }>;
};

export type FeeSummary = {
  ledger_id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  session_label: string;
  total_fee: number;
  amount_paid: number;
  balance: number;
  fee_state: FeeState;
};

export type MeritEntry = {
  student_id: string;
  full_name: string;
  admission_number: string;
  class_name: string | null;
  total_score: number;
  average_score: number;
  position: number;
};

export type SubjectPerformance = {
  subject_id: string;
  subject_name: string;
  average_score: number;
};

export type ReportCardData = {
  student: {
    id: string;
    full_name: string;
    admission_number: string;
    class_name: string | null;
    parent_contact: string | null;
  };
  marks: Array<{
    subject_name: string;
    term: AcademicTerm;
    score: number;
    max_score: number;
  }>;
  totals: Array<{
    term: AcademicTerm;
    total_score: number;
    average_score: number;
    position_in_class: number;
    overall_position: number;
  }>;
};

export type FeeStatementData = {
  student: {
    id: string;
    full_name: string;
    admission_number: string;
    class_name: string | null;
  };
  ledgers: Array<{
    ledger_id: string;
    session_label: string;
    total_fee: number;
    amount_paid: number;
    balance: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    session_label: string;
    recorded_by_name: string | null;
  }>;
};
