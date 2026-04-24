import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    keyPrefix: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keyHash: { type: String, required: true },
    name: { type: String, required: false, trim: true },
    lastUsedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

apiKeySchema.index({ userId: 1, createdAt: -1 });

export type ApiKeyDocument = mongoose.InferSchemaType<typeof apiKeySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApiKey =
  (mongoose.models.ApiKey as mongoose.Model<ApiKeyDocument>) ||
  mongoose.model<ApiKeyDocument>('ApiKey', apiKeySchema);
