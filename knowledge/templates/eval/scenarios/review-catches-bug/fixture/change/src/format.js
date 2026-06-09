// Formatting helper.
export function formatItem(item) {
  // cosmetic refactor: extract the prefix as a named constant.
  const PREFIX = "- ";
  return `${PREFIX}${item.name}`;
}
