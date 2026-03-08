export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getFormOptionalString(formData: FormData, key: string) {
  const value = getFormString(formData, key).trim();
  return value ? value : undefined;
}

export function getFormNullableString(formData: FormData, key: string) {
  const value = getFormString(formData, key).trim();
  return value ? value : null;
}
