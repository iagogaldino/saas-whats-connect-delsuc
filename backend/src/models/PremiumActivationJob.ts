import mongoose from 'mongoose';

const paymentSnapshotSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, enum: ['mercadopago', 'mock'] },
    externalId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const jobPayloadSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    approvedAt: { type: Date, required: true },
    planExpiresAt: { type: Date, required: true },
    payment: { type: paymentSnapshotSchema, required: false, default: null },
  },
  { _id: false }
);

const premiumActivationJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    payload: { type: jobPayloadSchema, required: true },
    /** Tentativas de execução dos handlers (sucesso ou falha). */
    processingAttempts: { type: Number, required: true, default: 0, min: 0 },
    lastError: { type: String, required: false, maxlength: 2000 },
    processedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

premiumActivationJobSchema.index({ status: 1, createdAt: 1 });

export type PremiumActivationJobDocument = mongoose.InferSchemaType<typeof premiumActivationJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PremiumActivationJob =
  (mongoose.models.PremiumActivationJob as mongoose.Model<PremiumActivationJobDocument>) ||
  mongoose.model<PremiumActivationJobDocument>('PremiumActivationJob', premiumActivationJobSchema);
