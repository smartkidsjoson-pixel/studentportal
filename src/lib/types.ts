export type UserRole = 'OWNER' | 'TEACHER';
export type StudentStatus = 'active' | 'transferred' | 'graduated' | 'inactive';
export type StudentGender = 'male' | 'female' | 'other';

export type StudentTransition = {
  id: string;
  student_id: string;
  old_status: StudentStatus | null;
  new_status: StudentStatus;
  transition_reason: string | null;
  transition_data: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
};

export type TransferStudentResult = {
  success: boolean;
  message: string;
  student_id: string | null;
};

export type DeleteStudentResult = {
  success: boolean;
  message: string;
  deleted_records: number;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
};

export type TeacherProfile = {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  assigned_classes?: string | null;
};

export type TeacherClassAssignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  class_name: string;
};

export type AcademicTerm = 'TERM_1' | 'TERM_2' | 'TERM_3';

export type ClassSummary = {
  id: string;
  name: string;
  capacity: number | null;
  level_order: number;
  teacher_count?: number;
  student_count?: number;
};

export type FeeStructureSummary = {
  id: string;
  class_id: string;
  class_name: string;
  academic_year: string;
  term: AcademicTerm;
  expected_amount: number;
  account_count: number;
  total_collected: number;
  total_outstanding: number;
};

export type StudentFeeAccountSummary = {
  id: string;
  student_id: string;
  fee_structure_id: string;
  academic_year: string;
  term: AcademicTerm;
  class_name: string | null;
  expected_amount: number;
  total_paid: number;
  balance: number;
  status: 'Cleared' | 'Partial' | 'Not Paid';
};

export type FeePaymentHistoryItem = {
  id: string;
  student_fee_account_id: string;
  student_id: string;
  amount: number;
  receipt_number: string;
  payment_date: string;
  recorded_by: string | null;
  academic_year: string;
  term: AcademicTerm;
  class_name: string | null;
};

export type FeeDashboardStats = {
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  studentsWithBalance: number;
  recentPayments: FeePaymentHistoryItem[];
};

export type StudentDirectoryItem = {
  id: string;
  full_name: string;
  admission_number: string;
  gender: StudentGender | null;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  alt_phone: string | null;
  home_address: string | null;
  status: StudentStatus;
  date_joined: string | null;
  notes: string | null;
  profile_photo_url: string | null;
  class_name: string | null;
  class_id: string | null;
  created_at: string | null;
  fee_expected: number;
  total_paid: number;
  balance: number;
  payment_status: 'Cleared' | 'Partial' | 'Not Paid' | null;
};

export type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalGraduated?: number;
  recentStudents: StudentDirectoryItem[];
  assignedClasses?: Array<{ id: string; name: string; studentCount: number }>;
  feeStats?: FeeDashboardStats;
};

export type PromotionHistoryItem = {
  id: string;
  from_class_name: string | null;
  to_class_name: string | null;
  promoted_by: string | null;
  promoted_at: string;
  notes: string | null;
};
