export const INDIA_MOBILE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
export const INDIA_VEHICLE_REG_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string) {
  return value.replace(/[\s-]/g, "").replace(/^\+91/, "");
}

export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function validatePhone(value: string) {
  if (!value.trim()) return "Phone is required";
  if (!INDIA_MOBILE_PATTERN.test(value.trim())) return "Enter a valid 10-digit Indian mobile number";
  return "";
}

export function validateFullName(value: string) {
  const name = value.trim();
  if (name.length < 2) return "Name must be at least 2 characters";
  if (name.length > 80) return "Name must be 80 characters or fewer";
  return "";
}

export function validateEmail(value: string, required = false) {
  const email = value.trim();
  if (!email) return required ? "Email is required" : "";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
  return "";
}

export function validatePassword(value: string, required = true) {
  if (!value) return required ? "Password is required" : "";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (value.length > 72) return "Password must be 72 characters or fewer";
  return "";
}

export function validateRegistration(value: string) {
  const reg = normalizeRegistration(value);
  if (!reg) return "Registration number is required";
  if (!/^[A-Z0-9]{3,32}$/.test(reg)) return "Enter a vehicle number using letters and digits (e.g. KA01AB1234)";
  return "";
}

export function validateRequired(value: string, label: string) {
  return value.trim() ? "" : `${label} is required`;
}
