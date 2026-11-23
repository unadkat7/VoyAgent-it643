// "asha@example.com" -> "as***@example.com": enough to tell users apart, not to contact them.
export function maskEmail(email) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
