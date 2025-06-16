const mongoose = require("mongoose");

//* Flat schema *//
const flatSchema = new mongoose.Schema({
    city: {
        type: String,
        required: [true, 'Flat city is required']
    },
    streetName: {
        type: String,
        required: [true, 'Street name is required']
    },
    streetNumber: {
        type: Number,
    },
    areaSize: {
        type: Number,
        required: [true, 'Area size is required']
    },
    hasAc: {
        type: Boolean,
        required: [true, 'Please specify if apartment has AC or not']
    },
    yearBuilt: {
        type: Number,
        required: [true, 'Year of construction is required']
    },
    rentPrice: {
        type: Number,
        required: [true, 'Rent price is required']
    },
    dateAvailable: {
        type: Date,
        required: [true, 'Available date is required']
    },
    flatImages: {
        type: [String],
        default: ["default.jpg"],
        validate: [
            {
                validator: function(images) {
                    // 🎯 FIX: default.jpg nu se numără la limita de 3 imagini
                    const realImages = images.filter(img => img !== 'default.jpg');
                    return realImages.length <= 3;
                },
                message: "Maximum 3 real images allowed (default.jpg doesn't count)"
            },
            {
                validator: function(images) {
                    const validExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
                    return images.every(image => validExtensions.test(image));
                },
                message: "Only image files are allowed (jpg, jpeg, png, gif, webp)"
            }
        ]
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: {
        type: String,
        default: Date.now
    },
    updatedAt: {
        type: String,
        default: Date.now
    }
})



const Flat = mongoose.model("Flat" , flatSchema);
module.exports = Flat;