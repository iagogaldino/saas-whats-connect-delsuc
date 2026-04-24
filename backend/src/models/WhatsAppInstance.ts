import mongoose from 'mongoose';

const whatsAppInstanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 64,
    },
    realtimeListeningEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

whatsAppInstanceSchema.index({ userId: 1, createdAt: -1 });
whatsAppInstanceSchema.index({ userId: 1, name: 1 });

export type WhatsAppInstanceDocument = mongoose.InferSchemaType<typeof whatsAppInstanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WhatsAppInstance =
  (mongoose.models.WhatsAppInstance as mongoose.Model<WhatsAppInstanceDocument>) ||
  mongoose.model<WhatsAppInstanceDocument>('WhatsAppInstance', whatsAppInstanceSchema);
