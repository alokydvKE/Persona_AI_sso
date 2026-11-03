export type Credentials = { email: string; password: string };

/** A message per field that can't be sent as it is; absent fields are fine. */
export type CredentialErrors = Partial<Record<keyof Credentials, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks a sign-in form before it is sent, so an empty or malformed entry is
 * caught on the spot instead of costing a request. The email is judged
 * trimmed (that is what gets sent); the password is taken exactly as typed.
 */
export function validateCredentials({ email, password }: Credentials): CredentialErrors {
  const errors: CredentialErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(trimmed)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}
