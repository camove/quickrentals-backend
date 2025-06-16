const express = require("express");
const cors = require("cors");
const flatRoutes = require("./Routes/flatRoutes");
const userRoutes = require("./Routes/userRoutes");
const landingController = require("./Controllers/landingController");
const path = require("path");

let app = express();

app.use(express.json());

// //* autorizare accesare backend din portul 5173 *//
// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true,
// //   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
// //   allowedHeaders: ["Content-Type", "Authorization"]
// }));

app.use(cors({
  origin: "*",
  credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"]
}));


//* creare si utilizare folder pentru upload imagini  *//
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


//* adaugare timestamp la fiecare request *//
app.use((req, res, next) => {
    req.requestedAt = new Date().toISOString();
    next();
})


//* ROUTES *//

//-> ruta pentru homepage
app.get('/', landingController.getLandingFlats);

//-> rutele pentru apartamente
app.use('/flats', flatRoutes)

//-> rutele pentru useri
app.use('/users', userRoutes)


//* Ruta defaut pentru pagini care nu exista in proiect *//

app.use((req, res) => {
    res.status(404).json({
        status: "failed",
        message: `Route ${req.originalUrl} not found!`
    });
});

module.exports = app