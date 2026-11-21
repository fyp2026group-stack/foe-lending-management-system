export function loginErrorMessage(status?: number): string {
  if (status === 401)
    return 'We could not sign you in. Check the email and password, then try again.';
  if (status === 429)
    return 'Too many sign-in attempts. Please wait and try again.';
  return 'Sign-in is temporarily unavailable. Please try again later.';
}
