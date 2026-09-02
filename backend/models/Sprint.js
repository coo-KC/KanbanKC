import mongoose from 'mongoose'
import { SPRINT_STATUSES } from '../../shared/constants.js'

const sprintSchema = new mongoose.Schema(
  {
    sprintNumber: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: SPRINT_STATUSES, default: 'active' },
    summary: {
      completedCount: { type: Number, default: 0 },
      avgCycleTimeHours: { type: Number, default: 0 },
      byAssignee: { type: Map, of: Number, default: {} },
    },
  },
  { timestamps: true },
)

const Sprint = mongoose.models?.Sprint || mongoose.model('Sprint', sprintSchema)
export default Sprint
