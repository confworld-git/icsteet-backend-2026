import mongoose, { mongo } from "mongoose";

const EssentialSchema = mongoose.Schema({
  Essential_File_Title: {
    type: String,
  },
  Essential_File: {
    File_Name: String,
    File_Buffer: Buffer,
  },
});

const Essential_Schema = mongoose.model("Essential_Files", EssentialSchema);

export default Essential_Schema;
