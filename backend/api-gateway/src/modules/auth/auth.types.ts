export interface JwtPayload {
  sub: string;
  phone: string;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  typ: 'refresh';
  jti: string;
  familyId: string;
}

export interface AuthenticatedUser {
  id: string;
  phone: string;
}
