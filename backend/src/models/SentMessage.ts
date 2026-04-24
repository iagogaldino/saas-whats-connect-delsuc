import mongoose from 'mongoose';

const sentMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    instanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppInstance',
      required: true,
      index: true,
    },
    phoneNumber: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['success', 'failed'],
    },
    errorMessage: { type: String, required: false },
    message: { type: String, required: false },
  },
  { timestamps: true }
);

sentMessageSchema.index({ userId: 1, instanceId: 1, createdAt: -1 });

export type SentMessageDocument = mongoose.InferSchemaType<typeof sentMessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SentMessage =
  (mongoose.models.SentMessage as mongoose.Model<SentMessageDocument>) ||
  mongoose.model<SentMessageDocument>('SentMessage', sentMessageSchema);
