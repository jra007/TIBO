export interface AuthenticatedIdentity {
  id: string;
  username: string;
  displayName: string;
  groupIds: string[];
}

export interface AuthProvider {
  readonly kind: 'local' | 'ldap';
  authenticate(username: string, password: string): Promise<AuthenticatedIdentity | null>;
}
