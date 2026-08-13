export const roles = {
  ADMIN: 'admin',
  CGRADE: 'cgrade',
  EMPLOYEE: 'employee',
}

export const ensureRole = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role
  if (!role) {
    return res.status(403).json({ error: 'Role claim missing from token' })
  }
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ error: 'Insufficient privileges' })
  }
  next()
}

export const requireAdmin = ensureRole(roles.ADMIN)
export const requireCgrade = ensureRole(roles.ADMIN, roles.CGRADE)
export const requireEmployee = ensureRole(roles.ADMIN, roles.CGRADE, roles.EMPLOYEE)
