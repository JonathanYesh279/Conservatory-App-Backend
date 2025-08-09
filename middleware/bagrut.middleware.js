import { bagrutService } from '../api/bagrut/bagrut.service.js'
import { ObjectId } from 'mongodb'

export async function authorizeBagrutAccess(req, res, next) {
  try {
    const bagrutId = req.params.id

    if (!bagrutId) {
      return res.status(400).json({ error: 'Bagrut ID is required' })
    }

    const bagrut = await bagrutService.getBagrutById(bagrutId)

    if (!bagrut) {
      return res.status(404).json({ error: `Bagrut with id ${bagrutId} not found` })
    }

    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    if (!isAdmin && bagrut.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to view this bagrut' })
    }

    req.bagrut = bagrut
    next()
  } catch (err) {
    console.error(`Error in authorizeBagrutAccess: ${err}`) 
    next(err)
  }
}