export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
