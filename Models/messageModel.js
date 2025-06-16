const mongoose = require("mongoose");

//* Message schema *//
const messageSchema = new mongoose.Schema({
    content: {
    type: String,
    required: [true, "Message content is required"],
    minlength: [1, "Message cannot be empty"],
    maxlength: [200, "Message length exceeded"],
    trim: true
    },
    createdAt:{
        type: String,
        default: Date.now
    },
    flatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Flat",
        required: [true, "Message must belong to a flat"]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Message must belong to an user"]
    }
})

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;