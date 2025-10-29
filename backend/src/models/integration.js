import { model, Schema } from "mongoose";

const IntegrationSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    provider: {
      type: String,
      enum: [
        "slack",
        "github",
        "gitlab",
        "notion",
        "google_calendar",
        "zapier",
      ],
    },
    config: Schema.Types.Mixed, // token, channelId, repo, webhook URL...
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

IntegrationSchema.index({ team: 1, provider: 1 }, { unique: true });

export const IntegrationModel = model("integration", IntegrationSchema);
