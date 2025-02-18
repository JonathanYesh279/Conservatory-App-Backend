export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher
      if (!teacher) {
        return res.status(401).json({ message: 'Unauthorized' })
      }

      if (teacher.roles.includes('מנהל')) {
        return next()
      }

      const hasRequiredRole = teacher.roles.some(role => roles.includes(role))
      if (!hasRequiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      if (req.params.id) {
        const isOwner = await _checkOwnership(teacher, req)
        if (!isOwner) {
          return res.status(403).json({ error: 'Not authorized to modify this resourse' })
        }
      }

      next()
    } catch (err) {
      next(err);
    }
  }
}

async function _checkOwnership(teacher, req) {
  const resourceId = req.params.id
  const path = req.path

  if (path.includes('/student')) {
    if (teacher.roles.includes('מורה')) {
      return teacher.teaching.studentIds.includes(resourceId)
    }
  }
  else if (path.includes('/orchestra')) {
    if (teacher.roles.includes('מנצח')) {
      return teacher.conducting.orchestraIds.includes(resourceId)
    }
  }
  else if (path.includes('/ensemble')) {
    if (teacher.roles.includes('מדריך הרכב')) {
      return teacher.ensembleIds.includes(resourceId)
    }
  }

  return false
}