export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  typ: 'admin-access';
}

export interface AdminRefreshPayload {
  sub: string;
  typ: 'admin-refresh';
  jti: string;
  familyId: string;
}

export interface AuthenticatedStaff {
  id: string;
  email: string;
  role: string;
}
