import mongoose from 'mongoose'
import { COMMENT_TYPES } from '../../shared/constants.js'

const activityLogSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: COMMENT_TYPES, required: true },
    content: { type: String, default: '' },
    oldStatus: { type: String, default: '' },
    newStatus: { type: String, default: '' },
    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true },
)

const ActivityLog = mongoose.models?.ActivityLog || mongoose.model('ActivityLog', activityLogSchema)
export default ActivityLog
