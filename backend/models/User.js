import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: false },
    role: {
      type: String,
      enum: ['admin', 'cgrade', 'employee'],
      default: 'employee',
    },
    department: { type: String, required: false },
    username: { type: String, unique: true, sparse: true },
    superior: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fcmTokens: [{ type: String, trim: true }],
  },
  { timestamps: true },
)

const User = mongoose.models.User || mongoose.model('User', userSchema)
export default User
