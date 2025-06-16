const express = require("express");
const router = express.Router();
const authController = require("../Controllers/authController");

/**
 * @route GET /users/check-email
 * @description Check email availability
 */
router.route('/check-email').get(authController.checkEmailAvailability);

/**
 * @route POST /users
 * @description Create a new user
 */
router.route('/').post(authController.signup)

/**
 * @route POST /users/login
 * @description Login user
 */
router.route('/login').post(authController.login)

/**
 * @route GET /users/get-all-users
 * @description Get the list of all users - only admin rights
 */
router.route('/').get(authController.protectSystem, authController.permission, authController.getAllUsers)

/**
 * @route PATCH /users/favorites/:flatId
 * @description Toggle favorite flat for current user
 */
router.route('/favorites/:flatId').patch(authController.protectSystem, authController.toggleFavorite);

/**
 * @route GET /users/favorites
 * @description Get current user's favorite flats
 */
router.route('/favorites').get(authController.protectSystem, authController.getUserFavoritesFlats);

/**
 * @route PATCH /users/:id/role
 * @description Change user role (admin only)
 */
router.route('/:id/role').patch(authController.protectSystem, authController.permission, authController.changeUserRole);

/**
 * @route GET /users/:id
 * @description Get user by ID
 */
router.route('/:id').get(authController.protectSystem, authController.getUserById);

/**
 * @route PATCH /users/updatePassword
 * @description Update user password
 */
router.route('/updatePassword').patch(authController.protectSystem, authController.updatePassword);

/**
 * @route PATCH /users/:id  
 * @description Update user profile
 */
router.route('/:id').patch(authController.protectSystem, authController.updateUser);

/**
 * @route DELETE /users/:id
 * @description Delete user account
 */
router.route('/:id').delete(authController.protectSystem, authController.deleteUser);



module.exports = router