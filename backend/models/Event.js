import mongoose from 'mongoose'
import { EVENT_TYPES } from '../../shared/constants.js'

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    eventType: { type: String, enum: EVENT_TYPES, required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, default: '' },
    deadline: { type: Date },
    status: { type: String, enum: ['published', 'pending_approval'], default: 'pending_approval' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema)
export default Event
