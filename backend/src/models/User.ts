import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    plan: {
      type: String,
      required: true,
      enum: ['free', 'paid'],
      default: 'free',
    },
    /** Fim do período pago (UTC). Só preenchido quando `plan` é `paid`. */
    planExpiresAt: { type: Date, default: null, index: true },
    realtimeListeningEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

export type UserDocument = mongoose.InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User =
  (mongoose.models.User as mongoose.Model<UserDocument>) ||
  mongoose.model<UserDocument>('User', userSchema);
