const User = require("../Models/userModel");
const jwt = require("jsonwebtoken");
const Flat = require("../Models/flatModel");
const Message = require("../Models/messageModel");

//* Functie ajutatoare pentru setrgerea pozelor *//
const deleteImageFiles = (imagePaths) => {
  const fs = require("fs");
  const path = require("path");

  if (!imagePaths || !Array.isArray(imagePaths)) return;

  imagePaths.forEach((imagePath) => {
    //-> Sare imaginile default
    if (!imagePath || 
        imagePath === "default.jpg" || 
        imagePath.includes("default.jpg")) {
      console.log(`Skipping default image: ${imagePath}`);
      return;
    }

    //-> Construim path-ul
    let cleanImagePath = imagePath;
    
    //-> Eliminam "/" de la inceput daca exista
    if (cleanImagePath.startsWith("/")) {
      cleanImagePath = cleanImagePath.substring(1);
    }
    
    //-> Eliminam "uploads/" de la inceput daca exista deja
    if (cleanImagePath.startsWith("uploads/")) {
      cleanImagePath = cleanImagePath.substring(8);
    }

    //-> Path-ul corect: din backend root catre uploads/filename
        const fullPath = path.join(__dirname, "..", "uploads", cleanImagePath);

    console.log(`Attempting to delete: ${fullPath}`);

    //-> Verificam daca fisierul exista inainte sa-l stergem
    fs.access(fullPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`File does not exist: ${fullPath}`);
        return;
      }

      //-> Stergem fisierul
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) {
          console.log(`Could not delete image: ${fullPath}`, unlinkErr.message);
        } else {
          console.log(`✅ Successfully deleted image: ${fullPath}`);
        }
      });
    });
  });
};

//** Inregistrare utilizator **//
exports.signup = async (req, res) => {
  try {
    console.log("Request body:", req.body);

    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      birthDate,
      isAdmin,
    } = req.body;

    //-> Validare parola
    if (!/^(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password)) {
      return res.status(400).json({
        message:
          "Password must have at least 8 characters, 1 number, and 1 special character",
      });
    }

    if (!confirmPassword || password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match!" });
    }

    //-> Crearea utilizatorului în baza de date
    const newUser = await User.create({
      email,
      password,
      firstName,
      lastName,
      birthDate,
      isAdmin,
    });

    return res.status(201).json({ newUser });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({
      status: "Failed",
      message: "Error creating user",
      error: error.message,
    });
  }
};

//* Login *//
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userToValidate = await User.findOne({ email });

    if (!userToValidate) {
      return res.status(404).json({
        status: "Failed!",
        message: "Invalid email or password!",
      });
    }

    const passMatching = await userToValidate.comparePass(password);

    if (!passMatching) {
      return res.status(404).json({
        status: "Failed!",
        message: "Invalid email or password!",
      });
    }

    const token = jwt.sign({ id: userToValidate._id }, process.env.SECRET_STR, {
      expiresIn: "24h",
    });

    userToValidate.activeToken = token;
    await User.findByIdAndUpdate(userToValidate._id, { activeToken: token });

    return res.status(200).json({
      staus: "Succes!",
      message: "Login successful!",
      userToValidate,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      status: "Failed!",
      message: "Error in login process",
      error: error,
    });
  }
};

//* Verificare validitate token pentru utilizatorii logati *//
exports.protectSystem = async (req, res, next) => {
  try {
    //-> Verificare daca requestul are token + citire token
    let token;
    if (
      req.headers &&
      req.headers.authorization.toLowerCase().startsWith("bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: "failed",
        message: "Access denied. No token provided.",
      });
    }

    //-> Verificare daca tokenul este valid (cel generat la logare si daca este sau nu expirat)
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.SECRET_STR);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          status: "failed",
          message: "Invalid token!",
        });
      } else if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          status: "failed",
          message: "Token expired!",
        });
      }

      return res.status(500).json({
        status: "failed",
        message: "Error verifying token",
      });
    }

    //-> Verificare daca userul exista in baza de date
    const currentUser = await User.findById(decodedToken.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "failed",
        message: "Authentication failed!",
      });
    }

    if (currentUser.activeToken !== token) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid token!",
      });
    }

    // //-> Verificare daca userul si-a schimbat parola dupa logare
    // if (await currentUser.isPasswordChanged(decodedToken.iat)) {
    //   return res.status(401).json({
    //     status: "failed",
    //     message: "Session expired. Please login again!",
    //   });
    // }

    //-> Atasam userul logat la obiectul request, astfel incat orice middleware urmator va avea acces la userul logat
    req.currentUser = currentUser;

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Error in validating token",
      error: error,
    });
  }
};

