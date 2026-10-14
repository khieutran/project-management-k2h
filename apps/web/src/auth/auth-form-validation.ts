const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailValid(email: string): boolean {
  return emailPattern.test(normalizeEmail(email));
}

export function isLoginPasswordValid(password: string): boolean {
  return password.length > 0 && password.length <= 128;
}

export function isRegisterPasswordValid(password: string): boolean {
  return password.length >= 10 && password.length <= 128;
}
