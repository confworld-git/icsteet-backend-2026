import mongoose from "mongoose";

const Session_Schema = mongoose.Schema({
  sessions: [
    {
      session: { type: String },
      topics: { type: [String] },
    },
  ],
});

const SessionSchema = mongoose.model("Session_Tracks", Session_Schema);

export default SessionSchema;
