export interface JwtPayload {
  sub: string;      // customer id
  phone: string;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  typ: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  phone: string;
}
