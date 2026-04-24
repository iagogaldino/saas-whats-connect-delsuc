import mongoose from 'mongoose';

const apiRequestLogSchema = new mongoose.Schema(
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
      required: false,
      index: true,
    },
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      required: true,
      index: true,
    },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String, required: false },
    userAgent: { type: String, required: false },
    requestHeaders: {
      type: Map,
      of: String,
      required: false,
    },
    durationMs: { type: Number, required: false },
  },
  { timestamps: true }
);

apiRequestLogSchema.index({ userId: 1, createdAt: -1 });
apiRequestLogSchema.index({ userId: 1, instanceId: 1, createdAt: -1 });
apiRequestLogSchema.index({ apiKeyId: 1, createdAt: -1 });

export type ApiRequestLogDocument = mongoose.InferSchemaType<typeof apiRequestLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApiRequestLog =
  (mongoose.models.ApiRequestLog as mongoose.Model<ApiRequestLogDocument>) ||
  mongoose.model<ApiRequestLogDocument>('ApiRequestLog', apiRequestLogSchema);