//* Functie pentru protejarea rutelor la care va avea acces doar admin-ul *//
exports.permission = async (req, res, next) => {
  if (req.currentUser && req.currentUser.isAdmin === "admin") {
    next();
  } else {
    return res.status(403).json({
      status: "Failed!",
      message: "You don't have permission!",
    });
  }
};

//* Lista utilizatorilor cu filtrare si sortare *//
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort, ...filters } = req.query;

    //-> 1. CONSTRUIRE FILTRU
    const filter = {};

    //-> Filtrare după tip user
    if (filters.userType) {
      if (filters.userType.includes(",")) {
        filter.isAdmin = { $in: filters.userType.split(",") }; //returneaza lista cu toti utilizatorii si cei admin si cei regular_user
      } else {
        filter.isAdmin = filters.userType;
      }
    }

    //-> Filtrare după varsta
    if (filters.ageRange && filters.ageRange.includes("-")) {
      const [minAge, maxAge] = filters.ageRange.split("-");
      const today = new Date();
      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(today.getFullYear() - minAge);
      const minBirthDate = new Date();
      minBirthDate.setFullYear(today.getFullYear() - maxAge);

      filter.birthDate = { $gte: minBirthDate, $lte: maxBirthDate };
    }

    //-> 2. LUAM TOTI UTILIZATORII (fara datele sensibile: parola, token, etc)
    let users = await User.find(filter)
      .select("-password -activeToken -passwordChangedAt")
      .lean(); //-> .lean() returneaza obiect simplu (doar date)

    //-> 3. PENTRU FIECARE USER, CALCULAM NUMARUL DE APARTAMENTE
    const Flat = require("../Models/flatModel");

    for (let user of users) {
      const flatsCount = await Flat.countDocuments({ ownerId: user._id });
      user.flatsCount = flatsCount;
    }

    //-> 4. FILTRARE DUPĂ NUMARUL DE APARTAMENTE (în JS)
    if (filters.flatsCountRange && filters.flatsCountRange.includes("-")) {
      const [minFlats, maxFlats] = filters.flatsCountRange.split("-");
      users = users.filter(
        (user) =>
          user.flatsCount >= Number(minFlats) &&
          user.flatsCount <= Number(maxFlats)
      );
    }

    //-> 5. SORTARE (în JS)
    if (sort) {
      const sortFields = sort.split(",");

      users.sort((a, b) => {
        for (let field of sortFields) {
          const order = field.startsWith("-") ? -1 : 1;
          const fieldName = field.replace("-", "");

          let valueA = a[fieldName];
          let valueB = b[fieldName];

          // Pentru string-uri
          if (typeof valueA === "string") {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
          }

          if (valueA < valueB) return -1 * order;
          if (valueA > valueB) return 1 * order;
        }
        return 0;
      });
    }

    //-> 6. CALCULAM TOTALUL PENTRU PAGINARE
    const totalUsers = users.length;
    const totalPages = Math.ceil(totalUsers / limit);

    //-> 7. APLICAM PAGINAREA (în JavaScript)
    const skip = (page - 1) * limit;
    const paginatedUsers = users.slice(skip, skip + Number(limit));

    res.status(200).json({
      status: "success",
      results: paginatedUsers.length,
      totalResults: totalUsers,
      currentPage: Number(page),
      totalPages: totalPages,
      data: paginatedUsers,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error fetching users",
      error: error.message,
    });
  }
};

