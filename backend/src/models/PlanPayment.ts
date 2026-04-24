import mongoose from 'mongoose';

const planPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['mercadopago', 'mock'],
    },
    /** ID do pagamento (MP) ou identificador único (simulação). Único por origem. */
    externalId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'BRL' },
    /** Estado do pagamento (só grava linhas aprovadas; campo preparado para evolução). */
    status: {
      type: String,
      required: true,
      enum: ['approved'],
      default: 'approved',
    },
    approvedAt: { type: Date, required: true },
    planExpiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

planPaymentSchema.index({ userId: 1, createdAt: -1 });
planPaymentSchema.index({ source: 1, externalId: 1 }, { unique: true });

export type PlanPaymentDocument = mongoose.InferSchemaType<typeof planPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlanPayment =
  (mongoose.models.PlanPayment as mongoose.Model<PlanPaymentDocument>) ||
  mongoose.model<PlanPaymentDocument>('PlanPayment', planPaymentSchema);
