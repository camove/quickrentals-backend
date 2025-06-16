const Flat = require("../Models/flatModel");

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

    //-> Path-ul corect: din backend root către uploads/filename
        const fullPath = path.join(__dirname, "..", "uploads", cleanImagePath);

    console.log(`Attempting to delete: ${fullPath}`);

    //-> Verificam dacă fisierul exista inainte sa-l stergem
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

//* Creare apartament *//
exports.createFlat = async (req, res) => {
  try {
    const {
      city,
      streetName,
      streetNumber,
      areaSize,
      hasAc,
      yearBuilt,
      rentPrice,
      dateAvailable,
      flatImages,
      createdAt,
    } = req.body;
    let imagePaths = ["default.jpg"]; //preia imaginea default
    if (req.files && req.files.length > 0) {
      imagePaths = req.files.map((file) => `/uploads/${file.filename}`);
    }

    const newFlat = new Flat({
      city,
      streetName,
      streetNumber,
      areaSize,
      hasAc,
      yearBuilt,
      rentPrice,
      dateAvailable,
      flatImages: imagePaths,
      ownerId: req.currentUser.id,
    });
    const savedFlat = await newFlat.save();

    return res.status(201).json({
      status: "succes",
      data: savedFlat,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

//* Apartament dupa ID *//
exports.getFlatById = async (req, res) => {
  try {
    const foundFlat = await Flat.findById(req.params.id).populate(
      "ownerId",
      "firstName lastName email"
    );

    if (!foundFlat) {
      return res.status(404).json({
        status: "failed",
        message: `Flat with id ${req.params.id} was not found`,
      });
    }
    res.status(200).json({
      status: "Succes",
      data: foundFlat,
    });
  } catch (error) {
    res.status(500).json({
      status: "Something went wrong",
      error: error.message,
    });
  }
};

//* Lista tuturor apartamentelor cu filtre si sortare *//
exports.getAllFlats = async (req, res) => {
  try {
    const { page = 1, limit = 12, sort, ...filters } = req.query; 

    //-> Construim obiectul de filtrare din query params
    const filter = {};
    
    for (const key in filters) {
      console.log(`Processing filter: ${key} = ${filters[key]}`);

      //-> TRATARE SPECIALA PENTRU CITY (rezolvat diacritice, Cluj-Napoca = din cauza "-"" trecea in logica de range)
      if (key === "city") {
        if (filters[key].includes(",")) {
          //-> Orase multiple - folosim $or cu $regex pentru fiecare
          const cities = filters[key].split(",").map(city => city.trim());
          filter.$or = cities.map(city => ({
            city: { $regex: city, $options: "i" }
          }));
          console.log("Multiple cities filter:", filter.$or);
        } else {
          //-> Un singur oras - folosim $regex simplu
          filter[key] = { $regex: filters[key].trim(), $options: "i" };
          console.log("Single city filter:", filter[key]);
        }
      }
      //-> TRATARE PENTRU RANGE-URI NUMERICE (doar pentru campuri numerice)
      else if (filters[key].includes("-") && (key === "rentPrice" || key === "areaSize" || key.includes("Price") || key.includes("Area"))) {
        const [min, max] = filters[key].split("-");
        const minNum = Number(min);
        const maxNum = Number(max);
        
        //-> Verificam daca sunt numere valide
        if (!isNaN(minNum) && !isNaN(maxNum)) {
          filter[key] = { $gte: minNum, $lte: maxNum };
          console.log(`Range filter for ${key}:`, filter[key]);
        } else {
          console.log(`Invalid range values for ${key}: ${min}-${max}`);
        }
      }
      //-> TRATARE PENTRU ALTE CAMPURI CU VIRGULĂ (non-city)
      else if (filters[key].includes(",")) {
        filter[key] = { $in: filters[key].split(",").map(val => val.trim()) };
        console.log(`Multiple values filter for ${key}:`, filter[key]);
      }
      //-> TRATARE PENTRU ALTE FILTRE SIMPLE
      else {
        filter[key] = filters[key];
        console.log(`Simple filter for ${key}:`, filter[key]);
      }
    }

    //-> Construim obiectul de sortare din query params
    const sortObj = {};
    if (sort) {
      const sortFields = sort.split(",");
      sortFields.forEach((field) => {
        const order = field.startsWith("-") ? -1 : 1;
        const fieldName = field.replace("-", "");

        //-> Verificam daca field-ul e valid pentru sortare
        const allowedSortFields = [
          "city",
          "rentPrice",
          "areaSize",
          "yearBuilt",
          "dateAvailable",
          "createdAt", //pentru sortare după data creării
        ];
        if (allowedSortFields.includes(fieldName)) {
          sortObj[fieldName] = order;
        }
      });
      console.log("Sort object:", sortObj);
    } else {
      //-> Sortare implicita -> cele mai noi, primele
      sortObj.createdAt = -1;
    }

    //-> Paginare
    const skip = (page - 1) * limit;

    console.log("Final filter object:", JSON.stringify(filter, null, 2));

    //-> Executam query-ul
    const flats = await Flat.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate("ownerId", "firstName lastName email");

    //-> Calculam total pentru paginare
    const totalFlats = await Flat.countDocuments(filter);
    const totalPages = Math.ceil(totalFlats / limit);

    res.status(200).json({
      status: "success",
      results: flats.length,
      totalResults: totalFlats,
      currentPage: Number(page),
      totalPages: totalPages,
      filters: filter,
      sorting: sortObj,
      data: flats,
    });
  } catch (error) {
    console.error("Error in getAllFlats:", error);
    res.status(500).json({
      status: "Something went wrong",
      error: error.message,
    });
  }
};

//* Lista apartamentelor in functie de user *//
exports.getMyFlats = async (req, res) => {
  try {
    // const { page = 1, limit = 12, sort, ...filters } = req.query;
    const { page = 1, limit = 12 } = req.query;
    const currentUserId = req.currentUser.id;

    // Construim filtrul cu ownerId automat
    const filter = { ownerId: currentUserId };

    // Adăugăm filtrele suplimentare (city, price, etc.)
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

    // Construim sortarea
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

    // Paginare
    const skip = (page - 1) * limit;

    // Executăm query-ul
    const myFlats = await Flat.find(filter)
      // .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate("ownerId", "firstName lastName email");

    // Calculăm total pentru paginare
    const totalFlats = await Flat.countDocuments(filter);
    const totalPages = Math.ceil(totalFlats / limit);

    res.status(200).json({
      status: "success",
      results: myFlats.length,
      totalResults: totalFlats,
      currentPage: Number(page),
      totalPages: totalPages,
      // filters: filter,
      // sorting: sortObj,
      data: myFlats,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error fetching your flats",
      error: error.message,
    });
  }
};

//* Actualizare date apartament *//
exports.updateFlatById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser;

    //-> Gaseste apartamentul
    const existingFlat = await Flat.findById(id);
    if (!existingFlat) {
      return res.status(404).json({
        status: "failed",
        message: "Flat not found",
      });
    }

    //-> Verifica permisiuni: doar owner sau admin
    if (
      existingFlat.ownerId.toString() !== currentUser.id &&
      currentUser.isAdmin !== "admin"
    ) {
      return res.status(403).json({
        status: "failed",
        message: "You can only update your own flats",
      });
    }

    //-> Campuri permise pentru update
    const allowedFields = [
      "city",
      "streetName",
      "streetNumber",
      "areaSize",
      "hasAc",
      "yearBuilt",
      "rentPrice",
      "dateAvailable",
      "flatImages",
    ];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    //-> Daca sunt uploadate imagini noi, sterge pe cele vechi
    if (req.files && req.files.length > 0) {
      // Sterge imaginile vechi (dacă nu sunt default)
      if (existingFlat.flatImages && existingFlat.flatImages.length > 0) {
        deleteImageFiles(existingFlat.flatImages);
      }

      // Adauga imaginile noi
      updateData.flatImages = req.files.map(
        (file) => `/uploads/${file.filename}`
      );
    }

    updateData.updatedAt = Date.now();

    //-> Update cu validare
    const updatedFlat = await Flat.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("ownerId", "firstName lastName email");

    res.status(200).json({
      status: "success",
      data: updatedFlat,
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error updating flat",
      error: error.message,
    });
  }
};

//** Stergere apartament *//
exports.deleteFlatById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser;

    //-> Gaseste apartamentul
    const existingFlat = await Flat.findById(id);
    if (!existingFlat) {
      return res.status(404).json({
        status: "failed",
        message: "Flat not found",
      });
    }

    //-> Verifica permisiuni: doar owner sau admin
    if (
      existingFlat.ownerId.toString() !== currentUser.id &&
      currentUser.isAdmin !== "admin"
    ) {
      return res.status(403).json({
        status: "failed",
        message: "You can only delete your own flats",
      });
    }

    //-> Sterge pozele din filesystem folosind functia ajutatoare
    if (existingFlat.flatImages && existingFlat.flatImages.length > 0) {
      deleteImageFiles(existingFlat.flatImages);
    }

    //-> Sterge toate mesajele asociate cu acest apartament
    const Message = require("../Models/messageModel");
    await Message.deleteMany({ flatId: id });

    //-> Elimina apartamentul din favouriteFlatList ale tuturor utilizatorilor
    const User = require("../Models/userModel");
    await User.updateMany(
      { favouriteFlatList: id },
      { $pull: { favouriteFlatList: id } }
    );

    //-> Sterge apartamentul
    await Flat.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Flat and all associated data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      message: "Error deleting flat",
      error: error.message,
    });
  }
};