//* Functie pentru toggle fav / not fav *//
exports.toggleFavorite = async (req, res) => {
  try {
    const { flatId } = req.params; //luam id-ul ap din URL
    const userId = req.currentUser.id; //luam id-ul utilizatorului din protectSystem

    //-> Gaseste user-ul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    //-> Verifica daca flatId exista in favouriteFlatList
    const flatIndex = user.favouriteFlatList.indexOf(flatId);

    if (flatIndex > -1) {
      //-> Elimina din favorite
      user.favouriteFlatList.splice(flatIndex, 1);
    } else {
      //-> Adauga la favorite
      user.favouriteFlatList.push(flatId);
    }

    //-> Salveaza user-ul actualizat
    await user.save();

    res.status(200).json({
      status: "success",
      message: flatIndex > -1 ? "Removed from favorites" : "Added to favorites",
      favouriteFlatList: user.favouriteFlatList,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error updating favorites",
      error: error.message,
    });
  }
};

//* Gasire utilizator dupa ID *//
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -activeToken -passwordChangedAt")
      .populate("favouriteFlatList", "city streetName rentPrice");

    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error fetching user",
      error: error.message,
    });
  }
};

//* Actualizare utilizator *//
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser;
    const { email, firstName, lastName, birthDate } = req.body;

    //-> Verifica permisiuni: user-ul insuși SAU admin
    if (id !== currentUser.id && currentUser.isAdmin !== "admin") {
      return res.status(403).json({
        status: "failed",
        message: "You can only update your own profile or you need admin privileges",
      });
    }

    //-> Gaseste user-ul curent
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    //-> Verifica daca email-ul se schimba
    const emailChanged = email && email !== existingUser.email;

    //-> Dacă email-ul se schimbă, verifica unicitatea
    if (emailChanged) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          status: "failed",
          message: "Email already in use by another account",
        });
      }
    }

    //-> Construiește obiectul de update doar cu campurile permise
    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    if (email !== undefined) updateData.email = email;

    updateData.updatedAt = Date.now();

    //-> IMPORTANT: Daca email-ul se schimba pentru alt user (admin editing), 
    //   invalidează token-ul DOAR pentru user-ul editat, nu pentru admin
    if (emailChanged) {
      updateData.activeToken = null; // Invalideaza token-ul user-ului editat
    }

    //-> Update user cu validare
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -activeToken -passwordChangedAt");

    //-> Raspuns diferit daca email-ul s-a schimbat
    if (emailChanged) {
      const isOwnProfile = id === currentUser.id;
      
      return res.status(200).json({
        status: "success",
        message: isOwnProfile 
          ? "Profile updated successfully. Please login again with your new email."
          : "User profile updated successfully. The user will need to login again with their new email.",
        emailChanged: true,
        data: updatedUser,
        requiresRelogin: isOwnProfile // true daca user-ul isi editeaza propriul profil
      });
    }

    //-> Raspuns normal pentru alte update-uri
    res.status(200).json({
      status: "success",
      message: id === currentUser.id 
        ? "Profile updated successfully" 
        : "User profile updated successfully",
      emailChanged: false,
      data: updatedUser,
    });
  } catch (error) {
    //-> Gestioneaza erorile de validare
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        status: "failed",
        message: "Validation error",
        errors: validationErrors,
      });
    }

    res.status(500).json({
      status: "failed",
      message: "Error updating user profile",
      error: error.message,
    });
  }
};

