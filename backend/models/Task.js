import mongoose from 'mongoose'
import { TASK_STATUSES, TASK_PRIORITIES } from '../../shared/constants.js'

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', index: true },
    dueDate: { type: Date, index: true },
    completedAt: { type: Date },
    lastDeadlineReminderSentAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    updatedAt: { type: Date, default: () => new Date(), index: true },
    tags: [{ type: String }],
    link: { type: String, default: '' },
  },
  { timestamps: true },
)

taskSchema.pre('save', function () {
  this.updatedAt = new Date()
})

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema)
export default Task
