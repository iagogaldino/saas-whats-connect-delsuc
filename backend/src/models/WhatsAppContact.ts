import mongoose from 'mongoose';

const whatsAppContactSchema = new mongoose.Schema(
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
    name: {
      type: String,
      default: '',
      trim: true,
      maxlength: 256,
    },
    notify: {
      type: String,
      default: '',
      trim: true,
      maxlength: 256,
    },
    pushName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 256,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 32,
    },
  },
  { timestamps: true }
);

whatsAppContactSchema.index({ userId: 1, instanceId: 1, jid: 1 }, { unique: true });
whatsAppContactSchema.index({ userId: 1, instanceId: 1, name: 1 });

export type WhatsAppContactDocument = mongoose.InferSchemaType<typeof whatsAppContactSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WhatsAppContact =
  (mongoose.models.WhatsAppContact as mongoose.Model<WhatsAppContactDocument>) ||
  mongoose.model<WhatsAppContactDocument>('WhatsAppContact', whatsAppContactSchema);
