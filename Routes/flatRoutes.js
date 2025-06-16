const express = require("express");
const router = express.Router();
const flatsController = require("../Controllers/flatsController");
const authController = require("../Controllers/authController")
const multer = require("multer");
const path = require("path");


//* utilizare multer pentru gestionare upload imagini *//
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
})
const upload = multer({ storage: storage })

/**
 * @route POST /flats/
 * @description Add a new flat
 */
router.route("/").post(authController.protectSystem, upload.array('photos', 3), flatsController.createFlat);

/**
 * @route GET /flats/my-flats
 * @description Get current user's flats
 */
router.route('/my-flats').get(authController.protectSystem, flatsController.getMyFlats);

/**
 * @route GET /flats/:id
 * @description Get a flat by ID
 */
router.route("/:id").get(authController.protectSystem, flatsController.getFlatById);

/**
 * @route DELETE /flats/:id
 * @description Delete a flat by ID
 */
router.route("/:id").delete(authController.protectSystem, flatsController.deleteFlatById);

/**
 * @route PATCH /flats/:id
 * @description Update a flat
 */
router.route("/:id").patch(authController.protectSystem, upload.array('photos', 3), flatsController.updateFlatById);

/**
 * @route GET /flats/
 * @description GEt all flats
 */
router.route("/").get(authController.protectSystem, flatsController.getAllFlats);

const messageRoutes = require('./messageRoutes');

//* Nested routes pentru mesaje *//
router.use('/:id/messages', messageRoutes);


module.exports = router;