//* Delete user *//
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser;

    //-> Permisiuni: user insusi sau admin
    if (id !== currentUser.id && currentUser.isAdmin !== "admin") {
      return res.status(403).json({
        status: "failed",
        message: "You can only delete your own account",
      });
    }

    //-> Gaseste user-ul care va fi sters
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    //-> 1. Gaseste apartamentele user-ului
    const userFlats = await Flat.find({ ownerId: id });
    const flatIds = userFlats.map((flat) => flat._id);

    //-> Sterge pozele tuturor apartamentelor utilizatorului
    userFlats.forEach((flat) => {
      if (flat.flatImages && flat.flatImages.length > 0) { 
        deleteImageFiles(flat.flatImages);
      }
    });

    //-> 2. Sterge apartamentele
    await Flat.deleteMany({ ownerId: id });

    //-> 3. Sterge mesajele
    await Message.deleteMany({
      $or: [
        { userId: id }, //mesajele utilizatorului
        { flatId: { $in: flatIds } }, //mesajele trimise catre apartamentele lui
      ],
    });

    //-> 4. Elimina din favorites
    await User.updateMany(
      { favouriteFlatList: { $in: flatIds } },
      { $pull: { favouriteFlatList: { $in: flatIds } } }
    );

    //-> 5. Sterge user-ul
    await User.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      status: "failed",
      message: "Error deleting user account",
      error: error.message,
    });
  }
};

