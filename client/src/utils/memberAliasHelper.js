export function getUserAliasKey(user) {
  const userIdKey = user?.email || user?.id || user?.name || "guest";
  return `myhome_member_aliases_${userIdKey.toLowerCase().replace(/\s+/g, "_")}`;
}

export function getPersonalAliases(user) {
  try {
    const key = getUserAliasKey(user);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error("Error reading personal aliases:", err);
    return {};
  }
}

export function getMemberDisplayName(user, memberId, originalName) {
  if (!originalName) return "";
  const aliases = getPersonalAliases(user);
  const keyById = memberId ? aliases[memberId] : null;
  const keyByName = aliases[originalName.toLowerCase()];
  return keyById || keyByName || originalName;
}

export function savePersonalAlias(user, memberId, originalName, alias) {
  try {
    const key = getUserAliasKey(user);
    const aliases = getPersonalAliases(user);
    const cleanAlias = alias ? alias.trim() : "";

    if (!cleanAlias || cleanAlias.toLowerCase() === originalName.toLowerCase()) {
      if (memberId) delete aliases[memberId];
      if (originalName) delete aliases[originalName.toLowerCase()];
    } else {
      if (memberId) aliases[memberId] = cleanAlias;
      if (originalName) aliases[originalName.toLowerCase()] = cleanAlias;
    }

    localStorage.setItem(key, JSON.stringify(aliases));
    return cleanAlias;
  } catch (err) {
    console.error("Error saving personal alias:", err);
    return alias;
  }
}
