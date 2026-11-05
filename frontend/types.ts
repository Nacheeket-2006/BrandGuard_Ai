export type Severity = 'high' | 'medium' | 'low';
export type Role = 'creator' | 'manager' | 'admin';
export interface Identity {
  id: string;
  role: Role;
  name?: string;
  demo?: boolean;
}
export interface Rule {
  pattern: string;
  replacement: string;
  allowed?: string;
  severity: Severity;
  explanation: string;
}
export interface Guideline {
  id: string;
  title: string;
  category: string;
  citation: string;
  content: string;
  active: boolean;
  rules: Rule[];
  colors?: string[];
  logoPositions?: string[];
}
export interface Issue {
  id: string;
  startIndex: number;
  endIndex: number;
  flaggedText: string;
  ruleCategory: string;
  ruleCitation: string;
  explanation: string;
  suggestedRewrite: string;
  severity: Severity;
  target: 'text' | 'visual';
  status: 'open' | 'accepted' | 'rejected';
}
export interface Visual {
  colors: string[];
  logoPosition: string;
  image: string;
}
export interface Draft {
  title: string;
  channel: string;
  text: string;
  visual: Visual;
}
export interface AuditEvent {
  id: string;
  at: number;
  actor: string;
  role: string;
  action: string;
  detail: string;
  version: number;
}
export interface Review extends Draft {
  id: string;
  original: string;
  originalVisual: Visual;
  owner: string;
  createdAt: number;
  version: number;
  status: 'draft' | 'pending' | 'approved' | 'returned';
  issues: Issue[];
  score: number;
  mode: string;
  visualCoverage: string;
  context: Guideline[];
  events: AuditEvent[];
  comment: string;
  policyHash: string;
}
export type Action = 'accept' | 'reject' | 'reopen' | 'submit' | 'approve' | 'return';
