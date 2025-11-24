import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    model: { type: String, default: 'gemini-2.0-flash' },
    userId: { type: String },   // optional: if you have user IDs
    meta: { type: Object },     // optional: anything extra
  },
  { timestamps: true }          // adds createdAt, updatedAt
);

export const Interaction = mongoose.model('Interaction', interactionSchema);
