import { model, Schema } from "mongoose";

const WebhookSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    url: { type: String, required: true },
    secret: { type: String },
    events: [{ type: String }], 
    isActive: { type: Boolean, default: true },
    lastDeliveredAt: Date,
  },
  { timestamps: true }
);

WebhookSchema.index({ team: 1, isActive: 1 });

export const WebhookModel = model("webhook", WebhookSchema);