//* Update password *//
exports.updatePassword = async (request, response) => {
  try {
    const currentUser = request.currentUser;
    
    //-> Verificare daca este pentru alt user (admin editing)
    const targetUserId = request.body.userId || currentUser.id;
    const isAdminEditingOtherUser = targetUserId !== currentUser.id;
    
    //-> Verificare permisiuni: user-ul insusi sau adminul
    if (isAdminEditingOtherUser && currentUser.isAdmin !== "admin") {
      return response.status(403).json({
        success: false,
        message: "You can only change your own password or you need admin privileges",
      });
    }

    //-> 1. Pentru admin editing alt user - logica diferita
    if (isAdminEditingOtherUser) {
      const { newPassword, confirmNewPassword } = request.body;

      if (!newPassword || !confirmNewPassword) {
        return response.status(400).json({
          success: false,
          message: "Please provide new password and confirmation",
        });
      }

      if (newPassword !== confirmNewPassword) {
        return response.status(400).json({
          success: false,
          message: "New passwords do not match",
        });
      }

      //-> Validare parola
      if (!/^(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword)) {
        return response.status(400).json({
          success: false,
          message: "Password must have at least 8 characters, 1 number, and 1 special character",
        });
      }

      //-> Gaseste user-ul target
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return response.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      //-> Seteaza noua parola fara sa verifice parola curenta
      targetUser.password = newPassword;
      targetUser.passwordChangedAt = Date.now();
      //-> Invalideaza token-ul userului (daca acesta e logat, va trebui sa faca login)
      targetUser.activeToken = null; 
      await targetUser.save();

      return response.status(200).json({
        success: true,
        message: `Password changed successfully for user ${targetUser.firstName} ${targetUser.lastName}. They will need to login again.`,
      });
    }

    //-> 2. Pentru user-ul care-si schimba propria parola
    const { currentPassword, newPassword, confirmNewPassword } = request.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return response.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    //-> Verifica daca parolele noi se potrivesc
    if (newPassword !== confirmNewPassword) {
      return response.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    //-> Validare parola
    if (!/^(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword)) {
      return response.status(400).json({
        success: false,
        message: "Password must have at least 8 characters, 1 number, and 1 special character",
      });
    }

    //-> Gaseste user-ul cu parola
    const user = await User.findById(currentUser.id).select("+password");

    //-> Verifica parola curenta
    if (!(await user.comparePass(currentPassword))) {
      return response.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    //-> Seteaza noua parola
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    //-> Invalidează token-ul
    user.activeToken = null; 
    await user.save();

    return response.status(200).json({
      success: true,
      message: "Password changed successfully. Please login with your new password.",
    });

  } catch (error) {
    return response.status(500).json({
      success: false,
      message: "Error updating password",
      error: error.message,
    });
  }
};

//* Schimbare rol user din admin in regular user si invers *//
exports.changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser;

    //-> Verificare ca doar admin poate schimba roluri
    if (currentUser.isAdmin !== "admin") {
      return res.status(403).json({
        status: "failed",
        message: "Only admins can change user roles",
      });
    }

    //-> Gaseste user-ul care urmeaza sa fie modificat
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    //-> Admin nu poate sa-si schimbe propriul rol
    if (userToUpdate._id.toString() === currentUser.id) {
      return res.status(400).json({
        status: "failed",
        message: "You cannot change your own role",
      });
    }

    //-> Toggle între "admin" si "regular_user"
    const newRole = userToUpdate.isAdmin === "admin" ? "regular_user" : "admin";

    //-> Update role
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        isAdmin: newRole,
        updatedAt: Date.now(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -activeToken -passwordChangedAt");

    res.status(200).json({
      status: "success",
      message: `User role changed to ${newRole}`,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error changing user role",
      error: error.message,
    });
  }
};

//* Lista apartamentelor favorite cu paginare *//
exports.getUserFavoritesFlats = async (req, res) => {
  try {
    // const { page = 1, limit = 12, sort, ...filters } = req.query;
    const { page = 1, limit = 12 } = req.query;
    const currentUserId = req.currentUser.id;

    //-> 1. Lista apartamente favorite cu ID-ul apartamentului
    const User = require("../Models/userModel");
    const user = await User.findById(currentUserId).select("favouriteFlatList");

    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "User not found",
      });
    }

    const favoriteIds = user.favouriteFlatList || [];

    if (favoriteIds.length === 0) {
      return res.status(200).json({
        status: "success",
        results: 0,
        totalResults: 0,
        currentPage: Number(page),
        totalPages: 0,
        data: [],
      });
    }

    //-> 2. Filtru pentru apartamente (doar favorite)
    const filter = { _id: { $in: favoriteIds } };

    // //-> 3. Add additional filters if provided
    // for (const key in filters) {
    //   if (!filters[key]) continue;

    //   if (filters[key].includes(",")) {
    //     filter[key] = { $in: filters[key].split(",") };
    //   } else if (filters[key].includes("-")) {
    //     const [min, max] = filters[key].split("-");
    //     filter[key] = { $gte: Number(min), $lte: Number(max) };
    //   } else if (key === "city") {
    //     filter[key] = { $regex: filters[key], $options: "i" };
    //   } else {
    //     filter[key] = filters[key];
    //   }
    // }

    // //-> 4. Build sort object
    // const sortObj = {};
    // if (sort) {
    //   const sortFields = sort.split(",");
    //   sortFields.forEach((field) => {
    //     const order = field.startsWith("-") ? -1 : 1;
    //     const fieldName = field.replace("-", "");

    //     const allowedSortFields = [
    //       "city",
    //       "rentPrice",
    //       "areaSize",
    //       "yearBuilt",
    //       "dateAvailable",
    //       "createdAt",
    //     ];
    //     if (allowedSortFields.includes(fieldName)) {
    //       sortObj[fieldName] = order;
    //     }
    //   });
    // } else {
    //   // Default sort by creation date (newest first)
    //   sortObj.createdAt = -1;
    // }

    //-> 5. Pagination
    const skip = (page - 1) * limit;

    //-> 6. Execute query
    const Flat = require("../Models/flatModel");
    const favoriteFlats = await Flat.find(filter)
      // .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate("ownerId", "firstName lastName email");

    //-> 7. Calculate total for pagination
    const totalFavorites = await Flat.countDocuments(filter);
    const totalPages = Math.ceil(totalFavorites / limit);

    res.status(200).json({
      status: "success",
      results: favoriteFlats.length,
      totalResults: totalFavorites,
      currentPage: Number(page),
      totalPages: totalPages,
      // filters: filter,
      // sorting: sortObj,
      data: favoriteFlats,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error fetching favorite flats",
      error: error.message,
    });
  }
};

//* Verificare existenta email in DB *//
exports.checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        status: "failed",
        message: "Email is required"
      });
    }

    const existingUser = await User.findOne({ email });
    
    res.status(200).json({
      status: "success",
      exists: !!existingUser, // convertește la boolean
      available: !existingUser
    });
    
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error checking email availability",
      error: error.message
    });
  }
};