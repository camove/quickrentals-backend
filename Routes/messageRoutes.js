const express = require("express");
//* Nested routes pentru mesaje, mergeParams permite accesul la parametrii din ruta parinte; din /flats/:id/messages poate accesa :id *//
const router = express.Router({ mergeParams: true }); 
const messagesController = require("../Controllers/messagesController");
const authController = require("../Controllers/authController");

/**
 * @route GET /flats/:id/messages
 * @description Get all messages for a flat (owner only)
 */
router.route('/')
    .get(authController.protectSystem, messagesController.getAllMessages)
    .post(authController.protectSystem, messagesController.addMessage);

/**
 * @route GET /flats/:id/messages/:senderId
 * @description Get user's own messages for a flat
 */
router.route('/:senderId')
    .get(authController.protectSystem, messagesController.getUserMessages);

module.exports = router;