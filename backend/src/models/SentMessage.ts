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
    jid: { type: String, required: false, index: true },
    messageId: { type: String, required: false, index: true },
    direction: {
      type: String,
      required: true,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
      index: true,
    },
    fromMe: { type: Boolean, required: false, default: false },
    type: { type: String, required: false, default: 'text' },
    messageTimestamp: { type: Date, required: false, index: true },
    mediaPath: { type: String, required: false },
    mediaMimeType: { type: String, required: false },
    mediaFileName: { type: String, required: false },
    mediaSize: { type: Number, required: false },
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
sentMessageSchema.index({ userId: 1, instanceId: 1, jid: 1, createdAt: -1 });

export type SentMessageDocument = mongoose.InferSchemaType<typeof sentMessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SentMessage =
  (mongoose.models.SentMessage as mongoose.Model<SentMessageDocument>) ||
  mongoose.model<SentMessageDocument>('SentMessage', sentMessageSchema);
