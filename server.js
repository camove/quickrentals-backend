//* Incarcare variabile de mediu din config.env *//
const dotenv = require("dotenv");
dotenv.config({path : './config.env'})

const port = process.env.PORT || 3001

//* SAFETY NET error handlers -> este deasupra app - "prinde erorile neasteptate" */
process.on('uncaughtException', (err) => {
    console.log(err.stack)
    console.log('❌ Uncaught exception occured! Please resolve... ❌')
})

//* pornire server *//
const app = require('./app')

app.listen(port, () => {
    console.log(`Server has started on port ${port} 👍`)
})

//* conexiunea la mongoDB *//
const mongoose = require("mongoose")

mongoose.connect(process.env.CONN_STR)
    .then(() => {
        console.log(" 🏡 FindMyPlace is connected to MongoDB 🏡 ");
    })
    .catch((err) => {
        console.log("❌ Database connection failed ❌ ", err.message)
    })
