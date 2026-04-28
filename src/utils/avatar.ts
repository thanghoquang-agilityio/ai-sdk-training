const DICEBEAR_AVATAR_BASE_URL = "https://api.dicebear.com/7.x/adventurer/svg";

export function getAvatarUrl(seedValue: string) {
  const seed = encodeURIComponent(seedValue.trim().toLowerCase());
  return `${DICEBEAR_AVATAR_BASE_URL}?seed=${seed}`;
}

export function getInitialsFromName(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
