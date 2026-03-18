import mongoose from "mongoose";

const DownloadRequestSchema = new mongoose.Schema(
  {
    Name: {
      type: String,
      required: true,
      trim: true,
    },
    Email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    Number: {
      type: String,
      required: true,
      trim: true,
    },
    Link: {
      type: String,
      required: false,
      trim: true,
    },
    Info: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { timestamps: true }
);

const Download = mongoose.model("Download", DownloadRequestSchema);

export default Download;
