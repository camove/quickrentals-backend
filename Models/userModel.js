const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

//* User schema *//
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, "Please enter a valid email"]
    },
    password: {
        type: String,
        required: [true, 'Please enter a password'],
     },
    firstName: {
        type: String,
        required: [true, "Please enter first name"],
        maxlength: [30, "Name cannot be longer than 30 characters"],
        minlength: [2, "Name must have at least 2 characters"],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, "Please entre last name"],
        maxlength: [30, "Name cannot be longer than 30 characters"],
        minlength: [2, "Name must have at least 2 characters"],
        trim: true,
    },
    birthDate: {
        type: Date,
        required: [true, "Please enter your birth date"],
        validate: {
            validator: function(value) {
                const today = new Date();
                const birthDate = new Date(value);
                
                // Calculează vârsta
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                // Ajustează vârsta dacă nu a trecut încă ziua de naștere în anul curent
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                
                // Verifică dacă vârsta e între 18 și 120 ani
                return age >= 18 && age <= 120;
            },
            message: "User must be between 18 and 120 years old"
    }
    },
    isAdmin: {
        type: String,
        default: "regular_user",
        enum: ["regular_user", "admin"]
    },
    favouriteFlatList: [
        {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Flat"
        }
    ],
    createdAt: {
        type: String,
        default: Date.now
    },
    updatedAt: {
        type: String,
        default: Date.now
    },
    activeToken: {
        type: String,
        default: null
    },
    passwordChangedAt: {
        type: Date
    }
})

userSchema.pre("save", async function(next){
    if(!this.isModified("password")){
        return next();
    }

    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.comparePass = async function(bodyPass){
    return await bcrypt.compare(bodyPass, this.password);
}

userSchema.methods.isPasswordChanged = async function(jwtTimeStamp){
    if(this.passwordChangedAt){
        const passwordChangedTimestamp = parseInt(this.passwordChangedAt / 1000);
        return jwtTimeStamp < passwordChangedTimestamp; 
    }

    return false; //Parola nu a fost schimbata niciodata 
}

const User = mongoose.model("User", userSchema);
module.exports = User;