const Flat = require("../Models/flatModel");

//* Lista tuturor apartamentelor pe landing page *//
exports.getLandingFlats = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        
        //-> paginare, fara filtre
        const skip = (page - 1) * limit;
        
        //-> Select info minime pentru preview
        const flats = await Flat.find({})
            .select('city rentPrice flatImages') // Doar oraș, preț și o imagine
            .sort({ createdAt: -1 }) // Cele mai noi primul
            .skip(skip)
            .limit(Number(limit));

        //-> Transform pentru frontend - doar prima poza
        const simplifiedFlats = flats.map(flat => ({
            _id: flat._id,
            city: flat.city,
            rentPrice: flat.rentPrice,
            mainImage: flat.flatImages && flat.flatImages.length > 0 ? flat.flatImages[0] : 'default.jpg'
        }));

        const totalFlats = await Flat.countDocuments({});
        const totalPages = Math.ceil(totalFlats / limit);

        res.status(200).json({
            status: "success",
            results: flats.length,
            totalResults: totalFlats,
            currentPage: Number(page),
            totalPages: totalPages,
            message: "Create an account to see full details and search filters!",
            data: simplifiedFlats
        });

    } catch (error) {
        res.status(500).json({
            status: "failed",
            message: "Error loading flats preview",
            error: error.message
        });
    }
};