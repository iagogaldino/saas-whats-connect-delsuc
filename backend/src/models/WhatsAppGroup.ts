import mongoose from 'mongoose';

const whatsAppGroupSchema = new mongoose.Schema(
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
    jid: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
  },
  { timestamps: true }
);

whatsAppGroupSchema.index({ userId: 1, instanceId: 1, jid: 1 }, { unique: true });

export type WhatsAppGroupDocument = mongoose.InferSchemaType<typeof whatsAppGroupSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WhatsAppGroup =
  (mongoose.models.WhatsAppGroup as mongoose.Model<WhatsAppGroupDocument>) ||
  mongoose.model<WhatsAppGroupDocument>('WhatsAppGroup', whatsAppGroupSchema);
