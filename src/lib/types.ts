export type UserRole = 'OWNER' | 'TEACHER';
export type StudentStatus = 'active' | 'transferred' | 'graduated';
export type StudentGender = 'male' | 'female' | 'other';

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
};

export type TeacherClassAssignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  class_name: string;
};

export type ClassSummary = {
  id: string;
  name: string;
  section: string | null;
  level_order: number;
  capacity: number | null;
  teacher_count?: number;
  student_count?: number;
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
};

export type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  recentStudents: StudentDirectoryItem[];
  assignedClasses?: Array<{ id: string; name: string; studentCount: number }>;
};

export type PromotionHistoryItem = {
  id: string;
  from_class_name: string | null;
  to_class_name: string | null;
  promoted_by: string | null;
  promoted_at: string;
  notes: string | null;
};
