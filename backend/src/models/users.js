import { model, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true },
    avatarUrl: String,
    passwordHash: { type: String },
    authProviders: [
      {
        provider: {
          type: String,
          enum: ["password", "google", "github", "microsoft"],
        },
        providerId: String,
      },
    ],
    preferences: {
      locale: { type: String, default: "vi-VN" },
      timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
      notification: {
        email: { type: Boolean, default: true },
        web: { type: Boolean, default: true },
        mobile: { type: Boolean, default: true },
      },
    },
    roles: [
      {
        team: { type: Schema.Types.ObjectId, ref: "team"},
        role: {
          type: String,
          enum: ["owner", "admin", "member", "guest"],
          default: "member",
        },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

UserSchema.index({ "roles.team": 1 });

export const UserModel = model("user", UserSchema);
