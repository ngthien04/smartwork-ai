import { model, Schema } from "mongoose";

const AIInsightSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    task: { type: Schema.Types.ObjectId, ref: "task", index: true },
    kind: {
      type: String,
      enum: [
        "priority_suggestion",
        "risk_warning",
        "timeline_prediction",
        "workload_balance",
      ],
    },
    message: { type: String, required: true },
    score: { type: Number, min: 0, max: 1 },

    metadata: { type: Schema.Types.Mixed, default: {} },

    acceptedBy: { type: Schema.Types.ObjectId, ref: "user" },
    acceptedAt: Date,
    dismissedBy: { type: Schema.Types.ObjectId, ref: "user" },
    dismissedAt: Date,
  },
  { timestamps: true }
);

AIInsightSchema.index({ team: 1, kind: 1, createdAt: -1 });

export const AIInsightModel = model("ai_insight", AIInsightSchema);
