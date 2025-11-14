import { model, Schema } from "mongoose";

const InviteSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["leader", "admin", "member"],
      default: "member",
    },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "user" },
    acceptedAt: Date,
  },
  { timestamps: true }
);

export const InviteModel = model("invite", InviteSchema);
